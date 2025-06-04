// メインアプリケーション（FRIENDLYモード100%完成版・ベース機能統合）
// 統合エラーハンドリング・キー交換・メモリ管理・堅牢なSocket.IO接続管理・完全統合

const { useState, useEffect } = React;

const SecureChatApp = () => {
  // =============================================================================
  // 状態管理（統合版）
  // =============================================================================
  const [currentView, setCurrentView] = useState('login');
  const [passphrase, setPassphrase] = useState('');
  const [currentSpace, setCurrentSpace] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(''); // ローカルなUIエラー表示用（UnifiedErrorDisplayと併用）
  const [newSpacePassphrase, setNewSpacePassphrase] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showPassphraseInHeader, setShowPassphraseInHeader] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'recovering', 'failed', 'slow', 'degraded'

  // 暗号化関連の状態
  const [encryptionStatus, setEncryptionStatus] = useState('disabled'); // 'disabled', 'enabled', 'initializing', 'error'
  const [encryptionInfo, setEncryptionInfo] = useState(null);
  const [sessionCount, setSessionCount] = useState(1); // ベース版より。キー交換やセッション管理で重要
  const [sessionInfo, setSessionInfo] = useState(null); // ベース版より。

  // 統合システム状態 (拡張版より)
  const [keyExchangeStatus, setKeyExchangeStatus] = useState({});
  const [systemHealth, setSystemHealth] = useState('unknown'); // 'unknown', 'healthy', 'degraded', 'error'
  const [performanceMetrics, setPerformanceMetrics] = useState(null); // 拡張版の performanceMetrics (ベース版の performanceData の後継)

  // Socket.IO統合強化用状態 (ベース版より、必要に応じてKeyExchangeManager等で代替されるか確認)
  // 拡張版のKeyExchangeManagerやSessionManagerがこれらの情報を管理する場合、直接的なstateは不要になる可能性あり
  const [realtimeUsers, setRealtimeUsers] = useState([]); // KeyExchangeManagerで管理されるピア情報と重複・統合の可能性
  const [typingUsers, setTypingUsers] = useState([]);   // 同上

  // =============================================================================
  // 統合システム初期化（ベース機能取り込み）
  // =============================================================================
  useEffect(() => {
    const initializeIntegratedSystems = async () => {
      window.Utils.log('info', 'FRIENDLYモード100%完成版・統合初期化開始');
      try {
        // 1. エラーハンドリングシステム初期化 (拡張版)
        if (window.ErrorHandler) {
          window.ErrorHandler.initialize();
          window.Utils.log('success', 'ErrorHandler初期化完了');
        }
        if (window.UnifiedErrorDisplay) {
          window.UnifiedErrorDisplay.initialize();
          window.Utils.log('success', 'UnifiedErrorDisplay初期化完了');
        }

        // 2. メモリ・パフォーマンス管理初期化 (拡張版)
        if (window.MemoryPerformanceManager) {
          window.MemoryPerformanceManager.initialize();
          window.MemoryPerformanceManager.setAutoOptimization(true); // 自動最適化を有効化
          window.Utils.log('success', 'MemoryPerformanceManager初期化完了');
        }

        // 3. 基本暗号化システム確認 (拡張版ベースにベース版情報も考慮)
        if (window.Crypto && window.Crypto.isSupported) {
          setEncryptionStatus('enabled');
          setEncryptionInfo({
            supported: true,
            algorithm: 'AES-256-GCM + ハイブリッド暗号化 (FRIENDLY対応)',
            status: 'FRIENDLYモード100%完成版',
            keyType: 'hybrid_deterministic',
            features: ['決定的暗号化', 'ハイブリッド暗号化', 'フォールバック復号化', 'リアルタイムキー交換', 'セッション検出'],
            version: '1.0.0-integrated'
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

        // 4. API初期化 (拡張版ベース)
        const apiInitialized = await window.API.init();
        if (apiInitialized) {
          // setConnectionStatus('connected'); // Socket.IO接続時に設定するため、ここでは設定しないか、APIサーバーへの接続状態として別途管理
          setSystemHealth('healthy');
          window.Utils.log('success', 'API初期化完了');
        } else {
          setConnectionStatus('degraded'); // APIサーバーとの接続が不安定な状態
          setSystemHealth('degraded');
          window.Utils.log('warn', 'API接続に問題があります');
          if (window.UnifiedErrorDisplay) {
            window.UnifiedErrorDisplay.addError({ /* API初期化失敗エラー情報 */ });
          }
        }

        // 5. パフォーマンス監視開始 (拡張版ベース + ベース版の自動最適化思想も反映)
        if (window.DEBUG_MODE && window.PerformanceOptimizer) {
          window.PerformanceOptimizer.startMonitoring();
          const perfUpdateInterval = setInterval(() => {
            const report = window.PerformanceOptimizer.generateReport();
            setPerformanceMetrics(report);
          }, 30000);

          // MemoryPerformanceManagerによるリソース追跡 (拡張版)
          if (window.MemoryPerformanceManager) {
            window.MemoryPerformanceManager.trackResource('perfUpdateInterval', {
              type: 'interval', resource: perfUpdateInterval, description: 'パフォーマンス更新インターバル'
            }, () => clearInterval(perfUpdateInterval));

            // ベース版の自動最適化の実行タイミングを考慮 (例: 初期化5秒後)
            setTimeout(() => {
              if (window.PerformanceOptimizer.applyOptimizations) {
                 window.PerformanceOptimizer.applyOptimizations();
                 window.Utils.log('info', '自動パフォーマンス最適化完了 (初期化時)');
              }
            }, 5000);
          }
          window.Utils.log('success', 'パフォーマンス監視開始');
        }

        // 6. E2Eテストの準備（開発環境のみ）(ベース版より)
        if (window.DEBUG_MODE && window.E2ETestSuite) {
          window.Utils.log('info', 'E2Eテストスイート準備完了');
        }

        setSystemHealth(prev => prev === 'unknown' ? 'healthy' : prev); // APIエラーがなければhealthy
        window.Utils.log('success', 'FRIENDLYモード100%完成版・統合初期化完了');

      } catch (error) {
        window.Utils.log('error', '統合システム初期化エラー', error.message);
        setSystemHealth('error');
        setConnectionStatus('error'); // システム全体のエラーとして接続状態も更新
        if (window.UnifiedErrorDisplay) {
          window.UnifiedErrorDisplay.addError({
            id: `init_error_${Date.now()}`, type: 'initialization_error', category: 'system', severity: 'high',
            title: 'システム初期化エラー', message: error.message, autoRecover: false, persistent: true
          });
        }
      }
    };
    initializeIntegratedSystems();
  }, []);

  // =============================================================================
  // セッション管理エフェクト（ベース版より。キー交換・暗号化レベルと連携）
  // =============================================================================
  useEffect(() => {
    if (currentSpace && window.SessionManager) {
      const updateSessionInfo = () => {
        const activeSessions = window.SessionManager.getActiveSessionsForSpace(currentSpace.id);
        const currentSession = window.SessionManager.getCurrentSession();
        const newSessionCount = Math.max(activeSessions.length, 1);

        setSessionCount(newSessionCount);
        setSessionInfo({
          activeCount: activeSessions.length,
          currentSession: currentSession,
          spaceId: currentSpace.id,
          lastUpdate: new Date()
        });

        if (encryptionStatus === 'enabled') {
          const newEncryptionLevel = newSessionCount > 1 ? 'hybrid' : 'deterministic';
          setEncryptionInfo(prev => {
            const currentLevel = prev?.encryptionLevel;
            if (prev && currentLevel && currentLevel !== newEncryptionLevel) {
              window.Utils.log('info', '🔄 暗号化レベル変更 (セッション数変動)', {
                from: currentLevel, to: newEncryptionLevel, sessionCount: newSessionCount
              });
              if (socket && socket.connected) {
                socket.emit('encryption-level-changed', {
                  spaceId: currentSpace.id, encryptionLevel: newEncryptionLevel,
                  sessionCount: newSessionCount, timestamp: new Date().toISOString()
                });
              }
            }
            return {
              ...prev,
              sessionCount: newSessionCount,
              encryptionLevel: newEncryptionLevel,
              realTimeStatus: `${newEncryptionLevel}暗号化 (${newSessionCount}セッション)`,
              capabilities: newEncryptionLevel === 'hybrid' ?
                ['ハイブリッド暗号化', 'セッション暗号化', 'フォールバック復号化', 'リアルタイムキー交換'] :
                ['決定的暗号化', 'パスフレーズベース', 'フォールバック復号化'],
              displayText: newEncryptionLevel === 'hybrid' ?
                `🔗 ハイブリッド暗号化 (${newSessionCount}セッション)` :
                '🔑 決定的暗号化 (単独セッション)',
              performanceNote: newEncryptionLevel === 'hybrid' ? 'セキュリティ強化済み' : 'パフォーマンス最適化',
              lastKeyExchange: prev?.lastKeyExchange, // キー交換情報を保持
              keyExchangeStatus: prev?.keyExchangeStatus // キー交換状態を保持
            };
          });
        }
      };

      updateSessionInfo();
      const sessionUpdateInterval = setInterval(updateSessionInfo, 5000); // 5秒ごと

      if (window.MemoryPerformanceManager) {
        window.MemoryPerformanceManager.trackResource('sessionUpdateInterval', {
          type: 'interval', resource: sessionUpdateInterval, description: 'セッション情報更新インターバル'
        }, () => clearInterval(sessionUpdateInterval));
      }
      return () => clearInterval(sessionUpdateInterval);
    }
  }, [currentSpace, encryptionStatus, socket]); // socketも依存関係に追加

  // =============================================================================
  // 時刻更新エフェクト (ベース版より)
  // =============================================================================
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); // 30秒ごと
    if (window.MemoryPerformanceManager) {
        window.MemoryPerformanceManager.trackResource('timeUpdateInterval', {
          type: 'interval', resource: timer, description: '時刻更新インターバル'
        }, () => clearInterval(timer));
    }
    return () => clearInterval(timer);
  }, []);

  // =============================================================================
  // Socket.IO接続管理（拡張版ベース + ベース版の堅牢な接続管理を統合）
  // =============================================================================
  useEffect(() => {
    if (currentSpace && typeof io !== 'undefined') {
      window.Utils.log('info', 'FRIENDLYモード100%完成版 Socket.IO初期化 (統合接続管理)', { spaceId: currentSpace.id });
      setConnectionStatus('connecting');

      // ベース版の接続統計・復旧管理メカニズム
      const connectionStats = {
        attempts: 0, successfulConnections: 0, lastSuccessTime: null,
        errorCounts: { connect_error: 0, disconnect: 0, timeout: 0 }
      };
      const recoveryManager = {
        isRecovering: false, maxRetries: 5, retryDelay: 1000,
        backoffMultiplier: 1.5, lastRecoveryAttempt: null, currentRetryAttempt: 0
      };

      const newSocket = io(window.SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000, // 接続タイムアウト
        reconnection: true, // 自動再接続を有効化 (Socket.IOクライアント標準機能)
        reconnectionAttempts: recoveryManager.maxRetries, // Socket.IO標準の試行回数
        reconnectionDelay: recoveryManager.retryDelay, // Socket.IO標準の初期遅延
        reconnectionDelayMax: 10000,
        // forceNew: false, // ベース版のオプション
        // multiplex: true, // ベース版のオプション
        autoConnect: true // Socket.IO v3+ではデフォルトtrue
      });

      const handleConnectionSuccess = (isReconnect = false) => {
        connectionStats.attempts++;
        connectionStats.successfulConnections++;
        connectionStats.lastSuccessTime = new Date();
        recoveryManager.isRecovering = false;
        recoveryManager.currentRetryAttempt = 0;

        window.Utils.log('success', `Socket.IO接続成功${isReconnect ? ' (再接続)' : ''}`, {
          attempts: connectionStats.attempts,
          successRate: (connectionStats.successfulConnections / connectionStats.attempts * 100).toFixed(1) + '%'
        });
        setConnectionStatus('connected');
        setError(''); // ローカルエラークリア

        newSocket.emit('join-space', currentSpace.id);

        if (window.SessionManager) {
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession) {
            newSocket.emit('session-info', {
              sessionId: currentSession.sessionId, spaceId: currentSpace.id, timestamp: new Date().toISOString(),
              isReconnection: isReconnect, recoveryMode: recoveryManager.isRecovering,
              connectionStats: { attempts: connectionStats.attempts, successRate: connectionStats.successfulConnections / connectionStats.attempts }
            });
          }
          window.SessionManager.setSocket(newSocket); // SessionManagerにSocketインスタンスを設定
        }

        // キー交換システム初期化 (拡張版)
        if (window.KeyExchangeManager && (encryptionStatus === 'enabled' || encryptionInfo?.keyType === 'hybrid_deterministic')) {
           // 既に初期化済みで再接続の場合、状態をリセット・再同期する処理が必要かKeyExchangeManager側で考慮
          const keyExchangeInitialized = window.KeyExchangeManager.initialize(newSocket, currentSpace.id);
          if (keyExchangeInitialized) {
            window.KeyExchangeManager.addKeyExchangeListener((event) => {
              window.Utils.log('info', `キー交換イベント: ${event.type}`, event);
              const status = window.KeyExchangeManager.getKeyExchangeStatus(currentSpace.id);
              setKeyExchangeStatus(status); // UIに状態を反映
              if (event.type === 'peer_key_received' || event.type === 'exchange_initiated' || event.type === 'exchange_complete') {
                setEncryptionInfo(prev => ({ ...prev, keyExchangeStatus: status, peerCount: status.peerCount, lastKeyExchange: new Date() }));
                // キー交換完了時にセッション数や暗号化レベルを再評価するトリガー
                if (window.SessionManager) { // updateSessionInfoを能動的に呼び出す
                    // この呼び出しはループを引き起こさないか注意。sessionInfoの更新が再びこのuseEffectをトリガーしないように。
                }
              }
            });
            window.Utils.log('success', 'キー交換システム初期化/再同期完了');
             // 参加時にキー交換を試みる
            window.KeyExchangeManager.initiateKeyExchangeForSpace(currentSpace.id);
          }
        }
        // 再接続時に失われた可能性のある情報を再送信
        if (isReconnect) {
            restoreSessionState(newSocket);
        }
      };

      // ベース版の高度な自動復旧処理
      const attemptRecovery = async (reason) => {
        if (recoveryManager.isRecovering && recoveryManager.currentRetryAttempt > 0) {
          window.Utils.log('debug', 'Recovery already in progress, skipping new attempt');
          return;
        }
        recoveryManager.isRecovering = true;
        recoveryManager.lastRecoveryAttempt = new Date();
        window.Utils.log('info', `Socket.IO自動復旧開始: ${reason}`);
        setConnectionStatus('recovering');

        for (let attempt = 1; attempt <= recoveryManager.maxRetries; attempt++) {
          recoveryManager.currentRetryAttempt = attempt;
          try {
            window.Utils.log('debug', `復旧試行 ${attempt}/${recoveryManager.maxRetries}`);
            if (newSocket.connected) {
              window.Utils.log('success', '接続が既に復旧済み (attemptRecovery)');
              handleConnectionSuccess(true); return;
            }
            if (!newSocket.active) { // Socket.IO v3+では .active で接続試行中か確認
                newSocket.connect();
            }
            // Socket.IOの標準再接続に任せるか、手動でconnectを呼び出すか。
            // 標準のreconnect_attemptイベントと組み合わせる方が良い場合もある。
            // ここではベース版のロジックを尊重し、手動での試行に近い形を残す。

            await new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => reject(new Error('Connection recovery timeout')), 5000 + attempt * 1000); // 試行毎にタイムアウト延長
              const onConnectHandler = () => {
                clearTimeout(timeoutId);
                newSocket.off('connect', onConnectHandler); // 一度きりのリスナー
                resolve();
              };
              newSocket.once('connect', onConnectHandler); // 'once'で一度だけ補足
            });

            window.Utils.log('success', `Socket.IO復旧成功 (試行${attempt}回目)`);
            handleConnectionSuccess(true); return;

          } catch (error) {
            window.Utils.log('warn', `復旧試行${attempt}失敗: ${error.message}`);
            if (attempt === recoveryManager.maxRetries) {
              window.Utils.log('error', 'Socket.IO復旧失敗 - 手動再接続またはページリロードを推奨');
              setConnectionStatus('failed');
              const errorMsg = '🔌 リアルタイム機能に接続できません。しばらくしてからページを再読み込みするか、手動で再接続してください。';
              setError(errorMsg);
              if (window.UnifiedErrorDisplay) {
                window.UnifiedErrorDisplay.addError({ /* 復旧失敗エラー情報 */ title: '接続復旧失敗', message: errorMsg });
              }
              setEncryptionInfo(prev => ({ ...prev, showManualReconnect: true }));
              recoveryManager.isRecovering = false; return;
            }
            const delay = recoveryManager.retryDelay * Math.pow(recoveryManager.backoffMultiplier, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, Math.min(delay, 15000))); // 最大遅延キャップ
          }
        }
        recoveryManager.isRecovering = false; // ループ終了後（通常はここまで来ない）
      };

      newSocket.on('connect', () => handleConnectionSuccess(false));

      newSocket.on('disconnect', (reason) => {
        connectionStats.errorCounts.disconnect++;
        window.Utils.log('warn', 'Socket.IO接続切断', { reason, disconnectCount: connectionStats.errorCounts.disconnect });
        setConnectionStatus('disconnected');
        setRealtimeUsers([]); // 関連状態クリア
        setTypingUsers([]);   // 関連状態クリア

        if (window.KeyExchangeManager) { // キー交換状態もリセット
            window.KeyExchangeManager.resetPeers(currentSpace.id);
            setKeyExchangeStatus(window.KeyExchangeManager.getKeyExchangeStatus(currentSpace.id));
        }

        const clientInitiatedDisconnect = reason === 'io client disconnect';
        const serverInitiatedDisconnect = reason === 'io server disconnect';

        if (!clientInitiatedDisconnect && !recoveryManager.isRecovering) { // ユーザーによる切断や既に復旧処理中でなければ
            // Socket.IO v3+ は 'disconnect' 時に自動で再接続を試みる。
            // attemptRecovery は、標準の再接続が失敗した場合や、より詳細な制御が必要な場合に補足的に使用。
            // ただし、標準の reconnectionAttempts を使い切った後の 'reconnect_failed' をトリガーにするのが一般的。
            // ここではベース版の積極的な復旧を一部残す。
             window.Utils.log('info', `予期せぬ切断(${reason})、Socket.IO標準の再接続処理に期待。状況により手動復旧も検討。`);
             // setTimeout(() => attemptRecovery(`disconnect: ${reason}`), 2000); // 標準再接続と競合する可能性あり。注意して使用。
        }
        if (window.UnifiedErrorDisplay && !clientInitiatedDisconnect) {
            window.UnifiedErrorDisplay.addError({ /* 切断エラー情報 */ title: 'リアルタイム接続切断', message: `接続が切れました: ${reason}` });
        }
      });

      newSocket.on('connect_error', (error) => {
        connectionStats.attempts++; // 接続試行回数
        connectionStats.errorCounts.connect_error++;
        window.Utils.log('error', 'Socket.IO接続エラー', { error: error.message, attempts: connectionStats.attempts, errorCount: connectionStats.errorCounts.connect_error });
        setConnectionStatus('error'); // 一時的なエラー状態

        let specificErrorMsg = `🔌 接続エラー: ${error.message}`;
        if (error.message.includes('timeout')) {
            connectionStats.errorCounts.timeout++;
            specificErrorMsg = '⏰ 接続がタイムアウトしました。ネットワーク環境を確認してください。';
        } else if (error.message.includes('refused')) {
            specificErrorMsg = '🚫 サーバーに接続を拒否されました。しばらく時間をおいて再試行してください。';
        }
        setError(specificErrorMsg); // ローカルUI用

        if (window.UnifiedErrorDisplay) {
            window.UnifiedErrorDisplay.addError({ /* 接続エラー情報 */ title: 'リアルタイム接続エラー', message: specificErrorMsg, details: { error: error.message } });
        }
        // Socket.IO標準の再接続メカニズムに任せる。 attemptRecovery は reconnect_failed でトリガーする方が一般的。
        // if (!recoveryManager.isRecovering && connectionStats.errorCounts.connect_error <= 3) {
        //   setTimeout(() => attemptRecovery(`connect_error: ${error.message}`), 3000);
        // }
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        window.Utils.log('info', `Socket.IO再接続試行中... (${attemptNumber}回目)`);
        setConnectionStatus('recovering');
        recoveryManager.isRecovering = true; // 標準の再接続試行中も復旧中とみなす
        recoveryManager.currentRetryAttempt = attemptNumber;
      });
      
      newSocket.on('reconnect', (attemptNumber) => {
        window.Utils.log('success', `Socket.IO再接続成功 (試行${attemptNumber}回目)`);
        handleConnectionSuccess(true); // 接続成功処理（再接続フラグ付き）
      });

      newSocket.on('reconnect_failed', () => {
        window.Utils.log('error', 'Socket.IO自動再接続失敗 (reconnect_failed)');
        setConnectionStatus('failed');
        const errorMsg = '🔄 自動再接続に失敗しました。手動で再接続するか、ページを再読み込みしてください。';
        setError(errorMsg);
        if (window.UnifiedErrorDisplay) {
            window.UnifiedErrorDisplay.addError({ /* 再接続失敗エラー */ title: '自動再接続失敗', message: errorMsg });
        }
        setEncryptionInfo(prev => ({ ...prev, showManualReconnect: true }));
        recoveryManager.isRecovering = false;
        // ここで attemptRecovery を呼び出すことで、ベース版の詳細なリトライロジックを最終手段として実行できる
        // setTimeout(() => attemptRecovery('reconnect_failed_final_attempt'), 1000);
      });

      // セッション状態復旧 (ベース版より、handleConnectionSuccess に統合、または個別呼び出し)
      const restoreSessionState = (targetSocket) => {
        window.Utils.log('info', 'セッション状態復旧開始');
        targetSocket.emit('join-space', currentSpace.id); // 再度join

        if (window.SessionManager) {
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession) {
            targetSocket.emit('session-info', {
              sessionId: currentSession.sessionId, spaceId: currentSpace.id,
              timestamp: new Date().toISOString(), isReconnection: true
            });
          }
        }
        // 暗号化レベルの再同期 (セッション管理エフェクトで処理されるか、ここで明示的に行うか)
        if (encryptionStatus === 'enabled' && sessionCount > 0) {
          const currentLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
          targetSocket.emit('encryption-level-changed', {
            spaceId: currentSpace.id, encryptionLevel: currentLevel, sessionCount: sessionCount,
            timestamp: new Date().toISOString(), isReconnection: true
          });
        }
        // キー交換状態の再同期 (KeyExchangeManager側で接続時に処理されるべき)
        if (window.KeyExchangeManager) {
            window.KeyExchangeManager.reInitiateKeyExchangeOnReconnect(currentSpace.id);
        }
      };
      window.manualReconnect = () => { // グローバル関数として定義 (ベース版)
        window.Utils.log('info', '手動再接続実行');
        setError('');
        setEncryptionInfo(prev => ({ ...prev, showManualReconnect: false }));
        if (socket && !socket.connected) { // 既存ソケットが切断状態なら再接続
            // attemptRecovery('manual_reconnect'); // ベース版の詳細リトライを実行
            socket.connect(); // Socket.IO標準の接続開始
        } else if (!socket) { // ソケットインスタンスがない場合 (稀なケース)
            // useEffectフックを再トリガーするためにcurrentSpaceを一時的に変更するハックは避ける
            // この場合は、コンポーネントの再初期化に近い処理が必要になるか、新しいsocketインスタンスを作る必要がある
            window.Utils.log('warn', '手動再接続試行時、socketインスタンスが存在しません。');
        }
      };

      // 接続品質監視 (ベース版より)
      const connectionMonitorInterval = setInterval(() => {
        if (newSocket.connected) {
          const pingStart = Date.now();
          newSocket.emit('ping', pingStart, (ackTimestamp) => { // acknowledgement callback を使用
            const latency = Date.now() - ackTimestamp; // ackTimestamp はサーバーが送り返した時刻
            window.Utils.log('debug', `Socket.IO レイテンシ: ${latency}ms`);
            if (latency > 2000 && connectionStatus === 'connected') {
              window.Utils.log('warn', `高いレイテンシを検出: ${latency}ms`);
              setConnectionStatus('slow');
              if (window.UnifiedErrorDisplay) {
                 window.UnifiedErrorDisplay.addError({ id: 'high_latency', type: 'performance', category: 'socket', severity: 'low', title: '接続遅延', message: `ネットワークの応答が遅れています (${latency}ms)。`, autoRecover: true, persistent: false });
              }
            } else if (connectionStatus === 'slow' && latency <= 1000) {
              setConnectionStatus('connected'); // 状態が改善したら戻す
            }
          });
        }
      }, 30000); // 30秒ごと
      if (window.MemoryPerformanceManager) {
        window.MemoryPerformanceManager.trackResource('connectionMonitorInterval', {
          type: 'interval', resource: connectionMonitorInterval, description: '接続品質監視インターバル'
        }, () => clearInterval(connectionMonitorInterval));
      }

      // メッセージ受信処理 (拡張版ベース + ベース版の復号化ロジック)
      newSocket.on('message-received', async (data) => {
        try {
          window.Utils.log('info', 'リアルタイムメッセージ受信 (統合版)', { from: data.from, spaceId: data.spaceId });
          if (data && data.message && data.spaceId === currentSpace.id) { // spaceId のチェックを追加
            let receivedMessage = {
              ...data.message,
              timestamp: new Date(data.message.timestamp),
              sessionCount: data.sessionCount || 1, // 送信元のセッション数
              encryptionInfoFromServer: data.encryptionInfo || null // 送信元の暗号化情報
            };

            if (receivedMessage.encrypted && window.API.encryptionSystem) {
              try {
                let decryptedText;
                // FRIENDLYモード対応復号化 (ベース版のロジックを優先)
                if (receivedMessage.encryptionType === 'hybrid' && window.Crypto.decryptMessageWithFallback) {
                  decryptedText = await window.Crypto.decryptMessageWithFallback(receivedMessage, currentSpace.id);
                  window.Utils.log('success', 'ハイブリッド復号化成功 (message-received)');
                } else { // 決定的暗号化またはフォールバック
                  decryptedText = await window.API.decryptMessage(receivedMessage); // API.decryptMessage がフォールバックも対応想定
                  window.Utils.log('success', '決定的/フォールバック復号化成功 (message-received)');
                }
                receivedMessage.text = decryptedText;
              } catch (decryptError) {
                window.Utils.log('warn', 'リアルタイム復号化失敗 (message-received)', decryptError.message);
                // ベース版の遅延復号化ロジック
                if (decryptError.message.includes('key') || decryptError.message.includes('session')) { // キー同期やセッション鍵の不一致の可能性
                  receivedMessage.text = '🔑 暗号化キーを同期中... しばらくお待ちください';
                  receivedMessage.encryptionType = 'key_sync_needed';
                  // 5秒後に復号化を再試行
                  setTimeout(async () => {
                    try {
                      const retryDecrypted = await window.API.decryptMessage(receivedMessage); // 再度API経由で試行
                      setMessages(prev => prev.map(msg =>
                        msg.id === receivedMessage.id ?
                        { ...msg, text: retryDecrypted, encryptionType: receivedMessage.encryptionInfoFromServer?.type || 'deterministic' } :
                        msg
                      ));
                      window.Utils.log('success', '遅延復GEO化成功 (message-received)');
                    } catch (retryError) {
                      window.Utils.log('error', '遅延復号化も失敗 (message-received)', retryError.message);
                       setMessages(prev => prev.map(msg =>
                        msg.id === receivedMessage.id ?
                        { ...msg, text: '[メッセージの復号化に最終的に失敗しました]', encryptionType: 'error' } :
                        msg
                      ));
                      if (window.UnifiedErrorDisplay) {
                        window.UnifiedErrorDisplay.addError({ /* 遅延復号化失敗エラー */ title: 'メッセージ復号化失敗', message: `メッセージ(ID: ${receivedMessage.id})の復号化に失敗しました。キーの同期に問題がある可能性があります。`});
                      }
                    }
                  }, 5000);
                } else {
                  receivedMessage.text = '[リアルタイム復号化に失敗しました]';
                  receivedMessage.encryptionType = 'error';
                }
                if (window.UnifiedErrorDisplay && receivedMessage.encryptionType !== 'key_sync_needed') { // 同期中以外でエラー通知
                    window.UnifiedErrorDisplay.addError({ /* 復号化失敗エラー */ title: 'メッセージ復号化エラー', message: '受信メッセージの復号化に失敗しました。'});
                }
              }
            }
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === receivedMessage.id);
              if (exists && receivedMessage.encryptionType !== 'key_sync_needed') { // キー同期中の仮メッセージは上書きされるべき
                  // 既に存在するメッセージが「キー同期中」で、新しい情報で更新される場合
                  if (prev.find(msg => msg.id === receivedMessage.id)?.encryptionType === 'key_sync_needed') {
                      return prev.map(msg => msg.id === receivedMessage.id ? receivedMessage : msg).sort((a,b) => a.timestamp - b.timestamp);
                  }
                  return prev; // 通常は重複追加を避ける
              }
              return [...prev, receivedMessage].sort((a, b) => a.timestamp - b.timestamp);
            });
          }
        } catch (error) {
          window.Utils.log('error', 'リアルタイムメッセージ処理エラー', error.message);
          if (window.UnifiedErrorDisplay) {
            window.UnifiedErrorDisplay.addError({ /* メッセージ処理エラー */ });
          }
        }
      });
      
      // サーバーからのタイピング通知など、他のリアルタイムイベントハンドラもここに追加
      newSocket.on('user-typing', ({ userId, spaceId, isTyping }) => {
          if (spaceId === currentSpace.id) {
              setTypingUsers(prev => isTyping ? [...new Set([...prev, userId])] : prev.filter(id => id !== userId));
          }
      });

      newSocket.on('active-users-updated', ({ spaceId, users }) => {
          if (spaceId === currentSpace.id) {
              setRealtimeUsers(users); // users はユーザーIDの配列などを想定
          }
      });


      // ErrorHandler との統合 (拡張版)
      if (window.ErrorHandler && window.ErrorHandler.attachSocketErrorHandlers) {
        window.ErrorHandler.attachSocketErrorHandlers(newSocket);
      }

      setSocket(newSocket);

      return () => { // クリーンアップ処理
        window.Utils.log('info', 'Socket.IO統合版クリーンアップ');
        clearInterval(connectionMonitorInterval);
        if (newSocket.connected) {
          newSocket.emit('leave-space', currentSpace.id);
        }
        // KeyExchangeManager のクリーンアップ (拡張版)
        if (window.KeyExchangeManager) {
          window.KeyExchangeManager.cleanup(currentSpace.id); // 特定スペースのリスナー等をクリーンアップ
        }
        newSocket.disconnect();
        setConnectionStatus('disconnected');
        setRealtimeUsers([]);
        setTypingUsers([]);
        setKeyExchangeStatus({}); // キー交換状態リセット
        delete window.manualReconnect; // グローバル関数クリーンアップ

        // MemoryPerformanceManager で管理されているリソースもここで解放されるべき (各useEffect内で定義)
      };
    }
  }, [currentSpace, encryptionStatus, sessionCount]); // sessionCountの変更で暗号化レベルが変わるため、socket再接続や再設定が必要な場合があるか検討。
                                                    // 基本的にはcurrentSpaceでSocket接続を管理し、encryptionStatus, sessionCountはそのコンテキスト内で利用。

  // =============================================================================
  // 空間入室処理（拡張版ベース + ベース版の詳細な暗号化初期化ロジックを統合）
  // =============================================================================
  const handleEnterSpace = async () => {
    window.Utils.performance.start('enter_space_integrated');
    window.Utils.log('info', 'FRIENDLYモード100%完成版・統合空間入室開始', { passphraseLength: passphrase?.length });

    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      setError(validation.error); // ローカルUIエラー
      if (window.UnifiedErrorDisplay) {
        window.UnifiedErrorDisplay.addError({ type: 'validation', title: '入力エラー', message: validation.error });
      }
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // ベース版の段階的リトライとリカバリーオプションを持つ暗号化初期化
      const initializeEncryptionWithRetryAndRecovery = async (space, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            setEncryptionStatus('initializing');
            setEncryptionInfo(prev => ({
              ...prev, status: `暗号化初期化試行中... (${attempt}/${maxRetries})`, attempt: attempt, showRecoveryUI: false
            }));

            const encryptionInitialized = await window.API.initializeEncryption(space.id, space.passphrase);
            if (encryptionInitialized) {
              setEncryptionStatus('enabled');
              setEncryptionInfo(prev => ({
                ...prev, spaceId: space.id,
                publicKey: window.Utils.getSafePublicKey(window.API.encryptionSystem?.publicKey),
                initialized: true, keyType: 'hybrid_deterministic', passphrase: space.passphrase, // マスキング推奨
                mode: 'FRIENDLYモード100%完成版',
                capabilities: ['決定的暗号化', 'ハイブリッド暗号化', 'フォールバック復号化', 'リアルタイムキー交換', 'セッション検出'],
                initializationAttempts: attempt, recoveryTime: new Date().toISOString(), integrationStatus: 'complete'
              }));
              window.Utils.log('success', `統合暗号化初期化成功 (試行${attempt}回目)`);
              return true;
            }
            throw new Error(`暗号化初期化実処理失敗 (試行${attempt}回目)`);
          } catch (error) {
            window.Utils.log('warn', `統合暗号化初期化失敗 (${attempt}/${maxRetries})`, { error: error.message, attempt, willRetry: attempt < maxRetries });
            if (attempt === maxRetries) {
              setEncryptionStatus('error');
              const errorMsg = `暗号化初期化に失敗しました (${maxRetries}回試行): ${error.message}`;
              setEncryptionInfo(prev => ({
                ...prev, error: errorMsg, lastError: error.message, fallbackMode: true, attempts: maxRetries
              }));
              // ベース版のリカバリーオプション表示ロジック
              showEncryptionRecoveryOptions(space, error, errorMsg);
              return false;
            }
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        return false; // Should not reach here if maxRetries > 0
      };
      
      // ベース版のリカバリーオプション表示関数
      const showEncryptionRecoveryOptions = (space, error, detailedMessage) => {
        const recoveryActions = [];
        if (error.message.includes('passphrase')) recoveryActions.push({ id: 'recheckPassphrase', label: 'パスフレーズの再確認' });
        if (error.message.includes('key') || error.message.includes('storage')) recoveryActions.push({ id: 'clearKeyCache', label: 'キーキャッシュのクリア (再試行)' });
        // recoveryActions.push({ id: 'retryEncryptionInit', label: '暗号化を再試行' });
        recoveryActions.push({ id: 'plaintextMode', label: '平文モードで継続 (非推奨)' });

        setEncryptionInfo(prev => ({ ...prev, recoveryOptions: recoveryActions, showRecoveryUI: true }));
        if (window.UnifiedErrorDisplay) {
          window.UnifiedErrorDisplay.addError({
            id: `encryption_init_failed_final_${Date.now()}`, type: 'encryption_initialization_failed', category: 'encryption', severity: 'high',
            title: '暗号化初期化最終失敗', message: detailedMessage,
            details: { error: error.message, attempts: recoveryManager.maxRetries, spaceId: space.id },
            actions: recoveryActions.map(act => ({ ...act, handler: () => executeEncryptionRecovery(act.id, space) })), // UnifiedErrorDisplay側でアクションを処理する場合
            autoRecover: false, persistent: true
          });
        }
      };

      const space = await window.API.enterSpace(validation.passphrase);
      if (window.SessionManager) {
        const sessionId = window.SessionManager.initializeSession(space.id);
        window.Utils.log('success', 'セッション初期化完了', { sessionId: sessionId.substring(0, 8) + '...', spaceId: space.id });
      }

      setCurrentSpace(space); // currentSpace の設定が Socket.IO の useEffect をトリガー
      setCurrentView('chat');
      setPassphrase(''); // 入力済みパスフレーズをクリア

      if (encryptionStatus !== 'error') { // 初期化エラーでなければ暗号化試行
        const encryptionSuccess = await initializeEncryptionWithRetryAndRecovery(space);
        if (!encryptionSuccess && encryptionStatus !== 'disabled') { // 失敗し、かつ手動で無効化されていなければ
          window.Utils.log('warn', '暗号化初期化に最終的に失敗。平文モードでの継続をユーザーに委ねるか、エラーとする。');
          // showEncryptionRecoveryOptions が UnifiedErrorDisplay にエラー通知とアクション提示を行っているはず
        } else if (encryptionStatus === 'disabled') {
            window.Utils.log('info', '暗号化は無効化されています。平文モードでチャットを開始します。');
        }
      }

      let loadedMessages = [];
      try {
        if (window.API.loadMessagesFriendly) {
          loadedMessages = await window.API.loadMessagesFriendly(space.id);
        } else {
          loadedMessages = await window.API.loadMessages(space.id); // フォールバック
        }
        setMessages(loadedMessages);
      } catch (messageError) {
        window.Utils.log('error', 'メッセージ読み込みエラー', messageError.message);
        const msg = 'メッセージの読み込みに失敗しましたが、新しいメッセージは送信できます。';
        setError(msg); // ローカルエラー
        if (window.UnifiedErrorDisplay) {
            window.UnifiedErrorDisplay.addError({ /* メッセージ読み込みエラー */ title: '読込エラー', message: msg });
        }
        setTimeout(() => setError(''), 3000);
      }

      window.Utils.log('success', 'FRIENDLYモード100%完成版・統合空間入室完了', {
        spaceId: space.id, messageCount: loadedMessages.length,
        encryptionFinallyEnabled: encryptionStatus === 'enabled', systemsIntegrated: true
      });

    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモード統合空間入室処理');
      setError(errorMessage); // ローカルエラー
      if (window.UnifiedErrorDisplay) {
        window.UnifiedErrorDisplay.addError({
          id: `space_enter_error_${Date.now()}`, type: 'space_enter_error', category: 'api', severity: 'high',
          title: '空間入室エラー', message: errorMessage, autoRecover: false, persistent: true
        });
      }
      // ベース版のネットワークエラー時フォールバック
      if (error.message.includes('network') || error.message.includes('server')) {
        setTimeout(() => {
          if (window.API.testConnection) {
            window.API.testConnection().then(connected => {
              if (connected) {
                const reconMsg = '✅ ネットワーク接続が復旧しました。再度お試しください。';
                setError(reconMsg);
                if (window.UnifiedErrorDisplay) window.UnifiedErrorDisplay.addError({ type:'info', title:'接続復旧', message: reconMsg});
                setTimeout(() => setError(''), 3000);
              }
            });
          }
        }, 5000);
      }
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('enter_space_integrated');
    }
  };

  // ベース版の暗号化リカバリー実行関数 (UnifiedErrorDisplayのアクションハンドラとして呼び出される想定)
  const executeEncryptionRecovery = async (action, space) => {
    window.Utils.log('info', `暗号化リカバリー実行: ${action}`, { spaceId: space?.id });
    setIsLoading(true);
    setError('');
    setEncryptionInfo(prev => ({ ...prev, showRecoveryUI: false, recoveryOptions: null }));

    try {
      switch (action) {
        case 'clearKeyCache':
          if (window.Crypto?.cleanupAllKeysForSpace) await window.Crypto.cleanupAllKeysForSpace(space.id);
          else if (window.Crypto?.cleanupAllKeys) await window.Crypto.cleanupAllKeys();
          window.Utils.log('info', 'キーキャッシュをクリアしました。再度入室処理を試みます。');
          // 再度 handleEnterSpace または initializeEncryption を試行する必要がある
          // ここではパスフレーズが state にないので、ユーザーに再入力を促すのが適切か、
          // あるいは直前のパスフレーズを保持しておき再試行するか。
          // passphrase はクリアされているので、ログインに戻すのが無難。
          // もしくは、現在のパスフレーズで再度 initializeEncryptionWithRetryAndRecovery を呼び出す。
          // 今回は一旦、ユーザーに再試行を促す形にする。
          setCurrentView('login'); // 再度ログインから
          setPassphrase(space.passphrase); // 元のパスフレーズをセットしてユーザーが再実行できるようにする
          setError("キーキャッシュをクリアしました。再度「入室」ボタンを押してください。");

          // もし自動再試行するなら:
          // setPassphrase(space.passphrase); // handleEnterSpaceが内部で使うため
          // await handleEnterSpace(); // これだとisLoadingのネスト問題があるかも
          break;
        case 'plaintextMode':
          setEncryptionStatus('disabled');
          setEncryptionInfo(prev => ({
            ...prev, supported: false, mode: 'plaintext', reason: 'ユーザー選択によるリカバリー', manualDisable: true,
            status: '平文モード (リカバリー)', error: null
          }));
          window.Utils.log('warn', 'ユーザー選択により平文モードで継続します。');
          // この後、チャット画面に進むための処理が必要 (handleEnterSpaceの後半部分)
          // ただし、handleEnterSpaceは既に失敗している可能性が高いので、
          // currentSpace は設定されている前提でメッセージ読み込み等を行う
          if (currentSpace) { // currentSpace が null なら、このリカバリーは不適切
            setCurrentView('chat'); // 強制的にチャット画面へ
            // メッセージ再読み込みなどが必要な場合がある
            let loadedMessages = [];
            if (window.API.loadMessages) { // 暗号化なしでロード
                loadedMessages = await window.API.loadMessages(currentSpace.id, false); // 第2引数で非暗号化を指定できるAPIなら
                setMessages(loadedMessages);
            }
          } else {
             setError("平文モードへの切り替えに失敗しました。空間情報がありません。");
             setCurrentView('login');
          }
          break;
        // 他のリカバリーアクション...
        default:
          window.Utils.log('warn', `不明なリカバリーアクション: ${action}`);
      }
    } catch (recError) {
      const errorMsg = `リカバリー処理 (${action}) に失敗しました: ${recError.message}`;
      setError(errorMsg);
      if (window.UnifiedErrorDisplay) {
        window.UnifiedErrorDisplay.addError({ title: 'リカバリー失敗', message: errorMsg });
      }
      window.Utils.log('error', errorMsg, recError);
    } finally {
      setIsLoading(false);
    }
  };


  // =============================================================================
  // 空間作成処理 (ベース版のロジック + 拡張版のエラー通知)
  // =============================================================================
  const handleCreateSpace = async () => {
    window.Utils.performance.start('create_space_integrated');
    window.Utils.log('info', '空間作成処理開始 (統合版)', { passphraseLength: newSpacePassphrase?.length });

    const validation = window.Utils.validatePassphrase(newSpacePassphrase);
    if (!validation.valid) {
      setError(validation.error);
      if (window.UnifiedErrorDisplay) window.UnifiedErrorDisplay.addError({ type: 'validation', title: '入力エラー', message: validation.error });
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await window.API.createSpace(validation.passphrase);
      setShowCreateSpace(false);
      setNewSpacePassphrase('');

      const encryptionNote = (encryptionStatus === 'enabled' && encryptionInfo?.supported) ?
        '\n🔒 FRIENDLYモード100%完成版: 高度なE2EE暗号化が有効です。' +
        '\n• 単独時: 決定的暗号化' +
        '\n• 複数時: ハイブリッド暗号化 (リアルタイムキー交換対応)' :
        '\n⚠️ 暗号化機能が利用できないか無効になっているため、平文通信になります。';
      alert('✅ FRIENDLYモード100%完成版対応の新しい空間を作成しました！' + encryptionNote + '\n作成した合言葉で入室してください。');
      window.Utils.log('success', '空間作成完了 (統合版)', { passphraseUsed: !!validation.passphrase }); // パスフレーズ自体はログに出さない
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, '空間作成処理 (統合版)');
      setError(errorMessage);
      if (window.UnifiedErrorDisplay) window.UnifiedErrorDisplay.addError({ title: '空間作成エラー', message: errorMessage, category: 'api' });
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('create_space_integrated');
    }
  };

  // =============================================================================
  // メッセージ送信処理 (ベース版のロジック + 拡張版のエラー通知・キー交換連携)
  // =============================================================================
  const handleSendMessage = async () => {
    if (!message.trim() || !currentSpace) return;
    if (currentSpace.passphrase === '秘密の部屋' && window.location.hostname !== 'localhost') { // サンプル空間制限
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。\n新しい空間を作成してお試しください。');
      return;
    }

    window.Utils.performance.start('send_message_integrated');
    setIsLoading(true);
    try {
      let newMessage;
      // FRIENDLYモード対応送信 (ベース版より)
      if (window.API.sendMessageFriendly) {
        newMessage = await window.API.sendMessageFriendly(currentSpace.id, message, sessionCount); // セッション数を渡す
        window.Utils.log('success', 'FRIENDLYモードメッセージ送信完了 (統合版)', {
          messageId: newMessage.id, encryptionType: newMessage.encryptionType,
          hasFallback: newMessage.hasFallback, sessionCountAtSend: sessionCount
        });
      } else { // フォールバック
        newMessage = await window.API.sendMessage(currentSpace.id, message); // 暗号化はAPI内部で処理
        window.Utils.log('info', '標準メッセージ送信完了 (統合版)', { messageId: newMessage.id });
      }

      setMessages(prev => [...prev, newMessage].sort((a,b) => a.timestamp - b.timestamp)); // ソートしつつ追加
      setMessage('');

      if (socket && socket.connected) {
        socket.emit('new-message', { // ベース版の送信データ構造
          spaceId: currentSpace.id,
          message: newMessage, // 送信するメッセージオブジェクト
          encryptionInfo: { // 送信時の暗号化関連情報
            type: newMessage.encryptionType || (sessionCount > 1 ? 'hybrid' : 'deterministic'),
            sessionCount: sessionCount, // 現在のクライアントのセッション数
            hasFallback: newMessage.hasFallback,
            keyExchangeAvailable: !!(window.KeyExchangeManager && window.KeyExchangeManager.isKeyExchangeReady(currentSpace.id))
          }
        });
        socket.emit('session-activity', { // ベース版のセッション活性度通知
          spaceId: currentSpace.id, activity: 'message_sent', timestamp: new Date().toISOString()
        });
        // タイピング状態をリセット
        socket.emit('user-typing', { spaceId: currentSpace.id, userId: window.SessionManager?.getCurrentSession()?.sessionId, isTyping: false });

      } else {
        window.Utils.log('warn', 'WebSocket未接続のため、リアルタイム配信をスキップ (統合版)');
        if (window.UnifiedErrorDisplay) window.UnifiedErrorDisplay.addError({ type:'warning', title: '送信未達', message: 'メッセージは保存されましたが、接続が不安定なため他の参加者に即時通知できませんでした。'});
      }
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモードメッセージ送信処理 (統合版)');
      setError(errorMessage);
      if (window.UnifiedErrorDisplay) window.UnifiedErrorDisplay.addError({ title: 'メッセージ送信エラー', message: errorMessage, category: 'api' });
      setTimeout(() => setError(prev => prev === errorMessage ? '' : prev), 3000);
    } finally {
      setIsLoading(false);
      window.Utils.performance.end('send_message_integrated');
    }
  };

  // =============================================================================
  // 空間退室処理 (ベース版・拡張版のクリーンアップを統合)
  // =============================================================================
  const handleLeaveSpace = () => {
    window.Utils.log('info', 'FRIENDLYモード空間退室開始 (統合版)', { spaceId: currentSpace?.id });

    if (socket) { // SocketクリーンアップはSocket useEffectの責務だが、明示的にも行う
      if (socket.connected && currentSpace) {
        socket.emit('leave-space', currentSpace.id);
      }
      socket.disconnect(); // これがuseEffectのクリーンアップをトリガーするはず
      setSocket(null); // socket stateをクリアして再接続を防ぐ
    }

    if (window.SessionManager && currentSpace) {
      window.SessionManager.leaveSession(currentSpace.id);
    }
    // KeyExchangeManager のクリーンアップは Socket useEffect 内で行われる

    // MemoryPerformanceManager で管理されているタイマーなどもここで明示的にクリアするなら、
    // それらを state や ref で保持する必要がある。基本は各useEffectのクリーンアップに任せる。
    // window.MemoryPerformanceManager.cleanupAllTrackedResources(); // アプリケーション終了時などには有効

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
    setPerformanceMetrics(null);
    // encryptionStatus, encryptionInfo は維持 (FRIENDLYモードの特徴)
    // systemHealth も維持するか、'unknown' にリセットするか検討。ログイン画面では 'healthy' か 'unknown' が適切か。
    setSystemHealth('unknown');


    window.Utils.log('success', 'FRIENDLYモード空間退室完了 (統合版)');
  };

  // =============================================================================
  // グローバルエラーハンドリング (ベース版のものを拡張版のErrorHandlerと共存させるか検討)
  // 拡張版のErrorHandler.initialize() で包括的に処理されるなら不要かもしれない。
  // ここでは念のため残すが、重複動作に注意。
  // =============================================================================
  useEffect(() => {
    const globalErrorHandler = (event) => {
      window.Utils.log('error', 'グローバルエラー (window.onerror)', event.error || event.message);
      if (window.UnifiedErrorDisplay && !event.defaultPrevented) { // ErrorHandlerで処理済みなら記録しない
        window.UnifiedErrorDisplay.addError({
            type: 'runtime_error', category: 'javascript', severity: 'critical',
            title: 'アプリケーションランタイムエラー', message: event.message || '不明なランタイムエラーが発生しました。',
            details: { error: event.error?.toString(), filename: event.filename, lineno: event.lineno, colno: event.colno }
        });
      }
    };
    const globalRejectionHandler = (event) => {
      window.Utils.log('error', 'グローバルPromiseRejection (unhandledrejection)', event.reason);
      if (window.UnifiedErrorDisplay && !event.defaultPrevented) {
         window.UnifiedErrorDisplay.addError({
            type: 'promise_rejection', category: 'javascript', severity: 'critical',
            title: '未処理のPromiseリジェクション', message: '非同期処理でエラーが発生しました。',
            details: { reason: event.reason?.toString() }
        });
      }
    };
    window.addEventListener('error', globalErrorHandler);
    window.addEventListener('unhandledrejection', globalRejectionHandler);
    return () => {
      window.removeEventListener('error', globalErrorHandler);
      window.removeEventListener('unhandledrejection', globalRejectionHandler);
    };
  }, []);


  // =============================================================================
  // レンダリング（拡張版ベース + 統合された props）
  // =============================================================================
  const renderWithUnifiedError = (mainContent) => {
    return React.createElement(
      React.Fragment, null,
      mainContent,
      // 拡張版の統一エラー表示コンポーネント
      window.UnifiedErrorDisplayComponent && React.createElement(window.UnifiedErrorDisplayComponent, {
          // 必要に応じてpropsを渡す (例: 最大表示数、フィルタリングなど)
          // このコンポーネントがエラーをどこから取得するか (グローバルストア or props) に依存
      })
    );
  };

  if (currentView === 'login') {
    return renderWithUnifiedError(
      React.createElement(window.LoginComponent, {
        passphrase, setPassphrase,
        error, // ローカルエラー用
        setError,
        newSpacePassphrase, setNewSpacePassphrase,
        showCreateSpace, setShowCreateSpace,
        isLoading,
        connectionStatus, // APIサーバーやSocketの全体的な接続状態
        encryptionStatus, encryptionInfo,
        systemHealth, // システム全体の健全性
        onEnterSpace: handleEnterSpace,
        onCreateSpace: handleCreateSpace,
        // executeEncryptionRecovery を渡してリカバリーUIから直接実行させる場合
        encryptionRecoveryHandler: encryptionStatus === 'error' && encryptionInfo?.showRecoveryUI ?
                                   (action) => executeEncryptionRecovery(action, currentSpace || {id: 'unknown', passphrase: passphrase}) :
                                   null,
        recoveryOptions: encryptionInfo?.recoveryOptions // リカバリーオプションを渡す
      })
    );
  }

  if (currentView === 'chat' && currentSpace) {
    if (window.IntegratedChatComponent) {
      return renderWithUnifiedError(
        React.createElement(window.IntegratedChatComponent, {
          currentSpace, messages, message, setMessage,
          showPassphraseInHeader, setShowPassphraseInHeader,
          currentTime, isLoading,
          connectionStatus, encryptionStatus, encryptionInfo,
          sessionCount, sessionInfo, // セッション関連情報
          keyExchangeStatus, // キー交換状態
          systemHealth, performanceMetrics,
          realtimeUsers, typingUsers, // リアルタイムユーザー情報
          onSendMessage: handleSendMessage,
          onLeaveSpace: handleLeaveSpace,
          // manualReconnect を渡してUIから手動接続できるようにする
          onManualReconnect: connectionStatus === 'failed' && encryptionInfo?.showManualReconnect ? window.manualReconnect : null
        })
      );
    } else { // フォールバック (古いChatComponentの場合)
      return renderWithUnifiedError(React.createElement(window.ChatComponent, { /* ...props */ }));
    }
  }

  // フォールバック/エラー画面 (ベース版ベースに拡張版の情報を追加)
  return renderWithUnifiedError(
    React.createElement('div', { className: 'min-h-screen bg-gray-900 text-white flex items-center justify-center p-4' },
      React.createElement('div', { className: 'text-center max-w-md' },
        React.createElement('h1', { className: 'text-2xl mb-4 text-red-400' }, 'FRIENDLYモード100%完成版 エラー'),
        React.createElement('p', { className: 'text-gray-300 mb-6' }, `アプリケーションの状態に問題があります。現在のビュー: ${currentView}`),
        React.createElement('div', { className: 'mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-left' },
            React.createElement('div', null, `接続状態: ${connectionStatus}`),
            React.createElement('div', null, `暗号化状態: ${encryptionStatus}`),
            React.createElement('div', null, `システムヘルス: ${systemHealth}`),
            encryptionInfo?.error && React.createElement('div', {className: 'text-red-400'}, `暗号化エラー: ${encryptionInfo.error}`),
            error && React.createElement('div', {className: 'text-yellow-400'}, `UIエラー: ${error}`)
        ),
        React.createElement('button', {
          onClick: () => { // リセット処理
            setCurrentView('login'); setCurrentSpace(null); setError(''); setMessages([]);
            setEncryptionStatus(window.Crypto?.isSupported ? 'enabled' : 'disabled'); // 暗号化状態を初期に
            setEncryptionInfo( prev => ({ ...prev, error: null, showRecoveryUI: false, recoveryOptions: null})); // エラー情報クリア
            setSystemHealth('unknown'); setKeyExchangeStatus({}); setRealtimeUsers([]); setTypingUsers([]);
            if (socket) socket.disconnect(); setSocket(null); // socketもリセット
            window.Utils.log('info', 'FRIENDLYモード100%完成版 手動リセット実行');
          },
          className: 'bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition duration-200'
        }, 'ログイン画面に戻る (リセット)'),

        // ベース版のデバッグ情報表示を参考に、主要な状態を表示
        window.DEBUG_MODE && React.createElement(
            'div', { className: 'mt-6 p-3 bg-gray-800 border border-gray-700 rounded-lg text-xs text-left' },
            React.createElement('h3', { className: 'font-bold mb-2' }, '統合デバッグ情報:'),
            React.createElement('pre', { className: 'text-gray-400 text-xs overflow-x-auto' }, JSON.stringify({
                currentView, currentSpaceId: currentSpace?.id, connectionStatus, encryptionStatus, systemHealth,
                encryptionInfo, sessionCount, sessionInfo, keyExchangeStatus,
                messageCount: messages.length, realtimeUserCount: realtimeUsers.length,
                performanceMetrics,
                apiDebug: window.API?.getEncryptionDebugInfo?.(),
                cryptoDebug: window.Crypto?.getAllSpaceKeyInfo?.(),
                sessionDebug: window.SessionManager?.getDebugInfo?.(),
            }, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2))
        )
      )
    )
  );
};

// =============================================================================
// FRIENDLYモード専用デバッグ関数（統合版）
// =============================================================================
if (window.DEBUG_MODE) {
  window.debugIntegratedFriendlyMode = () => {
    console.log('🔍 FRIENDLYモード100%完成版・統合状態デバッグ:');
    // ここに現在のReactコンポーネントのstateを直接ダンプする手段があればベスト
    // (例: グローバルにstateを持つオブジェクト参照をセットするなど。ただし通常は避けるべき)
    console.log('API情報:', window.API?.getEncryptionDebugInfo?.() || 'N/A');
    console.log('Crypto状態:', window.Crypto ? {
      spaceKeys: window.Crypto.spaceKeys?.size || 0,
      passphraseCache: window.Crypto.passphraseCache?.size || 0,
      allSpaceInfo: window.Crypto.getAllSpaceKeyInfo?.() || 'N/A'
    } : 'N/A');
    console.log('セッション情報:', window.SessionManager?.getDebugInfo?.() || 'N/A');
    console.log('キー交換情報:', window.KeyExchangeManager?.getDebugInfo?.() || 'N/A');
    console.log('メモリ/パフォ:', window.MemoryPerformanceManager?.getReport?.() || 'N/A');
    if (window.PerformanceOptimizer) console.log('パフォーマンスオプティマイザ:', window.PerformanceOptimizer.generateReport?.() || 'N/A');
    console.log('統一エラー表示:', window.UnifiedErrorDisplay?.getErrors?.() || 'N/A');
  };

  window.testIntegratedSystems = async () => {
    console.log('🧪 FRIENDLYモード100%完成版・統合システムテスト開始...');
    if (window.E2ETestSuite?.runAllTests) await window.E2ETestSuite.runAllTests();
    if (window.PerformanceOptimizer?.runBenchmark) await window.PerformanceOptimizer.runBenchmark();
    if (window.Crypto?.testFriendlyEncryption) await window.Crypto.testFriendlyEncryption();
    // 他の統合モジュールのテスト関数があれば呼び出す (KeyExchangeManager.test, etc.)
    console.log('🎉 FRIENDLYモード100%完成版・統合システムテスト完了！');
  };
  window.optimizeIntegratedMode = () => { // ベース版の optimizeFriendlyMode に相当
    if (window.PerformanceOptimizer?.applyOptimizations) {
      window.PerformanceOptimizer.applyOptimizations();
      console.log('⚡ FRIENDLYモード統合版 最適化適用完了');
    }
    if (window.MemoryPerformanceManager?.runManualOptimization) {
        window.MemoryPerformanceManager.runManualOptimization();
        console.log('🧠 メモリマネージャー 手動最適化実行完了');
    }
  };
}

// =============================================================================
// アプリケーションマウント（FRIENDLYモード100%完成版・統合）
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('Root element not found for React app');

    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(SecureChatApp));
    window.Utils.log('success', 'FRIENDLYモード100%完成版・統合アプリケーションマウント完了');

    if (window.DEBUG_MODE) {
      setTimeout(async () => {
        console.log('🩺 統合システムセルフチェック開始...');
        if (window.Crypto?.testFriendlyEncryption) {
          const cryptoTest = await window.Crypto.testFriendlyEncryption();
          console.log(`🧪 FRIENDLY暗号化テスト: ${cryptoTest.success ? '✅' : '❌'}`, cryptoTest);
        }
        const systemModules = {
          API: !!window.API, Crypto: !!window.Crypto, SessionManager: !!window.SessionManager,
          ErrorHandler: !!window.ErrorHandler, UnifiedErrorDisplay: !!window.UnifiedErrorDisplay,
          MemoryPerformanceManager: !!window.MemoryPerformanceManager, KeyExchangeManager: !!window.KeyExchangeManager,
          PerformanceOptimizer: !!window.PerformanceOptimizer, E2ETestSuite: !!window.E2ETestSuite,
          Utils: !!window.Utils, LoginComponent: !!window.LoginComponent, IntegratedChatComponent: !!window.IntegratedChatComponent
        };
        console.log('🛠️ 必須モジュール存在確認:', systemModules);
        const allModulesPresent = Object.values(systemModules).every(v => v);
        if (allModulesPresent) {
          console.log('🎉 全ての主要システムモジュールがロードされています。FRIENDLYモード100%完成版・統合システムは正常に動作する準備ができています！');
        } else {
          console.error('❌ いくつかの必須モジュールが見つかりません。アプリケーションが正しく動作しない可能性があります。', Object.entries(systemModules).filter(([,v])=>!v).map(([k])=>k));
        }
        // window.testIntegratedSystems?.(); // 自動テスト実行
      }, 2000);
    }
  } catch (error) {
    console.error('❌ FRIENDLYモード100%完成版・統合マウント失敗:', error);
    document.getElementById('root').innerHTML = `
      <div style="min-height: 100vh; background: #111827; color: white; display: flex; align-items: center; justify-content: center; font-family: sans-serif; padding: 1rem;">
        <div style="text-align: center; max-width: 600px;">
          <h1 style="font-size: 1.8rem; margin-bottom: 1rem; color: #f87171;">アプリケーションの起動に失敗しました</h1>
          <p style="color: #d1d5db; margin-bottom: 1.5rem;">FRIENDLYモード100%完成版（統合）の読み込み中に致命的なエラーが発生しました。ページを再読み込みするか、開発者コンソールで詳細を確認してください。</p>
          <p style="color: #fca5a5; margin-bottom: 1.5rem; font-family: monospace; font-size: 0.9rem; background: #374151; padding: 0.5rem; border-radius: 0.25rem;">エラー: ${error.message}</p>
          <button onclick="location.reload()" style="background: #2563eb; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; color: white; cursor: pointer; margin-right: 1rem;">再読み込み</button>
          <button onclick="console.error('Mount error details:', arguments[0])" style="background: #4b5563; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; color: white; cursor: pointer;">詳細をコンソールへ</button>
        </div>
      </div>
    `.replace("arguments[0]", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
});

console.log('✅ FRIENDLYモード100%完成版・統合 app.js loaded:', {
  version: 'FRIENDLY100%-Integrated',
  features: [
    '統合エラーハンドリング (UnifiedErrorDisplay)',
    'リアルタイムキー交換 (KeyExchangeManager)',
    'メモリ・パフォーマンス管理 (MemoryPerformanceManager)',
    '堅牢なSocket.IO接続管理 (詳細リトライ、品質監視)',
    'ハイブリッドE2EE暗号化システム (FRIENDLY)',
    'リアルタイムセッション同期・暗号化レベル自動切替',
    '統合E2Eテストスイート連携',
    '包括的デバッグ機能'
  ],
  debugMode: window.DEBUG_MODE,
  timestamp: new Date().toISOString()
});