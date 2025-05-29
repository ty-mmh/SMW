// ログイン画面コンポーネント
window.LoginComponent = ({
  passphrase,
  setPassphrase,
  error,
  setError,
  newSpacePassphrase,
  setNewSpacePassphrase,
  showCreateSpace,
  setShowCreateSpace,
  isLoading,
  onEnterSpace,
  onCreateSpace
}) => {
  const { Shield, Lock, AlertCircle, Clock, Key } = window.Icons;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'max-w-md w-full' },
      
      // ヘッダー
      React.createElement(
        'div',
        { className: 'text-center mb-8' },
        React.createElement(
          'div',
          { className: 'flex justify-center mb-4 relative' },
          React.createElement(Shield),
          React.createElement(
            'div',
            { className: 'absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center' },
            React.createElement('div', { className: 'w-2 h-2 bg-white rounded-full' })
          )
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' },
          'セキュアチャット'
        ),
        React.createElement('p', { className: 'text-gray-300' }, '合言葉で守られたプライベート空間')
      ),
      
      // フォーム
      React.createElement(
        'div',
        { className: 'bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-700' },
        React.createElement(
          'div',
          { className: 'mb-6' },
          React.createElement(
            'label',
            { className: 'block text-sm font-medium mb-2 text-gray-200' },
            '空間への合言葉を入力'
          ),
          React.createElement('input', {
            type: 'text',
            value: passphrase,
            onChange: (e) => setPassphrase(e.target.value),
            onKeyPress: (e) => {
              if (e.key === 'Enter' && !isLoading) {
                onEnterSpace();
              }
            },
            placeholder: '例: 秘密の部屋',
            disabled: isLoading,
            className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-all disabled:opacity-50'
          }),
          error && React.createElement(
            'div',
            { className: 'mt-3 text-red-400 text-sm flex items-center gap-2 bg-red-900/20 p-2 rounded' },
            React.createElement(AlertCircle),
            error
          )
        ),
        
        React.createElement(
          'button',
          {
            onClick: onEnterSpace,
            disabled: isLoading,
            className: 'w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 py-3 px-4 rounded-lg font-medium transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed'
          },
          React.createElement(Lock),
          isLoading ? '接続中...' : '空間に入る'
        ),
        
        // 空間作成セクション
        React.createElement(
          'div',
          { className: 'mt-6 pt-4 border-t border-gray-700' },
          React.createElement(
            'button',
            {
              onClick: () => setShowCreateSpace(!showCreateSpace),
              disabled: isLoading,
              className: 'w-full bg-gray-700/50 hover:bg-gray-600/50 py-3 px-4 rounded-lg font-medium transition duration-200 border border-gray-600 disabled:opacity-50'
            },
            '新しい空間を作成'
          ),
          
          showCreateSpace && React.createElement(
            'div',
            { className: 'mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600' },
            React.createElement('input', {
              type: 'text',
              value: newSpacePassphrase,
              onChange: (e) => setNewSpacePassphrase(e.target.value),
              placeholder: '新しい合言葉',
              disabled: isLoading,
              className: 'w-full px-4 py-2 bg-gray-600/50 rounded-lg border border-gray-500 focus:border-blue-500 focus:outline-none mb-3 disabled:opacity-50'
            }),
            React.createElement(
              'button',
              {
                onClick: onCreateSpace,
                disabled: isLoading,
                className: 'w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 py-2 px-4 rounded-lg font-medium transition duration-200 disabled:cursor-not-allowed'
              },
              isLoading ? '作成中...' : '作成'
            )
          )
        ),
        
        // 説明セクション
        React.createElement(
          'div',
          { className: 'mt-6 space-y-2 text-center text-sm text-gray-400' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement('svg', {
              className: 'w-4 h-4 text-green-400',
              fill: 'none',
              stroke: 'currentColor',
              viewBox: '0 0 24 24'
            }, React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
            })),
            React.createElement('span', null, '全ての通信はE2EEで保護されます')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement(Clock, { className: 'w-4 h-4 text-blue-400' }),
            React.createElement('span', null, '各メッセージは投稿から48時間で自動削除')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement(Key),
            React.createElement('span', null, '合言葉のみでアクセス可能')
          )
        )
      )
    )
  );
};