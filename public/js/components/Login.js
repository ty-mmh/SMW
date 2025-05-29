// ログイン画面コンポーネント（統合版ベース・改修版）
// 空間入室・作成フォーム

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
  const { Shield, Lock, AlertCircle, Clock, Key, Check } = window.Icons;

  // Enterキー処理
  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      action();
    }
  };

  // エラーのクリア処理
  const clearError = () => {
    if (error) {
      setError('');
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'max-w-md w-full' },
      
      // ヘッダーセクション
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
            React.createElement('div', { className: 'w-2 h-2 bg-white rounded-full animate-pulse' })
          )
        ),
        React.createElement(
          'h1',
          { className: 'text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' },
          'セキュアチャット'
        ),
        React.createElement(
          'p', 
          { className: 'text-gray-300 text-sm' }, 
          '合言葉で守られたプライベート空間'
        )
      ),
      
      // メインフォーム
      React.createElement(
        'div',
        { className: 'bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-700' },
        
        // 入室フォーム
        React.createElement(
          'div',
          { className: 'mb-6' },
          React.createElement(
            'label',
            { 
              className: 'block text-sm font-medium mb-2 text-gray-200',
              htmlFor: 'passphrase-input'
            },
            '空間への合言葉を入力'
          ),
          React.createElement('input', {
            id: 'passphrase-input',
            type: 'text',
            value: passphrase,
            onChange: (e) => {
              setPassphrase(e.target.value);
              clearError();
            },
            onKeyPress: (e) => handleKeyPress(e, onEnterSpace),
            placeholder: '例: 秘密の部屋',
            disabled: isLoading,
            autoComplete: 'off',
            autoCapitalize: 'off',
            spellCheck: 'false',
            className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed'
          }),
          
          // エラー表示
          error && React.createElement(
            'div',
            { 
              className: 'mt-3 text-red-400 text-sm flex items-start gap-2 bg-red-900/20 p-3 rounded-lg border border-red-800/30',
              role: 'alert',
              'aria-live': 'polite'
            },
            React.createElement(AlertCircle, { className: 'w-4 h-4 mt-0.5 flex-shrink-0' }),
            React.createElement('span', null, error)
          )
        ),
        
        // 入室ボタン
        React.createElement(
          'button',
          {
            onClick: onEnterSpace,
            disabled: isLoading || !passphrase.trim(),
            className: 'w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 py-3 px-4 rounded-lg font-medium transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500/50 focus:outline-none',
            'aria-label': isLoading ? '接続中です' : '空間に入室します'
          },
          React.createElement(Lock, { className: isLoading ? 'animate-pulse' : '' }),
          React.createElement('span', null, isLoading ? '接続中...' : '空間に入る')
        ),
        
        // 区切り線
        React.createElement(
          'div',
          { className: 'mt-6 pt-6 border-t border-gray-700' },
          
          // 空間作成トグルボタン
          React.createElement(
            'button',
            {
              onClick: () => {
                setShowCreateSpace(!showCreateSpace);
                clearError();
              },
              disabled: isLoading,
              className: 'w-full bg-gray-700/50 hover:bg-gray-600/50 py-3 px-4 rounded-lg font-medium transition duration-200 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-gray-500/50 focus:outline-none',
              'aria-expanded': showCreateSpace,
              'aria-controls': 'create-space-form'
            },
            React.createElement('span', null, showCreateSpace ? '空間作成をキャンセル' : '新しい空間を作成'),
            React.createElement(
              'span',
              { className: 'ml-2 text-gray-400 text-sm' },
              showCreateSpace ? '▲' : '▼'
            )
          ),
          
          // 空間作成フォーム（条件付き表示）
          showCreateSpace && React.createElement(
            'div',
            { 
              id: 'create-space-form',
              className: 'mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600 space-y-3'
            },
            React.createElement(
              'label',
              { 
                className: 'block text-sm font-medium text-gray-200',
                htmlFor: 'new-passphrase-input'
              },
              '新しい合言葉'
            ),
            React.createElement('input', {
              id: 'new-passphrase-input',
              type: 'text',
              value: newSpacePassphrase,
              onChange: (e) => {
                setNewSpacePassphrase(e.target.value);
                clearError();
              },
              onKeyPress: (e) => handleKeyPress(e, onCreateSpace),
              placeholder: '例: 友達の部屋',
              disabled: isLoading,
              autoComplete: 'off',
              autoCapitalize: 'off',
              spellCheck: 'false',
              className: 'w-full px-4 py-2 bg-gray-600/50 rounded-lg border border-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed'
            }),
            React.createElement(
              'button',
              {
                onClick: onCreateSpace,
                disabled: isLoading || !newSpacePassphrase.trim(),
                className: 'w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 py-2 px-4 rounded-lg font-medium transition duration-200 disabled:cursor-not-allowed focus:ring-2 focus:ring-green-500/50 focus:outline-none',
                'aria-label': isLoading ? '作成中です' : '新しい空間を作成します'
              },
              React.createElement('span', null, isLoading ? '作成中...' : '作成')
            )
          )
        ),
        
        // 機能説明セクション
        React.createElement(
          'div',
          { className: 'mt-6 space-y-3 text-center text-sm text-gray-400' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement(Check, { className: 'w-4 h-4 text-green-400' }),
            React.createElement('span', null, '全ての通信はE2EEで暗号化されます')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement(Clock, { className: 'w-4 h-4 text-blue-400' }),
            React.createElement('span', null, 'メッセージは48時間で自動削除されます')
          ),
          React.createElement(
            'div',
            { className: 'flex items-center justify-center gap-2' },
            React.createElement(Key, { className: 'w-4 h-4 text-purple-400' }),
            React.createElement('span', null, '合言葉を知る人のみがアクセス可能')
          )
        ),

        // ヒントセクション
        React.createElement(
          'div',
          { className: 'mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-800/30' },
          React.createElement(
            'p',
            { className: 'text-blue-300 text-xs text-center' },
            React.createElement('span', { className: 'font-medium' }, 'ヒント: '),
            '「秘密の部屋」と入力するとサンプル空間を体験できます'
          )
        )
      ),

      // フッター情報
      React.createElement(
        'div',
        { className: 'mt-6 text-center text-xs text-gray-500' },
        React.createElement(
          'p',
          null,
          'プライベート・セキュア・シンプル'
        ),
        React.createElement(
          'p',
          { className: 'mt-1' },
          'バージョン 1.0 - 開発版'
        )
      )
    )
  );
};