// server.js - FRIENDLYモード Socket.IO統合サーバー
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 静的ファイルの提供
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// データベース初期化（SQLite）
const Database = require('better-sqlite3');
const db = new Database('secure_chat.db');

// テーブル作成
db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    passphrase TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    last_activity_at TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    encrypted_content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    encrypted INTEGER DEFAULT 0,
    encrypted_payload TEXT,
    FOREIGN KEY (space_id) REFERENCES spaces(id)
  );
`);

// サンプル空間作成
try {
  db.prepare(`
    INSERT OR IGNORE INTO spaces (id, passphrase, created_at, last_activity_at)
    VALUES (?, ?, ?, ?)
  `).run('sample-space-001', '秘密の部屋', new Date().toISOString(), new Date().toISOString());
} catch (error) {
  console.log('サンプル空間は既に存在します');
}

// ルーター設定
const spacesRouter = require('./routes/spaces')(db);
const messagesRouter = require('./routes/messages')(db);

app.use('/api/spaces', spacesRouter);
app.use('/api/messages', messagesRouter);

// =============================================================================
// FRIENDLYモード Socket.IO統合強化版
// =============================================================================

// セッション管理
const activeSessions = new Map(); // spaceId -> Set<sessionInfo>
const sessionToSpace = new Map(); // socketId -> spaceId
const sessionActivity = new Map(); // sessionId -> lastActivity

io.on('connection', (socket) => {
  console.log(`🔌 新しい接続: ${socket.id}`);
  
  // ===== セッション管理 =====
  
  socket.on('join-space', (spaceId) => {
    console.log(`👥 空間参加: ${socket.id} -> ${spaceId}`);
    
    socket.join(spaceId);
    sessionToSpace.set(socket.id, spaceId);
    
    // アクティブセッションに追加
    if (!activeSessions.has(spaceId)) {
      activeSessions.set(spaceId, new Set());
    }
    activeSessions.get(spaceId).add(socket.id);
    
    // セッション数を他のクライアントに通知
    const sessionCount = activeSessions.get(spaceId).size;
    socket.to(spaceId).emit('session-count-updated', {
      spaceId,
      sessionCount,
      encryptionLevel: sessionCount > 1 ? 'hybrid' : 'deterministic',
      reason: 'user_joined'
    });
    
    // セッション参加を通知
    socket.to(spaceId).emit('session-joined', {
      sessionId: socket.id,
      spaceId,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('leave-space', (spaceId) => {
    console.log(`👋 空間退出: ${socket.id} -> ${spaceId}`);
    handleSessionLeave(socket, spaceId);
  });
  
  // ===== メッセージング =====
  
  socket.on('new-message', (data) => {
    console.log(`💬 新メッセージ: ${socket.id} -> ${data.spaceId}`);
    
    // 同じ空間の他のクライアントに配信
    socket.to(data.spaceId).emit('message-received', {
      message: data.message,
      encryptionInfo: data.encryptionInfo,
      sessionCount: activeSessions.get(data.spaceId)?.size || 1,
      from: socket.id,
      timestamp: new Date().toISOString()
    });
  });
  
  // ===== セッション活性度管理 =====
  
  socket.on('session-info', (data) => {
    console.log(`📊 セッション情報: ${data.sessionId?.substring(0, 12)}... -> ${data.spaceId}`);
    
    sessionActivity.set(data.sessionId, {
      lastActivity: new Date(),
      spaceId: data.spaceId,
      socketId: socket.id,
      isReconnection: data.isReconnection || false
    });
  });
  
  socket.on('session-activity', (data) => {
    if (data.notifyOthers !== false) {
      socket.to(data.spaceId).emit('session-activity-update', {
        sessionId: data.sessionId,
        activity: data.activity,
        timestamp: data.timestamp
      });
    }
  });
  
  // ===== 暗号化レベル管理 =====
  
  socket.on('encryption-level-changed', (data) => {
    console.log(`🔒 暗号化レベル変更: ${data.spaceId} -> ${data.encryptionLevel}`);
    
    socket.to(data.spaceId).emit('encryption-level-updated', {
      spaceId: data.spaceId,
      encryptionLevel: data.encryptionLevel,
      sessionCount: data.sessionCount,
      triggeredBy: socket.id,
      timestamp: data.timestamp
    });
  });
  
  // ===== キー交換システム =====
  
  socket.on('public-key-announcement', (data) => {
    console.log(`🔑 公開鍵通知: ${data.sessionId?.substring(0, 12)}... -> ${data.spaceId}`);
    
    socket.to(data.spaceId).emit('public-key-received', {
      sessionId: data.sessionId,
      spaceId: data.spaceId,
      publicKey: data.publicKey,
      timestamp: data.timestamp,
      purpose: data.purpose
    });
  });
  
  socket.on('key-exchange-request', (data) => {
    console.log(`🔄 キー交換要求: ${data.sessionId?.substring(0, 12)}... -> ${data.spaceId}`);
    
    if (data.targetSessionId) {
      // 特定のセッションに送信
      socket.to(data.spaceId).emit('key-exchange-request', data);
    } else {
      // 空間の全セッションに送信
      socket.to(data.spaceId).emit('key-exchange-request', data);
    }
  });
  
  socket.on('key-exchange-response', (data) => {
    console.log(`✅ キー交換応答: ${data.sessionId?.substring(0, 12)}... -> ${data.spaceId}`);
    
    socket.to(data.spaceId).emit('key-exchange-response', data);
  });
  
  socket.on('key-verification-request', (data) => {
    socket.to(data.spaceId).emit('key-verification-request', data);
  });
  
  socket.on('key-verification-response', (data) => {
    socket.to(data.spaceId).emit('key-verification-response', data);
  });
  
  // ===== 接続品質監視 =====
  
  socket.on('ping', (timestamp) => {
    socket.emit('pong', timestamp);
  });
  
  // ===== 切断処理 =====
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 接続切断: ${socket.id} (${reason})`);
    
    const spaceId = sessionToSpace.get(socket.id);
    if (spaceId) {
      handleSessionLeave(socket, spaceId);
    }
  });
});

// セッション退出処理
function handleSessionLeave(socket, spaceId) {
  const sessions = activeSessions.get(spaceId);
  if (sessions) {
    sessions.delete(socket.id);
    
    // セッション退出を通知
    socket.to(spaceId).emit('session-left', {
      sessionId: socket.id,
      spaceId,
      timestamp: new Date().toISOString()
    });
    
    // セッション数更新を通知
    const sessionCount = sessions.size;
    socket.to(spaceId).emit('session-count-updated', {
      spaceId,
      sessionCount,
      encryptionLevel: sessionCount > 1 ? 'hybrid' : 'deterministic',
      reason: 'user_left'
    });
    
    if (sessions.size === 0) {
      activeSessions.delete(spaceId);
    }
  }
  
  sessionToSpace.delete(socket.id);
  
  // セッション活性度管理からも削除
  for (const [sessionId, activity] of sessionActivity) {
    if (activity.socketId === socket.id) {
      sessionActivity.delete(sessionId);
    }
  }
  
  socket.leave(spaceId);
}

// 健康チェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    database: 'SQLite',
    socketConnections: io.engine.clientsCount,
    activeSpaces: activeSessions.size,
    timestamp: new Date().toISOString()
  });
});

// 統計エンドポイント（開発環境のみ）
app.get('/api/stats', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Statistics not available in production' });
  }
  
  res.json({
    stats: {
      socketConnections: io.engine.clientsCount,
      activeSpaces: activeSessions.size,
      totalActiveSessions: Array.from(activeSessions.values()).reduce((sum, sessions) => sum + sessions.size, 0),
      sessionActivity: sessionActivity.size,
      spaceSessionCounts: Object.fromEntries(
        Array.from(activeSessions.entries()).map(([spaceId, sessions]) => [spaceId, sessions.size])
      )
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 FRIENDLYモード Socket.IO統合サーバー起動 - ポート ${PORT}`);
  console.log(`📡 WebSocket URL: http://localhost:${PORT}`);
  console.log(`🔒 FRIENDLYモード機能:`);
  console.log(`   • 決定的暗号化 (単独セッション)`);
  console.log(`   • ハイブリッド暗号化 (複数セッション)`);
  console.log(`   • リアルタイムキー交換`);
  console.log(`   • セッション管理`);
  console.log(`   • パフォーマンス監視`);
});