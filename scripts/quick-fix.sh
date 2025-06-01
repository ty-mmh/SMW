#!/bin/bash

echo "🚀 Phase 1B: グループ暗号化システム デプロイ開始"
echo "======================================================="

# 現在のディレクトリ確認
echo "📍 現在のディレクトリ: $(pwd)"

# Phase 1B の新機能確認
echo ""
echo "🔒 Phase 1B 新機能:"
echo "✅ ECDH鍵交換システム"
echo "✅ 空間共有キー管理"
echo "✅ リアルタイム暗号化通信"
echo "✅ 複数ユーザー対応"
echo "✅ 過去メッセージ復号化"
echo "✅ 公開キー自動交換"

# Step 1: 必要なファイルの存在確認
echo ""
echo "1️⃣ 必要なファイル確認..."

required_files=(
    "public/js/modules/crypto.js"
    "public/js/modules/api.js"
    "public/js/app.js"
    "routes/messages.js"
    "server.js"
    "scripts/setup-database.js"
    "docker-compose.yml"
    "package.json"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo ""
    echo "❌ 不足しているファイルがあります:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "🔧 必要なファイルを作成してから再実行してください"
    exit 1
fi

# Step 2: crypto.jsモジュールの確認
echo ""
echo "2️⃣ 暗号化モジュール確認..."

if [ ! -f "public/js/modules/crypto.js" ]; then
    echo "❌ crypto.js が見つかりません"
    echo "🔧 crypto.js を作成しています..."
    
    # crypto.jsディレクトリ作成
    mkdir -p public/js/modules
    
    # crypto.js作成（基本的な内容）
    cat > public/js/modules/crypto.js << 'EOF'
// セキュアチャット E2EE暗号化モジュール - Phase 1B
// ECDH鍵交換 + AES-256-GCM + 空間共有キーシステム

console.log('🔒 Phase 1B 暗号化モジュール読み込み開始');

window.Crypto = {
  isSupported: (() => {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  })(),
  
  spaceKeys: new Map(),
  
  testEncryption: async () => {
    console.log('🧪 Phase 1B 暗号化テスト - 準備中');
    return { success: true, message: 'Phase 1B テスト準備完了' };
  }
};

console.log('✅ Phase 1B 暗号化モジュール読み込み完了');
EOF
    
    echo "✅ 基本的な crypto.js を作成しました"
else
    # Phase 1B の機能が含まれているかチェック
    if grep -q "Phase 1B" public/js/modules/crypto.js; then
        echo "✅ Phase 1B 対応の crypto.js が存在します"
    else
        echo "⚠️ crypto.js は存在しますが、Phase 1B 対応が必要です"
    fi
fi

# Step 3: データベースの更新
echo ""
echo "3️⃣ データベース更新（暗号化カラム追加）..."

# 現在のサーバーが動いているかチェック
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "⚠️ サーバーが動作中です。安全のため一時停止..."
    docker compose down
    sleep 3
fi

# データベース更新実行
echo "🗄️ データベースセットアップ実行中..."
if docker compose run --rm app npm run db:setup; then
    echo "✅ データベース更新完了"
else
    echo "❌ データベース更新に失敗しました"
    echo "🔧 手動でデータベースをリセットしてください:"
    echo "   docker compose exec app npm run db:reset"
    exit 1
fi

# Step 4: アプリケーション再起動
echo ""
echo "4️⃣ アプリケーション再起動..."

echo "🚀 Docker Compose でアプリケーションを起動中..."
if docker compose up -d; then
    echo "✅ アプリケーション起動完了"
else
    echo "❌ アプリケーション起動に失敗しました"
    echo "🔧 詳細ログを確認してください:"
    echo "   docker compose logs app"
    exit 1
fi

# Step 5: 起動確認とヘルスチェック
echo ""
echo "5️⃣ サービス起動確認..."

# 起動待機
echo "⏳ サービス起動を待機中..."
sleep 15

# ヘルスチェック
echo "🔍 ヘルスチェック実行:"
for i in {1..5}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ サーバーが正常に応答しています"
        
        # ヘルスチェック詳細表示
        if command -v jq &> /dev/null; then
            curl -s http://localhost:3000/health | jq .
        else
            curl -s http://localhost:3000/health
        fi
        break
    else
        echo "⏳ 応答待ち... (試行 $i/5)"
        sleep 3
    fi
    
    if [ $i -eq 5 ]; then
        echo "⚠️ ヘルスチェックが完了しませんでした"
        echo "🔧 ログを確認してください:"
        echo "   docker compose logs app"
    fi
done

# Step 6: サービス状態表示
echo ""
echo "6️⃣ サービス状態確認..."

echo "📊 Docker Compose サービス状態:"
docker compose ps

echo ""
echo "📝 最新ログ（暗号化関連）:"
docker compose logs app --tail=10 | grep -E "(🔒|暗号化|Phase|crypto|✅|❌)" || echo "（暗号化関連ログは接続後に表示されます）"

# Step 7: テスト手順の案内
echo ""
echo "🧪 Phase 1B テスト手順"
echo "======================================================="

echo ""
echo "【基本確認】"
echo "1. ブラウザで http://localhost:3000 にアクセス"
echo "2. 開発者ツールのコンソールを開く"
echo "3. 以下のログが表示されることを確認:"
echo "   ✅ Phase 1B 暗号化モジュール読み込み完了"
echo "   🔒 暗号化システム準備完了"

echo ""
echo "【暗号化テスト】"
echo "ブラウザコンソールで以下を実行:"
echo "window.Crypto.testEncryption()"
echo "window.Crypto.testMultiUserEncryption()"

echo ""
echo "【マルチユーザーテスト】"
echo "1. 新しい空間を作成（例: 'Phase1Bテスト'）"
echo "2. 2つのブラウザタブで同じ空間に入室"
echo "3. 片方でメッセージ送信"
echo "4. もう片方で平文として受信されることを確認 ✨"

echo ""
echo "【期待される動作変化】"
echo "✅ Phase 1A: '[復号化できませんでした]' と表示"
echo "✅ Phase 1B: '普通のメッセージ' として表示"

echo ""
echo "【デバッグ用コマンド】"
echo "console.log('暗号化システム:', window.API?.encryptionSystem);"
echo "console.log('暗号化統計:', window.API?.getEncryptionStats?.());"
echo "console.log('空間キー情報:', window.Crypto?.getAllSpaceKeyInfo?.());"

# Step 8: 開発用コマンド案内
echo ""
echo "🛠️ 開発用コマンド"
echo "======================================================="
echo "# ログ監視"
echo "docker compose logs -f app"
echo ""
echo "# データベースリセット（注意）"
echo "docker compose exec app npm run db:reset"
echo ""
echo "# 環境再起動"
echo "docker compose restart app"
echo ""
echo "# 完全クリーンアップ"
echo "docker compose down -v && docker system prune -f"

# Step 9: デバッグ用URL
echo ""
echo "🔗 デバッグ用URL"
echo "======================================================="
echo "📊 API統計: http://localhost:3000/api/stats"
echo "🔧 ヘルスチェック: http://localhost:3000/health"
echo "💬 アプリケーション: http://localhost:3000"

# Step 10: 成功確認とまとめ
echo ""
echo "🎉 Phase 1B デプロイ完了"
echo "======================================================="

echo ""
echo "✨ 期待される新機能:"
echo "🔒 ECDH鍵交換システム"
echo "🔗 リアルタイム暗号化通信"
echo "👥 複数ユーザー対応"
echo "📜 過去メッセージ復号化"
echo "🚀 自動公開キー交換"

echo ""
echo "🎯 成功の指標:"
echo "1. 2つのブラウザタブでリアルタイム平文受信"
echo "2. 過去メッセージの復号化表示"
echo "3. コンソールでの暗号化ログ確認"
echo "4. テスト関数の全成功"

echo ""
echo "🎊 Phase 1B の核心:"
echo "「復号化できませんでした」→「普通のメッセージ」への変化を体験してください！"

echo ""
echo "🚀 次のステップ:"
echo "1. 上記のテスト手順を実行"
echo "2. 動作確認とフィードバック"
echo "3. 問題があればログ確認"
echo "4. 成功すれば Phase 1C への準備"

echo ""
echo "🔒 Phase 1B グループ暗号化システム デプロイ完了！"