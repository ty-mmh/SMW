// チャット画面コンポーネント（統合版ベース・完全版）
// メッセージ表示、送信、空間管理

window.ChatComponent = ({
  currentSpace,
  messages,
  message,
  setMessage,
  showPassphraseInHeader,
  setShowPassphraseInHeader,
  currentTime,
  isLoading,
  connectionStatus,
  onSendMessage,
  onLeaveSpace
}) => {
  const { MessageCircle, Users, Lock, Clock, Trash2, Send } = window.Icons;
  const { formatTime, formatRelativeTime, getMessageTimeRemaining, getSafeValues } = window.Utils;
  
  // 安全な値の取得
  const { passphrase: safePassphrase, createdAt: safeCreatedAt, lastActivityAt: safeLastActivityAt } = getSafeValues(currentSpace);

  // メッセージ送信のキーハンドリング
  const handleKeyPress = (e) => {
    // Ctrl+Enter で送信（改行はそのままEnter）
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault();
      onSendMessage();
    }
  };

  // テキストエリアの自動リサイズ
  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    
    // 自動リサイズ
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px'; // 最大128px
  };

  // 接続状態インジケーター
  const getConnectionIndicator = () => {
    const indicators = {
      connected: { color: 'text-green-400', icon: '🟢', text: 'オンライン' },
      connecting: { color: 'text-yellow-400', icon: '🟡', text: '接続中...' },
      disconnected: { color: 'text-red-400', icon: '🔴', text: 'オフライン' }
    };
    
    return indicators[connectionStatus] || indicators.disconnected;
  };

  // サンプル空間かどうかの判定
  const isSampleSpace = safePassphrase === '秘密の部屋';

  // メッセージが空かどうかの判定
  const isEmpty = messages.length === 0;

  // メッセージのソート（念のため）
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
    
    // ヘッダー
    React.createElement(
      'header',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
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
                'aria-label': showPassphraseInHeader ? '合言葉を隠す' : '合言葉を表示する',
                title: showPassphraseInHeader ? '合言葉を隠す' : '合言葉を表示する'
              },
              showPassphraseInHeader ? safePassphrase : '•'.repeat(safePassphrase.length || 1)
            ),
            
            // サンプル空間のバッジ
            isSampleSpace && React.createElement(
              'span',
              { className: 'text-xs bg-blue-600/20 text-blue-300 px-2 py-1 rounded-full border border-blue-600/30' },
              'サンプル'
            ),

            // 接続状態インジケーター
            React.createElement(
              'div',
              { 
                className: `flex items-center gap-1 text-xs ${getConnectionIndicator().color}`,
                title: `接続状態: ${getConnectionIndicator().text}`
              },
              React.createElement('span', null, getConnectionIndicator().icon),
              React.createElement('span', { className: 'hidden sm:inline' }, getConnectionIndicator().text)
            )
          ),
          
          // 右側: 退室ボタン
          React.createElement(
            'button',
            {
              onClick: onLeaveSpace,
              className: 'bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 focus:ring-2 focus:ring-red-500/50 focus:outline-none',
              'aria-label': '空間から退室する'
            },
            '退室'
          )
        ),
        
        // 空間の詳細情報
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-400 flex justify-between items-center' },
          React.createElement('span', null, `作成: ${formatRelativeTime(safeCreatedAt)}`),
          React.createElement('span', null, `最終アクティビティ: ${formatRelativeTime(safeLastActivityAt)}`),
          React.createElement('span', null, `メッセージ: ${sortedMessages.length}件`)
        )
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
          React.createElement('p', { className: 'text-sm opacity-75 mb-4' }, 
            isSampleSpace ? 
              'このサンプル空間では閲覧のみ可能です' : 
              '最初のメッセージを送信してください'
          ),
          !isSampleSpace && React.createElement(
            'div',
            { className: 'text-xs text-gray-500 bg-gray-800/50 p-3 rounded-lg inline-block' },
            '💡 Ctrl+Enter でメッセージを送信できます'
          )
        ) : 
        
        // メッセージ一覧
        React.createElement(
          'div',
          { className: 'space-y-4' },
          sortedMessages.map((msg, index) => {
            const timeRemaining = getMessageTimeRemaining(msg.timestamp);
            const isExpired = timeRemaining.expired;
            
            return React.createElement(
              'article',
              {
                key: msg.id || `msg-${index}`,
                className: `bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:bg-gray-800/80 transition-all ${isExpired ? 'opacity-60' : ''}`,
                'aria-label': `メッセージ ${index + 1}`
              },
              React.createElement(
                'div',
                { className: 'flex items-start justify-between gap-3' },
                
                // メッセージ本文
                React.createElement(
                  'div',
                  { className: 'flex-1 min-w-0' },
                  React.createElement(
                    'pre',
                    { 
                      className: 'text-gray-100 leading-relaxed whitespace-pre-wrap font-sans break-words',
                      style: { wordBreak: 'break-word' }
                    },
                    msg.text || '[メッセージが読み込めませんでした]'
                  )
                ),
                
                // メタ情報
                React.createElement(
                  'div',
                  { className: 'text-xs text-gray-400 text-right whitespace-nowrap flex-shrink-0' },
                  
                  // 暗号化状態と時刻
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-1 justify-end mb-1' },
                    msg.encrypted && React.createElement(Lock, { 
                      className: 'w-3 h-3 text-green-400',
                      title: 'E2EE暗号化済み'
                    }),
                    React.createElement(
                      'time',
                      { 
                        dateTime: msg.timestamp?.toISOString(),
                        title: msg.timestamp?.toLocaleString('ja-JP')
                      },
                      formatTime(msg.timestamp)
                    )
                  ),
                  
                  // 削除タイマー
                  React.createElement(
                    'div',
                    { 
                      className: `flex items-center gap-1 justify-end ${isExpired ? 'text-red-400' : 'text-gray-500'}`,
                      title: isExpired ? 'このメッセージは削除予定です' : `削除まで: ${timeRemaining.text}`
                    },
                    isExpired ? 
                      React.createElement(Trash2, { className: 'w-3 h-3' }) : 
                      React.createElement(Clock, { className: 'w-3 h-3' }),
                    React.createElement('span', { className: 'text-xs' }, timeRemaining.text)
                  )
                )
              )
            );
          })
        )
      )
    ),
    
    // メッセージ入力エリア
    React.createElement(
      'footer',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 sticky bottom-0' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
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
              'aria-label': 'メッセージを入力',
              maxLength: 5000
            }),
            
            // 文字数カウンター（メッセージが長い場合のみ表示）
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
              className: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center gap-2 min-w-0 focus:ring-2 focus:ring-blue-500/50 focus:outline-none',
              'aria-label': isLoading ? '送信中' : 'メッセージを送信'
            },
            React.createElement(Lock, { className: isLoading ? 'animate-pulse' : '' }),
            React.createElement('span', { className: 'hidden sm:inline' }, 
              isLoading ? '送信中...' : '送信'
            )
          )
        ),
        
        // フッター情報
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-500 flex justify-between items-center' },
          React.createElement(
            'span',
            null,
            isSampleSpace ? 
              '📖 サンプル空間（閲覧のみ）' : 
              '🔒 E2E暗号化済み | ⏰ 48時間で自動削除'
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
        
        // 操作ヒント（サンプル空間以外）
        !isSampleSpace && React.createElement(
          'div',
          { className: 'mt-1 text-xs text-gray-600 text-center' },
          'Ctrl+Enter: 送信 | Enter: 改行'
        )
      )
    )
  );
};

// デバッグ用: コンポーネントの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ Chat component loaded');
}