// チャット画面コンポーネント
window.ChatComponent = ({
  currentSpace,
  messages,
  message,
  setMessage,
  showPassphraseInHeader,
  setShowPassphraseInHeader,
  currentTime,
  isLoading,
  onSendMessage,
  onLeaveSpace
}) => {
  const { MessageCircle, Users, Lock, Clock, Trash2 } = window.Icons;
  const { formatTime, formatRelativeTime, getMessageTimeRemaining, getSafeValues } = window.Utils;
  
  const { passphrase: safePassphrase, createdAt: safeCreatedAt, lastActivityAt: safeLastActivityAt } = getSafeValues(currentSpace);

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex flex-col' },
    
    // ヘッダー
    React.createElement(
      'div',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto flex items-center justify-between' },
        React.createElement(
          'div',
          { className: 'flex gap-3 items-end' },
          React.createElement(
            'div',
            { className: 'flex-1' },
            React.createElement('textarea', {
              value: message,
              onChange: (e) => setMessage(e.target.value),
              placeholder: safePassphrase === '秘密の部屋' ? 
                'これはサンプル空間です（送信不可）' : 
                'メッセージを入力...',
              className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none min-h-[44px] max-h-32 disabled:opacity-50',
              rows: 1,
              disabled: safePassphrase === '秘密の部屋' || isLoading
            })
          ),
          React.createElement(
            'button',
            {
              onClick: onSendMessage,
              disabled: !message.trim() || safePassphrase === '秘密の部屋' || isLoading,
              className: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center gap-2 min-w-0'
            },
            React.createElement(Lock),
            React.createElement('span', { className: 'hidden sm:inline' }, isLoading ? '送信中...' : '送信')
          )
        ),
        
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-500 flex justify-between items-center' },
          React.createElement(
            'span',
            null,
            safePassphrase === '秘密の部屋' ? 
              '📖 サンプル空間（閲覧のみ）' : 
              '🔒 E2E暗号化済み | ⏰ 48時間で自動削除'
          ),
          React.createElement('span', null, formatTime(currentTime))
        )
      )
    )
  );
};
          'div',
          { className: 'flex items-center gap-3' },
          React.createElement(MessageCircle),
          React.createElement(
            'button',
            {
              onClick: () => setShowPassphraseInHeader(!showPassphraseInHeader),
              className: 'text-sm text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 px-3 py-1 rounded-full border border-gray-600 transition-colors cursor-pointer select-none'
            },
            showPassphraseInHeader ? safePassphrase : '•'.repeat(safePassphrase.length || 1)
          )
        ),
        React.createElement(
          'button',
          {
            onClick: onLeaveSpace,
            className: 'bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200'
          },
          '退室'
        )
      ),
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto mt-2 text-xs text-gray-400 flex justify-between' },
        React.createElement('span', null, `作成: ${formatRelativeTime(safeCreatedAt)}`),
        React.createElement('span', null, `最終アクティビティ: ${formatRelativeTime(safeLastActivityAt)}`)
      )
    ),
    
    // チャットエリア
    React.createElement(
      'div',
      { className: 'flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-900 to-gray-800' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
        messages.length === 0 ? React.createElement(
          'div',
          { className: 'text-center text-gray-400 mt-12' },
          React.createElement(Users),
          React.createElement('p', { className: 'text-lg' }, 'まだメッセージがありません'),
          React.createElement('p', { className: 'text-sm mt-2 opacity-75' }, '最初のメッセージを送信してください')
        ) : React.createElement(
          'div',
          { className: 'space-y-4' },
          messages.map(msg => {
            const timeRemaining = getMessageTimeRemaining(msg.timestamp);
            return React.createElement(
              'div',
              {
                key: msg.id,
                className: 'bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:bg-gray-800/80 transition-all'
              },
              React.createElement(
                'div',
                { className: 'flex items-start justify-between gap-3' },
                React.createElement(
                  'pre',
                  { className: 'text-gray-100 flex-1 leading-relaxed whitespace-pre-wrap font-sans' },
                  msg.text || ''
                ),
                React.createElement(
                  'div',
                  { className: 'text-xs text-gray-400 text-right whitespace-nowrap min-w-0' },
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-1 justify-end mb-1' },
                    msg.encrypted && React.createElement(Lock, { className: 'w-3 h-3 text-green-400' }),
                    React.createElement('span', null, formatTime(msg.timestamp))
                  ),
                  React.createElement(
                    'div',
                    { className: `flex items-center gap-1 justify-end ${timeRemaining.expired ? 'text-red-400' : 'text-gray-500'}` },
                    timeRemaining.expired ? 
                      React.createElement(Trash2) : 
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
    
    // メッセージ入力
    React.createElement(
      'div',
      { className: 'bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 sticky bottom-0' },
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto' },
        React.createElement(