#!/bin/bash

echo "🔧 M1 Mac用セキュアチャット クイックフィックス"
echo "================================================="

# 現在のディレクトリ確認
echo "📍 現在のディレクトリ: $(pwd)"

# Step 1: 既存環境のクリーンアップ
echo ""
echo "1️⃣ 既存環境のクリーンアップ..."
docker compose down -v --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true
rm -rf node_modules 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true

# Step 2: package.jsonの更新確認
echo ""
echo "2️⃣ package.json確認..."
if grep -q "sqlite3" package.json; then
    echo "⚠️ package.jsonにsqlite3が残っています"
    echo "   better-sqlite3のみに統一することを推奨します"
else
    echo "✅ package.jsonはbetter-sqlite3で統一されています"
fi

# Step 3: Dockerfile更新
echo ""
echo "3️⃣ Dockerfileの更新..."
cp Dockerfile.dev Dockerfile.dev.backup 2>/dev/null || true

cat > Dockerfile.dev << 'EOF'
# M1 Mac + better-sqlite3 対応 Dockerfile
FROM node:18-slim

# 必要なシステムパッケージをインストール（Alpine使用を止めてDebian slimに変更）
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# 作業ディレクトリ設定
WORKDIR /app

# パッケージファイルを先にコピー（キャッシュ効率化）
COPY package*.json ./

# npmキャッシュクリア
RUN npm cache clean --force

# better-sqlite3用の環境変数設定
ENV PYTHON=/usr/bin/python3

# 依存関係インストール
RUN npm install --verbose

# アプリケーションファイルをコピー
COPY . .

# データディレクトリ作成
RUN mkdir -p data utils

# 権限設定
RUN chmod -R 755 /app
RUN chmod -R 777 /app/data

# 開発用ポート公開
EXPOSE 3000 9229

# 開発サーバー起動
CMD ["npm", "run", "dev"]
EOF

echo "✅ Dockerfile.devを更新しました"

# Step 4: docker-compose.yml の更新
echo ""
echo "4️⃣ docker-compose.ymlの更新..."
cp docker-compose.yml docker-compose.yml.backup 2>/dev/null || true

cat > docker-compose.yml << 'EOF'
services:
  # Node.js アプリケーション
  app:
    build: 
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
      - "9229:9229"  # デバッグポート
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=file:./data/secure-chat.db
      - JWT_SECRET=dev-secret-key-m1-mac
      - PYTHON=/usr/bin/python3
    depends_on:
      db-setup:
        condition: service_completed_successfully
    command: npm run dev
    restart: unless-stopped

  # データベース初期化用
  db-setup:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - ./data:/app/data
      - .:/app
      - node_modules:/app/node_modules
    environment:
      - DATABASE_URL=file:./data/secure-chat.db
      - PYTHON=/usr/bin/python3
    command: npm run db:setup

volumes:
  node_modules:
EOF

echo "✅ docker-compose.ymlを更新しました"

# Step 5: package.jsonの修正（better-sqlite3に統一）
echo ""
echo "5️⃣ package.jsonをbetter-sqlite3に統一..."
if [ -f package.json ]; then
    # sqlite3を削除してbetter-sqlite3に統一
    sed -i.backup 's/"sqlite3".*,/"better-sqlite3": "^9.2.0",/' package.json 2>/dev/null || true
    echo "✅ package.jsonを修正しました"
else
    echo "⚠️ package.jsonが見つかりません"
fi

# Step 6: 必要なファイルの存在確認
echo ""
echo "6️⃣ 必要なファイルの確認..."

required_files=(
    "server.js"
    "routes/spaces.js" 
    "routes/messages.js"
    "scripts/setup-database.js"
    "utils/id-generator.js"
    "public/index.html"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
        echo "❌ 不足: $file"
    else
        echo "✅ 存在: $file"
    fi
done

# Step 7: Docker環境の構築とテスト
echo ""
echo "7️⃣ Docker環境の構築..."

if [ ${#missing_files[@]} -eq 0 ]; then
    echo "✅ 全ての必要なファイルが揃っています"
    echo ""
    echo "🚀 Docker環境を構築中..."
    
    # Buildx設定（M1対応）
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    if docker compose up --build -d; then
        echo ""
        echo "✅ Docker環境が正常に起動しました！"
        
        # 起動確認
        sleep 10
        echo ""
        echo "🔍 サービス状態確認:"
        docker-compose ps
        
        echo ""
        echo "📊 ヘルスチェック:"
        if curl -s http://localhost:3000/health > /dev/null; then
            echo "✅ サーバーが正常に応答しています"
            curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
        else
            echo "⚠️ サーバーの応答待ち中..."
            sleep 5
            curl -s http://localhost:3000/health 2>/dev/null || echo "接続中..."
        fi
        
        echo ""
        echo "🎉 セットアップ完了！"
        echo "📱 アプリケーション: http://localhost:3000"
        echo "🔧 API統計: http://localhost:3000/api/stats"
        echo ""
        echo "📝 次のステップ:"
        echo "1. ブラウザで http://localhost:3000 にアクセス"
        echo "2. 合言葉「秘密の部屋」でサンプル空間に入室"
        echo "3. 新しい空間を作成してテスト"
        echo ""
        echo "📋 ログをリアルタイムで確認:"
        echo "docker-compose logs -f"
        
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
    
else
    echo ""
    echo "❌ 不足しているファイルがあります:"
    for file in "${missing_files[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "🔧 必要なファイルを作成してから再実行してください"
    exit 1
fi

# Step 8: 開発用便利コマンドの案内
echo ""
echo "🛠️ 開発用便利コマンド:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "# 環境停止"
echo "docker compose down"
echo ""
echo "# 環境再起動"
echo "docker compose restart"
echo ""
echo "# データベースリセット"
echo "docker compose exec app npm run db:reset"
echo ""
echo "# ログ監視"
echo "docker compose logs -f app"
echo ""
echo "# コンテナ内部にアクセス"
echo "docker compose exec app /bin/bash"
echo ""
echo "# 完全クリーンアップ"
echo "docker compose down -v && docker system prune -f"

echo ""
echo "✅ M1 Mac用クイックフィックス完了！"