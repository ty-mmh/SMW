// public/js/modules/SessionRealtimeSync.js
window.SessionRealtimeSync = {
  // セッション同期状態
  syncState: {
    lastSyncTime: null,
    pendingSyncs: new Map(),
    syncErrors: []
  },

  /**
   * セッション変更の統合処理
   */
  handleSessionChange: async (changeType, data, socket) => {
    const { spaceId, sessionId } = data;
    
    try {
      // 1. SessionManagerの更新
      if (changeType === 'join') {
        window.SessionManager.addSessionToSpace(spaceId, sessionId);
      } else if (changeType === 'leave') {
        window.SessionManager.removeSessionFromSpace(spaceId, sessionId);
      }
      
      // 2. 暗号化レベルの再評価
      const newSessionCount = window.SessionManager.getActiveSessionsForSpace(spaceId).length;
      const newEncryptionLevel = newSessionCount > 1 ? 'hybrid' : 'deterministic';
      
      // 3. キー交換の必要性判定
      if (newEncryptionLevel === 'hybrid' && changeType === 'join') {
        // 新規参加者とのキー交換開始
        if (window.KeyExchangeManager) {
          await window.KeyExchangeManager.initiateKeyExchangeWithPeer(socket, spaceId, sessionId);
        }
      }
      
      // 4. UIへの通知
      window.SessionRealtimeSync.notifyUI({
        type: 'session_changed',
        changeType,
        sessionId,
        sessionCount: newSessionCount,
        encryptionLevel: newEncryptionLevel
      });
      
      window.Utils.log('success', 'セッション変更同期完了', {
        changeType,
        sessionId,
        newSessionCount,
        newEncryptionLevel
      });
      
    } catch (error) {
      window.Utils.log('error', 'セッション同期エラー', error);
      window.SessionRealtimeSync.syncState.syncErrors.push({
        timestamp: new Date(),
        error: error.message,
        data
      });
    }
  },

  /**
   * 定期的な同期状態確認
   */
  verifySyncState: async (socket, spaceId) => {
    if (!socket?.connected) return;
    
    socket.emit('request-session-state', { spaceId }, (serverState) => {
      const localSessions = window.SessionManager.getActiveSessionsForSpace(spaceId);
      const serverSessions = serverState.sessions || [];
      
      // 差分検出
      const missingSessions = serverSessions.filter(s => !localSessions.includes(s));
      const extraSessions = localSessions.filter(s => !serverSessions.includes(s));
      
      if (missingSessions.length > 0 || extraSessions.length > 0) {
        window.Utils.log('warn', 'セッション状態の不整合検出', {
          missing: missingSessions,
          extra: extraSessions
        });
        
        // 自動修復
        window.SessionRealtimeSync.repairSyncState(spaceId, serverState);
      }
    });
  }
};