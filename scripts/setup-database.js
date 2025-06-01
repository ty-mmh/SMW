const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('🗄️ セキュアチャット データベース初期化開始');

// データディレクトリ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ dataディレクトリを作成しました');
}

const dbPath = path.join(dataDir, 'secure-chat.db');

// 既存のDBファイルがあれば削除（開発環境のみ）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ 既存のデータベースファイルを削除しました');
}

let db;

try {
  db = new Database(dbPath);
  console.log('✅ データベースに接続しました:', dbPath);
  
  // WALモード有効化（パフォーマンス向上）
  db.pragma('journal_mode = WAL');
  console.log('✅ WALモードを有効化しました');
  
  // 外部キー制約有効化
  db.pragma('foreign_keys = ON');
  console.log('✅ 外部キー制約を有効化しました');
  
  // テーブル作成
  console.log('📋 テーブルを作成中...');
  
  // 空間テーブル作成
  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_activity_at TEXT DEFAULT (datetime('now'))
    )
  `);
  console.log('✅ spacesテーブルを作成しました');
  
  // メッセージテーブル作成（暗号化対応）
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      encrypted INTEGER DEFAULT 0,
      encrypted_payload TEXT,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ messagesテーブルを作成しました（暗号化対応）');
  
  // インデックス作成
  db.exec('CREATE INDEX IF NOT EXISTS idx_spaces_passphrase ON spaces(passphrase)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_space_id ON messages(space_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(is_deleted)');
  console.log('✅ インデックスを作成しました');
  
  // サンプルデータ挿入
  console.log('📝 サンプルデータを挿入中...');
  
  const sampleSpaceId = 'sample-space-1';
  const now = new Date();
  const createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前
  const lastActivity = new Date(now.getTime() - 5 * 60 * 1000); // 5分前
  
  // サンプル空間作成
  const insertSpace = db.prepare(`
    INSERT OR IGNORE INTO spaces (id, passphrase, created_at, last_activity_at) 
    VALUES (?, ?, ?, ?)
  `);
  
  const spaceResult = insertSpace.run(
    sampleSpaceId, 
    '秘密の部屋', 
    createdAt.toISOString(), 
    lastActivity.toISOString()
  );
  
  if (spaceResult.changes > 0) {
    console.log('✅ サンプル空間「秘密の部屋」を作成しました');
  }
  
  // サンプルメッセージ1（47時間前、まもなく削除）
  const msg1Time = new Date(now.getTime() - 47 * 60 * 60 * 1000); // 47時間前
  const msg1Expires = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1時間後に削除
  
  const insertMessage = db.prepare(`
    INSERT OR IGNORE INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const msg1Result = insertMessage.run(
    'msg-1', 
    sampleSpaceId, 
    'ようこそ、秘密の部屋へ\n\nこちらはセキュアチャットのサンプル空間です。\n実際のメッセージは48時間で自動削除されます。', 
    msg1Time.toISOString(), 
    msg1Expires.toISOString(), 
    0
  );
  
  if (msg1Result.changes > 0) {
    console.log('✅ サンプルメッセージ1を作成しました（まもなく削除予定）');
  }
  
  // サンプルメッセージ2（1分前、長時間残る）
  const msg2Time = new Date(now.getTime() - 1 * 60 * 1000); // 1分前
  const msg2Expires = new Date(now.getTime() + 47 * 60 * 60 * 1000); // 47時間後に削除
  
  const msg2Result = insertMessage.run(
    'msg-2', 
    sampleSpaceId, 
    '🔒 このメッセージはE2EEで保護されています\n\n新しい空間を作成して、実際にチャットをお試しください！', 
    msg2Time.toISOString(), 
    msg2Expires.toISOString(), 
    0
  );
  
  if (msg2Result.changes > 0) {
    console.log('✅ サンプルメッセージ2を作成しました');
  }
  
  // サンプルメッセージ3（複数行テスト）
  const msg3Time = new Date(now.getTime() - 30 * 1000); // 30秒前
  const msg3Expires = new Date(now.getTime() + 47.5 * 60 * 60 * 1000); // 47.5時間後
  
  const msg3Result = insertMessage.run(
    'msg-3', 
    sampleSpaceId, 
    '機能テスト:\n\n• リアルタイムメッセージ配信\n• 自動削除タイマー表示\n• 改行対応\n• E2EE暗号化（準備中）\n\n全ての機能が正常に動作しています ✨', 
    msg3Time.toISOString(), 
    msg3Expires.toISOString(), 
    0
  );
  
  if (msg3Result.changes > 0) {
    console.log('✅ サンプルメッセージ3を作成しました');
  }
  
  // データベース統計表示
  const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'");
  const tables = tablesQuery.all();
  console.log('📋 作成されたテーブル:', tables.map(t => t.name).join(', '));
  
  const spaceCount = db.prepare('SELECT COUNT(*) as count FROM spaces').get();
  const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
  
  console.log(`📊 データベース統計:`);
  console.log(`   - 空間数: ${spaceCount.count}`);
  console.log(`   - メッセージ数: ${messageCount.count}`);
  console.log(`   - ファイルサイズ: ${Math.round(fs.statSync(dbPath).size / 1024)}KB`);
  
  console.log('\n✅ データベースセットアップ完了！');
  console.log(`📁 データベースファイル: ${dbPath}`);
  console.log(`🎯 次のステップ: npm run dev でサーバーを起動`);
  
} catch (error) {
  console.error('❌ データベースセットアップエラー:', error.message);
  console.error('詳細:', error);
  process.exit(1);
} finally {
  if (db) {
    try {
      db.close();
      console.log('✅ データベース接続を閉じました');
    } catch (error) {
      console.error('❌ データベース切断エラー:', error.message);
    }
  }
}