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

// Socket.IO設定（FRIENDLYモード対応）
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
      dbPath: dbPath.replace(process.cwd(), '.'),
      friendlyMode: 'Socket.IO統合強化版'
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
      endpoint: '/api/health', // デバッグ用
      friendlyMode: 'Socket.IO統合強化版'
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
    
    // Socket.IO統計情報を追加
    const socketStats = {
      connectedClients: connectedUsers.size,
      activeSpaces: Array.from(io.sockets.adapter.rooms.keys()).filter(key => !key.startsWith('/')).length,
      totalRooms: io.sockets.adapter.rooms.size
    };
    
    res.json({
      success: true,
      stats: {
        totalSpaces: spacesCount.count,
        activeSpaces: activeSpaces.count,
        totalMessages: messagesCount.count,
        uptime: process.uptime(),
        dbSize: require('fs').statSync(dbPath).size,
        ...socketStats
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

// =============================================================================
// 🚀 Socket.IO FRIENDLYモード統合機能
// =============================================================================

// 接続ユーザー管理（FRIENDLYモード拡張）
const connectedUsers = new Map();

// 空間ごとのセッション管理
const spaceSessionMap = new Map(); // spaceId -> Set<sessionId>

// 暗号化キー交換管理（将来の実装用）
const keyExchangeRequests = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 FRIENDLYモード ユーザー接続: ${socket.id}`);
  
  // =============================================================================
  // 基本的な空間管理
  // =============================================================================
  
  // 空間参加（FRIENDLYモード対応）
  socket.on('join-space', (spaceId) => {
    if (!spaceId) {
      socket.emit('error', { message: '空間IDが必要です' });
      return;
    }
    
    socket.join(spaceId);
    
    // ユーザー情報を記録
    const userInfo = {
      spaceId,
      joinedAt: new Date(),
      lastActivity: new Date(),
      sessionId: null // セッション情報で後で設定
    };
    connectedUsers.set(socket.id, userInfo);
    
    // 空間の参加者数を更新
    const roomSize = io.sockets.adapter.rooms.get(spaceId)?.size || 0;
    
    console.log(`📥 FRIENDLYモード 空間参加: ${socket.id} → ${spaceId} (${roomSize}人)`);
    
    // 🆕 FRIENDLYモード: 空間情報を送信
    socket.emit('space-joined', {
      spaceId,
      userCount: roomSize,
      timestamp: new Date().toISOString()
    });
    
    // 他の参加者に新規参加を通知
    socket.to(spaceId).emit('user-joined', {
      userId: socket.id,
      userCount: roomSize,
      timestamp: new Date().toISOString()
    });
    
    // 空間全体に参加者数更新を通知
    io.to(spaceId).emit('room-info', { 
      userCount: roomSize,
      activeUsers: Array.from(io.sockets.adapter.rooms.get(spaceId) || [])
    });
  });
  
  // =============================================================================
  // 🆕 FRIENDLYモード セッション管理
  // =============================================================================
  
  // セッション情報登録（新規追加）
  socket.on('session-info', (data) => {
    if (!data.sessionId || !data.spaceId) {
      socket.emit('error', { message: 'セッション情報が不完全です' });
      return;
    }
    
    console.log(`👤 セッション情報登録: ${socket.id} → ${data.sessionId.substring(0, 12)}...`);
    
    // ユーザー情報にセッションIDを追加
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.sessionId = data.sessionId;
      userInfo.lastActivity = new Date();
    }
    
    // 空間のセッション管理に追加
    if (!spaceSessionMap.has(data.spaceId)) {
      spaceSessionMap.set(data.spaceId, new Set());
    }
    spaceSessionMap.get(data.spaceId).add(data.sessionId);
    
    // その空間の全ユーザーにセッション参加を通知
    socket.to(data.spaceId).emit('session-joined', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      userId: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // 🆕 セッション統計情報を送信
    const activeSessions = spaceSessionMap.get(data.spaceId);
    const sessionCount = activeSessions ? activeSessions.size : 1;
    
    console.log(`📊 空間 ${data.spaceId} セッション数: ${sessionCount}`);
    
    // 空間全体にセッション数更新を通知（暗号化レベル判定用）
    io.to(data.spaceId).emit('session-count-updated', {
      spaceId: data.spaceId,
      sessionCount: sessionCount,
      encryptionLevel: sessionCount > 1 ? 'hybrid' : 'deterministic',
      timestamp: new Date().toISOString()
    });
    
    socket.emit('session-registered', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      sessionCount: sessionCount
    });
  });
  
  // セッション活性度更新（新規追加）
  socket.on('session-activity', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo && userInfo.sessionId) {
      userInfo.lastActivity = new Date();
      
      // 必要に応じて他のユーザーに活性度更新を通知
      if (data.notifyOthers) {
        socket.to(userInfo.spaceId).emit('session-activity-update', {
          sessionId: userInfo.sessionId,
          userId: socket.id,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  
  // =============================================================================
  // 🆕 FRIENDLYモード 暗号化レベル同期
  // =============================================================================
  
  // 暗号化レベル変更通知（新規追加）
  socket.on('encryption-level-changed', (data) => {
    if (!data.spaceId || !data.encryptionLevel) return;
    
    console.log(`🔒 暗号化レベル変更: ${data.spaceId} → ${data.encryptionLevel}`);
    
    // 同じ空間の他のユーザーに暗号化レベル変更を通知
    socket.to(data.spaceId).emit('encryption-level-updated', {
      spaceId: data.spaceId,
      encryptionLevel: data.encryptionLevel,
      sessionCount: data.sessionCount || 1,
      triggeredBy: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // 🆕 暗号化キー交換要求（基本実装・将来の拡張用）
  socket.on('key-exchange-request', (data) => {
    if (!data.spaceId || !data.publicKey) {
      socket.emit('error', { message: 'キー交換データが不完全です' });
      return;
    }
    
    console.log(`🔑 キー交換要求: ${socket.id} → ${data.spaceId}`);
    
    const exchangeId = `exchange_${Date.now()}_${socket.id.substring(0, 8)}`;
    keyExchangeRequests.set(exchangeId, {
      fromUser: socket.id,
      spaceId: data.spaceId,
      publicKey: data.publicKey,
      timestamp: new Date(),
      status: 'pending'
    });
    
    // 同じ空間の他のユーザーにキー交換要求を転送
    socket.to(data.spaceId).emit('key-exchange-request', {
      exchangeId,
      fromUser: socket.id,
      publicKey: data.publicKey,
      spaceId: data.spaceId,
      timestamp: new Date().toISOString()
    });
    
    // 要求者に確認を送信
    socket.emit('key-exchange-initiated', {
      exchangeId,
      spaceId: data.spaceId,
      status: 'sent'
    });
  });
  
  // キー交換応答（基本実装）
  socket.on('key-exchange-response', (data) => {
    if (!data.exchangeId || !data.publicKey) return;
    
    const exchangeRequest = keyExchangeRequests.get(data.exchangeId);
    if (!exchangeRequest) {
      socket.emit('error', { message: 'キー交換要求が見つかりません' });
      return;
    }
    
    console.log(`🔑 キー交換応答: ${socket.id} → ${data.exchangeId}`);
    
    // 要求者に応答を転送
    const targetSocket = io.sockets.sockets.get(exchangeRequest.fromUser);
    if (targetSocket) {
      targetSocket.emit('key-exchange-response', {
        exchangeId: data.exchangeId,
        fromUser: socket.id,
        publicKey: data.publicKey,
        spaceId: exchangeRequest.spaceId,
        timestamp: new Date().toISOString()
      });
    }
    
    // 交換完了をマーク
    exchangeRequest.status = 'completed';
    exchangeRequest.completedAt = new Date();
    
    socket.emit('key-exchange-completed', {
      exchangeId: data.exchangeId,
      status: 'completed'
    });
  });
  
  // =============================================================================
  // メッセージ配信（FRIENDLYモード対応強化）
  // =============================================================================
  
  // 新規メッセージ配信（強化版）
  socket.on('new-message', (data) => {
    if (!data.spaceId || !data.message) {
      socket.emit('error', { message: 'メッセージデータが不完全です' });
      return;
    }
    
    console.log(`📨 FRIENDLYモード メッセージ配信: 空間 ${data.spaceId}`);
    
    // セッション活性度更新
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.lastActivity = new Date();
    }
    
    // 🆕 FRIENDLYモード: 暗号化情報を含む配信
    const messageData = {
      message: data.message,
      from: socket.id,
      spaceId: data.spaceId,
      timestamp: new Date().toISOString(),
      encryptionInfo: data.encryptionInfo || null,
      sessionCount: spaceSessionMap.get(data.spaceId)?.size || 1
    };
    
    // 送信者以外に配信
    socket.to(data.spaceId).emit('message-received', messageData);
    
    // 送信確認を送信者に返す
    socket.emit('message-sent-confirmation', {
      messageId: data.message.id,
      spaceId: data.spaceId,
      timestamp: messageData.timestamp,
      deliveredTo: (io.sockets.adapter.rooms.get(data.spaceId)?.size || 1) - 1
    });
  });
  
  // =============================================================================
  // 空間退出とクリーンアップ
  // =============================================================================
  
  // 空間退出（FRIENDLYモード対応）
  socket.on('leave-space', (spaceId) => {
    if (!spaceId) return;
    
    socket.leave(spaceId);
    
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo && userInfo.sessionId) {
      // セッション管理からも削除
      const spaceSessions = spaceSessionMap.get(spaceId);
      if (spaceSessions) {
        spaceSessions.delete(userInfo.sessionId);
        
        if (spaceSessions.size === 0) {
          spaceSessionMap.delete(spaceId);
        }
        
        // セッション退出を他のユーザーに通知
        socket.to(spaceId).emit('session-left', {
          sessionId: userInfo.sessionId,
          spaceId: spaceId,
          userId: socket.id,
          timestamp: new Date().toISOString()
        });
        
        // セッション数更新通知
        const remainingSessionCount = spaceSessions.size;
        io.to(spaceId).emit('session-count-updated', {
          spaceId: spaceId,
          sessionCount: remainingSessionCount,
          encryptionLevel: remainingSessionCount > 1 ? 'hybrid' : 'deterministic',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    console.log(`📤 FRIENDLYモード 空間退出: ${socket.id} ← ${spaceId}`);
    
    // 参加者数更新
    const roomSize = io.sockets.adapter.rooms.get(spaceId)?.size || 0;
    io.to(spaceId).emit('room-info', { 
      userCount: roomSize,
      activeUsers: Array.from(io.sockets.adapter.rooms.get(spaceId) || [])
    });
    
    // 他のユーザーに退出通知
    socket.to(spaceId).emit('user-left', {
      userId: socket.id,
      userCount: roomSize,
      timestamp: new Date().toISOString()
    });
  });
  
  // =============================================================================
  // その他の機能
  // =============================================================================
  
  // タイピング状態通知
  socket.on('typing', (data) => {
    if (!data.spaceId) return;
    
    socket.to(data.spaceId).emit('user-typing', {
      userId: socket.id,
      isTyping: data.isTyping,
      timestamp: new Date().toISOString()
    });
  });
  
  // 接続切断（FRIENDLYモード対応クリーンアップ）
  socket.on('disconnect', (reason) => {
    console.log(`❌ FRIENDLYモード ユーザー切断: ${socket.id} (理由: ${reason})`);
    
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      const { spaceId, sessionId } = userInfo;
      
      if (spaceId && sessionId) {
        // セッション管理からクリーンアップ
        const spaceSessions = spaceSessionMap.get(spaceId);
        if (spaceSessions) {
          spaceSessions.delete(sessionId);
          
          if (spaceSessions.size === 0) {
            spaceSessionMap.delete(spaceId);
          }
          
          // セッション退出を他のユーザーに通知
          socket.to(spaceId).emit('session-left', {
            sessionId: sessionId,
            spaceId: spaceId,
            userId: socket.id,
            reason: 'disconnect',
            timestamp: new Date().toISOString()
          });
          
          // セッション数更新通知
          const remainingSessionCount = spaceSessions.size;
          io.to(spaceId).emit('session-count-updated', {
            spaceId: spaceId,
            sessionCount: remainingSessionCount,
            encryptionLevel: remainingSessionCount > 1 ? 'hybrid' : 'deterministic',
            reason: 'user_disconnect',
            timestamp: new Date().toISOString()
          });
        }
        
        // 参加者数更新
        const roomSize = io.sockets.adapter.rooms.get(spaceId)?.size || 0;
        io.to(spaceId).emit('room-info', { 
          userCount: roomSize,
          activeUsers: Array.from(io.sockets.adapter.rooms.get(spaceId) || [])
        });
        
        // 他のユーザーに退出通知
        socket.to(spaceId).emit('user-left', {
          userId: socket.id,
          userCount: roomSize,
          reason: 'disconnect',
          timestamp: new Date().toISOString()
        });
      }
      
      connectedUsers.delete(socket.id);
    }
    
    // 進行中のキー交換要求をクリーンアップ
    for (const [exchangeId, request] of keyExchangeRequests) {
      if (request.fromUser === socket.id) {
        keyExchangeRequests.delete(exchangeId);
      }
    }
  });
  
  // Socket.IOエラーハンドリング
  socket.on('error', (error) => {
    console.error(`🐛 FRIENDLYモード Socket.IOエラー (${socket.id}):`, error);
    
    socket.emit('error-response', {
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      socketId: socket.id
    });
  });
});

// =============================================================================
// 定期的なクリーンアップ処理
// =============================================================================

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

// セッション管理クリーンアップ（10分ごと）
const cleanupSessions = () => {
  const now = new Date();
  let cleanedSessions = 0;
  
  // 非アクティブセッションをクリーンアップ
  for (const [socketId, userInfo] of connectedUsers) {
    const inactiveTime = now - userInfo.lastActivity;
    const maxInactiveTime = 30 * 60 * 1000; // 30分
    
    if (inactiveTime > maxInactiveTime) {
      // 該当するSocket.IO接続があるかチェック
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        // 接続が存在しない場合はクリーンアップ
        if (userInfo.spaceId && userInfo.sessionId) {
          const spaceSessions = spaceSessionMap.get(userInfo.spaceId);
          if (spaceSessions) {
            spaceSessions.delete(userInfo.sessionId);
            cleanedSessions++;
          }
        }
        connectedUsers.delete(socketId);
      }
    }
  }
  
  // 空のセッション管理をクリーンアップ
  for (const [spaceId, sessions] of spaceSessionMap) {
    if (sessions.size === 0) {
      spaceSessionMap.delete(spaceId);
    }
  }
  
  // キー交換要求クリーンアップ（1時間以上古い）
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  let cleanedKeyExchanges = 0;
  
  for (const [exchangeId, request] of keyExchangeRequests) {
    if (request.timestamp < oneHourAgo) {
      keyExchangeRequests.delete(exchangeId);
      cleanedKeyExchanges++;
    }
  }
  
  if (cleanedSessions > 0 || cleanedKeyExchanges > 0) {
    console.log(`🧹 セッションクリーンアップ: ${cleanedSessions}セッション, ${cleanedKeyExchanges}キー交換`);
  }
};

const cleanupInterval = setInterval(cleanupExpiredMessages, 60000);
const sessionCleanupInterval = setInterval(cleanupSessions, 10 * 60000);

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
  console.log('\n🚀 FRIENDLYモード Socket.IO統合強化版サーバーが起動しました');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️ データベース: ${dbPath}`);
  console.log(`⏰ 起動時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log('🔗 FRIENDLYモード機能:');
  console.log('  • リアルタイムセッション同期');
  console.log('  • 暗号化レベル自動切り替え');
  console.log('  • キー交換サポート (基本版)');
  console.log('  • 拡張クリーンアップ機能');
  
  try {
    const spacesCount = db.prepare('SELECT COUNT(*) as count FROM spaces').get();
    const messagesCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0').get();
    console.log(`📋 データベース状況: ${spacesCount.count}個の空間, ${messagesCount.count}件のメッセージ`);
  } catch (error) {
    console.warn('⚠️ データベース状況取得に失敗:', error.message);
  }
  
  console.log('\n✅ FRIENDLYモード Socket.IO統合サーバー準備完了！');
});

// グレースフルシャットダウン
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} を受信。FRIENDLYモード サーバーを停止中...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ サーバー停止エラー:', err);
      process.exit(1);
    }
    
    console.log('✅ サーバーが正常に停止しました');
    
    clearInterval(cleanupInterval);
    clearInterval(sessionCleanupInterval);
    
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