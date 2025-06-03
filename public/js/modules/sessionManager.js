console.log('🔄 SessionManager モジュール読み込み開始');

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
  
  /**
   * セッション初期化
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
      
      window.Utils.log('success', 'セッション初期化完了', { 
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
   * セッション活性度更新
   */
  updateActivity: () => {
    if (window.SessionManager.currentSession.sessionId) {
      window.SessionManager.currentSession.lastActivity = new Date();
      window.Utils.log('debug', 'セッション活性度更新');
    }
  },
  
  /**
   * セッション退出
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
      
      // セッション情報クリア
      window.SessionManager.currentSession = {
        sessionId: null,
        spaceId: null,
        joinedAt: null,
        lastActivity: null
      };
      
      sessionStorage.removeItem('secureChatSession');
      
      window.Utils.log('success', 'セッション退出完了', { 
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
   * デバッグ情報取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo: () => {
    return {
      currentSession: {
        ...window.SessionManager.currentSession,
        sessionId: window.SessionManager.currentSession.sessionId ? 
          window.SessionManager.currentSession.sessionId.substring(0, 12) + '...' : null
      },
      activeSpaces: window.SessionManager.activeSessions.size,
      spaceSessionCounts: Object.fromEntries(
        Array.from(window.SessionManager.activeSessions.entries()).map(([spaceId, sessions]) => [
          spaceId, sessions.size
        ])
      )
    };
  }
};

console.log('✅ SessionManager モジュール読み込み完了');