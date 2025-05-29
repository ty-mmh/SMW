#!/bin/bash

# M1 Mac用セットアップスクリプト
echo "🍎 M1 Mac用セキュアチャット環境セットアップ"
echo "================================================="

# アーキテクチャ確認
echo "📋 システム情報:"
echo "Architecture: $(uname -m)"
echo "OS: $(uname -s)"
echo "Docker version:"
docker --version

# Docker Desktop for Mac の設定確認
echo ""
echo "🐳 Docker設定確認:"
echo "Docker is running: $(docker info > /dev/null 2>&1 && echo 'Yes' || echo 'No')"

# 必要なディレクトリ作成
echo ""
echo "📁 ディレクトリセットアップ:"
mkdir -p data
mkdir -p routes
echo "✅ data/ ディレクトリを作成"
echo "✅ routes/ ディレクトリを作成"

# 既存のコンテナとボリュームをクリーンアップ
echo ""
echo "🧹 Docker環境のクリーンアップ:"
docker-compose down -v --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true
echo "✅ 既存のコンテナとボリュームを削除"

# Docker Buildkit有効化（M1対応）
echo ""
echo "🔧 Docker Buildx設定（M1対応）:"
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker buildx create --use --name m1-builder 2>/dev/null || true
echo "✅ Docker Buildx for M1が有効化されました"

# 環境変数ファイル作成
echo ""
echo "⚙️ 環境設定ファイル作成:"
cat > .env << EOF
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
DATABASE_URL=file:./data/secure-chat.db
JWT_SECRET=dev-secret-key-change-in-production-m1-$(date +%s)
EOF
echo "✅ .env ファイルを作成"

# Docker Composeでビルド・起動
echo ""
echo "🚀 Docker環境構築・起動:"
echo "これには数分かかる場合があります..."

if docker compose up --build -d; then
    echo ""
    echo "✅ Docker環境が正常に起動しました！"
    
    # 起動確認
    echo ""
    echo "🔍 サービス状態確認:"
    sleep 5
    docker-compose ps
    
    echo ""
    echo "📊 ヘルスチェック:"
    sleep 3
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
    
    echo ""
    echo "🎉 セットアップ完了！"
    echo "📱 アプリケーション: http://localhost:3000"
    echo "🔧 API統計: http://localhost:3000/api/stats"
    echo ""
    echo "📝 次のステップ:"
    echo "1. ブラウザで http://localhost:3000 にアクセス"
    echo "2. 合言葉「秘密の部屋」でサンプル空間に入室"
    echo "3. 新しい空間を作成してテスト"
    
else
    echo ""
    echo "❌ Docker環境の起動に失敗しました"
    echo ""
    echo "🔍 トラブルシューティング:"
    echo "1. Docker Desktop for Macが起動していることを確認"
    echo "2. 以下のコマンドでログを確認:"
    echo "   docker-compose logs"
    echo ""
    echo "3. 手動での起動を試行:"
    echo "   docker-compose up --build"
    
    exit 1
fi

# ログ表示の案内
echo ""
echo "📋 ログをリアルタイムで確認するには:"
echo "docker-compose logs -f"
echo ""
echo "🛑 停止するには:"
echo "docker-compose down"