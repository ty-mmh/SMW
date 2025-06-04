// public/js/components/EncryptionStatus.js
// 暗号化状態表示コンポーネント（FRIENDLYモード対応）

window.EncryptionStatusComponent = ({
  encryptionStatus = 'disabled',
  encryptionInfo = null,
  connectionStatus = 'disconnected',
  sessionCount = 0,
  className = ''
}) => {
  const { Shield, Lock, Users, AlertCircle, Check, Key } = window.Icons;

  // 暗号化状態に応じたスタイルとアイコン
  const getEncryptionDisplay = () => {
    switch (encryptionStatus) {
      case 'enabled':
        return {
          icon: Lock,
          color: 'text-green-400 bg-green-900/20 border-green-800/30',
          status: 'E2EE有効',
          description: encryptionInfo?.keyType === 'deterministic' ? '決定的暗号化' : 'ハイブリッド暗号化'
        };
      case 'initializing':
        return {
          icon: Key,
          color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30 animate-pulse',
          status: '暗号化準備中',
          description: 'キー生成中...'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-400 bg-red-900/20 border-red-800/30',
          status: '暗号化エラー',
          description: encryptionInfo?.error || 'エラーが発生しました'
        };
      default:
        return {
          icon: Shield,
          color: 'text-gray-400 bg-gray-900/20 border-gray-700/30',
          status: '暗号化無効',
          description: '平文通信'
        };
    }
  };

  // セッション数に応じた暗号化レベル表示
  const getEncryptionLevel = () => {
    if (encryptionStatus !== 'enabled') return null;
    
    if (sessionCount <= 1) {
      return {
        level: 'Basic',
        type: '決定的暗号化',
        icon: Key,
        color: 'text-blue-400'
      };
    } else {
      return {
        level: 'Enhanced',
        type: 'ハイブリッド暗号化',
        icon: Users,
        color: 'text-purple-400'
      };
    }
  };

  const display = getEncryptionDisplay();
  const level = getEncryptionLevel();

  return React.createElement(
    'div',
    { className: `rounded-lg border p-3 ${display.color} ${className}` },
    
    // メイン表示
    React.createElement(
      'div',
      { className: 'flex items-center gap-3' },
      
      // アイコン
      React.createElement(display.icon, { 
        className: 'w-5 h-5 flex-shrink-0',
        'aria-hidden': 'true'
      }),
      
      // ステータス情報
      React.createElement(
        'div',
        { className: 'flex-1 min-w-0' },
        React.createElement(
          'div',
          { className: 'flex items-center gap-2' },
          React.createElement(
            'span',
            { className: 'font-medium text-sm' },
            display.status
          ),
          level && React.createElement(
            'span',
            { className: `text-xs px-2 py-1 rounded ${level.color} bg-opacity-20 border border-current border-opacity-30` },
            level.level
          )
        ),
        React.createElement(
          'div',
          { className: 'text-xs opacity-75 mt-1' },
          display.description
        )
      ),
      
      // 接続状態インジケーター
      connectionStatus === 'connected' && React.createElement(
        'div',
        { 
          className: 'w-2 h-2 bg-green-400 rounded-full flex-shrink-0',
          title: 'リアルタイム接続中',
          'aria-label': 'リアルタイム接続中'
        }
      )
    ),
    
    // 詳細情報（暗号化有効時のみ）
    encryptionStatus === 'enabled' && encryptionInfo && React.createElement(
      'div',
      { className: 'mt-3 pt-3 border-t border-current border-opacity-20' },
      React.createElement(
        'div',
        { className: 'text-xs space-y-1 opacity-75' },
        
        // 暗号化レベル詳細
        level && React.createElement(
          'div',
          { className: 'flex items-center gap-2' },
          React.createElement(level.icon, { className: 'w-3 h-3' }),
          React.createElement('span', null, level.type),
          sessionCount > 1 && React.createElement(
            'span',
            { className: 'text-xs bg-current bg-opacity-20 px-1 rounded' },
            `${sessionCount}セッション`
          )
        ),
        
        // 空間ID（開発環境のみ）
        window.DEBUG_MODE && encryptionInfo.spaceId && React.createElement(
          'div',
          null,
          `空間: ${encryptionInfo.spaceId.substring(0, 8)}...`
        ),
        
        // 公開キー情報（ハイブリッド時のみ）
        level?.level === 'Enhanced' && encryptionInfo.publicKey && React.createElement(
          'div',
          null,
          `公開キー: ${window.Utils.getSafePublicKey(encryptionInfo.publicKey)}`
        )
      )
    )
  );
};

// 使用例とテスト用プレビュー
window.EncryptionStatusComponent.Preview = () => {
  const [status, setStatus] = React.useState('enabled');
  const [sessionCount, setSessionCount] = React.useState(2);
  
  const mockEncryptionInfo = {
    spaceId: 'test-space-12345',
    keyType: sessionCount > 1 ? 'hybrid' : 'deterministic',
    publicKey: 'abc123def456...',
    initialized: true
  };

  return React.createElement(
    'div',
    { className: 'p-4 space-y-4 bg-gray-900 text-white' },
    
    React.createElement('h3', { className: 'text-lg font-bold mb-4' }, '暗号化状態プレビュー'),
    
    // コントロール
    React.createElement(
      'div',
      { className: 'flex gap-4 mb-4' },
      React.createElement(
        'select',
        {
          value: status,
          onChange: (e) => setStatus(e.target.value),
          className: 'bg-gray-800 border border-gray-600 rounded px-3 py-1'
        },
        React.createElement('option', { value: 'disabled' }, '無効'),
        React.createElement('option', { value: 'initializing' }, '初期化中'),
        React.createElement('option', { value: 'enabled' }, '有効'),
        React.createElement('option', { value: 'error' }, 'エラー')
      ),
      React.createElement(
        'input',
        {
          type: 'range',
          min: 1,
          max: 5,
          value: sessionCount,
          onChange: (e) => setSessionCount(parseInt(e.target.value)),
          className: 'w-32'
        }
      ),
      React.createElement('span', { className: 'text-sm self-center' }, `${sessionCount}セッション`)
    ),
    
    // プレビュー
    React.createElement(window.EncryptionStatusComponent, {
      encryptionStatus: status,
      encryptionInfo: status === 'enabled' ? mockEncryptionInfo : null,
      connectionStatus: 'connected',
      sessionCount: sessionCount
    })
  );
};

console.log('✅ EncryptionStatus component loaded');