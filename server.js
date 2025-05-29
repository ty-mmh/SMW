require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Database = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);

// Socket.IO設定
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

// データベース接続
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/secure-chat.db';
let db;

try {
  db = new Database.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ データベース接続エラー:', err);
      process.exit(1);
    }
    console.log('✅ データベース接続成功:', dbPath);
  });
  
} catch (error) {
  console.error('❌ データベース接続エラー:', error);
  process.exit(1);
}

// ミドルウェア設定
app.use(helmet({
  contentSecurityPolicy: false // 開発環境用
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : "*",
  credentials: true
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// APIルート読み込み
app.use('/api/spaces', require('./routes/spaces')(db));
app.use('/api/messages', require('./routes/messages')(db));

// ヘルスチェック
app.get('/health', (req, res) => {
  try {
    // データベース接続テスト
    db.get('SELECT 1 as test', (err, result) => {
      if (err) {
        res.status(500).json({
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          error: err.message
        });
      } else {
        res.json({ 
          status: 'OK',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          database: result ? 'Connected' : 'Disconnected',
          version: process.env.npm_package_version || '1.0.0'
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API統計情報
app.get('/api/stats', (req, res) => {
  try {
    db.get('SELECT COUNT(*) as count FROM spaces', (err, spacesCount) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      db.get('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0', (err, messagesCount) => {
        if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        
        db.get(`SELECT COUNT(*) as count FROM spaces WHERE last_activity_at > datetime('now', '-24 hours')`, (err, activeSpaces) => {
          if (err) {
            return res.status(500).json({ success: false, error: err.message });
          }
          
          res.json({
            success: true,
            stats: {
              totalSpaces: spacesCount.count,
              activeSpaces: activeSpaces.count,
              totalMessages: messagesCount.count,
              uptime: process.uptime()
            }
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Socket.IO接続処理
const connectedUsers = new Map(); // 接続中ユーザー管理

io.on('connection', (socket) => {
  console.log(`🔌 ユーザー接続: ${socket.id}`);
  
  // 空間参加
  socket.on('join-space', (spaceId) => {
    if (!spaceId) return;
    
    socket.join(spaceId);
    connectedUsers.set(socket.id, { spaceId, joinedAt: new Date() });
    
    console.log(`📥 ユーザー ${socket.id} が空間 ${spaceId} に参加`);
    
    // その空間の参加者数を通知
    const roomSize = io.sockets.adapter.rooms.get(spaceId)?.size || 0;
    io.to(spaceId).emit('room-info', { userCount: roomSize });
  });
  
  // 空間退出
  socket.on('leave-space', (spaceId) => {
    if (!spaceId) return;
    
    socket.leave(spaceId);
    console.log(`📤 ユーザー ${socket.id} が空間 ${spaceId} から退出`);
    
    // 参加者数更新
    const roomSize = io.sockets.adapter.rooms.get(spaceId)?.size || 0;
    io.to(spaceId).emit('room-info', { userCount: roomSize });
  });
  
  // 新規メッセージ配信
  socket.on('new-message', (data) => {
    if (!data.spaceId || !data.message) return;
    
    console.log(`📨 メッセージ配信: 空間 ${data.spaceId}`);
    
    // 送信者以外に配信
    socket.to(data.spaceId).emit('message-received', {
      message: data.message,
      from: socket.id
    });
  });
  
  // タイピング状態通知
  socket.on('typing', (data) => {
    if (!data.spaceId) return;
    
    socket.to(data.spaceId).emit('user-typing', {
      userId: socket.id,
      isTyping: data.isTyping
    });
  });
  
  // 接続切断
  socket.on('disconnect', (reason) => {
    console.log(`❌ ユーザー切断: ${socket.id} (理由: ${reason})`);
    
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      // 空間の参加者数更新
      const roomSize = io.sockets.adapter.rooms.get(userInfo.spaceId)?.size || 0;
      io.to(userInfo.spaceId).emit('room-info', { userCount: roomSize });
      
      connectedUsers.delete(socket.id);
    }
  });
  
  // エラーハンドリング
  socket.on('error', (error) => {
    console.error(`🐛 Socket.IOエラー (${socket.id}):`, error);
  });
});

// メッセージクリーンアップ処理（1分ごと）
const cleanupExpiredMessages = () => {
  try {
    db.run(`
      UPDATE messages 
      SET is_deleted = 1 
      WHERE expires_at <= datetime('now') AND is_deleted = 0
    `, function(err) {
      if (err) {
        console.error('❌ メッセージクリーンアップエラー:', err);
      } else if (this.changes > 0) {
        console.log(`🗑️ 期限切れメッセージを削除: ${this.changes}件`);
      }
    });
  } catch (error) {
    console.error('❌ メッセージクリーンアップエラー:', error);
  }
};

// 定期クリーンアップ開始
const cleanupInterval = setInterval(cleanupExpiredMessages, 60000);

// デバッグ情報表示（開発環境のみ）
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    const connections = connectedUsers.size;
    const rooms = io.sockets.adapter.rooms.size;
    
    if (connections > 0) {
      console.log(`📊 接続状況: ${connections}人接続中, ${rooms}個の空間がアクティブ`);
    }
  }, 30000);
}

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Path ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// エラーハンドラー
app.use((error, req, res, next) => {
  console.error('🐛 サーバーエラー:', error);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('\n🚀 セキュアチャットサーバーが起動しました');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ データベース: ${dbPath}`);
  console.log(`⏰ 起動時刻: ${new Date().toLocaleString('ja-JP')}`);
  
  // 初期データ確認
  try {
    db.get('SELECT COUNT(*) as count FROM spaces', (err, spacesCount) => {
      if (err) {
        console.warn('⚠️ データベース状況取得に失敗:', err.message);
      } else {
        db.get('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0', (err, messagesCount) => {
          if (err) {
            console.warn('⚠️ データベース状況取得に失敗:', err.message);
          } else {
            console.log(`📋 データベース状況: ${spacesCount.count}個の空間, ${messagesCount.count}件のメッセージ`);
          }
        });
      }
    });
  } catch (error) {
    console.warn('⚠️ データベース状況取得に失敗:', error.message);
  }
  
  console.log('\n✅ サーバー準備完了！');
});

// グレースフルシャットダウン
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} を受信しました。サーバーを停止しています...`);
  
  // 新しい接続を拒否
  server.close((err) => {
    if (err) {
      console.error('❌ サーバー停止エラー:', err);
      process.exit(1);
    }
    
    console.log('✅ サーバーが正常に停止しました');
    
    // クリーンアップ処理
    clearInterval(cleanupInterval);
    
    // データベース接続を閉じる
    if (db) {
      try {
        db.close((err) => {
          if (err) {
            console.error('❌ データベース切断エラー:', err);
          } else {
            console.log('✅ データベース接続を閉じました');
          }
          process.exit(0);
        });
      } catch (error) {
        console.error('❌ データベース切断エラー:', error);
        process.exit(1);
      }
    } else {
      process.exit(0);
    }
    
    // Socket.IO接続を閉じる
    io.close(() => {
      console.log('✅ WebSocket接続を閉じました');
      process.exit(0);
    });
  });
  
  // 強制終了タイマー（30秒）
  setTimeout(() => {
    console.error('❌ グレースフルシャットダウンがタイムアウトしました');
    process.exit(1);
  }, 30000);
};

// シグナルハンドラー登録
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未処理エラーをキャッチ
process.on('uncaughtException', (error) => {
  console.error('🔥 未処理例外:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 未処理Promise拒否:', reason);
  console.error('Promise:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = { app, server, io, db };