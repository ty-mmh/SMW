// public/js/components/IntegratedChatUI.js
// FRIENDLYモード完成版 - 統合チャットUI

window.IntegratedChatComponent = ({
  currentSpace,
  messages,
  message,
  setMessage,
  showPassphraseInHeader,
  setShowPassphraseInHeader,
  currentTime,
  isLoading,
  connectionStatus,
  encryptionStatus,
  encryptionInfo,
  onSendMessage,
  onLeaveSpace
}) => {
  const { MessageCircle, Users, Send, Info } = window.Icons;
  const { formatTime, formatRelativeTime, getSafeValues } = window.Utils;
  
  // セッション情報の取得
  const [sessionCount, setSessionCount] = React.useState(1);
  const [sessionInfo, setSessionInfo] = React.useState(null);
  const [showEncryptionDetails, setShowEncryptionDetails] = React.useState(false);

  // セッション情報更新エフェクト
  React.useEffect(() => {
    if (currentSpace && window.SessionManager) {
      const activeSessions = window.SessionManager.getActiveSessionsForSpace(currentSpace.id);
      setSessionCount(Math.max(activeSessions.length, 1));
      
      setSessionInfo({
        activeCount: activeSessions.length,
        currentSession: window.SessionManager.getCurrentSession(),
        spaceId: currentSpace.id
      });
    }
  }, [currentSpace, messages.length]);

  // 安全な値の取得
  const { passphrase: safePassphrase, createdAt: safeCreatedAt, lastActivityAt: safeLastActivityAt } = getSafeValues(currentSpace);

  // メッセージ送信のキーハンドリング
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // テキストエリアの自動リサイズ
  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
  };

  // 復号化リトライ関数
  const handleRetryDecrypt = async (targetMessage) => {
    try {
      console.log('🔄 復号化リトライ開始:', targetMessage.id);
      
      if (window.API && window.API.decryptMessage) {
        const decryptedText = await window.API.decryptMessage({
          encryptedData: targetMessage.encryptedData,
          iv: targetMessage.iv,
          algorithm: targetMessage.algorithm
        });
        
        // メッセージリストを更新（親コンポーネントに通知が必要）
        console.log('✅ 復号化リトライ成功:', decryptedText);
      }
    } catch (error) {
      console.error('❌ 復号化リトライ失敗:', error);
    }
  };

  // サンプル空間かどうかの判定
  const isSampleSpace = safePassphrase === '秘密の部屋';
  const isEmpty = messages.length === 0;

  // メッセージのソート
  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex flex-col' },
    
    // 拡張ヘッダー
    React.createElement(
      'header',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10' },
      
      // メインヘッダー行
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto p-4' },
        React.createElement(
          'div',
          { className: 'flex items-center justify-between' },
          
          // 左側: 空間情報
          React.createElement(
            'div',
            { className: 'flex items-center gap-3' },
            React.createElement(MessageCircle, { className: 'w-6 h-6 text-blue-400' }),
            React.createElement(
              'button',
              {
                onClick: () => setShowPassphraseInHeader(!showPassphraseInHeader),
                className: 'text-sm text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 px-3 py-1 rounded-full border border-gray-600 transition-colors cursor-pointer select-none focus:ring-2 focus:ring-blue-500/50 focus:outline-none',
                'aria-label': showPassphraseInHeader ? '合言葉を隠す' : '合言葉を表示する'
              },
              showPassphraseInHeader ? safePassphrase : '•'.repeat(safePassphrase.length || 1)
            ),
            
            // サンプル空間のバッジ
            isSampleSpace && React.createElement(
              'span',
              { className: 'text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded-full border border-blue-600/30' },
              'サンプル'
            )
          ),
          
          // 右側: アクション
          React.createElement(
            'div',
            { className: 'flex items-center gap-3' },
            
            // 暗号化詳細トグル
            React.createElement(
              'button',
              {
                onClick: () => setShowEncryptionDetails(!showEncryptionDetails),
                className: 'text-xs text-gray-400 hover:text-gray-300 transition-colors',
                title: '暗号化詳細の表示/非表示'
              },
              React.createElement(Info, { className: 'w-4 h-4' })
            ),
            
            // 退室ボタン
            React.createElement(
              'button',
              {
                onClick: onLeaveSpace,
                className: 'bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 focus:ring-2 focus:ring-red-500/50 focus:outline-none'
              },
              '退室'
            )
          )
        ),
        
        // 空間情報行
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-400 flex justify-between items-center' },
          React.createElement('span', null, `作成: ${formatRelativeTime(safeCreatedAt)}`),
          React.createElement('span', null, `最終アクティビティ: ${formatRelativeTime(safeLastActivityAt)}`),
          React.createElement('span', null, `メッセージ: ${sortedMessages.length}件`),
          sessionInfo && React.createElement('span', null, `セッション: ${sessionInfo.activeCount}件`)
        )
      ),
      
      // 暗号化状態表示（詳細表示時）
      showEncryptionDetails && React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto px-4 pb-4' },
        React.createElement(window.EncryptionStatusComponent, {
          encryptionStatus,
          encryptionInfo,
          connectionStatus,
          sessionCount,
          className: 'w-full'
        })
      )
    ),
    
    // チャットエリア
    React.createElement(
      'main',
      { className: 'flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-900 to-gray-800' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
        
        // 空のチャット状態
        isEmpty ? React.createElement(
          'div',
          { className: 'text-center text-gray-400 mt-12' },
          React.createElement(Users),
          React.createElement('h2', { className: 'text-lg mb-2' }, 'まだメッセージがありません'),
          React.createElement(
            'p', 
            { className: 'text-sm opacity-75 mb-4' }, 
            isSampleSpace ? 
              'このサンプル空間では閲覧のみ可能です' : 
              '最初のメッセージを送信してください'
          ),
          
          // 暗号化情報プレビュー
          !isSampleSpace && encryptionStatus === 'enabled' && React.createElement(
            'div',
            { className: 'inline-block mt-4' },
            React.createElement(window.EncryptionStatusComponent, {
              encryptionStatus,
              encryptionInfo,
              connectionStatus,
              sessionCount,
              className: 'text-left'
            })
          ),
          
          !isSampleSpace && React.createElement(
            'div',
            { className: 'text-xs text-gray-500 bg-gray-800/50 p-3 rounded-lg inline-block mt-4' },
            '💡 Ctrl+Enter でメッセージを送信できます'
          )
        ) : 
        
        // 拡張メッセージ一覧
        React.createElement(
          'div',
          { className: 'space-y-4' },
          sortedMessages.map((msg, index) => 
            React.createElement(window.EnhancedMessageDisplay, {
              key: msg.id || `msg-${index}`,
              message: msg,
              index: index,
              showDebugInfo: window.DEBUG_MODE,
              onRetryDecrypt: handleRetryDecrypt
            })
          )
        )
      )
    ),
    
    // 拡張メッセージ入力エリア
    React.createElement(
      'footer',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 sticky bottom-0' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto p-4' },
        
        // 入力コントロール
        React.createElement(
          'div',
          { className: 'flex gap-3 items-end' },
          
          // テキスト入力エリア
          React.createElement(
            'div',
            { className: 'flex-1 relative' },
            React.createElement('textarea', {
              value: message,
              onChange: handleTextareaChange,
              onKeyDown: handleKeyPress,
              placeholder: isSampleSpace ? 
                'これはサンプル空間です（送信不可）' : 
                'メッセージを入力... (Ctrl+Enter で送信)',
              disabled: isSampleSpace || isLoading,
              rows: 1,
              className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed pr-12',
              style: { minHeight: '44px', maxHeight: '128px' },
              maxLength: 5000
            }),
            
            // 文字数カウンター
            message.length > 100 && React.createElement(
              'div',
              { className: 'absolute bottom-1 right-1 text-xs text-gray-500 bg-gray-800/80 px-1 rounded' },
              `${message.length}/5000`
            )
          ),
          
          // 送信ボタン
          React.createElement(
            'button',
            {
              onClick: onSendMessage,
              disabled: !message.trim() || isSampleSpace || isLoading,
              className: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center gap-2 min-w-0 focus:ring-2 focus:ring-blue-500/50 focus:outline-none'
            },
            React.createElement(Send, { className: isLoading ? 'animate-pulse' : '' }),
            React.createElement('span', { className: 'hidden sm:inline' }, 
              isLoading ? '送信中...' : '送信'
            )
          )
        ),
        
        // フッター情報行
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-500 flex justify-between items-center' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-4' },
            React.createElement(
              'span',
              null,
              isSampleSpace ? 
                '📖 サンプル空間（閲覧のみ）' : 
                '🔒 E2E暗号化済み | ⏰ 48時間で自動削除'
            ),
            // リアルタイム暗号化レベル表示
            encryptionStatus === 'enabled' && React.createElement(
              'span',
              { className: 'text-blue-400' },
              sessionCount > 1 ? 
                `🔗 ハイブリッド暗号化 (${sessionCount}セッション)` : 
                '🔑 決定的暗号化'
            )
          ),
          React.createElement(
            'time',
            { 
              dateTime: currentTime.toISOString(),
              title: currentTime.toLocaleString('ja-JP')
            },
            formatTime(currentTime)
          )
        ),
        
        // 操作ヒント
        !isSampleSpace && React.createElement(
          'div',
          { className: 'mt-1 text-xs text-gray-600 text-center' },
          'Ctrl+Enter: 送信 | Enter: 改行 | ℹ️アイコン: 暗号化詳細表示'
        )
      )
    )
  );
};

console.log('✅ IntegratedChat component loaded (FRIENDLYモード完成版)');