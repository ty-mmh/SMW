console.log('🔄 SessionManager Socket.IO統合強化版 モジュール読み込み開始');

window.SessionManager = {
  // 現在のセッション情報
  currentSession: {
    sessionId: null,
    spaceId: null,
    joinedAt: null,
    lastActivity: null
  },
  
  // 空間ごとのアクティブセッション管理
  activeSessions: new Map(), // spaceId -> Set<sessionId>
  
  // 🆕 リアルタイム同期のための状態管理
  realtimeState: {
    socket: null,
    isConnected: false,
    lastSyncTime: null,
    syncErrors: [],
    pendingUpdates: new Map() // sessionId -> updateData
  },
  
  // 🆕 セッション活性度管理
  sessionActivity: new Map(), // sessionId -> { lastActivity, heartbeat }
  
  // 🆕 暗号化レベル管理
  encryptionLevels: new Map(), // spaceId -> { level, sessionCount, lastUpdate }
  
  /**
   * セッション初期化（Socket.IO統合強化版）
   * @param {string} spaceId 空間ID
   * @returns {string} 生成されたセッションID
   */
  initializeSession: (spaceId) => {
    try {
      const sessionId = window.SessionManager.generateSessionId();
      
      window.SessionManager.currentSession = {
        sessionId,
        spaceId,
        joinedAt: new Date(),
        lastActivity: new Date()
      };
      
      // sessionStorageに保存（タブ固有）
      sessionStorage.setItem('secureChatSession', JSON.stringify({
        sessionId,
        spaceId,
        joinedAt: new Date().toISOString()
      }));
      
      // 空間のアクティブセッションに追加
      if (!window.SessionManager.activeSessions.has(spaceId)) {
        window.SessionManager.activeSessions.set(spaceId, new Set());
      }
      window.SessionManager.activeSessions.get(spaceId).add(sessionId);
      
      // 🆕 セッション活性度管理開始
      window.SessionManager.sessionActivity.set(sessionId, {
        lastActivity: new Date(),
        heartbeat: setInterval(() => {
          window.SessionManager.updateActivity();
        }, 30000) // 30秒ごとのハートビート
      });
      
      // 🆕 暗号化レベル初期化
      window.SessionManager.updateEncryptionLevel(spaceId);
      
      window.Utils.log('success', 'Socket.IO統合強化版 セッション初期化完了', { 
        sessionId: sessionId.substring(0, 12) + '...', 
        spaceId 
      });
      
      return sessionId;
    } catch (error) {
      window.Utils.log('error', 'セッション初期化エラー', error.message);
      throw error;
    }
  },
  
  /**
   * セッションID生成
   * @returns {string} 一意のセッションID
   */
  generateSessionId: () => {
    const timestamp = Date.now().toString(36);
    const random = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(random, b => b.toString(16).padStart(2, '0')).join('');
    return `session_${timestamp}_${randomHex}`;
  },
  
  /**
   * 現在のセッション取得
   * @returns {Object|null} セッション情報
   */
  getCurrentSession: () => {
    // メモリから取得
    if (window.SessionManager.currentSession.sessionId) {
      return window.SessionManager.currentSession;
    }
    
    // sessionStorageから復元試行
    try {
      const stored = sessionStorage.getItem('secureChatSession');
      if (stored) {
        const parsed = JSON.parse(stored);
        window.SessionManager.currentSession = {
          ...parsed,
          joinedAt: new Date(parsed.joinedAt),
          lastActivity: new Date()
        };
        
        window.Utils.log('debug', 'セッション復元成功', { 
          sessionId: parsed.sessionId.substring(0, 12) + '...' 
        });
        
        return window.SessionManager.currentSession;
      }
    } catch (error) {
      window.Utils.log('warn', 'セッション復元失敗', error.message);
    }
    
    return null;
  },
  
  /**
   * 空間のアクティブセッション取得
   * @param {string} spaceId 空間ID
   * @returns {Array<string>} セッションIDの配列
   */
  getActiveSessionsForSpace: (spaceId) => {
    const sessions = window.SessionManager.activeSessions.get(spaceId);
    const sessionArray = sessions ? Array.from(sessions) : [];
    
    window.Utils.log('debug', '空間のアクティブセッション取得', { 
      spaceId, 
      sessionCount: sessionArray.length 
    });
    
    return sessionArray;
  },
  
  /**
   * 🆕 Socket.IO接続設定
   * @param {Object} socket Socket.IOインスタンス
   */
  setSocket: (socket) => {
    window.SessionManager.realtimeState.socket = socket;
    window.SessionManager.realtimeState.isConnected = socket?.connected || false;
    
    if (socket) {
      // Socket.IOイベントリスナーの設定
      window.SessionManager.setupSocketListeners(socket);
      window.Utils.log('success', 'SessionManager Socket.IO統合設定完了');
    }
  },
  
  /**
   * 🆕 Socket.IOイベントリスナー設定
   * @param {Object} socket Socket.IOインスタンス
   */
  setupSocketListeners: (socket) => {
    // セッション関連イベント
    socket.on('session-count-updated', (data) => {
      window.SessionManager.handleSessionCountUpdate(data);
    });
    
    socket.on('session-joined', (data) => {
      window.SessionManager.handleSessionJoined(data);
    });
    
    socket.on('session-left', (data) => {
      window.SessionManager.handleSessionLeft(data);
    });
    
    socket.on('encryption-level-updated', (data) => {
      window.SessionManager.handleEncryptionLevelUpdate(data);
    });
    
    socket.on('connect', () => {
      window.SessionManager.realtimeState.isConnected = true;
      window.SessionManager.realtimeState.lastSyncTime = new Date();
      window.Utils.log('success', 'SessionManager Socket.IO接続確立');
    });
    
    socket.on('disconnect', () => {
      window.SessionManager.realtimeState.isConnected = false;
      window.Utils.log('warn', 'SessionManager Socket.IO接続切断');
    });
  },
  
  /**
   * 🆕 セッション数更新の処理
   * @param {Object} data サーバーからの更新データ
   */
  handleSessionCountUpdate: (data) => {
    if (!data.spaceId) return;
    
    window.Utils.log('info', 'リアルタイム セッション数更新処理', data);
    
    // 暗号化レベル更新
    window.SessionManager.encryptionLevels.set(data.spaceId, {
      level: data.encryptionLevel,
      sessionCount: data.sessionCount,
      lastUpdate: new Date(),
      source: 'server_update',
      reason: data.reason
    });
    
    // 現在の空間の場合は即座に反映
    const currentSession = window.SessionManager.getCurrentSession();
    if (currentSession && currentSession.spaceId === data.spaceId) {
      // セッション数を更新（但し、自分のセッションは保持）
      const currentSessions = window.SessionManager.activeSessions.get(data.spaceId) || new Set();
      
      // 必要に応じてセッション数を調整
      if (data.sessionCount !== currentSessions.size) {
        window.Utils.log('debug', 'セッション数同期', {
          current: currentSessions.size,
          server: data.sessionCount,
          space: data.spaceId
        });
      }
    }
  },
  
  /**
   * 🆕 セッション参加の処理
   * @param {Object} data セッション参加データ
   */
  handleSessionJoined: (data) => {
    if (!data.sessionId || !data.spaceId) return;
    
    window.Utils.log('info', 'リアルタイム セッション参加処理', {
      sessionId: data.sessionId.substring(0, 12) + '...',
      spaceId: data.spaceId
    });
    
    // アクティブセッションに追加
    if (!window.SessionManager.activeSessions.has(data.spaceId)) {
      window.SessionManager.activeSessions.set(data.spaceId, new Set());
    }
    
    const sessions = window.SessionManager.activeSessions.get(data.spaceId);
    const wasAdded = !sessions.has(data.sessionId);
    sessions.add(data.sessionId);
    
    if (wasAdded) {
      // 暗号化レベル更新
      window.SessionManager.updateEncryptionLevel(data.spaceId);
      
      window.Utils.log('success', 'セッション参加処理完了', {
        sessionId: data.sessionId.substring(0, 12) + '...',
        totalSessions: sessions.size
      });
    }
  },
  
  /**
   * 🆕 セッション退出の処理
   * @param {Object} data セッション退出データ
   */
  handleSessionLeft: (data) => {
    if (!data.sessionId || !data.spaceId) return;
    
    window.Utils.log('info', 'リアルタイム セッション退出処理', {
      sessionId: data.sessionId.substring(0, 12) + '...',
      spaceId: data.spaceId
    });
    
    const sessions = window.SessionManager.activeSessions.get(data.spaceId);
    if (sessions && sessions.has(data.sessionId)) {
      sessions.delete(data.sessionId);
      
      // 空のセッション管理をクリーンアップ
      if (sessions.size === 0) {
        window.SessionManager.activeSessions.delete(data.spaceId);
      }
      
      // セッション活性度管理からも削除
      const activity = window.SessionManager.sessionActivity.get(data.sessionId);
      if (activity && activity.heartbeat) {
        clearInterval(activity.heartbeat);
        window.SessionManager.sessionActivity.delete(data.sessionId);
      }
      
      // 暗号化レベル更新
      window.SessionManager.updateEncryptionLevel(data.spaceId);
      
      window.Utils.log('success', 'セッション退出処理完了', {
        sessionId: data.sessionId.substring(0, 12) + '...',
        remainingSessions: sessions.size
      });
    }
  },
  
  /**
   * 🆕 暗号化レベル更新の処理
   * @param {Object} data 暗号化レベル更新データ
   */
  handleEncryptionLevelUpdate: (data) => {
    if (!data.spaceId) return;
    
    window.Utils.log('info', 'リアルタイム 暗号化レベル更新処理', data);
    
    window.SessionManager.encryptionLevels.set(data.spaceId, {
      level: data.encryptionLevel,
      sessionCount: data.sessionCount || 1,
      lastUpdate: new Date(),
      source: 'peer_update',
      triggeredBy: data.triggeredBy
    });
  },
  
  /**
   * 🆕 暗号化レベル更新
   * @param {string} spaceId 空間ID
   */
  updateEncryptionLevel: (spaceId) => {
    const sessions = window.SessionManager.activeSessions.get(spaceId);
    const sessionCount = sessions ? sessions.size : 1;
    const encryptionLevel = sessionCount > 1 ? 'hybrid' : 'deterministic';
    
    window.SessionManager.encryptionLevels.set(spaceId, {
      level: encryptionLevel,
      sessionCount: sessionCount,
      lastUpdate: new Date(),
      source: 'local_update'
    });
    
    window.Utils.log('debug', '暗号化レベル更新', {
      spaceId,
      sessionCount,
      encryptionLevel
    });
    
    // Socket.IOで他のクライアントに通知
    if (window.SessionManager.realtimeState.socket && 
        window.SessionManager.realtimeState.isConnected) {
      window.SessionManager.realtimeState.socket.emit('encryption-level-changed', {
        spaceId,
        encryptionLevel,
        sessionCount,
        timestamp: new Date().toISOString()
      });
    }
  },
  
  /**
   * 🆕 暗号化レベル取得
   * @param {string} spaceId 空間ID
   * @returns {Object} 暗号化レベル情報
   */
  getEncryptionLevel: (spaceId) => {
    return window.SessionManager.encryptionLevels.get(spaceId) || {
      level: 'deterministic',
      sessionCount: 1,
      lastUpdate: new Date(),
      source: 'default'
    };
  },
  
  /**
   * セッション活性度更新（Socket.IO統合強化版）
   */
  updateActivity: () => {
    const currentSession = window.SessionManager.getCurrentSession();
    if (currentSession && currentSession.sessionId) {
      window.SessionManager.currentSession.lastActivity = new Date();
      
      // セッション活性度管理更新
      const activity = window.SessionManager.sessionActivity.get(currentSession.sessionId);
      if (activity) {
        activity.lastActivity = new Date();
      }
      
      window.Utils.log('debug', 'セッション活性度更新');
      
      // 🆕 Socket.IOでサーバーに活性度を通知
      if (window.SessionManager.realtimeState.socket && 
          window.SessionManager.realtimeState.isConnected) {
        window.SessionManager.realtimeState.socket.emit('session-activity', {
          sessionId: currentSession.sessionId,
          spaceId: currentSession.spaceId,
          timestamp: new Date().toISOString(),
          notifyOthers: false
        });
      }
    }
  },
  
  /**
   * セッション退出（Socket.IO統合強化版）
   * @param {string} spaceId 空間ID
   */
  leaveSession: (spaceId) => {
    const session = window.SessionManager.getCurrentSession();
    if (!session) return;
    
    try {
      // アクティブセッションから削除
      const activeSessions = window.SessionManager.activeSessions.get(spaceId);
      if (activeSessions) {
        activeSessions.delete(session.sessionId);
        
        if (activeSessions.size === 0) {
          window.SessionManager.activeSessions.delete(spaceId);
        }
      }
      
      // セッション活性度管理のクリーンアップ
      const activity = window.SessionManager.sessionActivity.get(session.sessionId);
      if (activity && activity.heartbeat) {
        clearInterval(activity.heartbeat);
        window.SessionManager.sessionActivity.delete(session.sessionId);
      }
      
      // 暗号化レベル管理のクリーンアップ
      window.SessionManager.encryptionLevels.delete(spaceId);
      
      // セッション情報クリア
      window.SessionManager.currentSession = {
        sessionId: null,
        spaceId: null,
        joinedAt: null,
        lastActivity: null
      };
      
      sessionStorage.removeItem('secureChatSession');
      
      window.Utils.log('success', 'Socket.IO統合強化版 セッション退出完了', { 
        sessionId: session.sessionId.substring(0, 12) + '...',
        spaceId 
      });
    } catch (error) {
      window.Utils.log('error', 'セッション退出エラー', error.message);
    }
  },
  
  /**
   * 他のセッションを追加（Socket.IO経由で受信）
   * @param {string} spaceId 空間ID
   * @param {string} sessionId セッションID
   */
  addSessionToSpace: (spaceId, sessionId) => {
    if (!window.SessionManager.activeSessions.has(spaceId)) {
      window.SessionManager.activeSessions.set(spaceId, new Set());
    }
    
    const sessions = window.SessionManager.activeSessions.get(spaceId);
    const wasAdded = !sessions.has(sessionId);
    sessions.add(sessionId);
    
    if (wasAdded) {
      // 暗号化レベル更新
      window.SessionManager.updateEncryptionLevel(spaceId);
      
      window.Utils.log('info', '他のセッションが参加', { 
        spaceId, 
        sessionId: sessionId.substring(0, 12) + '...',
        totalSessions: sessions.size 
      });
    }
  },
  
  /**
   * セッションを削除（Socket.IO経由で受信）
   * @param {string} spaceId 空間ID
   * @param {string} sessionId セッションID
   */
  removeSessionFromSpace: (spaceId, sessionId) => {
    const sessions = window.SessionManager.activeSessions.get(spaceId);
    if (sessions && sessions.has(sessionId)) {
      sessions.delete(sessionId);
      
      // 暗号化レベル更新
      window.SessionManager.updateEncryptionLevel(spaceId);
      
      window.Utils.log('info', 'セッションが退出', { 
        spaceId, 
        sessionId: sessionId.substring(0, 12) + '...',
        remainingSessions: sessions.size 
      });
      
      if (sessions.size === 0) {
        window.SessionManager.activeSessions.delete(spaceId);
      }
    }
  },
  
  /**
   * 🆕 リアルタイム同期状態取得
   * @returns {Object} 同期状態情報
   */
  getRealtimeStatus: () => {
    return {
      isConnected: window.SessionManager.realtimeState.isConnected,
      lastSyncTime: window.SessionManager.realtimeState.lastSyncTime,
      errorCount: window.SessionManager.realtimeState.syncErrors.length,
      pendingUpdates: window.SessionManager.realtimeState.pendingUpdates.size
    };
  },
  
  /**
   * 🆕 セッション統計情報取得
   * @returns {Object} セッション統計
   */
  getSessionStats: () => {
    const currentSession = window.SessionManager.getCurrentSession();
    const totalSpaces = window.SessionManager.activeSessions.size;
    let totalSessions = 0;
    
    for (const sessions of window.SessionManager.activeSessions.values()) {
      totalSessions += sessions.size;
    }
    
    return {
      currentSession: currentSession ? {
        sessionId: currentSession.sessionId.substring(0, 12) + '...',
        spaceId: currentSession.spaceId,
        joinedAt: currentSession.joinedAt,
        lastActivity: currentSession.lastActivity
      } : null,
      totalSpaces,
      totalSessions,
      averageSessionsPerSpace: totalSpaces > 0 ? (totalSessions / totalSpaces).toFixed(2) : 0,
      encryptionLevels: Object.fromEntries(
        Array.from(window.SessionManager.encryptionLevels.entries()).map(([spaceId, info]) => [
          spaceId, `${info.level} (${info.sessionCount})`
        ])
      )
    };
  },
  
  /**
   * 🆕 強制同期（手動実行）
   * @param {string} spaceId 空間ID
   */
  forceSyncSpace: async (spaceId) => {
    if (!window.SessionManager.realtimeState.socket || 
        !window.SessionManager.realtimeState.isConnected) {
      window.Utils.log('warn', '強制同期失敗: Socket.IO未接続');
      return false;
    }
    
    const currentSession = window.SessionManager.getCurrentSession();
    if (!currentSession || currentSession.spaceId !== spaceId) {
      window.Utils.log('warn', '強制同期失敗: セッション不一致');
      return false;
    }
    
    window.Utils.log('info', '強制同期実行', { spaceId });
    
    // セッション情報を再送信
    window.SessionManager.realtimeState.socket.emit('session-info', {
      sessionId: currentSession.sessionId,
      spaceId: spaceId,
      timestamp: new Date().toISOString(),
      forceSync: true
    });
    
    // 暗号化レベル更新を通知
    window.SessionManager.updateEncryptionLevel(spaceId);
    
    return true;
  },
  
  /**
   * デバッグ情報取得（Socket.IO統合強化版）
   * @returns {Object} デバッグ情報
   */
  getDebugInfo: () => {
    const currentSession = window.SessionManager.getCurrentSession();
    
    return {
      currentSession: currentSession ? {
        ...currentSession,
        sessionId: currentSession.sessionId ? 
          currentSession.sessionId.substring(0, 12) + '...' : null
      } : null,
      activeSpaces: window.SessionManager.activeSessions.size,
      spaceSessionCounts: Object.fromEntries(
        Array.from(window.SessionManager.activeSessions.entries()).map(([spaceId, sessions]) => [
          spaceId, sessions.size
        ])
      ),
      realtimeState: window.SessionManager.realtimeState,
      encryptionLevels: Object.fromEntries(window.SessionManager.encryptionLevels),
      sessionActivity: window.SessionManager.sessionActivity.size,
      stats: window.SessionManager.getSessionStats()
    };
  }
};

console.log('✅ SessionManager Socket.IO統合強化版 モジュール読み込み完了');