#!/bin/bash

echo "🎉 FRIENDLYモード完成版 デプロイメント開始"
echo "=============================================="

# カラー出力の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 現在のディレクトリ確認
echo -e "${BLUE}📍 現在のディレクトリ: $(pwd)${NC}"

# FRIENDLYモード完成版の機能一覧表示
echo ""
echo -e "${PURPLE}✨ FRIENDLYモード完成版の新機能:${NC}"
echo -e "${GREEN}✅ 段階的暗号化システム${NC}"
echo -e "${GREEN}  • 単独セッション: 決定的暗号化${NC}"
echo -e "${GREEN}  • 複数セッション: ハイブリッド暗号化${NC}"
echo -e "${GREEN}  • フォールバック復号化${NC}"
echo -e "${GREEN}✅ 拡張UIコンポーネント${NC}"
echo -e "${GREEN}  • 暗号化状態可視化${NC}"
echo -e "${GREEN}  • 拡張メッセージ表示${NC}"
echo -e "${GREEN}  • 統合チャットUI${NC}"
echo -e "${GREEN}✅ E2Eテストスイート${NC}"
echo -e "${GREEN}✅ パフォーマンス最適化ツール${NC}"
echo -e "${GREEN}✅ セッション管理強化${NC}"

# Step 1: 前提条件の確認
echo ""
echo -e "${CYAN}1️⃣ 前提条件確認...${NC}"

required_files=(
    "package.json"
    "server.js"
    "public/index.html"
    "public/js/app.js"
    "public/js/modules/crypto.js"
    "public/js/modules/api.js"
    "routes/messages.js"
    "docker-compose.yml"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file${NC}"
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo ""
    echo -e "${RED}❌ 必要なファイルが不足しています:${NC}"
    for file in "${missing_files[@]}"; do
        echo -e "${RED}   - $file${NC}"
    done
    echo ""
    echo -e "${YELLOW}🔧 基本プロジェクト構造を先に作成してください${NC}"
    exit 1
fi

# Step 2: バックアップの作成
echo ""
echo -e "${CYAN}2️⃣ 既存ファイルのバックアップ作成...${NC}"

backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

backup_files=(
    "public/index.html"
    "public/js/app.js"
    "public/js/modules/crypto.js"
    "public/js/modules/api.js"
    "routes/messages.js"
)

for file in "${backup_files[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$backup_dir/"
        echo -e "${GREEN}📦 $file をバックアップ${NC}"
    fi
done

echo -e "${GREEN}✅ バックアップ完了: $backup_dir${NC}"

# Step 3: 必要なディレクトリの作成
echo ""
echo -e "${CYAN}3️⃣ FRIENDLYモード用ディレクトリ作成...${NC}"

directories=(
    "public/js/components/enhanced"
    "public/js/test"
    "public/js/performance"
    "public/css/friendly"
    "docs/friendly"
)

for dir in "${directories[@]}"; do
    mkdir -p "$dir"
    echo -e "${GREEN}📁 $dir 作成${NC}"
done

# Step 4: FRIENDLYモード完成版ファイルの配置
echo ""
echo -e "${CYAN}4️⃣ FRIENDLYモード完成版ファイル配置...${NC}"

# このスクリプトでは、実際のファイル内容は直接含めず、
# 開発者が手動で作成したコンポーネントファイルを想定
echo -e "${YELLOW}⚠️ 以下のファイルを手動で作成・配置してください:${NC}"

component_files=(
    "public/js/components/enhanced/EncryptionStatus.js"
    "public/js/components/enhanced/EnhancedMessageDisplay.js" 
    "public/js/components/enhanced/IntegratedChatUI.js"
    "public/js/test/E2ETestSuite.js"
    "public/js/performance/PerformanceOptimizer.js"
)

for file in "${component_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file 存在確認${NC}"
    else
        echo -e "${YELLOW}⚠️ $file を作成してください${NC}"
    fi
done

# Step 5: package.jsonの更新確認
echo ""
echo -e "${CYAN}5️⃣ package.json設定確認...${NC}"

# FRIENDLYモード関連のスクリプト追加を提案
cat << 'EOF' > friendly_package_additions.json
{
  "scripts": {
    "friendly:test": "echo 'FRIENDLYモードE2Eテスト実行中...' && node -e 'console.log(\"ブラウザでwindow.testFriendlyModeComplete()を実行してください\")'",
    "friendly:benchmark": "echo 'FRIENDLYモードベンチマーク実行中...' && node -e 'console.log(\"ブラウザでwindow.benchmarkFriendlyMode()を実行してください\")'",
    "friendly:optimize": "echo 'FRIENDLYモード最適化実行中...' && node -e 'console.log(\"ブラウザでwindow.optimizeFriendlyMode()を実行してください\")'",
    "friendly:debug": "echo 'FRIENDLYモードデバッグ情報表示中...' && node -e 'console.log(\"ブラウザでwindow.debugFriendlyMode()を実行してください\")'",
    "friendly:deploy": "npm run db:setup && npm run dev"
  }
}
EOF

echo -e "${BLUE}📝 推奨するpackage.jsonスクリプト追加:${NC}"
cat friendly_package_additions.json

# Step 6: データベースの更新
echo ""
echo -e "${CYAN}6️⃣ データベース更新（暗号化対応）...${NC}"

# サーバーが動いているかチェック
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ サーバーが動作中です。一時停止中...${NC}"
    docker compose down
    sleep 3
fi

# データベースセットアップ実行
echo -e "${BLUE}🗄️ FRIENDLYモード対応データベースセットアップ...${NC}"
if docker compose run --rm app npm run db:setup; then
    echo -e "${GREEN}✅ データベース更新完了${NC}"
else
    echo -e "${RED}❌ データベース更新に失敗しました${NC}"
    echo -e "${YELLOW}🔧 手動でデータベースをリセットしてください:${NC}"
    echo "   docker compose exec app npm run db:reset"
    exit 1
fi

# Step 7: アプリケーション起動
echo ""
echo -e "${CYAN}7️⃣ FRIENDLYモード完成版アプリケーション起動...${NC}"

echo -e "${BLUE}🚀 Docker Compose で FRIENDLYモード完成版を起動中...${NC}"
if docker compose up -d; then
    echo -e "${GREEN}✅ アプリケーション起動完了${NC}"
else
    echo -e "${RED}❌ アプリケーション起動に失敗しました${NC}"
    echo -e "${YELLOW}🔧 詳細ログを確認してください:${NC}"
    echo "   docker compose logs app"
    exit 1
fi

# Step 8: 起動確認とヘルスチェック
echo ""
echo -e "${CYAN}8️⃣ FRIENDLYモード完成版サービス起動確認...${NC}"

# 起動待機
echo -e "${YELLOW}⏳ FRIENDLYモード完成版起動を待機中...${NC}"
sleep 20

# ヘルスチェック
echo -e "${BLUE}🔍 FRIENDLYモード対応ヘルスチェック実行:${NC}"
for i in {1..5}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ FRIENDLYモード完成版サーバーが正常に応答しています${NC}"
        
        # ヘルスチェック詳細表示
        echo -e "${BLUE}📊 サーバー状態:${NC}"
        if command -v jq &> /dev/null; then
            curl -s http://localhost:3000/health | jq .
        else
            curl -s http://localhost:3000/health
        fi
        break
    else
        echo -e "${YELLOW}⏳ 応答待ち... (試行 $i/5)${NC}"
        sleep 5
    fi
    
    if [ $i -eq 5 ]; then
        echo -e "${RED}⚠️ ヘルスチェックが完了しませんでした${NC}"
        echo -e "${YELLOW}🔧 ログを確認してください:${NC}"
        echo "   docker compose logs app"
    fi
done

# Step 9: FRIENDLYモード機能確認テスト
echo ""
echo -e "${CYAN}9️⃣ FRIENDLYモード機能確認...${NC}"

echo -e "${BLUE}📊 Docker Compose サービス状態:${NC}"
docker compose ps

echo ""
echo -e "${BLUE}📝 最新ログ（FRIENDLYモード関連）:${NC}"
docker compose logs app --tail=15 | grep -E "(FRIENDLYモード|friendly|暗号化|crypto|✅|❌|🔒)" || echo "（FRIENDLYモード関連ログは接続後に表示されます）"

# Step 10: 成功確認とテスト手順の案内
echo ""
echo -e "${GREEN}🎉 FRIENDLYモード完成版デプロイ完了${NC}"
echo "=============================================="

echo ""
echo -e "${PURPLE}✨ FRIENDLYモード完成版の期待される新機能:${NC}"
echo -e "${GREEN}🔒 段階的E2EE暗号化システム${NC}"
echo -e "${GREEN}🔗 セッション数による自動暗号化切り替え${NC}"
echo -e "${GREEN}👥 複数ユーザー対応ハイブリッド暗号化${NC}"
echo -e "${GREEN}📜 フォールバック復号化機能${NC}"
echo -e "${GREEN}🎨 暗号化状態可視化UI${NC}"
echo -e "${GREEN}🚀 統合チャットインターフェース${NC}"
echo -e "${GREEN}🧪 包括的E2Eテストスイート${NC}"
echo -e "${GREEN}⚡ パフォーマンス最適化ツール${NC}"

echo ""
echo -e "${CYAN}🧪 FRIENDLYモード完成版テスト手順${NC}"
echo "=============================================="

echo ""
echo -e "${YELLOW}【基本動作確認】${NC}"
echo "1. ブラウザで http://localhost:3000 にアクセス"
echo "2. 開発者ツールのコンソールを開く"
echo "3. 以下のログが表示されることを確認:"
echo -e "${GREEN}   ✅ FRIENDLYモード完成版が読み込まれました${NC}"
echo -e "${GREEN}   🔒 段階的E2EE暗号化システム初期化完了${NC}"

echo ""
echo -e "${YELLOW}【FRIENDLYモード機能テスト】${NC}"
echo "ブラウザコンソールで以下を実行:"
echo -e "${BLUE}• window.testFriendlyModeComplete()${NC} - 完全テスト実行"
echo -e "${BLUE}• window.benchmarkFriendlyMode()${NC} - パフォーマンステスト"
echo -e "${BLUE}• window.optimizeFriendlyMode()${NC} - 最適化実行"
echo -e "${BLUE}• window.debugFriendlyMode()${NC} - 状態デバッグ"

echo ""
echo -e "${YELLOW}【段階的暗号化テスト】${NC}"
echo "1. 新しい空間を作成（例: 'FRIENDLYテスト'）"
echo "2. 一つのブラウザタブで入室 → 決定的暗号化"
echo "3. 別のタブで同じ空間に入室 → ハイブリッド暗号化に自動切り替え"
echo "4. メッセージ送信・受信のテスト"
echo "5. 暗号化状態の可視化を確認"

echo ""
echo -e "${YELLOW}【期待される動作変化】${NC}"
echo -e "${GREEN}✅ Phase 1A（旧版）: '[復号化できませんでした]' と表示${NC}"
echo -e "${GREEN}✅ FRIENDLYモード完成版: 'メッセージ内容' が正常表示${NC}"
echo -e "${PURPLE}✨ セッション数に応じた暗号化レベル表示${NC}"
echo -e "${PURPLE}✨ 過去メッセージの確実な復号化${NC}"
echo -e "${PURPLE}✨ 視覚的な暗号化状態インジケーター${NC}"

echo ""
echo -e "${CYAN}🔗 FRIENDLYモード完成版デバッグ用URL${NC}"
echo "=============================================="
echo -e "${BLUE}💬 アプリケーション: http://localhost:3000${NC}"
echo -e "${BLUE}📊 API統計: http://localhost:3000/api/stats${NC}"
echo -e "${BLUE}🔧 ヘルスチェック: http://localhost:3000/health${NC}"

echo ""
echo -e "${CYAN}🛠️ 開発用コマンド${NC}"
echo "=============================================="
echo "# リアルタイムログ監視"
echo -e "${BLUE}docker compose logs -f app | grep -E \"(FRIENDLYモード|friendly|🔒|✅)\"${NC}"
echo ""
echo "# データベースリセット（注意）"
echo -e "${BLUE}docker compose exec app npm run db:reset${NC}"
echo ""
echo "# 環境再起動"
echo -e "${BLUE}docker compose restart app${NC}"
echo ""
echo "# パフォーマンス監視"
echo -e "${BLUE}docker compose exec app node -e \"console.log('パフォーマンス監視はブラウザで確認してください')\"${NC}"

echo ""
echo -e "${CYAN}🎯 FRIENDLYモード完成版成功の指標${NC}"
echo "=============================================="
echo -e "${GREEN}1. 2つのブラウザタブでリアルタイム暗号化通信${NC}"
echo -e "${GREEN}2. セッション数による暗号化レベル自動切り替え${NC}"
echo -e "${GREEN}3. 過去メッセージの100%復号化成功${NC}"
echo -e "${GREEN}4. 暗号化状態の視覚的確認${NC}"
echo -e "${GREEN}5. E2Eテストスイートの全成功${NC}"
echo -e "${GREEN}6. パフォーマンステストの合格${NC}"
echo -e "${GREEN}7. エラー発生時の適切なフォールバック${NC}"

echo ""
echo -e "${PURPLE}🚀 FRIENDLYモード完成版の革新${NC}"
echo "=============================================="
echo -e "${CYAN}「復号化できませんでした」から「普通のメッセージ」への変化${NC}"
echo -e "${CYAN}ユーザビリティを保ちながら段階的セキュリティ強化${NC}"
echo -e "${CYAN}実用的なE2EE暗号化システムの実現${NC}"

echo ""
echo -e "${GREEN}🎊 FRIENDLYモード完成版 デプロイメント完了！${NC}"
echo ""
echo -e "${YELLOW}🔧 問題が発生した場合:${NC}"
echo "1. docker compose logs app でログ確認"
echo "2. ブラウザコンソールでエラー確認"
echo "3. window.debugFriendlyMode() でデバッグ実行"
echo "4. バックアップから復元: $backup_dir"

echo ""
echo -e "${BLUE}📧 次のステップ:${NC}"
echo "1. 上記のテスト手順を実行"
echo "2. FRIENDLYモード機能の動作確認"
echo "3. フィードバック収集"
echo "4. SECUREモード (Phase 2) への準備"

# クリーンアップ
rm -f friendly_package_additions.json

echo ""
echo -e "${GREEN}🌟 FRIENDLYモード完成版へようこそ！${NC}"