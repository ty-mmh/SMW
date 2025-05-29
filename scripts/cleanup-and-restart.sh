#!/bin/bash

echo "🧹 M1 Mac用完全クリーンアップ＆再起動"
echo "======================================="

# Docker環境停止・削除
echo "1. Docker環境をクリーンアップ中..."
docker-compose down -v --remove-orphans 2>/dev/null || true
docker system prune -f 2>/dev/null || true

# ホストマシンのnode_modulesを削除
echo "2. ホストマシンのnode_modulesを削除中..."
rm -rf node_modules
rm -f package-lock.json

# Dockerビルドキャッシュをクリア
echo "3. Dockerビルドキャッシュをクリア中..."
docker builder prune -f 2>/dev/null || true

# .dockerignoreの存在確認
echo "4. .dockerignoreファイルの確認..."
if [ -f ".dockerignore" ]; then
    echo "✅ .dockerignoreが存在します"
    if grep -q "node_modules" .dockerignore; then
        echo "✅ node_modulesが.dockerignoreに含まれています"
    else
        echo "⚠️ node_modulesを.dockerignoreに追加します"
        echo "node_modules" >> .dockerignore
    fi
else
    echo "❌ .dockerignoreが存在しません。作成してください。"
    exit 1
fi

# 環境変数設定
echo "5. Docker Buildx設定..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 完全リビルド＆起動
echo "6. Docker環境を完全リビルド中..."
echo "これには数分かかります..."

if docker compose up --build --force-recreate; then
    echo ""
    echo "✅ 成功！アプリケーションが起動しました"
    echo "📱 アクセス: http://localhost:3000"
else
    echo ""
    echo "❌ 起動に失敗しました。ログを確認してください："
    echo "docker-compose logs"
    exit 1
fi