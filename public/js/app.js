// メインアプリケーション（FRIENDLYモード完成版統合・Socket.IO強化）
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
  
  // 🆕 Socket.IO統合強化用状態
  const [realtimeUsers, setRealtimeUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [keyExchangeStatus, setKeyExchangeStatus] = useState({});
  
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
  // セッション管理エフェクト（Socket.IO統合強化）
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

        // 🔧 Action 1.2: 暗号化情報の更新（修正版）
        if (encryptionStatus === 'enabled') {
          const newEncryptionLevel = activeSessions.length > 1 ? 'hybrid' : 'deterministic';
          
          setEncryptionInfo(prev => {
            // 🆕 暗号化レベル変更の通知（setEncryptionInfo内で処理）
            if (prev && prev.encryptionLevel && prev.encryptionLevel !== newEncryptionLevel) {
              window.Utils.log('info', '🔄 暗号化レベル変更', {
                from: prev.encryptionLevel,
                to: newEncryptionLevel,
                sessionCount: activeSessions.length
              });
              
              // 🆕 Socket.IOに暗号化レベル変更を通知
              if (socket && socket.connected) {
                socket.emit('encryption-level-changed', {
                  spaceId: currentSpace.id,
                  encryptionLevel: newEncryptionLevel,
                  sessionCount: activeSessions.length,
                  timestamp: new Date().toISOString()
                });
              }
            }
            
            return {
              ...prev,
              sessionCount: activeSessions.length,
              encryptionLevel: newEncryptionLevel,
              spaceId: currentSpace.id,
              lastUpdate: new Date(),
              realTimeStatus: `${newEncryptionLevel}暗号化 (${activeSessions.length}セッション)`,
              capabilities: newEncryptionLevel === 'hybrid' ? 
                ['ハイブリッド暗号化', 'セッション暗号化', 'フォールバック復号化'] : 
                ['決定的暗号化', 'パスフレーズベース', 'フォールバック復号化'],
              displayText: newEncryptionLevel === 'hybrid' ? 
                `🔗 ハイブリッド暗号化 (${activeSessions.length}セッション)` :
                '🔑 決定的暗号化 (単独セッション)',
              performanceNote: newEncryptionLevel === 'hybrid' ? 
                'セキュリティ強化済み' : 'パフォーマンス最適化'
            };
          });
        }
      };

      // 初回更新
      updateSessionInfo();

      // 🔧 Action 1.2: 更新頻度を5秒に短縮
      const sessionUpdateInterval = setInterval(updateSessionInfo, 5000);

      return () => clearInterval(sessionUpdateInterval);
    }
  }, [currentSpace, encryptionStatus, socket]);

  // 🆕 Action 1.2で追加: 暗号化状態変更専用エフェクト（簡略版）
  useEffect(() => {
    if (currentSpace && encryptionStatus === 'enabled' && sessionCount > 0) {
      // セッション数変更時のリアルタイム表示更新
      const currentLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
      
      window.Utils.log('debug', '🔄 セッション状態更新', {
        spaceId: currentSpace.id,
        sessionCount,
        encryptionLevel: currentLevel
      });
    }
  }, [currentSpace, sessionCount, encryptionStatus]);

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
  // Socket.IO接続管理（FRIENDLYモード統合強化版）
  // =============================================================================
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      window.Utils.log('info', 'FRIENDLYモード Socket.IO統合強化版接続初期化', { spaceId: currentSpace.id });
      setConnectionStatus('connecting');
      
      // 🆕 接続統計管理
      const connectionStats = {
        attempts: 0,
        successfulConnections: 0,
        lastSuccessTime: null,
        errorCounts: {
          connect_error: 0,
          disconnect: 0,
          timeout: 0
        }
      };
      
      // 🆕 自動復旧管理
      const recoveryManager = {
        isRecovering: false,
        maxRetries: 5,
        retryDelay: 1000,
        backoffMultiplier: 1.5,
        lastRecoveryAttempt: null
      };
      
      const newSocket = io(window.SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        maxReconnectionAttempts: 10,
        // 🆕 強化された接続オプション
        forceNew: false,
        multiplex: true,
        autoConnect: true
      });

      // =============================================================================
      // 🆕 強化された接続状態管理
      // =============================================================================
      
      const handleConnectionSuccess = () => {
        connectionStats.attempts++;
        connectionStats.successfulConnections++;
        connectionStats.lastSuccessTime = new Date();
        recoveryManager.isRecovering = false;
        
        window.Utils.log('success', 'Socket.IO接続成功', {
          attempts: connectionStats.attempts,
          successRate: (connectionStats.successfulConnections / connectionStats.attempts * 100).toFixed(1) + '%'
        });
        
        setConnectionStatus('connected');
        setError(''); // 接続成功時にエラーをクリア
        
        // 基本的な空間参加
        newSocket.emit('join-space', currentSpace.id);
        
        // セッション情報送信（強化版）
        if (window.SessionManager) {
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession) {
            newSocket.emit('session-info', {
              sessionId: currentSession.sessionId,
              spaceId: currentSpace.id,
              timestamp: new Date().toISOString(),
              recoveryMode: recoveryManager.isRecovering,
              connectionStats: {
                attempts: connectionStats.attempts,
                successRate: connectionStats.successfulConnections / connectionStats.attempts
              }
            });
          }
        }
      };

      // 🆕 自動復旧処理
      const attemptRecovery = async (reason) => {
        if (recoveryManager.isRecovering) {
          window.Utils.log('debug', 'Recovery already in progress, skipping');
          return;
        }
        
        recoveryManager.isRecovering = true;
        recoveryManager.lastRecoveryAttempt = new Date();
        
        window.Utils.log('info', `Socket.IO自動復旧開始: ${reason}`);
        setConnectionStatus('recovering');
        
        // 段階的復旧処理
        for (let attempt = 1; attempt <= recoveryManager.maxRetries; attempt++) {
          try {
            window.Utils.log('debug', `復旧試行 ${attempt}/${recoveryManager.maxRetries}`);
            
            // 接続状態確認
            if (newSocket.connected) {
              window.Utils.log('success', '接続が既に復旧済み');
              handleConnectionSuccess();
              return;
            }
            
            // 強制再接続
            if (!newSocket.connected) {
              newSocket.connect();
            }
            
            // 接続確認の待機
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
              }, 5000);
              
              const onConnect = () => {
                clearTimeout(timeout);
                newSocket.off('connect', onConnect);
                resolve();
              };
              
              newSocket.on('connect', onConnect);
            });
            
            // 復旧成功
            window.Utils.log('success', `Socket.IO復旧成功 (試行${attempt}回目)`);
            handleConnectionSuccess();
            return;
            
          } catch (error) {
            window.Utils.log('warn', `復旧試行${attempt}失敗: ${error.message}`);
            
            if (attempt === recoveryManager.maxRetries) {
              // 最終試行失敗
              window.Utils.log('error', 'Socket.IO復旧失敗 - 手動再接続が必要');
              setConnectionStatus('failed');
              setError('🔌 リアルタイム機能に接続できません。ページを再読み込みしてください。');
              recoveryManager.isRecovering = false;
              return;
            }
            
            // リトライ遅延
            const delay = recoveryManager.retryDelay * Math.pow(recoveryManager.backoffMultiplier, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      };

      // =============================================================================
      // 🆕 強化されたエラーハンドリング
      // =============================================================================
      
      newSocket.on('connect', handleConnectionSuccess);
      
      newSocket.on('disconnect', (reason) => {
        connectionStats.errorCounts.disconnect++;
        window.Utils.log('warn', 'Socket.IO接続切断', { 
          reason,
          disconnectCount: connectionStats.errorCounts.disconnect 
        });
        
        setConnectionStatus('disconnected');
        setRealtimeUsers([]);
        setTypingUsers([]);
        
        // 自動復旧判定
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          // 予期しない切断の場合は自動復旧
          setTimeout(() => {
            attemptRecovery(`disconnect: ${reason}`);
          }, 2000);
        }
      });

      newSocket.on('connect_error', (error) => {
        connectionStats.attempts++;
        connectionStats.errorCounts.connect_error++;
        
        window.Utils.log('error', 'Socket.IO接続エラー', {
          error: error.message,
          attempts: connectionStats.attempts,
          errorCount: connectionStats.errorCounts.connect_error
        });
        
        setConnectionStatus('error');
        
        // 🆕 エラー種別による対応分岐
        if (error.message.includes('timeout')) {
          connectionStats.errorCounts.timeout++;
          setError('⏰ 接続がタイムアウトしました。ネットワーク環境を確認してください。');
        } else if (error.message.includes('refused')) {
          setError('🚫 サーバーに接続できません。しばらく時間をおいて再試行してください。');
        } else {
          setError(`🔌 接続エラー: ${error.message}`);
        }
        
        // 一定時間後に自動復旧を試行
        if (connectionStats.errorCounts.connect_error <= 3) {
          setTimeout(() => {
            attemptRecovery(`connect_error: ${error.message}`);
          }, 3000);
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        window.Utils.log('success', 'Socket.IO再接続成功', { attemptNumber });
        handleConnectionSuccess();
        
        // 🆕 再接続後の状態復旧
        restoreSessionState();
      });

      newSocket.on('reconnect_failed', () => {
        window.Utils.log('error', 'Socket.IO再接続失敗');
        setConnectionStatus('failed');
        setError('🔄 自動再接続に失敗しました。手動で再接続してください。');
        
        // 手動再接続ボタンの表示
        setEncryptionInfo(prev => ({
          ...prev,
          showManualReconnect: true
        }));
      });

      // =============================================================================
      // 🆕 セッション状態復旧
      // =============================================================================
      
      const restoreSessionState = () => {
        window.Utils.log('info', 'セッション状態復旧開始');
        
        // 空間に再参加
        newSocket.emit('join-space', currentSpace.id);
        
        // セッション情報の再送信
        if (window.SessionManager) {
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession) {
            newSocket.emit('session-info', {
              sessionId: currentSession.sessionId,
              spaceId: currentSpace.id,
              timestamp: new Date().toISOString(),
              isReconnection: true
            });
          }
          
          // Socket.IOインスタンスを SessionManager に設定
          if (window.SessionManager.setSocket) {
            window.SessionManager.setSocket(newSocket);
          }
        }
        
        // 暗号化レベルの再同期
        if (encryptionStatus === 'enabled' && sessionCount > 0) {
          const currentLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
          newSocket.emit('encryption-level-changed', {
            spaceId: currentSpace.id,
            encryptionLevel: currentLevel,
            sessionCount: sessionCount,
            timestamp: new Date().toISOString(),
            isReconnection: true
          });
        }
      };

      // 🆕 手動再接続機能
      window.manualReconnect = () => {
        window.Utils.log('info', '手動再接続実行');
        setError('');
        setEncryptionInfo(prev => ({
          ...prev,
          showManualReconnect: false
        }));
        
        attemptRecovery('manual_reconnect');
      };

      // =============================================================================
      // 🆕 接続品質監視
      // =============================================================================
      
      const connectionMonitor = setInterval(() => {
        if (newSocket.connected) {
          // ping-pong による接続品質確認
          const pingStart = Date.now();
          newSocket.emit('ping', pingStart);
          
          newSocket.once('pong', (timestamp) => {
            const latency = Date.now() - timestamp;
            window.Utils.log('debug', `Socket.IO レイテンシ: ${latency}ms`);
            
            // 高いレイテンシの警告
            if (latency > 2000) {
              window.Utils.log('warn', `高いレイテンシを検出: ${latency}ms`);
              setConnectionStatus('slow');
            } else if (connectionStatus === 'slow' && latency < 1000) {
              setConnectionStatus('connected');
            }
          });
        }
      }, 30000); // 30秒ごと

      // =============================================================================
      // 🆕 拡張されたメッセージ処理
      // =============================================================================
      
      newSocket.on('message-received', async (data) => {
        try {
          window.Utils.log('info', 'FRIENDLYモード統合強化版 メッセージ受信', { from: data.from });
          
          if (data && data.message) {
            let receivedMessage = {
              ...data.message,
              timestamp: new Date(data.message.timestamp),
              sessionCount: data.sessionCount || 1,
              encryptionInfo: data.encryptionInfo || null
            };

            // 🆕 強化された復号化処理
            if (receivedMessage.encrypted && window.API.encryptionSystem) {
              try {
                let decryptedText;
                
                // ハイブリッド復号化を試行
                if (receivedMessage.encryptionType === 'hybrid' && window.Crypto.decryptMessageWithFallback) {
                  decryptedText = await window.Crypto.decryptMessageWithFallback(receivedMessage, currentSpace.id);
                  window.Utils.log('success', 'ハイブリッド復号化成功');
                } else {
                  // 決定的復号化
                  decryptedText = await window.API.decryptMessage(receivedMessage);
                  window.Utils.log('success', '決定的復号化成功');
                }
                
                receivedMessage.text = decryptedText;
                
              } catch (decryptError) {
                window.Utils.log('warn', 'リアルタイム復号化失敗', decryptError.message);
                
                // 🆕 復号化失敗時の詳細処理
                if (decryptError.message.includes('key')) {
                  receivedMessage.text = '🔑 暗号化キーを同期中... しばらくお待ちください';
                  receivedMessage.encryptionType = 'key_sync_needed';
                  
                  // 5秒後に復号化を再試行
                  setTimeout(async () => {
                    try {
                      const retryDecrypted = await window.API.decryptMessage(receivedMessage);
                      
                      setMessages(prev => prev.map(msg => 
                        msg.id === receivedMessage.id ? 
                          { ...msg, text: retryDecrypted, encryptionType: 'deterministic' } : 
                          msg
                      ));
                      
                      window.Utils.log('success', '遅延復号化成功');
                    } catch (retryError) {
                      window.Utils.log('error', '遅延復号化も失敗', retryError.message);
                    }
                  }, 5000);
                  
                } else {
                  receivedMessage.text = '[リアルタイム復号化に失敗しました]';
                  receivedMessage.encryptionType = 'error';
                }
              }
            }
            
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === receivedMessage.id);
              if (exists) return prev;
              
              return [...prev, receivedMessage].sort((a, b) => a.timestamp - b.timestamp);
            });
          }
        } catch (error) {
          window.Utils.log('error', 'リアルタイムメッセージ処理エラー', error.message);
        }
      });

      // ErrorHandler との統合
      if (window.ErrorHandler && window.ErrorHandler.attachSocketErrorHandlers) {
        window.ErrorHandler.attachSocketErrorHandlers(newSocket);
      }

      setSocket(newSocket);

      // クリーンアップ
      return () => {
        window.Utils.log('info', 'Socket.IO統合強化版クリーンアップ');
        
        clearInterval(connectionMonitor);
        
        if (newSocket.connected) {
          newSocket.emit('leave-space', currentSpace.id);
        }
        
        newSocket.disconnect();
        setConnectionStatus('disconnected');
        setRealtimeUsers([]);
        setTypingUsers([]);
        setKeyExchangeStatus({});
        
        // グローバル関数のクリーンアップ
        delete window.manualReconnect;
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
      // 🆕 暗号化初期化の段階的リトライ機能
      const initializeEncryptionWithRetry = async (space, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            setEncryptionStatus('initializing');
            setEncryptionInfo(prev => ({
              ...prev,
              status: `初期化試行中... (${attempt}/${maxRetries})`,
              attempt: attempt
            }));

            const encryptionInitialized = await window.API.initializeEncryption(space.id, space.passphrase);
            
            if (encryptionInitialized) {
              setEncryptionStatus('enabled');
              setEncryptionInfo(prev => ({
                ...prev,
                spaceId: space.id,
                publicKey: window.Utils.getSafePublicKey(window.API.encryptionSystem?.publicKey),
                initialized: true,
                keyType: 'hybrid_deterministic',
                passphrase: space.passphrase,
                mode: 'FRIENDLY',
                capabilities: ['決定的暗号化', 'ハイブリッド暗号化', 'セッション検出', 'フォールバック復号化'],
                initializationAttempts: attempt,
                recoveryTime: new Date().toISOString()
              }));
              
              window.Utils.log('success', `暗号化初期化成功 (試行${attempt}回目)`);
              return true;
            }
            
            throw new Error(`暗号化初期化失敗 (試行${attempt}回目)`);
            
          } catch (error) {
            window.Utils.log('warn', `暗号化初期化失敗 (${attempt}/${maxRetries})`, {
              error: error.message,
              attempt,
              willRetry: attempt < maxRetries
            });
            
            if (attempt === maxRetries) {
              // 最終試行後の処理
              setEncryptionStatus('error');
              setEncryptionInfo(prev => ({
                ...prev,
                error: `暗号化初期化に失敗しました (${maxRetries}回試行)`,
                lastError: error.message,
                fallbackMode: true,
                attempts: maxRetries
              }));
              
              // 🆕 エラーリカバリーの選択肢を提供
              showEncryptionRecoveryOptions(space, error);
              return false;
            }
            
            // リトライ前の遅延（指数バックオフ）
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        return false;
      };

      // 🆕 暗号化リカバリーオプション表示
      const showEncryptionRecoveryOptions = (space, error) => {
        const recoveryActions = [];
        
        if (error.message.includes('passphrase')) {
          recoveryActions.push('パスフレーズの再確認');
        }
        
        if (error.message.includes('key')) {
          recoveryActions.push('キーキャッシュのクリア');
        }
        
        if (error.message.includes('network')) {
          recoveryActions.push('ネットワーク接続の確認');
        }
        
        recoveryActions.push('平文モードで継続');
        
        // UIに回復オプションを表示
        setEncryptionInfo(prev => ({
          ...prev,
          recoveryOptions: recoveryActions,
          showRecoveryUI: true
        }));
      };

      // 空間入室処理
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
      
      // 🆕 強化された暗号化初期化
      if (encryptionStatus === 'enabled' || encryptionStatus === 'disabled') {
        const encryptionSuccess = await initializeEncryptionWithRetry(space);
        
        if (!encryptionSuccess) {
          // 暗号化失敗でも継続可能
          window.Utils.log('warn', '暗号化無しで継続します');
          setError('⚠️ 暗号化機能が利用できませんが、平文モードで継続します');
          
          setTimeout(() => {
            setError('');
          }, 5000);
        }
      }
      
      // メッセージ読み込み（FRIENDLYモード対応）
      let loadedMessages = [];
      try {
        if (window.API.loadMessagesFriendly) {
          loadedMessages = await window.API.loadMessagesFriendly(space.id);
        } else {
          loadedMessages = await window.API.loadMessages(space.id);
        }
        setMessages(loadedMessages);
      } catch (messageError) {
        window.Utils.log('error', 'メッセージ読み込みエラー', messageError.message);
        setError('メッセージの読み込みに失敗しましたが、新しいメッセージは送信できます');
        
        setTimeout(() => {
          setError('');
        }, 3000);
      }
      
      window.Utils.log('success', 'FRIENDLYモード空間入室完了', { 
        spaceId: space.id, 
        messageCount: loadedMessages.length,
        encryptionEnabled: encryptionStatus === 'enabled'
      });
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモード空間入室処理');
      setError(errorMessage);
      
      // 🆕 重大エラーの場合の回復処理
      if (error.message.includes('network') || error.message.includes('server')) {
        // ネットワークエラーの場合のフォールバック
        setError(prev => prev + '\n\n🔄 ネットワーク接続を確認して再試行してください');
        
        // 自動再接続の準備
        setTimeout(() => {
          if (window.API.testConnection) {
            window.API.testConnection().then(connected => {
              if (connected) {
                setError('✅ 接続が復旧しました。再度お試しください');
                setTimeout(() => setError(''), 3000);
              }
            });
          }
        }, 5000);
      }
      
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('enter_space_friendly');
    }
  };

  // 🆕 暗号化リカバリー実行関数
  const executeEncryptionRecovery = async (action, space) => {
    setIsLoading(true);
    setError('');
    
    try {
      switch (action) {
        case 'clearKeyCache':
          if (window.Crypto?.cleanupAllKeys) {
            window.Crypto.cleanupAllKeys();
            window.Utils.log('info', 'キーキャッシュをクリアしました');
          }
          break;
          
        case 'retryEncryption':
          await window.API.initializeEncryption(space.id, space.passphrase);
          break;
          
        case 'plaintextMode':
          setEncryptionStatus('disabled');
          setEncryptionInfo({
            supported: false,
            mode: 'plaintext',
            reason: 'ユーザー選択',
            manualDisable: true
          });
          break;
      }
      
      setEncryptionInfo(prev => ({
        ...prev,
        showRecoveryUI: false,
        recoveryOptions: null
      }));
      
    } catch (error) {
      setError(`回復処理に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
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
  // メッセージ送信処理（FRIENDLYモード対応・Socket.IO強化）
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
      
      // 🆕 Socket.IOで他のユーザーに送信（強化版）
      if (socket && socket.connected) {
        socket.emit('new-message', {
          spaceId: currentSpace.id,
          message: newMessage,
          encryptionInfo: {
            type: newMessage.encryptionType || 'deterministic',
            sessionCount: sessionCount,
            hasFallback: newMessage.hasFallback
          }
        });
        
        // セッション活性度更新をサーバーに通知
        socket.emit('session-activity', {
          spaceId: currentSpace.id,
          activity: 'message_sent',
          notifyOthers: false
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
    setRealtimeUsers([]);
    setTypingUsers([]);
    setKeyExchangeStatus({});
    
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
    // 統合チャットUIを使用（Socket.IO統合強化版）
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
        // 🆕 Socket.IO統合強化版用の props
        realtimeUsers,
        typingUsers,
        keyExchangeStatus,
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
            setRealtimeUsers([]);
            setTypingUsers([]);
            setKeyExchangeStatus({});
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
          React.createElement('li', null, '• 過去メッセージ読み込み保証'),
          React.createElement('li', null, '• リアルタイムセッション同期'),
          React.createElement('li', null, '• 暗号化レベル自動切り替え')
        )
      ),
      
      // デバッグ情報（開発環境のみ）
      window.DEBUG_MODE && React.createElement(
        'div',
        { className: 'mt-6 p-3 bg-gray-800 border border-gray-700 rounded-lg text-xs text-left' },
        React.createElement('h3', { className: 'font-bold mb-2' }, 'FRIENDLYモード Socket.IO統合強化版 デバッグ情報:'),
        React.createElement('pre', { className: 'text-gray-400 text-xs overflow-x-auto' }, JSON.stringify({
          encryptionStatus,
          encryptionInfo,
          connectionStatus,
          sessionCount,
          sessionInfo,
          realtimeUsers,
          typingUsers,
          keyExchangeStatus,
          cryptoSupported: window.Crypto?.isSupported,
          friendlyModeFeatures: window.API?.getEncryptionDebugInfo?.(),
          performanceData
        }, null, 2))
      )
    )
  );
};

// =============================================================================
// FRIENDLYモード専用デバッグ関数（Socket.IO統合強化）
// =============================================================================
if (window.DEBUG_MODE) {
  window.debugFriendlyMode = () => {
    console.log('🔍 FRIENDLYモード Socket.IO統合強化版状態デバッグ:');
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
    console.log('🧪 FRIENDLYモード Socket.IO統合強化版総合テスト開始...');
    
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
    
    console.log('🎉 FRIENDLYモード Socket.IO統合強化版総合テスト完了！');
  };
  
  window.optimizeFriendlyMode = () => {
    if (window.PerformanceOptimizer) {
      window.PerformanceOptimizer.applyOptimizations();
      console.log('⚡ FRIENDLYモード最適化完了');
    }
  };
}

// =============================================================================
// アプリケーションマウント（FRIENDLYモード Socket.IO統合強化版）
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(SecureChatApp));
    
    window.Utils.log('success', 'FRIENDLYモード Socket.IO統合強化版アプリケーションマウント完了');
    
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
              console.log('🎊 FRIENDLYモード Socket.IO統合強化版が正常に動作しています！');
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
        
        console.log('🔍 FRIENDLYモード Socket.IO統合強化版コンポーネント確認:');
        components.forEach(comp => {
          const exists = !!window[comp];
          console.log(`  ${comp}: ${exists ? '✅' : '❌'}`);
        });
        
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ FRIENDLYモード Socket.IO統合強化版マウント失敗:', error);
    
    document.getElementById('root').innerHTML = `
      <div style="min-height: 100vh; background: #111827; color: white; display: flex; align-items: center; justify-content: center; font-family: system-ui;">
        <div style="text-align: center; max-width: 500px; padding: 2rem;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem; color: #ef4444;">FRIENDLYモード Socket.IO統合強化版の読み込みに失敗しました</h1>
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

console.log('✅ FRIENDLYモード Socket.IO統合強化版 app.js loaded:', {
  version: 'FRIENDLYモード Socket.IO統合強化版',
  features: [
    'ハイブリッド暗号化システム', 
    '統合UI', 
    'E2Eテストスイート', 
    'パフォーマンス最適化',
    'セッション管理',
    'フォールバック復号化',
    '暗号化状態可視化',
    'リアルタイムセッション同期',
    '暗号化レベル自動切り替え',
    'キー交換サポート（基本版）',
    'タイピング状態表示',
    'ユーザー参加/退出通知'
  ],
  debugMode: window.DEBUG_MODE,
  timestamp: new Date().toISOString()
});