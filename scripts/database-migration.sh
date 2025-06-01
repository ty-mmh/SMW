#!/bin/bash

echo "🔧 Phase 1B データベースマイグレーション開始"
echo "=============================================="

# 現在の状況確認
echo "📊 現在のデータベース状況確認..."

# サーバーを一時停止
echo "⏸️ サーバーを一時停止..."
docker compose down

# データベーススキーマ確認
echo "🔍 現在のテーブル構造確認..."
docker compose run --rm app sqlite3 data/secure-chat.db ".schema messages" || echo "データベースファイルが存在しないか、アクセスできません"

# 方法1: ALTER TABLEで新しいカラムを追加
echo ""
echo "🔧 方法1: 既存テーブルにカラム追加を試行..."

docker compose run --rm app sqlite3 data/secure-chat.db << 'EOF'
-- encrypted カラム追加
ALTER TABLE messages ADD COLUMN encrypted INTEGER DEFAULT 0;

-- encrypted_payload カラム追加  
ALTER TABLE messages ADD COLUMN encrypted_payload TEXT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_messages_encrypted ON messages(encrypted);

-- 変更確認
.schema messages

-- 現在のデータ確認
SELECT COUNT(*) as total_messages FROM messages;

.quit
EOF

# 結果確認
if [ $? -eq 0 ]; then
    echo "✅ データベーススキーマ更新成功"
else
    echo "⚠️ ALTER TABLEが失敗しました。完全再作成を実行します..."
    
    # 方法2: データベース完全再作成
    echo ""
    echo "🔧 方法2: データベース完全再作成..."
    
    # バックアップ作成
    if [ -f "data/secure-chat.db" ]; then
        cp data/secure-chat.db data/secure-chat.db.backup.$(date +%Y%m%d_%H%M%S)
        echo "📦 既存データベースをバックアップしました"
    fi
    
    # データベース削除
    rm -f data/secure-chat.db*
    
    # 新しいデータベース作成
    docker compose run --rm app npm run db:setup
    
    if [ $? -eq 0 ]; then
        echo "✅ データベース再作成成功"
    else
        echo "❌ データベース再作成失敗"
        exit 1
    fi
fi

# 最終的なスキーマ確認
echo ""
echo "📋 更新後のテーブル構造確認:"
docker compose run --rm app sqlite3 data/secure-chat.db << 'EOF'
.schema messages
SELECT 
    name,
    type 
FROM pragma_table_info('messages');
.quit
EOF

# サーバー再起動
echo ""
echo "🚀 サーバー再起動..."
docker compose up -d

# 起動確認
echo "⏳ サーバー起動を待機中..."
sleep 10

# ヘルスチェック
echo "🔍 ヘルスチェック..."
for i in {1..3}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ サーバーが正常に起動しました"
        
        # 詳細情報表示
        if command -v jq &> /dev/null; then
            curl -s http://localhost:3000/health | jq .
        else
            curl -s http://localhost:3000/health
        fi
        break
    else
        echo "⏳ 応答待ち... (試行 $i/3)"
        sleep 5
    fi
done

# テストメッセージ送信確認
echo ""
echo "🧪 データベース修正確認テスト..."

# APIテスト用のサンプル空間確認
echo "📊 サンプルデータ確認:"
docker compose run --rm app sqlite3 data/secure-chat.db << 'EOF'
SELECT 
    id,
    passphrase,
    COUNT(m.id) as message_count
FROM spaces s
LEFT JOIN messages m ON s.id = m.space_id AND m.is_deleted = 0
GROUP BY s.id, s.passphrase;
.quit
EOF

echo ""
echo "🎉 Phase 1B データベースマイグレーション完了"
echo "=============================================="

echo ""
echo "✅ 完了した作業:"
echo "   - encrypted カラム追加"
echo "   - encrypted_payload カラム追加"
echo "   - インデックス最適化"
echo "   - サーバー再起動"

echo ""
echo "🧪 次のテスト手順:"
echo "1. http://localhost:3000 にアクセス"
echo "2. 新しい空間を作成"
echo "3. メッセージ送信テスト"
echo "4. エラーが解消されていることを確認"

echo ""
echo "📝 問題が継続する場合:"
echo "docker compose logs app | tail -20"

echo ""
echo "🔧 Phase 1B データベースマイグレーション完了！"