// セキュアチャットアプリ（統合版・アイコン修正済み）
const { useState, useEffect } = React;

const SecureChatApp = () => {
  // 状態管理
  const [currentView, setCurrentView] = useState('login');
  const [passphrase, setPassphrase] = useState('');
  const [currentSpace, setCurrentSpace] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newSpacePassphrase, setNewSpacePassphrase] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showPassphraseInHeader, setShowPassphraseInHeader] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // SVGアイコンコンポーネント（Lucideの代替）
  const LockIcon = ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
  }));

  const MessageCircleIcon = ({ className = 'w-6 h-6' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
  }));

  const UsersIcon = ({ className = 'w-16 h-16 mx-auto mb-4 opacity-30' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z'
  }));

  const ClockIcon = ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
  }));

  const ShieldIcon = ({ className = 'w-16 h-16 text-blue-400 animate-pulse' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
  }));

  const AlertCircleIcon = ({ className = 'w-4 h-4' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  }));

  const KeyIcon = ({ className = 'w-4 h-4 text-purple-400' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
  }));

  const Trash2Icon = ({ className = 'w-3 h-3' } = {}) => React.createElement('svg', {
    className,
    fill: 'none',
    stroke: 'currentColor',
    viewBox: '0 0 24 24'
  }, React.createElement('path', {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    d: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
  }));

  // 現在時刻の更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Socket.IO接続管理
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      console.log('🔌 WebSocket接続を初期化中...');
      
      const newSocket = io(window.SOCKET_URL);
      
      newSocket.on('connect', () => {
        console.log('✅ WebSocket接続成功');
        newSocket.emit('join-space', currentSpace.id);
      });

      newSocket.on('message-received', (data) => {
        console.log('📨 新しいメッセージを受信:', data);
        if (data && data.message) {
          setMessages(prev => [...prev, {
            ...data.message,
            timestamp: new Date(data.message.timestamp)
          }]);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ WebSocket接続が切断されました:', reason);
      });

      setSocket(newSocket);

      return () => {
        if (newSocket) {
          newSocket.emit('leave-space', currentSpace.id);
          newSocket.disconnect();
        }
      };
    }
  }, [currentSpace]);

  // API呼び出し関数
  const apiCall = async (endpoint, options = {}) => {
    try {
      console.log(`🔄 API呼び出し: ${endpoint}`, options);
      
      if (!window.API_BASE) {
        throw new Error('API_BASE URLが設定されていません');
      }

      const url = `${window.API_BASE}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      const data = await response.json();
      console.log(`📨 レスポンス:`, data);
      
      if (!response.ok) {
        throw new Error(data.error || `APIエラー: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
      throw error;
    }
  };

  // 空間入室
  const enterSpace = async () => {
    console.log('📥 空間入室処理開始');
    
    if (!passphrase.trim()) {
      setError('合言葉を入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await apiCall('/spaces/enter', {
        method: 'POST',
        body: JSON.stringify({ passphrase })
      });

      console.log('✅ 空間入室成功:', result);

      if (result.success) {
        const space = {
          ...result.space,
          createdAt: new Date(result.space.createdAt),
          lastActivityAt: new Date(result.space.lastActivityAt)
        };
        
        setCurrentSpace(space);
        setCurrentView('chat');
        setPassphrase('');
        
        // メッセージ読み込み
        await loadMessages(space.id);
      }
    } catch (error) {
      console.error('❌ 空間入室エラー:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // メッセージ読み込み
  const loadMessages = async (spaceId) => {
    try {
      const result = await apiCall(`/messages/${spaceId}`);
      
      if (result.success) {
        const formattedMessages = result.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        console.log('📄 メッセージ読み込み成功:', formattedMessages);
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('❌ メッセージ読み込みエラー:', error);
    }
  };

  // 空間作成
  const createSpace = async () => {
    if (!newSpacePassphrase.trim()) {
      setError('合言葉を入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await apiCall('/spaces/create', {
        method: 'POST',
        body: JSON.stringify({ passphrase: newSpacePassphrase })
      });

      if (result.success) {
        setShowCreateSpace(false);
        setNewSpacePassphrase('');
        setError('');
        alert('✅ 新しい空間を作成しました！');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // メッセージ送信
  const sendMessage = async () => {
    if (!message.trim()) return;
    
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiCall('/messages/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: currentSpace.id,
          message: message.trim()
        })
      });

      if (result.success) {
        const newMessage = {
          ...result.message,
          timestamp: new Date(result.message.timestamp)
        };
        
        setMessages(prev => [...prev, newMessage]);
        setMessage('');
        
        // Socket.IOで他のユーザーに送信
        if (socket && socket.connected) {
          socket.emit('new-message', {
            spaceId: currentSpace.id,
            message: newMessage
          });
        }
      }
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // 空間退室
  const leaveSpace = () => {
    if (socket && socket.connected) {
      socket.emit('leave-space', currentSpace.id);
      socket.disconnect();
      setSocket(null);
    }
    
    setCurrentSpace(null);
    setCurrentView('login');
    setMessages([]);
    setError('');
  };

  // ユーティリティ関数
  const formatTime = (date) => {
    return new Date(date).toLocaleString('ja-JP', { 
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    if (minutes > 0) return `${minutes}分前`;
    return 'たった今';
  };

  const getMessageTimeRemaining = (timestamp) => {
    const created = new Date(timestamp);
    const deleteTime = new Date(created.getTime() + 48 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = deleteTime - now;
    
    if (remaining <= 0) return { text: '削除済み', expired: true };
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return { text: `あと${days}日${hours % 24}時間`, expired: false };
    } else if (hours > 0) {
      return { text: `あと${hours}時間${minutes}分`, expired: false };
    } else if (minutes > 0) {
      return { text: `あと${minutes}分`, expired: false };
    } else {
      return { text: 'まもなく削除', expired: true };
    }
  };

  // ログイン画面
  if (currentView === 'login') {
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
            React.createElement(ShieldIcon),
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
                  enterSpace();
                }
              },
              placeholder: '例: 秘密の部屋',
              disabled: isLoading,
              className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-all disabled:opacity-50'
            }),
            error && React.createElement(
              'div',
              { className: 'mt-3 text-red-400 text-sm flex items-center gap-2 bg-red-900/20 p-2 rounded' },
              React.createElement(AlertCircleIcon),
              error
            )
          ),
          
          React.createElement(
            'button',
            {
              onClick: enterSpace,
              disabled: isLoading,
              className: 'w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 py-3 px-4 rounded-lg font-medium transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:cursor-not-allowed'
            },
            React.createElement(LockIcon),
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
                  onClick: createSpace,
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
              React.createElement(ClockIcon, { className: 'w-4 h-4 text-blue-400' }),
              React.createElement('span', null, '各メッセージは投稿から48時間で自動削除')
            ),
            React.createElement(
              'div',
              { className: 'flex items-center justify-center gap-2' },
              React.createElement(KeyIcon),
              React.createElement('span', null, '合言葉のみでアクセス可能')
            )
          )
        )
      )
    );
  }

  // チャット画面
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
          { className: 'flex items-center gap-3' },
          React.createElement(MessageCircleIcon),
          React.createElement(
            'button',
            {
              onClick: () => setShowPassphraseInHeader(!showPassphraseInHeader),
              className: 'text-sm text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 px-3 py-1 rounded-full border border-gray-600 transition-colors cursor-pointer select-none'
            },
            showPassphraseInHeader ? currentSpace.passphrase : '•'.repeat(currentSpace.passphrase.length)
          )
        ),
        React.createElement(
          'button',
          {
            onClick: leaveSpace,
            className: 'bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200'
          },
          '退室'
        )
      ),
      React.createElement(
        'div',
        { className: 'max-w-4xl mx-auto mt-2 text-xs text-gray-400 flex justify-between' },
        React.createElement('span', null, `作成: ${formatRelativeTime(currentSpace.createdAt)}`),
        React.createElement('span', null, `最終アクティビティ: ${formatRelativeTime(currentSpace.lastActivityAt)}`)
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
          React.createElement(UsersIcon),
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
                  msg.text
                ),
                React.createElement(
                  'div',
                  { className: 'text-xs text-gray-400 text-right whitespace-nowrap min-w-0' },
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-1 justify-end mb-1' },
                    msg.encrypted && React.createElement(LockIcon, { className: 'w-3 h-3 text-green-400' }),
                    React.createElement('span', null, formatTime(msg.timestamp))
                  ),
                  React.createElement(
                    'div',
                    { className: `flex items-center gap-1 justify-end ${timeRemaining.expired ? 'text-red-400' : 'text-gray-500'}` },
                    timeRemaining.expired ? 
                      React.createElement(Trash2Icon) : 
                      React.createElement(ClockIcon, { className: 'w-3 h-3' }),
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
          'div',
          { className: 'flex gap-3 items-end' },
          React.createElement(
            'div',
            { className: 'flex-1' },
            React.createElement('textarea', {
              value: message,
              onChange: (e) => setMessage(e.target.value),
              placeholder: currentSpace.passphrase === '秘密の部屋' ? 
                'これはサンプル空間です（送信不可）' : 
                'メッセージを入力...',
              className: 'w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none min-h-[44px] max-h-32 disabled:opacity-50',
              rows: 1,
              disabled: currentSpace.passphrase === '秘密の部屋' || isLoading
            })
          ),
          React.createElement(
            'button',
            {
              onClick: sendMessage,
              disabled: !message.trim() || currentSpace.passphrase === '秘密の部屋' || isLoading,
              className: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center gap-2 min-w-0'
            },
            React.createElement(LockIcon),
            React.createElement('span', { className: 'hidden sm:inline' }, isLoading ? '送信中...' : '送信')
          )
        ),
        
        React.createElement(
          'div',
          { className: 'mt-2 text-xs text-gray-500 flex justify-between items-center' },
          React.createElement(
            'span',
            null,
            currentSpace.passphrase === '秘密の部屋' ? 
              '📖 サンプル空間（閲覧のみ）' : 
              '🔒 E2E暗号化済み | ⏰ 48時間で自動削除'
          ),
          React.createElement('span', null, formatTime(currentTime))
        )
      )
    )
  );
};

// アプリケーションをマウント
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(SecureChatApp));