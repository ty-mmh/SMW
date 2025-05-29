// メインアプリケーション（モジュール統合・完全改修版）
// 統合版をベースにした高品質なモジュール分割アーキテクチャ

const { useState, useEffect } = React;

const SecureChatApp = () => {
  // =============================================================================
  // 状態管理
  // =============================================================================
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
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected

  // =============================================================================
  // 初期化処理
  // =============================================================================
  useEffect(() => {
    const initializeApp = async () => {
      window.Utils.log('info', 'アプリケーション初期化開始');
      
      try {
        // APIモジュールの初期化
        const apiInitialized = await window.API.init();
        
        if (apiInitialized) {
          setConnectionStatus('connected');
          window.Utils.log('success', 'アプリケーション初期化完了');
        } else {
          setConnectionStatus('disconnected');
          window.Utils.log('warn', 'API接続に問題がありますが、アプリケーションを開始します');
        }
      } catch (error) {
        window.Utils.log('error', 'アプリケーション初期化エラー', error.message);
        setConnectionStatus('disconnected');
      }
    };

    initializeApp();
  }, []);

  // =============================================================================
  // 時刻更新
  // =============================================================================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30秒ごと

    return () => clearInterval(timer);
  }, []);

  // =============================================================================
  // Socket.IO接続管理
  // =============================================================================
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      window.Utils.log('info', 'WebSocket接続を初期化中', { spaceId: currentSpace.id });
      setConnectionStatus('connecting');
      
      const newSocket = io(window.SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      // 接続イベント
      newSocket.on('connect', () => {
        window.Utils.log('success', 'WebSocket接続成功');
        setConnectionStatus('connected');
        newSocket.emit('join-space', currentSpace.id);
      });

      // メッセージ受信
      newSocket.on('message-received', (data) => {
        window.Utils.log('info', '新しいメッセージを受信', { from: data.from });
        
        if (data && data.message) {
          const receivedMessage = {
            ...data.message,
            timestamp: new Date(data.message.timestamp)
          };
          
          setMessages(prev => {
            // 重複チェック
            const exists = prev.some(msg => msg.id === receivedMessage.id);
            if (exists) return prev;
            
            return [...prev, receivedMessage].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      });

      // 空間情報更新
      newSocket.on('room-info', (data) => {
        window.Utils.log('debug', '空間情報更新', data);
      });

      // タイピング状態
      newSocket.on('user-typing', (data) => {
        window.Utils.log('debug', 'ユーザータイピング状態', data);
      });

      // 接続切断
      newSocket.on('disconnect', (reason) => {
        window.Utils.log('warn', 'WebSocket接続切断', { reason });
        setConnectionStatus('disconnected');
      });

      // 再接続
      newSocket.on('reconnect', (attemptNumber) => {
        window.Utils.log('success', 'WebSocket再接続成功', { attemptNumber });
        setConnectionStatus('connected');
        newSocket.emit('join-space', currentSpace.id);
      });

      // エラー
      newSocket.on('error', (error) => {
        window.Utils.log('error', 'WebSocketエラー', error);
        setConnectionStatus('disconnected');
      });

      setSocket(newSocket);

      // クリーンアップ
      return () => {
        window.Utils.log('info', 'WebSocket接続をクリーンアップ');
        if (newSocket.connected) {
          newSocket.emit('leave-space', currentSpace.id);
        }
        newSocket.disconnect();
        setConnectionStatus('disconnected');
      };
    }
  }, [currentSpace]);

  // =============================================================================
  // 空間入室処理
  // =============================================================================
  const handleEnterSpace = async () => {
    window.Utils.performance.start('enter_space');
    window.Utils.log('info', '空間入室処理開始', { passphraseLength: passphrase?.length });
    
    // バリデーション
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 空間入室API呼び出し
      const space = await window.API.enterSpace(validation.passphrase);
      
      // 状態更新
      setCurrentSpace(space);
      setCurrentView('chat');
      setPassphrase('');
      
      // メッセージ読み込み
      const loadedMessages = await window.API.loadMessages(space.id);
      setMessages(loadedMessages);
      
      window.Utils.log('success', '空間入室完了', { 
        spaceId: space.id, 
        messageCount: loadedMessages.length 
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, '空間入室処理');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('enter_space');
    }
  };

  // =============================================================================
  // 空間作成処理
  // =============================================================================
  const handleCreateSpace = async () => {
    window.Utils.performance.start('create_space');
    window.Utils.log('info', '空間作成処理開始', { passphraseLength: newSpacePassphrase?.length });
    
    // バリデーション
    const validation = window.Utils.validatePassphrase(newSpacePassphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 空間作成API呼び出し
      await window.API.createSpace(validation.passphrase);
      
      // フォームリセット
      setShowCreateSpace(false);
      setNewSpacePassphrase('');
      setError('');
      
      // 成功通知
      alert('✅ 新しい空間を作成しました！\n作成した合言葉で入室してください。');
      
      window.Utils.log('success', '空間作成完了', { passphrase: validation.passphrase });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, '空間作成処理');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('create_space');
    }
  };

  // =============================================================================
  // メッセージ送信処理
  // =============================================================================
  const handleSendMessage = async () => {
    if (!message.trim() || !currentSpace) return;
    
    // サンプル空間チェック
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。\n新しい空間を作成してお試しください。');
      return;
    }

    window.Utils.performance.start('send_message');
    setIsLoading(true);

    try {
      // メッセージ送信API呼び出し
      const newMessage = await window.API.sendMessage(currentSpace.id, message);
      
      // ローカル状態更新
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      
      // Socket.IOで他のユーザーに送信
      if (socket && socket.connected) {
        socket.emit('new-message', {
          spaceId: currentSpace.id,
          message: newMessage
        });
      } else {
        window.Utils.log('warn', 'WebSocket未接続のため、リアルタイム配信をスキップ');
      }
      
      window.Utils.log('success', 'メッセージ送信完了', { 
        messageId: newMessage.id,
        messageLength: newMessage.text.length
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'メッセージ送信処理');
      setError(errorMessage);
      
      // エラーメッセージを3秒後に自動クリア
      setTimeout(() => {
        setError(prev => prev === errorMessage ? '' : prev);
      }, 3000);
      
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('send_message');
    }
  };

  // =============================================================================
  // 空間退室処理
  // =============================================================================
  const handleLeaveSpace = () => {
    window.Utils.log('info', '空間退室処理開始', { spaceId: currentSpace?.id });
    
    // WebSocket接続のクリーンアップ
    if (socket) {
      if (socket.connected && currentSpace) {
        socket.emit('leave-space', currentSpace.id);
      }
      socket.disconnect();
      setSocket(null);
    }
    
    // 状態リセット
    setCurrentSpace(null);
    setCurrentView('login');
    setMessages([]);
    setError('');
    setConnectionStatus('disconnected');
    
    window.Utils.log('success', '空間退室完了');
  };

  // =============================================================================
  // エラーハンドリング
  // =============================================================================
  useEffect(() => {
    // グローバルエラーハンドラー
    const handleError = (event) => {
      window.Utils.log('error', 'Unhandled error', event.error);
    };

    const handleRejection = (event) => {
      window.Utils.log('error', 'Unhandled promise rejection', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // =============================================================================
  // レンダリング
  // =============================================================================
  
  // ログイン画面
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
      connectionStatus,
      onEnterSpace: handleEnterSpace,
      onCreateSpace: handleCreateSpace
    });
  }

  // チャット画面
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
      connectionStatus,
      onSendMessage: handleSendMessage,
      onLeaveSpace: handleLeaveSpace
    });
  }

  // フォールバック画面（エラー状態）
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'text-center max-w-md' },
      React.createElement('h1', { className: 'text-2xl mb-4 text-red-400' }, 'エラーが発生しました'),
      React.createElement('p', { className: 'text-gray-300 mb-6' }, 'アプリケーションの状態に問題があります'),
      React.createElement(
        'button',
        {
          onClick: () => {
            // 状態を完全リセット
            setCurrentView('login');
            setCurrentSpace(null);
            setError('');
            setMessages([]);
            window.Utils.log('info', '手動リセット実行');
          },
          className: 'bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition duration-200'
        },
        'ログイン画面に戻る'
      )
    )
  );
};

// =============================================================================
// アプリケーションマウント
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(SecureChatApp));
    
    window.Utils.log('success', 'アプリケーションマウント完了');
    
  } catch (error) {
    console.error('❌ アプリケーションマウント失敗:', error);
    
    // フォールバック表示
    document.getElementById('root').innerHTML = `
      <div style="min-height: 100vh; background: #111827; color: white; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
        <div style="text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">アプリケーションの読み込みに失敗しました</h1>
          <p style="color: #9ca3af; margin-bottom: 1.5rem;">ページを再読み込みしてください</p>
          <button onclick="location.reload()" style="background: #3b82f6; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; color: white; cursor: pointer;">
            再読み込み
          </button>
        </div>
      </div>
    `;
  }
});