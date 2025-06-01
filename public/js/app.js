// メインアプリケーション（暗号化統合・完全版）
// E2EE暗号化機能を統合したセキュアチャットアプリ

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
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // 暗号化関連の状態
  const [encryptionStatus, setEncryptionStatus] = useState('disabled'); // disabled, initializing, enabled, error
  const [encryptionInfo, setEncryptionInfo] = useState(null);

  // =============================================================================
  // 初期化処理
  // =============================================================================
  useEffect(() => {
    const initializeApp = async () => {
      window.Utils.log('info', 'アプリケーション初期化開始');
      
      try {
        // 暗号化システムの可用性確認
        if (window.Crypto && window.Crypto.isSupported) {
          setEncryptionStatus('enabled');
          setEncryptionInfo({
            supported: true,
            algorithm: 'AES-256-GCM + ECDH',
            status: '利用可能'
          });
          window.Utils.log('success', '暗号化システム確認完了');
        } else {
          setEncryptionStatus('disabled');
          setEncryptionInfo({
            supported: false,
            reason: 'Web Crypto API未サポート',
            status: '利用不可'
          });
          window.Utils.log('warn', '暗号化システム利用不可');
        }

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
        setEncryptionStatus('error');
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
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // =============================================================================
  // Socket.IO接続管理（暗号化対応）
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

      // メッセージ受信（暗号化対応）
      newSocket.on('message-received', async (data) => {
        window.Utils.log('info', '新しいメッセージを受信', { from: data.from });
        
        if (data && data.message) {
          try {
            let receivedMessage = {
              ...data.message,
              timestamp: new Date(data.message.timestamp)
            };

            // 暗号化されたメッセージの復号化
            if (receivedMessage.encrypted && receivedMessage.encryptedData && receivedMessage.iv) {
              try {
                const decryptedText = await window.API.decryptMessage(receivedMessage);
                receivedMessage.text = decryptedText;
                window.Utils.log('debug', 'リアルタイムメッセージ復号化成功');
              } catch (decryptError) {
                window.Utils.log('warn', 'リアルタイムメッセージ復号化失敗', decryptError.message);
                receivedMessage.text = '[暗号化されたメッセージ - 復号化できませんでした]';
              }
            }
            
            setMessages(prev => {
              // 重複チェック
              const exists = prev.some(msg => msg.id === receivedMessage.id);
              if (exists) return prev;
              
              return [...prev, receivedMessage].sort((a, b) => a.timestamp - b.timestamp);
            });
          } catch (error) {
            window.Utils.log('error', 'リアルタイムメッセージ処理エラー', error.message);
          }
        }
      });

      // 暗号化関連イベント（将来の実装）
      newSocket.on('key-exchange', (data) => {
        window.Utils.log('debug', '鍵交換イベント受信', data);
        // 将来: 他のユーザーの公開鍵を受信・管理
      });

      // その他のイベント
      newSocket.on('room-info', (data) => {
        window.Utils.log('debug', '空間情報更新', data);
      });

      newSocket.on('user-typing', (data) => {
        window.Utils.log('debug', 'ユーザータイピング状態', data);
      });

      newSocket.on('disconnect', (reason) => {
        window.Utils.log('warn', 'WebSocket接続切断', { reason });
        setConnectionStatus('disconnected');
      });

      newSocket.on('reconnect', (attemptNumber) => {
        window.Utils.log('success', 'WebSocket再接続成功', { attemptNumber });
        setConnectionStatus('connected');
        newSocket.emit('join-space', currentSpace.id);
      });

      newSocket.on('error', (error) => {
        window.Utils.log('error', 'WebSocketエラー', error);
        setConnectionStatus('disconnected');
      });

      setSocket(newSocket);

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
  // 空間入室処理（暗号化対応）
  // =============================================================================
  const handleEnterSpace = async () => {
    window.Utils.performance.start('enter_space');
    window.Utils.log('info', '空間入室処理開始', { passphraseLength: passphrase?.length });
    
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 暗号化システムが利用可能な場合は初期化準備
      if (encryptionStatus === 'enabled') {
        setEncryptionStatus('initializing');
      }

      // 空間入室API呼び出し（内部で暗号化システム初期化）
      const space = await window.API.enterSpace(validation.passphrase);
      
      // 状態更新
      setCurrentSpace(space);
      setCurrentView('chat');
      setPassphrase('');
      
      // 暗号化システム初期化完了確認
      if (window.API.encryptionSystem) {
        setEncryptionStatus('enabled');
        setEncryptionInfo(prev => ({
          ...prev,
          spaceId: space.id,
          publicKey: window.API.encryptionSystem.publicKey.substring(0, 16) + '...',
          initialized: true
        }));
        window.Utils.log('success', '空間暗号化システム初期化完了');
      } else if (encryptionStatus === 'initializing') {
        setEncryptionStatus('disabled');
        window.Utils.log('warn', '暗号化システム初期化失敗 - 平文通信に切り替え');
      }
      
      // メッセージ読み込み（復号化含む）
      const loadedMessages = await window.API.loadMessages(space.id);
      setMessages(loadedMessages);
      
      window.Utils.log('success', '空間入室完了', { 
        spaceId: space.id, 
        messageCount: loadedMessages.length,
        encryptedCount: loadedMessages.filter(m => m.encrypted).length,
        encryptionEnabled: !!window.API.encryptionSystem
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, '空間入室処理');
      setError(errorMessage);
      
      // 暗号化エラーの場合の状態更新
      if (encryptionStatus === 'initializing') {
        setEncryptionStatus('error');
        setEncryptionInfo(prev => ({
          ...prev,
          error: errorMessage
        }));
      }
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
    
    const validation = window.Utils.validatePassphrase(newSpacePassphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await window.API.createSpace(validation.passphrase);
      
      setShowCreateSpace(false);
      setNewSpacePassphrase('');
      setError('');
      
      // 成功通知（暗号化情報を含む）
      const encryptionNote = encryptionStatus === 'enabled' ? 
        '\n🔒 作成された空間ではE2EE暗号化が有効になります。' : 
        '\n⚠️ 暗号化機能が利用できないため、平文通信になります。';
        
      alert('✅ 新しい空間を作成しました！' + encryptionNote + '\n作成した合言葉で入室してください。');
      
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
  // メッセージ送信処理（暗号化対応）
  // =============================================================================
  const handleSendMessage = async () => {
    if (!message.trim() || !currentSpace) return;
    
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。\n新しい空間を作成してお試しください。');
      return;
    }

    window.Utils.performance.start('send_message');
    setIsLoading(true);

    try {
      // メッセージ送信API呼び出し（内部で暗号化処理）
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
        messageLength: newMessage.text.length,
        encrypted: newMessage.encrypted
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'メッセージ送信処理');
      setError(errorMessage);
      
      setTimeout(() => {
        setError(prev => prev === errorMessage ? '' : prev);
      }, 3000);
      
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('send_message');
    }
  };

  // =============================================================================
  // 空間退室処理（暗号化対応）
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
    
    // 暗号化システムのクリーンアップ
    window.API.leaveSpace();
    
    // 状態リセット
    setCurrentSpace(null);
    setCurrentView('login');
    setMessages([]);
    setError('');
    setConnectionStatus('disconnected');
    
    // 暗号化状態リセット
    if (encryptionStatus === 'enabled' && window.Crypto.isSupported) {
      setEncryptionStatus('enabled');
      setEncryptionInfo(prev => ({
        ...prev,
        spaceId: null,
        publicKey: null,
        initialized: false
      }));
    }
    
    window.Utils.log('success', '空間退室完了');
  };

  // =============================================================================
  // エラーハンドリング
  // =============================================================================
  useEffect(() => {
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
      encryptionStatus,
      encryptionInfo,
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
      encryptionStatus,
      encryptionInfo,
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
      
      // 暗号化状態の表示
      encryptionStatus === 'error' && encryptionInfo?.error && React.createElement(
        'div',
        { className: 'mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-300' },
        '🔒 暗号化エラー: ', encryptionInfo.error
      ),
      
      React.createElement(
        'button',
        {
          onClick: () => {
            // 状態を完全リセット
            setCurrentView('login');
            setCurrentSpace(null);
            setError('');
            setMessages([]);
            setEncryptionStatus(window.Crypto.isSupported ? 'enabled' : 'disabled');
            window.Utils.log('info', '手動リセット実行');
          },
          className: 'bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition duration-200'
        },
        'ログイン画面に戻る'
      ),
      
      // デバッグ情報（開発環境のみ）
      window.DEBUG_MODE && React.createElement(
        'div',
        { className: 'mt-6 p-3 bg-gray-800 border border-gray-700 rounded-lg text-xs text-left' },
        React.createElement('h3', { className: 'font-bold mb-2' }, 'デバッグ情報:'),
        React.createElement('pre', { className: 'text-gray-400' }, JSON.stringify({
          encryptionStatus,
          encryptionInfo,
          connectionStatus,
          cryptoSupported: window.Crypto?.isSupported
        }, null, 2))
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
    
    // 暗号化機能のテスト（開発環境のみ）
    if (window.DEBUG_MODE && window.Crypto && window.Crypto.isSupported) {
      setTimeout(() => {
        window.Crypto.testEncryption().then(result => {
          console.log(`🧪 暗号化システム統合テスト: ${result ? '✅ 成功' : '❌ 失敗'}`);
        });
      }, 1000);
    }
    
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