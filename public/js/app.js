// メインアプリケーション（モジュール統合版）
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

  // 現在時刻の更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Socket.IO接続管理（将来の実装用）
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      const newSocket = io(window.SOCKET_URL);
      
      newSocket.on('connect', () => {
        console.log('🔌 WebSocket接続しました');
        newSocket.emit('join-space', currentSpace.id);
      });

      newSocket.on('message-received', (data) => {
        console.log('📨 新しいメッセージを受信:', data);
        setMessages(prev => [...prev, data.message]);
      });

      newSocket.on('disconnect', () => {
        console.log('❌ WebSocket接続が切断されました');
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

  // 空間入室処理
  const handleEnterSpace = async () => {
    window.Utils.log('info', '空間入室処理開始');
    
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const space = await window.API.enterSpace(passphrase);
      
      window.Utils.log('info', '空間データ設定', space);
      setCurrentSpace(space);
      setCurrentView('chat');
      setPassphrase('');
      
      // メッセージ読み込み
      const loadedMessages = await window.API.loadMessages(space.id);
      window.Utils.log('info', 'メッセージ読み込み成功', `${loadedMessages.length}件`);
      setMessages(loadedMessages);
      
    } catch (error) {
      window.Utils.log('error', '空間入室エラー', error.message);
      setError(error.message || '空間への入室に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 空間作成処理
  const handleCreateSpace = async () => {
    const validation = window.Utils.validatePassphrase(newSpacePassphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await window.API.createSpace(newSpacePassphrase);
      
      setShowCreateSpace(false);
      setNewSpacePassphrase('');
      setError('');
      alert('✅ 新しい空間を作成しました！');
      
    } catch (error) {
      window.Utils.log('error', '空間作成エラー', error.message);
      setError(error.message || '空間の作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // メッセージ送信処理
  const handleSendMessage = async () => {
    if (!message.trim() || !currentSpace) return;
    
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。');
      return;
    }

    setIsLoading(true);

    try {
      const newMessage = await window.API.sendMessage(currentSpace.id, message);
      
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      
      // Socket.IOで他のユーザーに送信（将来の実装）
      if (socket) {
        socket.emit('new-message', {
          spaceId: currentSpace.id,
          message: newMessage
        });
      }
      
    } catch (error) {
      window.Utils.log('error', 'メッセージ送信エラー', error.message);
      setError(error.message || 'メッセージ送信に失敗しました');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // 空間退室処理
  const handleLeaveSpace = () => {
    if (socket) {
      socket.emit('leave-space', currentSpace.id);
      socket.disconnect();
      setSocket(null);
    }
    
    setCurrentSpace(null);
    setCurrentView('login');
    setMessages([]);
    setError('');
  };

  // 画面レンダリング
  if (currentView === 'login') {
    return React.createElement(window.LoginComponent, {
      passphrase,
      setPassphrase,
      error,
      setError,
      newSpacePassphrase,
      setNewSpacePassphrase,
      showCreateSpace,
      setShowCreateSpace,
      isLoading,
      onEnterSpace: handleEnterSpace,
      onCreateSpace: handleCreateSpace
    });
  }

  if (currentView === 'chat' && currentSpace) {
    return React.createElement(window.ChatComponent, {
      currentSpace,
      messages,
      message,
      setMessage,
      showPassphraseInHeader,
      setShowPassphraseInHeader,
      currentTime,
      isLoading,
      onSendMessage: handleSendMessage,
      onLeaveSpace: handleLeaveSpace
    });
  }

  // フォールバック画面
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex items-center justify-center' },
    React.createElement(
      'div',
      { className: 'text-center' },
      React.createElement('h1', { className: 'text-2xl mb-4' }, '読み込み中...'),
      React.createElement(
        'button',
        {
          onClick: () => {
            setCurrentView('login');
            setCurrentSpace(null);
            setError('');
          },
          className: 'bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg'
        },
        'ログイン画面に戻る'
      )
    )
  );
};

// アプリケーションをマウント
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(SecureChatApp));