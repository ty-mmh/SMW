require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

// ミドルウェア設定
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// データベース接続
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/secure-chat.db';
const db = new sqlite3.Database(dbPath);

// API Routes
app.use('/api/spaces', require('./routes/spaces')(db));
app.use('/api/messages', require('./routes/messages')(db));

// Socket.IO接続処理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-space', (spaceId) => {
    socket.join(spaceId);
    console.log(`User ${socket.id} joined space: ${spaceId}`);
  });
  
  socket.on('leave-space', (spaceId) => {
    socket.leave(spaceId);
    console.log(`User ${socket.id} left space: ${spaceId}`);
  });
  
  socket.on('new-message', (data) => {
    socket.to(data.spaceId).emit('message-received', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`📊 環境: ${process.env.NODE_ENV || 'development'}`);
});

// グレースフルシャットダウン
process.on('SIGINT', () => {
  console.log('\n🛑 サーバーを停止しています...');
  server.close(() => {
    db.close();
    console.log('✅ サーバーが停止しました');
    process.exit(0);
  });
});
