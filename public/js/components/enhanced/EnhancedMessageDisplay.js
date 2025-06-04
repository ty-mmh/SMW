// public/js/components/EnhancedMessageDisplay.js
// FRIENDLYモード対応の拡張メッセージ表示

window.EnhancedMessageDisplay = ({ 
  message, 
  index, 
  onRetryDecrypt = null,
  showDebugInfo = false 
}) => {
  const { Lock, Key, Users, Clock, Trash2, AlertCircle, Shield } = window.Icons;
  const { formatTime, getMessageTimeRemaining } = window.Utils;
  
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  // メッセージの暗号化状態分析
  const getEncryptionDetails = () => {
    if (!message.encrypted) {
      return {
        level: 'plaintext',
        icon: Shield,
        color: 'text-gray-400',
        label: '平文',
        description: '暗号化されていません'
      };
    }

    if (message.encryptionType === 'hybrid') {
      return {
        level: 'hybrid',
        icon: Users,
        color: 'text-purple-400',
        label: 'ハイブリッド',
        description: 'マルチセッション暗号化',
        sessionCount: message.sessionParticipants?.length || 0,
        hasFallback: message.hasFallback
      };
    }

    if (message.encryptionType === 'deterministic') {
      return {
        level: 'deterministic',
        icon: Key,
        color: 'text-blue-400',
        label: '決定的',
        description: 'パスフレーズベース暗号化'
      };
    }

    if (message.encryptionType === 'error') {
      return {
        level: 'error',
        icon: AlertCircle,
        color: 'text-red-400',
        label: 'エラー',
        description: '復号化に失敗しました'
      };
    }

    return {
      level: 'encrypted',
      icon: Lock,
      color: 'text-green-400',
      label: '暗号化',
      description: 'E2EE保護済み'
    };
  };

  const encryptionDetails = getEncryptionDetails();
  const timeRemaining = getMessageTimeRemaining(message.timestamp);
  const isExpired = timeRemaining.expired;

  // 復号化リトライ
  const handleRetryDecrypt = async () => {
    if (!onRetryDecrypt) return;
    
    setRetryCount(prev => prev + 1);
    try {
      await onRetryDecrypt(message);
    } catch (error) {
      console.error('復号化リトライ失敗:', error);
    }
  };

  return React.createElement(
    'article',
    {
      className: `bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:bg-gray-800/80 transition-all ${isExpired ? 'opacity-60' : ''}`,
      'aria-label': `メッセージ ${index + 1}`
    },
    
    React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      
      // メッセージ本文エリア
      React.createElement(
        'div',
        { className: 'flex-1 min-w-0' },
        
        // 暗号化バッジ（メッセージ上部）
        message.encrypted && React.createElement(
          'div',
          { className: 'flex items-center gap-2 mb-2' },
          React.createElement(
            'div',
            { 
              className: `flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${encryptionDetails.color} bg-current bg-opacity-10 border-current border-opacity-30`
            },
            React.createElement(encryptionDetails.icon, { className: 'w-3 h-3' }),
            React.createElement('span', null, encryptionDetails.label),
            encryptionDetails.sessionCount > 0 && React.createElement(
              'span',
              { className: 'bg-current bg-opacity-20 px-1 rounded text-xs' },
              encryptionDetails.sessionCount
            )
          ),
          
          // フォールバック表示
          encryptionDetails.hasFallback && React.createElement(
            'div',
            { 
              className: 'text-xs text-yellow-400 flex items-center gap-1',
              title: 'フォールバック復号化で解読'
            },
            '🔄 FB'
          )
        ),
        
        // メッセージテキスト
        React.createElement(
          'pre',
          { 
            className: `text-gray-100 leading-relaxed whitespace-pre-wrap font-sans break-words ${
              message.encryptionType === 'error' ? 'text-red-300 italic' : ''
            }`,
            style: { wordBreak: 'break-word' }
          },
          message.text || '[メッセージが読み込めませんでした]'
        ),
        
        // エラー時のリトライボタン
        message.encryptionType === 'error' && onRetryDecrypt && React.createElement(
          'button',
          {
            onClick: handleRetryDecrypt,
            className: 'mt-2 text-xs text-blue-400 hover:text-blue-300 underline',
            disabled: retryCount >= 3
          },
          retryCount >= 3 ? '復号化諦め' : `復号化リトライ (${retryCount}/3)`
        )
      ),
      
      // メタ情報エリア
      React.createElement(
        'div',
        { className: 'text-xs text-gray-400 text-right whitespace-nowrap flex-shrink-0' },
        
        // 時刻と暗号化アイコン
        React.createElement(
          'div',
          { className: 'flex items-center gap-1 justify-end mb-1' },
          message.encrypted && React.createElement(encryptionDetails.icon, { 
            className: `w-3 h-3 ${encryptionDetails.color}`,
            title: `${encryptionDetails.label}: ${encryptionDetails.description}`
          }),
          React.createElement(
            'time',
            { 
              dateTime: message.timestamp?.toISOString(),
              title: message.timestamp?.toLocaleString('ja-JP')
            },
            formatTime(message.timestamp)
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
        ),
        
        // デバッグ情報トグル（開発環境のみ）
        showDebugInfo && React.createElement(
          'button',
          {
            onClick: () => setIsExpanded(!isExpanded),
            className: 'mt-1 text-xs text-gray-500 hover:text-gray-400',
            title: 'デバッグ情報の表示/非表示'
          },
          isExpanded ? '▼ Debug' : '▶ Debug'
        )
      )
    ),
    
    // デバッグ情報（開発環境・展開時のみ）
    showDebugInfo && isExpanded && React.createElement(
      'div',
      { className: 'mt-3 pt-3 border-t border-gray-700/50 text-xs bg-gray-900/50 rounded p-3' },
      React.createElement('h4', { className: 'font-bold mb-2 text-yellow-400' }, 'デバッグ情報'),
      React.createElement(
        'div',
        { className: 'space-y-1 font-mono text-gray-300' },
        React.createElement('div', null, `ID: ${message.id}`),
        React.createElement('div', null, `暗号化: ${message.encrypted ? 'Yes' : 'No'}`),
        React.createElement('div', null, `タイプ: ${message.encryptionType || 'unknown'}`),
        message.sessionParticipants && React.createElement(
          'div', 
          null, 
          `セッション: ${message.sessionParticipants.length}件`
        ),
        React.createElement('div', null, `フォールバック: ${message.hasFallback ? 'Yes' : 'No'}`),
        React.createElement('div', null, `削除済み: ${message.isDeleted ? 'Yes' : 'No'}`),
        React.createElement('div', null, `タイムスタンプ: ${message.timestamp?.toISOString()}`),
        message.encryptedData && React.createElement(
          'div', 
          null, 
          `暗号化データ: ${message.encryptedData.substring(0, 20)}...`
        )
      )
    )
  );
};

// テスト用プレビュー
window.EnhancedMessageDisplay.Preview = () => {
  const [showDebug, setShowDebug] = React.useState(false);
  
  const sampleMessages = [
    {
      id: 'msg-1',
      text: 'これは平文メッセージです',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      encrypted: false
    },
    {
      id: 'msg-2', 
      text: 'これは決定的暗号化されたメッセージです',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      encrypted: true,
      encryptionType: 'deterministic'
    },
    {
      id: 'msg-3',
      text: 'これはハイブリッド暗号化されたメッセージです\n複数のセッションで保護されています',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      encrypted: true,
      encryptionType: 'hybrid',
      sessionParticipants: ['session-1', 'session-2', 'session-3'],
      hasFallback: true
    },
    {
      id: 'msg-4',
      text: '[復号化できませんでした]',
      timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000),
      encrypted: true,
      encryptionType: 'error'
    }
  ];

  return React.createElement(
    'div',
    { className: 'p-4 space-y-4 bg-gray-900 text-white max-w-4xl' },
    
    React.createElement('h3', { className: 'text-lg font-bold mb-4' }, '拡張メッセージ表示プレビュー'),
    
    React.createElement(
      'label',
      { className: 'flex items-center gap-2 mb-4' },
      React.createElement('input', {
        type: 'checkbox',
        checked: showDebug,
        onChange: (e) => setShowDebug(e.target.checked)
      }),
      React.createElement('span', null, 'デバッグ情報を表示')
    ),
    
    React.createElement(
      'div',
      { className: 'space-y-4' },
      sampleMessages.map((msg, index) => 
        React.createElement(window.EnhancedMessageDisplay, {
          key: msg.id,
          message: msg,
          index: index,
          showDebugInfo: showDebug,
          onRetryDecrypt: msg.encryptionType === 'error' ? 
            () => console.log('復号化リトライ:', msg.id) : null
        })
      )
    )
  );
};

console.log('✅ EnhancedMessageDisplay component loaded');