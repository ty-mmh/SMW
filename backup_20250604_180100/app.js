// メインアプリケーション（FRIENDLYモード完成版統合）
// E2EE暗号化機能を統合したセキュアチャットアプリ

const { useState, useEffect } = React;

const SecureChatApp = () => {
  // =============================================================================
  // 状態管理（拡張版）
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
  
  // 暗号化関連の状態（拡張）
  const [encryptionStatus, setEncryptionStatus] = useState('disabled');
  const [encryptionInfo, setEncryptionInfo] = useState(null);
  const [sessionCount, setSessionCount] = useState(1);
  const [sessionInfo, setSessionInfo] = useState(null);
  
  // パフォーマンス関連の状態
  const [performanceData, setPerformanceData] = useState(null);
  const [optimizationEnabled, setOptimizationEnabled] = useState(false);

  // =============================================================================
  // 初期化処理（FRIENDLYモード完成版）
  // =============================================================================
  useEffect(() => {
    const initializeApp = async () => {
      window.Utils.log('info', 'FRIENDLYモード完成版初期化開始');
      
      try {
        // 基本システムの初期化
        if (window.Crypto && window.Crypto.isSupported) {
          setEncryptionStatus('enabled');
          setEncryptionInfo({
            supported: true,
            algorithm: 'AES-256-GCM + 決定的キー + ハイブリッド',
            status: 'FRIENDLYモード対応',
            keyType: 'hybrid_deterministic',
            features: ['決定的暗号化', 'ハイブリッド暗号化', 'フォールバック復号化']
          });
          window.Utils.log('success', 'FRIENDLYモード暗号化システム確認完了');
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
          window.Utils.log('success', 'API初期化完了');
        } else {
          setConnectionStatus('disconnected');
          window.Utils.log('warn', 'API接続に問題がありますが、継続します');
        }

        // パフォーマンス監視の開始（開発環境のみ）
        if (window.DEBUG_MODE && window.PerformanceOptimizer) {
          window.PerformanceOptimizer.startMonitoring();
          setOptimizationEnabled(true);
          
          // 5秒後に自動最適化
          setTimeout(() => {
            window.PerformanceOptimizer.applyOptimizations();
            window.Utils.log('info', '自動パフォーマンス最適化完了');
          }, 5000);
          
          window.Utils.log('success', 'パフォーマンス監視開始');
        }

        // E2Eテストの準備（開発環境のみ）
        if (window.DEBUG_MODE && window.E2ETestSuite) {
          window.Utils.log('info', 'E2Eテストスイート準備完了');
        }

        window.Utils.log('success', 'FRIENDLYモード完成版初期化完了');
        
      } catch (error) {
        window.Utils.log('error', '初期化エラー', error.message);
        setConnectionStatus('disconnected');
        setEncryptionStatus('error');
        setEncryptionInfo(prev => ({
          ...prev,
          error: error.message
        }));
      }
    };

    initializeApp();
  }, []);

  // =============================================================================
  // セッション管理エフェクト
  // =============================================================================
  useEffect(() => {
    if (currentSpace && window.SessionManager) {
      const updateSessionInfo = () => {
        const activeSessions = window.SessionManager.getActiveSessionsForSpace(currentSpace.id);
        const currentSession = window.SessionManager.getCurrentSession();
        
        setSessionCount(Math.max(activeSessions.length, 1));
        setSessionInfo({
          activeCount: activeSessions.length,
          currentSession: currentSession,
          spaceId: currentSpace.id,
          lastUpdate: new Date()
        });

        // 暗号化情報の更新
        if (encryptionStatus === 'enabled') {
          setEncryptionInfo(prev => ({
            ...prev,
            sessionCount: activeSessions.length,
            encryptionLevel: activeSessions.length > 1 ? 'hybrid' : 'deterministic',
            spaceId: currentSpace.id
          }));
        }
      };

      // 初回更新
      updateSessionInfo();

      // 定期更新（10秒ごと）
      const sessionUpdateInterval = setInterval(updateSessionInfo, 10000);

      return () => clearInterval(sessionUpdateInterval);
    }
  }, [currentSpace, encryptionStatus]);

  // =============================================================================
  // パフォーマンス監視エフェクト
  // =============================================================================
  useEffect(() => {
    if (optimizationEnabled && window.PerformanceOptimizer) {
      const performanceUpdateInterval = setInterval(() => {
        const report = window.PerformanceOptimizer.generateReport();
        setPerformanceData(report);
      }, 30000); // 30秒ごと

      return () => clearInterval(performanceUpdateInterval);
    }
  }, [optimizationEnabled]);

  // =============================================================================
  // 時刻更新エフェクト
  // =============================================================================
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  // =============================================================================
  // Socket.IO接続管理（FRIENDLYモード対応）
  // =============================================================================
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      window.Utils.log('info', 'FRIENDLYモード WebSocket接続初期化', { spaceId: currentSpace.id });
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
        
        // セッション情報をサーバーに送信
        if (window.SessionManager) {
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession) {
            newSocket.emit('session-info', {
              sessionId: currentSession.sessionId,
              spaceId: currentSpace.id
            });
          }
        }
      });

      // メッセージ受信（FRIENDLYモード対応）
      newSocket.on('message-received', async (data) => {
        window.Utils.log('info', 'FRIENDLYモード メッセージ受信', { from: data.from });
        
        if (data && data.message) {
          try {
            let receivedMessage = {
              ...data.message,
              timestamp: new Date(data.message.timestamp)
            };

            // FRIENDLYモード復号化処理
            if (receivedMessage.encrypted && window.API.encryptionSystem) {
              try {
                // ハイブリッド復号化を試行
                if (receivedMessage.encryptionType === 'hybrid' && window.Crypto.decryptMessageWithFallback) {
                  const decryptedText = await window.Crypto.decryptMessageWithFallback(receivedMessage, currentSpace.id);
                  receivedMessage.text = decryptedText;
                  window.Utils.log('success', 'ハイブリッド復号化成功');
                } else {
                  // 決定的復号化
                  const decryptedText = await window.API.decryptMessage(receivedMessage);
                  receivedMessage.text = decryptedText;
                  window.Utils.log('success', '決定的復号化成功');
                }
              } catch (decryptError) {
                window.Utils.log('warn', 'リアルタイム復号化失敗', decryptError.message);
                receivedMessage.text = '[リアルタイム復号化に失敗しました]';
                receivedMessage.encryptionType = 'error';
              }
            }
            
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === receivedMessage.id);
              if (exists) return prev;
              
              return [...prev, receivedMessage].sort((a, b) => a.timestamp - b.timestamp);
            });
          } catch (error) {
            window.Utils.log('error', 'リアルタイムメッセージ処理エラー', error.message);
          }
        }
      });

      // 暗号化状態エフェクト強化
      useEffect(() => {
        if (currentSpace && encryptionStatus === 'enabled') {
          const updateEncryptionDisplay = () => {
            const activeSessions = window.SessionManager.getActiveSessionsForSpace(currentSpace.id);
            const newEncryptionLevel = activeSessions.length > 1 ? 'hybrid' : 'deterministic';
            
            setEncryptionInfo(prev => ({
              ...prev,
              encryptionLevel: newEncryptionLevel,
              sessionCount: activeSessions.length,
              lastUpdate: new Date()
            }));
          };
          
          // 初回更新
          updateEncryptionDisplay();
          
          // 定期更新
          const interval = setInterval(updateEncryptionDisplay, 5000);
          return () => clearInterval(interval);
        }
      }, [currentSpace, sessionCount, encryptionStatus]);

      // セッション管理イベント
      newSocket.on('session-joined', (data) => {
        window.Utils.log('info', 'セッション参加通知', data);
        if (window.SessionManager && data.sessionId && data.spaceId === currentSpace.id) {
          window.SessionManager.addSessionToSpace(data.spaceId, data.sessionId);
        }
      });

      newSocket.on('session-left', (data) => {
        window.Utils.log('info', 'セッション退出通知', data);
        if (window.SessionManager && data.sessionId && data.spaceId === currentSpace.id) {
          window.SessionManager.removeSessionFromSpace(data.spaceId, data.sessionId);
        }
      });

      // その他のイベント
      newSocket.on('encryption-key-exchange', (data) => {
        window.Utils.log('debug', '暗号化キー交換', data);
        // 将来: 公開キー交換処理
      });

      newSocket.on('space-info-update', (data) => {
        window.Utils.log('debug', '空間情報更新', data);
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
        window.Utils.log('info', 'WebSocket接続クリーンアップ');
        if (newSocket.connected) {
          newSocket.emit('leave-space', currentSpace.id);
        }
        newSocket.disconnect();
        setConnectionStatus('disconnected');
      };
    }
  }, [currentSpace]);

  // =============================================================================
  // 空間入室処理（FRIENDLYモード完成版）
  // =============================================================================
  const handleEnterSpace = async () => {
    window.Utils.performance.start('enter_space_friendly');
    window.Utils.log('info', 'FRIENDLYモード空間入室開始', { passphraseLength: passphrase?.length });
    
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 暗号化システム準備
      if (encryptionStatus === 'enabled') {
        setEncryptionStatus('initializing');
      }

      // FRIENDLYモード対応空間入室
      const space = await window.API.enterSpace(validation.passphrase);
      
      // セッション初期化
      if (window.SessionManager) {
        const sessionId = window.SessionManager.initializeSession(space.id);
        window.Utils.log('success', 'セッション初期化完了', { 
          sessionId: sessionId.substring(0, 12) + '...',
          spaceId: space.id 
        });
      }
      
      // 状態更新
      setCurrentSpace(space);
      setCurrentView('chat');
      setPassphrase('');
      
      // FRIENDLYモード暗号化システム初期化
      if (window.API.encryptionSystem || encryptionStatus === 'initializing') {
        setEncryptionStatus('enabled');
        setEncryptionInfo(prev => ({
          ...prev,
          spaceId: space.id,
          publicKey: window.Utils.getSafePublicKey(window.API.encryptionSystem?.publicKey),
          initialized: true,
          keyType: 'hybrid_deterministic',
          passphrase: space.passphrase,
          mode: 'FRIENDLY',
          capabilities: ['決定的暗号化', 'ハイブリッド暗号化', 'セッション検出', 'フォールバック復号化']
        }));
        window.Utils.log('success', 'FRIENDLYモード暗号化システム確認完了');
      } else if (encryptionStatus === 'initializing') {
        setEncryptionStatus('disabled');
        window.Utils.log('warn', 'FRIENDLYモード暗号化システム初期化失敗');
      }
      
      // FRIENDLYモード対応メッセージ読み込み
      let loadedMessages = [];
      if (window.API.loadMessagesFriendly) {
        loadedMessages = await window.API.loadMessagesFriendly(space.id);
      } else {
        loadedMessages = await window.API.loadMessages(space.id);
      }
      setMessages(loadedMessages);
      
      window.Utils.log('success', 'FRIENDLYモード空間入室完了', { 
        spaceId: space.id, 
        messageCount: loadedMessages.length,
        encryptedCount: loadedMessages.filter(m => m.encrypted).length,
        hybridCount: loadedMessages.filter(m => m.encryptionType === 'hybrid').length,
        deterministicCount: loadedMessages.filter(m => m.encryptionType === 'deterministic').length,
        encryptionEnabled: !!window.API.encryptionSystem
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモード空間入室処理');
      setError(errorMessage);
      
      if (encryptionStatus === 'initializing') {
        setEncryptionStatus('error');
        setEncryptionInfo(prev => ({
          ...prev,
          error: errorMessage
        }));
      }
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('enter_space_friendly');
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
      
      const encryptionNote = encryptionStatus === 'enabled' ? 
        '\n🔒 FRIENDLYモード: 段階的E2EE暗号化が有効になります。' + 
        '\n• 単独時: 決定的暗号化' +
        '\n• 複数時: ハイブリッド暗号化' : 
        '\n⚠️ 暗号化機能が利用できないため、平文通信になります。';
        
      alert('✅ FRIENDLYモード対応の新しい空間を作成しました！' + encryptionNote + '\n作成した合言葉で入室してください。');
      
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
  // メッセージ送信処理（FRIENDLYモード対応）
  // =============================================================================
  const handleSendMessage = async () => {
    if (!message.trim() || !currentSpace) return;
    
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。\n新しい空間を作成してお試しください。');
      return;
    }

    window.Utils.performance.start('send_message_friendly');
    setIsLoading(true);

    try {
      let newMessage;
      
      // FRIENDLYモード対応送信
      if (window.API.sendMessageFriendly) {
        newMessage = await window.API.sendMessageFriendly(currentSpace.id, message);
        window.Utils.log('success', 'FRIENDLYモードメッセージ送信完了', {
          messageId: newMessage.id,
          encryptionType: newMessage.encryptionType,
          hasFallback: newMessage.hasFallback
        });
      } else {
        // フォールバック: 標準送信
        newMessage = await window.API.sendMessage(currentSpace.id, message);
        window.Utils.log('info', '標準メッセージ送信完了', { messageId: newMessage.id });
      }
      
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
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモードメッセージ送信処理');
      setError(errorMessage);
      
      setTimeout(() => {
        setError(prev => prev === errorMessage ? '' : prev);
      }, 3000);
      
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('send_message_friendly');
    }
  };

  // =============================================================================
  // 空間退室処理
  // =============================================================================
  const handleLeaveSpace = () => {
    window.Utils.log('info', 'FRIENDLYモード空間退室開始', { spaceId: currentSpace?.id });
    
    // WebSocket接続のクリーンアップ
    if (socket) {
      if (socket.connected && currentSpace) {
        socket.emit('leave-space', currentSpace.id);
      }
      socket.disconnect();
      setSocket(null);
    }
    
    // セッション管理のクリーンアップ
    if (window.SessionManager && currentSpace) {
      window.SessionManager.leaveSession(currentSpace.id);
    }
    
    // UIの状態リセット
    setCurrentSpace(null);
    setCurrentView('login');
    setMessages([]);
    setError('');
    setConnectionStatus('disconnected');
    setSessionCount(1);
    setSessionInfo(null);
    
    // 暗号化状態は保持（FRIENDLYモードの特徴）
    
    window.Utils.log('success', 'FRIENDLYモード空間退室完了');
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
  // レンダリング（FRIENDLYモード完成版）
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

  // チャット画面（FRIENDLYモード完成版UI使用）
  if (currentView === 'chat' && currentSpace) {
    // 統合チャットUIを使用
    if (window.IntegratedChatComponent) {
      return React.createElement(window.IntegratedChatComponent, {
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
        sessionCount,
        sessionInfo,
        performanceData,
        sessionCount,
        sessionInfo,
        performanceData,
        onSendMessage: handleSendMessage,
        onLeaveSpace: handleLeaveSpace
      });
    } else {
      // フォールバック: 既存のチャットコンポーネント
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
  }

  // フォールバック画面
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-900 text-white flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'text-center max-w-md' },
      React.createElement('h1', { className: 'text-2xl mb-4 text-red-400' }, 'FRIENDLYモードエラー'),
      React.createElement('p', { className: 'text-gray-300 mb-6' }, 'アプリケーションの状態に問題があります'),
      
      encryptionStatus === 'error' && encryptionInfo?.error && React.createElement(
        'div',
        { className: 'mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-300' },
        '🔒 暗号化エラー: ', encryptionInfo.error
      ),
      
      React.createElement(
        'button',
        {
          onClick: () => {
            setCurrentView('login');
            setCurrentSpace(null);
            setError('');
            setMessages([]);
            setEncryptionStatus(window.Crypto?.isSupported ? 'enabled' : 'disabled');
            window.Utils.log('info', 'FRIENDLYモード手動リセット実行');
          },
          className: 'bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition duration-200'
        },
        'ログイン画面に戻る'
      ),
      
      // FRIENDLYモード情報
      React.createElement(
        'div',
        { className: 'mt-6 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg text-sm text-blue-300' },
        React.createElement('h3', { className: 'font-bold mb-2' }, 'FRIENDLYモード機能:'),
        React.createElement('ul', { className: 'text-left text-xs space-y-1' },
          React.createElement('li', null, '• 決定的暗号化（単独セッション）'),
          React.createElement('li', null, '• ハイブリッド暗号化（複数セッション）'),
          React.createElement('li', null, '• フォールバック復号化'),
          React.createElement('li', null, '• セッション自動検出'),
          React.createElement('li', null, '• 過去メッセージ読み込み保証')
        )
      ),
      
      // デバッグ情報（開発環境のみ）
      window.DEBUG_MODE && React.createElement(
        'div',
        { className: 'mt-6 p-3 bg-gray-800 border border-gray-700 rounded-lg text-xs text-left' },
        React.createElement('h3', { className: 'font-bold mb-2' }, 'FRIENDLYモード デバッグ情報:'),
        React.createElement('pre', { className: 'text-gray-400 text-xs overflow-x-auto' }, JSON.stringify({
          encryptionStatus,
          encryptionInfo,
          connectionStatus,
          sessionCount,
          sessionInfo,
          cryptoSupported: window.Crypto?.isSupported,
          friendlyModeFeatures: window.API?.getEncryptionDebugInfo?.(),
          performanceData
        }, null, 2))
      )
    )
  );
};

// =============================================================================
// FRIENDLYモード専用デバッグ関数
// =============================================================================
if (window.DEBUG_MODE) {
  window.debugFriendlyMode = () => {
    console.log('🔍 FRIENDLYモード完成版状態デバッグ:');
    console.log('API情報:', window.API.getEncryptionDebugInfo?.());
    console.log('Crypto状態:', {
      spaceKeys: window.Crypto?.spaceKeys?.size || 0,
      passphraseCache: window.Crypto?.passphraseCache?.size || 0,
      allSpaceInfo: window.Crypto?.getAllSpaceKeyInfo?.()
    });
    console.log('セッション情報:', window.SessionManager?.getDebugInfo?.());
    if (window.PerformanceOptimizer) {
      console.log('パフォーマンス:', window.PerformanceOptimizer.generateReport());
    }
  };
  
  window.testFriendlyModeComplete = async () => {
    console.log('🧪 FRIENDLYモード完成版総合テスト開始...');
    
    // 1. E2Eテスト実行
    if (window.E2ETestSuite) {
      console.log('📋 E2Eテスト実行中...');
      await window.E2ETestSuite.runAllTests();
    }
    
    // 2. パフォーマンステスト実行
    if (window.PerformanceOptimizer) {
      console.log('⚡ パフォーマンステスト実行中...');
      await window.PerformanceOptimizer.runBenchmark();
    }
    
    // 3. 機能テスト実行
    if (window.Crypto?.testFriendlyEncryption) {
      console.log('🔒 FRIENDLYモード暗号化テスト実行中...');
      await window.Crypto.testFriendlyEncryption();
    }
    
    console.log('🎉 FRIENDLYモード完成版総合テスト完了！');
  };
  
  window.optimizeFriendlyMode = () => {
    if (window.PerformanceOptimizer) {
      window.PerformanceOptimizer.applyOptimizations();
      console.log('⚡ FRIENDLYモード最適化完了');
    }
  };
}

// =============================================================================
// アプリケーションマウント（FRIENDLYモード完成版）
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(SecureChatApp));
    
    window.Utils.log('success', 'FRIENDLYモード完成版アプリケーションマウント完了');
    
    // FRIENDLYモード機能のテスト（開発環境のみ）
    if (window.DEBUG_MODE) {
      setTimeout(() => {
        // 基本システムテスト
        if (window.Crypto && window.Crypto.isSupported) {
          window.Crypto.testEncryption().then(result => {
            console.log(`🧪 基本暗号化テスト: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
          });
        }
        
        // FRIENDLYモード専用テスト
        if (window.Crypto && window.Crypto.testFriendlyEncryption) {
          window.Crypto.testFriendlyEncryption().then(result => {
            console.log(`🧪 FRIENDLYモード暗号化テスト: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
            if (result.success) {
              console.log('🎊 FRIENDLYモード完成版が正常に動作しています！');
            }
          });
        }

        // UIコンポーネントの確認
        const components = [
          'EncryptionStatusComponent',
          'EnhancedMessageDisplay', 
          'IntegratedChatComponent',
          'E2ETestSuite',
          'PerformanceOptimizer'
        ];
        
        console.log('🔍 FRIENDLYモード完成版コンポーネント確認:');
        components.forEach(comp => {
          const exists = !!window[comp];
          console.log(`  ${comp}: ${exists ? '✅' : '❌'}`);
        });
        
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ FRIENDLYモード完成版マウント失敗:', error);
    
    document.getElementById('root').innerHTML = `
      <div style="min-height: 100vh; background: #111827; color: white; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
        <div style="text-align: center; max-width: 500px; padding: 2rem;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">FRIENDLYモード完成版の読み込みに失敗しました</h1>
          <p style="color: #9ca3af; margin-bottom: 1.5rem;">ページを再読み込みするか、ブラウザのコンソールでエラーを確認してください</p>
          <button onclick="location.reload()" style="background: #3b82f6; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; color: white; cursor: pointer; margin-right: 1rem;">
            再読み込み
          </button>
          <button onclick="console.log(typeof window.Crypto, typeof window.API)" style="background: #6b7280; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; color: white; cursor: pointer;">
            デバッグ情報
          </button>
        </div>
      </div>
    `;
  }
});

console.log('✅ FRIENDLYモード完成版 app.js loaded:', {
  version: 'FRIENDLYモード完成版',
  features: [
    'ハイブリッド暗号化システム', 
    '統合UI', 
    'E2Eテストスイート', 
    'パフォーマンス最適化',
    'セッション管理',
    'フォールバック復号化',
    '暗号化状態可視化'
  ],
  debugMode: window.DEBUG_MODE,
  timestamp: new Date().toISOString()
});