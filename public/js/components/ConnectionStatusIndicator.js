// public/js/components/ConnectionStatusIndicator.js
window.ConnectionStatusIndicator = ({ connectionStatus, encryptionInfo, sessionCount }) => {
  const getStatusDisplay = () => {
    const statusMap = {
      'connected': { 
        icon: '🟢', 
        text: 'オンライン', 
        color: 'text-green-400',
        description: `${sessionCount}セッション接続中`
      },
      'connecting': { 
        icon: '🟡', 
        text: '接続中...', 
        color: 'text-yellow-400',
        animation: 'animate-pulse'
      },
      'recovering': { 
        icon: '🔄', 
        text: '再接続中...', 
        color: 'text-orange-400',
        animation: 'animate-spin'
      },
      'disconnected': { 
        icon: '🔴', 
        text: 'オフライン', 
        color: 'text-red-400'
      },
      'failed': { 
        icon: '❌', 
        text: '接続失敗', 
        color: 'text-red-600',
        showReconnect: true
      },
      'slow': { 
        icon: '🐌', 
        text: '接続遅延', 
        color: 'text-yellow-600'
      }
    };
    
    return statusMap[connectionStatus] || statusMap['disconnected'];
  };

  const status = getStatusDisplay();

  return React.createElement(
    'div',
    { 
      className: `flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 ${status.animation || ''}`
    },
    React.createElement('span', { className: status.color }, status.icon),
    React.createElement('span', { className: `text-sm ${status.color}` }, status.text),
    status.description && React.createElement(
      'span', 
      { className: 'text-xs text-gray-400' }, 
      status.description
    ),
    status.showReconnect && window.manualReconnect && React.createElement(
      'button',
      {
        onClick: window.manualReconnect,
        className: 'ml-2 text-xs text-blue-400 hover:text-blue-300 underline'
      },
      '再接続'
    )
  );
};