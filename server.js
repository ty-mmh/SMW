// server.js - FRIENDLYモード Socket.IO統合サーバー
// セッション管理、暗号化レベル同期、リアルタイム通信

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// データベース初期化
const db = new Database('securechat.db');

// ミドルウェア設定
app.use(express.json());
app.use(express.static('public'));

// セッション管理
const activeSessions = new Map(); // spaceId -> Map<sessionId, socketInfo>
const socketToSession = new Map(); // socketId -> { sessionId, spaceId }
const sessionHeartbeats = new Map(); // sessionId -> lastActivity

// ルート設定
const spacesRouter = require('./routes/spaces')(db);
const messagesRouter = require('./routes/messages')(db);

app.use('/api/spaces', spacesRouter);
app.use('/api/messages', messagesRouter);

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'connected',
    sockets: io.engine.clientsCount,
    activeSessions: activeSessions.size
  });
});

// =============================================================================
// Socket.IO統合イベントハンドリング
// =============================================================================

io.on('connection', (socket) => {
  console.log(`🔌 Socket.IO接続: ${socket.id}`);

  /**
   * 空間参加処理
   */
  socket.on('join-space', (spaceId) => {
    if (!spaceId) return;
    
    console.log(`🏠 空間参加: ${socket.id} -> ${spaceId}`);
    socket.join(spaceId);
    
    // 空間の現在のセッション数を通知
    const spaceInfo = getSpaceInfo(spaceId);
    socket.emit('session-count-updated', {
      spaceId,
      sessionCount: spaceInfo.sessionCount,
      encryptionLevel: spaceInfo.encryptionLevel,
      reason: 'joined_space'
    });
  });

  /**
   * セッション情報登録
   */
  socket.on('session-info', (data) => {
    if (!data.sessionId || !data.spaceId) return;
    
    console.log(`👤 セッション登録: ${data.sessionId.substring(0, 12)}... -> ${data.spaceId}`);
    
    // セッション情報の保存
    if (!activeSessions.has(data.spaceId)) {
      activeSessions.set(data.spaceId, new Map());
    }
    
    const spaceSessions = activeSessions.get(data.spaceId);
    spaceSessions.set(data.sessionId, {
      socketId: socket.id,
      joinedAt: new Date(),
      lastActivity: new Date(),
      isRecovering: data.recoveryMode || false,
      connectionStats: data.connectionStats || {}
    });
    
    // ソケットとセッションの関連付け
    socketToSession.set(socket.id, {
      sessionId: data.sessionId,
      spaceId: data.spaceId
    });
    
    // セッション活性度管理
    sessionHeartbeats.set(data.sessionId, new Date());
    
    // 他のクライアントにセッション参加を通知
    socket.to(data.spaceId).emit('session-joined', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      timestamp: new Date().toISOString()
    });
    
    // 暗号化レベル更新
    updateEncryptionLevel(data.spaceId);
  });

  /**
   * セッション活性度更新
   */
  socket.on('session-activity', (data) => {
    if (!data.sessionId) return;
    
    sessionHeartbeats.set(data.sessionId, new Date());
    
    // セッション情報も更新
    const sessionInfo = socketToSession.get(socket.id);
    if (sessionInfo && activeSessions.has(sessionInfo.spaceId)) {
      const spaceSessions = activeSessions.get(sessionInfo.spaceId);
      const session = spaceSessions.get(data.sessionId);
      if (session) {
        session.lastActivity = new Date();
      }
    }
  });

  /**
   * 新しいメッセージの配信
   */
  socket.on('new-message', (data) => {
    if (!data.spaceId || !data.message) return;
    
    console.log(`💬 新メッセージ配信: ${data.spaceId}`);
    
    // 送信者以外に配信
    socket.to(data.spaceId).emit('message-received', {
      message: data.message,
      from: socket.id,
      encryptionInfo: data.encryptionInfo,
      sessionCount: getSpaceInfo(data.spaceId).sessionCount,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * 暗号化レベル変更通知
   */
  socket.on('encryption-level-changed', (data) => {
    if (!data.spaceId) return;
    
    console.log(`🔒 暗号化レベル変更: ${data.spaceId} -> ${data.encryptionLevel}`);
    
    // 他のクライアントに通知
    socket.to(data.spaceId).emit('encryption-level-updated', {
      spaceId: data.spaceId,
      encryptionLevel: data.encryptionLevel,
      sessionCount: data.sessionCount,
      triggeredBy: socket.id,
      timestamp: data.timestamp
    });
  });

  /**
   * Ping-Pong（接続品質確認）
   */
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });

  /**
   * タイピング状態通知
   */
  socket.on('typing-start', (data) => {
    if (!data.spaceId) return;
    socket.to(data.spaceId).emit('user-typing', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      isTyping: true
    });
  });

  socket.on('typing-stop', (data) => {
    if (!data.spaceId) return;
    socket.to(data.spaceId).emit('user-typing', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      isTyping: false
    });
  });

  /**
   * 空間退出処理
   */
  socket.on('leave-space', (spaceId) => {
    if (!spaceId) return;
    
    console.log(`🚪 空間退出: ${socket.id} -> ${spaceId}`);
    
    handleSessionLeave(socket, spaceId);
    socket.leave(spaceId);
  });

  /**
   * 接続切断処理
   */
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket.IO切断: ${socket.id} (理由: ${reason})`);
    
    const sessionInfo = socketToSession.get(socket.id);
    if (sessionInfo) {
      handleSessionLeave(socket, sessionInfo.spaceId);
    }
    
    socketToSession.delete(socket.id);
  });
});

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * 空間情報取得
 */
function getSpaceInfo(spaceId) {
  const spaceSessions = activeSessions.get(spaceId);
  const sessionCount = spaceSessions ? spaceSessions.size : 0;
  const encryptionLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
  
  return {
    sessionCount,
    encryptionLevel,
    activeSessions: spaceSessions ? Array.from(spaceSessions.keys()) : []
  };
}

/**
 * 暗号化レベル更新
 */
function updateEncryptionLevel(spaceId) {
  const spaceInfo = getSpaceInfo(spaceId);
  
  // 空間の全クライアントに通知
  io.to(spaceId).emit('session-count-updated', {
    spaceId,
    sessionCount: spaceInfo.sessionCount,
    encryptionLevel: spaceInfo.encryptionLevel,
    reason: 'session_change',
    timestamp: new Date().toISOString()
  });
  
  console.log(`🔄 暗号化レベル更新: ${spaceId} -> ${spaceInfo.encryptionLevel} (${spaceInfo.sessionCount}セッション)`);
}

/**
 * セッション退出処理
 */
function handleSessionLeave(socket, spaceId) {
  const sessionInfo = socketToSession.get(socket.id);
  if (!sessionInfo) return;
  
  const { sessionId } = sessionInfo;
  
  // アクティブセッションから削除
  const spaceSessions = activeSessions.get(spaceId);
  if (spaceSessions && spaceSessions.has(sessionId)) {
    spaceSessions.delete(sessionId);
    
    // 空間が空になった場合は削除
    if (spaceSessions.size === 0) {
      activeSessions.delete(spaceId);
    }
    
    // セッション活性度管理からも削除
    sessionHeartbeats.delete(sessionId);
    
    // 他のクライアントにセッション退出を通知
    socket.to(spaceId).emit('session-left', {
      sessionId,
      spaceId,
      timestamp: new Date().toISOString()
    });
    
    // 暗号化レベル更新
    updateEncryptionLevel(spaceId);
    
    console.log(`👤 セッション退出: ${sessionId.substring(0, 12)}... -> ${spaceId}`);
  }
}

// =============================================================================
// 定期的なメンテナンス
// =============================================================================

/**
 * 非アクティブセッションのクリーンアップ
 */
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const inactiveSessions = [];
  
  for (const [sessionId, lastActivity] of sessionHeartbeats) {
    if (lastActivity < fiveMinutesAgo) {
      inactiveSessions.push(sessionId);
    }
  }
  
  if (inactiveSessions.length > 0) {
    console.log(`🗑️ 非アクティブセッションをクリーンアップ: ${inactiveSessions.length}件`);
    
    inactiveSessions.forEach(sessionId => {
      sessionHeartbeats.delete(sessionId);
      
      // 対応する空間セッションも削除
      for (const [spaceId, spaceSessions] of activeSessions) {
        if (spaceSessions.has(sessionId)) {
          spaceSessions.delete(sessionId);
          
          // 暗号化レベル更新通知
          updateEncryptionLevel(spaceId);
          
          if (spaceSessions.size === 0) {
            activeSessions.delete(spaceId);
          }
        }
      }
    });
  }
}, 60000); // 1分ごと

/**
 * 統計情報API
 */
app.get('/api/stats', (req, res) => {
  const stats = {
    connections: io.engine.clientsCount,
    totalSessions: sessionHeartbeats.size,
    activeSpaces: activeSessions.size,
    spaceDetails: {}
  };
  
  for (const [spaceId, spaceSessions] of activeSessions) {
    stats.spaceDetails[spaceId] = {
      sessionCount: spaceSessions.size,
      encryptionLevel: spaceSessions.size > 1 ? 'hybrid' : 'deterministic'
    };
  }
  
  res.json({
    success: true,
    stats,
    timestamp: new Date().toISOString()
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 FRIENDLYモード Socket.IO統合サーバー起動: http://localhost:${PORT}`);
  console.log(`📋 使用可能エンドポイント:`);
  console.log(`  • GET  /api/health - ヘルスチェック`);
  console.log(`  • GET  /api/stats  - 統計情報`);
  console.log(`  • POST /api/spaces/enter - 空間入室`);
  console.log(`  • POST /api/spaces/create - 空間作成`);
  console.log(`  • POST /api/messages/create - メッセージ送信`);
  console.log(`  • GET  /api/messages/:spaceId - メッセージ取得`);
  console.log(`🔌 Socket.IO リアルタイム通信対応`);
});

module.exports = { app, server, io };