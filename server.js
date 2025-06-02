require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Database = require('better-sqlite3');
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

// データベース接続（better-sqlite3を使用）
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/secure-chat.db';
let db;

try {
  console.log(`🗄️ データベース接続中: ${dbPath}`);
  db = new Database(dbPath);
  
  // WALモード有効化（パフォーマンス向上）
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  console.log('✅ データベース接続成功');
  
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
    const result = db.prepare('SELECT 1 as test').get();
    
    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: result ? 'Connected' : 'Disconnected',
      version: process.env.npm_package_version || '1.0.0',
      dbPath: dbPath.replace(process.cwd(), '.')
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  try {
    // データベース接続テスト
    const result = db.prepare('SELECT 1 as test').get();
    
    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: result ? 'Connected' : 'Disconnected',
      version: process.env.npm_package_version || '1.0.0',
      dbPath: dbPath.replace(process.cwd(), '.'),
      endpoint: '/api/health' // デバッグ用
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
    const spacesCount = db.prepare('SELECT COUNT(*) as count FROM spaces').get();
    const messagesCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0').get();
    const activeSpaces = db.prepare(`SELECT COUNT(*) as count FROM spaces WHERE last_activity_at > datetime('now', '-24 hours')`).get();
    
    res.json({
      success: true,
      stats: {
        totalSpaces: spacesCount.count,
        activeSpaces: activeSpaces.count,
        totalMessages: messagesCount.count,
        uptime: process.uptime(),
        dbSize: require('fs').statSync(dbPath).size
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Socket.IO接続処理
const connectedUsers = new Map();

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
      const roomSize = io.sockets.adapter.rooms.get(userInfo.spaceId)?.size || 0;
      io.to(userInfo.spaceId).emit('room-info', { userCount: roomSize });
      connectedUsers.delete(socket.id);
    }
  });
  
  socket.on('error', (error) => {
    console.error(`🐛 Socket.IOエラー (${socket.id}):`, error);
  });
});

// メッセージクリーンアップ処理（1分ごと）
const cleanupExpiredMessages = () => {
  try {
    const result = db.prepare(`
      UPDATE messages 
      SET is_deleted = 1 
      WHERE expires_at <= datetime('now') AND is_deleted = 0
    `).run();
    
    if (result.changes > 0) {
      console.log(`🗑️ 期限切れメッセージを削除: ${result.changes}件`);
    }
  } catch (error) {
    console.error('❌ メッセージクリーンアップエラー:', error);
  }
};

const cleanupInterval = setInterval(cleanupExpiredMessages, 60000);

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
  
  try {
    const spacesCount = db.prepare('SELECT COUNT(*) as count FROM spaces').get();
    const messagesCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0').get();
    console.log(`📋 データベース状況: ${spacesCount.count}個の空間, ${messagesCount.count}件のメッセージ`);
  } catch (error) {
    console.warn('⚠️ データベース状況取得に失敗:', error.message);
  }
  
  console.log('\n✅ サーバー準備完了！');
});

// グレースフルシャットダウン
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} を受信。サーバーを停止中...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ サーバー停止エラー:', err);
      process.exit(1);
    }
    
    console.log('✅ サーバーが正常に停止しました');
    
    clearInterval(cleanupInterval);
    
    if (db) {
      try {
        db.close();
        console.log('✅ データベース接続を閉じました');
      } catch (error) {
        console.error('❌ データベース切断エラー:', error);
      }
    }
    
    io.close(() => {
      console.log('✅ WebSocket接続を閉じました');
      process.exit(0);
    });
  });
  
  setTimeout(() => {
    console.error('❌ シャットダウンタイムアウト');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('🔥 未処理例外:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 未処理Promise拒否:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = { app, server, io, db };