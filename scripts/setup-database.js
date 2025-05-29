const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// データディレクトリ作成
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'secure-chat.db');

// 既存のDBファイルがあれば削除（開発環境のみ）
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ 既存のデータベースファイルを削除しました');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ データベース接続エラー:', err.message);
    process.exit(1);
  }
  console.log('✅ データベースに接続しました:', dbPath);
});

// WALモード有効化
db.exec('PRAGMA journal_mode = WAL;', (err) => {
  if (err) {
    console.error('❌ WALモード設定エラー:', err.message);
  } else {
    console.log('✅ WALモードを有効化しました');
  }
});

// 外部キー制約有効化
db.exec('PRAGMA foreign_keys = ON;', (err) => {
  if (err) {
    console.error('❌ 外部キー制約設定エラー:', err.message);
  } else {
    console.log('✅ 外部キー制約を有効化しました');
  }
});

// テーブル作成とデータ挿入を順次実行
db.serialize(() => {
  // 空間テーブル作成
  db.run(`
    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      passphrase TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ spacesテーブル作成エラー:', err.message);
      process.exit(1);
    }
    console.log('✅ spacesテーブルを作成しました');
  });

  // メッセージテーブル作成
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      encrypted_content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      is_deleted BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ messagesテーブル作成エラー:', err.message);
      process.exit(1);
    }
    console.log('✅ messagesテーブルを作成しました');
  });

  // インデックス作成
  db.run('CREATE INDEX IF NOT EXISTS idx_spaces_passphrase ON spaces(passphrase)', (err) => {
    if (err) console.error('⚠️ インデックス作成警告:', err.message);
  });
  
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_space_id ON messages(space_id)', (err) => {
    if (err) console.error('⚠️ インデックス作成警告:', err.message);
  });
  
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at)', (err) => {
    if (err) console.error('⚠️ インデックス作成警告:', err.message);
    else console.log('✅ インデックスを作成しました');
  });

  // サンプルデータ挿入
  const sampleSpaceId = 'sample-space-1';
  const now = new Date();
  const createdAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30日前
  const lastActivity = new Date(now.getTime() - 5 * 60 * 1000); // 5分前

  db.run(`
    INSERT OR IGNORE INTO spaces (id, passphrase, created_at, last_activity_at) 
    VALUES (?, ?, ?, ?)
  `, [sampleSpaceId, '秘密の部屋', createdAt.toISOString(), lastActivity.toISOString()], function(err) {
    if (err) {
      console.error('❌ サンプル空間作成エラー:', err.message);
    } else if (this.changes > 0) {
      console.log('✅ サンプル空間「秘密の部屋」を作成しました');
    }
  });

  // サンプルメッセージ1
  const msg1Time = new Date(now.getTime() - 47 * 60 * 60 * 1000); // 47時間前
  const msg1Expires = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1時間後

  db.run(`
    INSERT OR IGNORE INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['msg-1', sampleSpaceId, 'ようこそ、秘密の部屋へ', msg1Time.toISOString(), msg1Expires.toISOString(), 0], function(err) {
    if (err) {
      console.error('❌ サンプルメッセージ1作成エラー:', err.message);
    } else if (this.changes > 0) {
      console.log('✅ サンプルメッセージ1を作成しました');
    }
  });

  // サンプルメッセージ2
  const msg2Time = new Date(now.getTime() - 1 * 60 * 1000); // 1分前
  const msg2Expires = new Date(now.getTime() + 47 * 60 * 60 * 1000); // 47時間後

  db.run(`
    INSERT OR IGNORE INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?)
  `, ['msg-2', sampleSpaceId, 'このメッセージはE2EEで保護されています', msg2Time.toISOString(), msg2Expires.toISOString(), 0], function(err) {
    if (err) {
      console.error('❌ サンプルメッセージ2作成エラー:', err.message);
    } else if (this.changes > 0) {
      console.log('✅ サンプルメッセージ2を作成しました');
    }
  });

  // テーブル一覧表示
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      console.error('❌ テーブル一覧取得エラー:', err.message);
    } else {
      console.log('📋 作成されたテーブル:', rows.map(row => row.name).join(', '));
    }
    
    // データベース接続を閉じる
    db.close((err) => {
      if (err) {
        console.error('❌ データベース切断エラー:', err.message);
        process.exit(1);
      } else {
        console.log('✅ データベースセットアップ完了');
        console.log(`📁 データベースファイル: ${dbPath}`);
        process.exit(0);
      }
    });
  });
});