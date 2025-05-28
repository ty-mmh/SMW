const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// データディレクトリ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'secure-chat.db');
const db = new Database(dbPath);

try {
  // WALモード有効化（パフォーマンス向上）
  db.pragma('journal_mode = WAL');
  
  // 外部キー制約有効化
  db.pragma('foreign_keys = ON');

  // テーブル作成
  // 空間テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // メッセージテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    )
  `);

  // インデックス作成
  db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_passphrase ON spaces(passphrase)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_space_id ON messages(space_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at)');

  // サンプルデータ挿入
  const insertSpace = db.prepare(`
    INSERT OR IGNORE INTO spaces (id, passphrase, created_at, last_activity_at) 
    VALUES (?, ?, datetime('now', '-30 days'), datetime('now', '-5 minutes'))
  `);
  
  insertSpace.run('sample-space-1', '秘密の部屋');

  const insertMessage = db.prepare(`
    INSERT OR IGNORE INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  insertMessage.run(
    'msg-1', 
    'sample-space-1', 
    'ようこそ、秘密の部屋へ',
    new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(), // 47時間前
    new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),   // 1時間後
    0
  );
  
  insertMessage.run(
    'msg-2', 
    'sample-space-1', 
    'このメッセージはE2EEで保護されています',
    new Date(Date.now() - 1 * 60 * 1000).toISOString(),        // 1分前
    new Date(Date.now() + 47 * 60 * 60 * 1000).toISOString(),  // 47時間後
    0
  );

  console.log('✅ データベースセットアップ完了');
  console.log(`📁 データベースファイル: ${dbPath}`);
  
  // テーブル一覧表示
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 作成されたテーブル:', tables.map(t => t.name).join(', '));
  
} catch (error) {
  console.error('❌ データベースセットアップエラー:', error.message);
  process.exit(1);
} finally {
  db.close();
}
