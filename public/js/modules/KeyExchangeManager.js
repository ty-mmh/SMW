// KeyExchangeManager.js - FRIENDLYモード リアルタイムキー交換システム
// ECDH公開鍵交換、セッション暗号化、鍵同期機能

console.log('🔐 FRIENDLYモード リアルタイムキー交換システム 読み込み開始');

window.KeyExchangeManager = {
  // キー交換状態管理
  exchangeState: {
    activeExchanges: new Map(), // spaceId -> exchangeInfo
    peerPublicKeys: new Map(),  // spaceId -> Map<sessionId, publicKey>
    keyNegotiationStatus: new Map(), // spaceId -> status
    lastExchange: new Map() // spaceId -> timestamp
  },
  
  // キー交換イベントリスナー
  keyExchangeListeners: new Set(),
  
  /**
   * キー交換システム初期化
   * @param {Object} socket Socket.IOインスタンス
   * @param {string} currentSpaceId 現在の空間ID
   */
  initialize: (socket, currentSpaceId) => {
    if (!socket || !currentSpaceId) {
      window.Utils.log('error', 'キー交換初期化失敗: socket または spaceId が無効');
      return false;
    }
    
    window.Utils.log('info', 'リアルタイムキー交換システム初期化', { spaceId: currentSpaceId });
    
    // Socket.IOイベントリスナー設定
    window.KeyExchangeManager.setupSocketListeners(socket, currentSpaceId);
    
    // 初期キー交換の開始
    window.KeyExchangeManager.initiateKeyExchange(socket, currentSpaceId);
    
    return true;
  },
  
  /**
   * Socket.IOイベントリスナー設定
   * @param {Object} socket Socket.IOインスタンス
   * @param {string} spaceId 空間ID
   */
  setupSocketListeners: (socket, spaceId) => {
    // 公開鍵受信
    socket.on('public-key-received', (data) => {
      window.KeyExchangeManager.handlePublicKeyReceived(data, spaceId);
    });
    
    // キー交換要求受信
    socket.on('key-exchange-request', (data) => {
      window.KeyExchangeManager.handleKeyExchangeRequest(socket, data, spaceId);
    });
    
    // キー交換応答受信
    socket.on('key-exchange-response', (data) => {
      window.KeyExchangeManager.handleKeyExchangeResponse(data, spaceId);
    });
    
    // キー検証要求
    socket.on('key-verification-request', (data) => {
      window.KeyExchangeManager.handleKeyVerificationRequest(socket, data, spaceId);
    });
    
    // セッション参加時のキー同期
    socket.on('session-joined', (data) => {
      if (data.spaceId === spaceId) {
        window.KeyExchangeManager.syncKeysWithNewSession(socket, data, spaceId);
      }
    });
    
    window.Utils.log('success', 'キー交換Socket.IOリスナー設定完了', { spaceId });
  },
  
  /**
   * キー交換開始
   * @param {Object} socket Socket.IOインスタンス
   * @param {string} spaceId 空間ID
   */
  initiateKeyExchange: async (socket, spaceId) => {
    try {
      window.Utils.log('info', 'キー交換開始', { spaceId });
      
      // 現在のセッション情報取得
      const currentSession = window.SessionManager.getCurrentSession();
      if (!currentSession || currentSession.spaceId !== spaceId) {
        throw new Error('有効なセッションが見つかりません');
      }
      
      // 既存の暗号化キー確認
      const spaceKeyInfo = window.Crypto.getSpaceKeyInfo(spaceId);
      let myPublicKey = null;
      
      if (spaceKeyInfo && spaceKeyInfo.publicKeyJWK) {
        myPublicKey = spaceKeyInfo.publicKeyJWK;
        window.Utils.log('debug', '既存の公開鍵を使用', { spaceId });
      } else {
        // 新しいキーペア生成
        window.Utils.log('debug', '新しいキーペア生成中', { spaceId });
        const keyPair = await window.Crypto.generateKeyPair();
        myPublicKey = await window.Crypto.exportPublicKey(keyPair.publicKey);
        
        // キー情報更新
        window.Crypto.spaceKeys.set(spaceId, {
          ...window.Crypto.spaceKeys.get(spaceId),
          keyPair: keyPair,
          publicKeyJWK: myPublicKey
        });
      }
      
      // 公開鍵を他のセッションに送信
      socket.emit('public-key-announcement', {
        spaceId: spaceId,
        sessionId: currentSession.sessionId,
        publicKey: myPublicKey,
        timestamp: new Date().toISOString(),
        purpose: 'key_exchange_initiation'
      });
      
      // キー交換状態を更新
      window.KeyExchangeManager.exchangeState.activeExchanges.set(spaceId, {
        status: 'initiated',
        myPublicKey: myPublicKey,
        startTime: new Date(),
        sessionId: currentSession.sessionId
      });
      
      window.Utils.log('success', 'キー交換開始完了', { 
        spaceId,
        publicKeyPreview: myPublicKey.x?.substring(0, 16) + '...'
      });
      
      // キー交換リスナーに通知
      window.KeyExchangeManager.notifyKeyExchangeListeners({
        type: 'exchange_initiated',
        spaceId: spaceId,
        sessionId: currentSession.sessionId
      });
      
    } catch (error) {
      window.Utils.log('error', 'キー交換開始エラー', {
        spaceId,
        error: error.message
      });
      
      window.KeyExchangeManager.exchangeState.keyNegotiationStatus.set(spaceId, {
        status: 'failed',
        error: error.message,
        timestamp: new Date()
      });
    }
  },
  
  /**
   * 公開鍵受信処理
   * @param {Object} data 受信データ
   * @param {string} spaceId 空間ID
   */
  handlePublicKeyReceived: async (data, spaceId) => {
    if (!data.publicKey || !data.sessionId || data.spaceId !== spaceId) return;
    
    window.Utils.log('info', 'ピア公開鍵受信', {
      spaceId,
      fromSession: data.sessionId.substring(0, 12) + '...',
      publicKeyPreview: data.publicKey.x?.substring(0, 16) + '...'
    });
    
    try {
      // ピア公開鍵を保存
      if (!window.KeyExchangeManager.exchangeState.peerPublicKeys.has(spaceId)) {
        window.KeyExchangeManager.exchangeState.peerPublicKeys.set(spaceId, new Map());
      }
      
      const peerKeys = window.KeyExchangeManager.exchangeState.peerPublicKeys.get(spaceId);
      peerKeys.set(data.sessionId, data.publicKey);
      
      // 共有鍵の導出
      const currentSession = window.SessionManager.getCurrentSession();
      if (currentSession && currentSession.spaceId === spaceId) {
        await window.KeyExchangeManager.deriveSharedKey(spaceId, data.sessionId, data.publicKey);
      }
      
      // キー交換リスナーに通知
      window.KeyExchangeManager.notifyKeyExchangeListeners({
        type: 'peer_key_received',
        spaceId: spaceId,
        peerSessionId: data.sessionId,
        publicKey: data.publicKey
      });
      
    } catch (error) {
      window.Utils.log('error', 'ピア公開鍵処理エラー', {
        spaceId,
        sessionId: data.sessionId,
        error: error.message
      });
    }
  },
  
  /**
   * 共有鍵導出
   * @param {string} spaceId 空間ID
   * @param {string} peerSessionId ピアセッションID
   * @param {Object} peerPublicKey ピア公開鍵
   */
  deriveSharedKey: async (spaceId, peerSessionId, peerPublicKey) => {
    try {
      window.Utils.log('debug', '共有鍵導出開始', {
        spaceId,
        peerSession: peerSessionId.substring(0, 12) + '...'
      });
      
      // 自分のキーペア取得
      const spaceKeyInfo = window.Crypto.spaceKeys.get(spaceId);
      if (!spaceKeyInfo || !spaceKeyInfo.keyPair) {
        throw new Error('自分のキーペアが見つかりません');
      }
      
      // ピア公開鍵をインポート
      const importedPeerKey = await window.Crypto.importPublicKey(peerPublicKey);
      
      // ECDH共有鍵導出
      const sharedKey = await window.Crypto.deriveSharedSecret(
        spaceKeyInfo.keyPair.privateKey,
        importedPeerKey,
        spaceId
      );
      
      // 共有鍵を保存（セッション別）
      if (!spaceKeyInfo.peerKeys) {
        spaceKeyInfo.peerKeys = new Map();
      }
      spaceKeyInfo.peerKeys.set(peerSessionId, {
        publicKey: peerPublicKey,
        sharedKey: sharedKey,
        derivedAt: new Date()
      });
      
      window.Utils.log('success', '共有鍵導出完了', {
        spaceId,
        peerSession: peerSessionId.substring(0, 12) + '...'
      });
      
      // 暗号化レベルをハイブリッドに更新
      if (window.SessionManager) {
        window.SessionManager.updateEncryptionLevel(spaceId);
      }
      
    } catch (error) {
      window.Utils.log('error', '共有鍵導出エラー', {
        spaceId,
        peerSession: peerSessionId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * キー交換要求処理
   * @param {Object} socket Socket.IOインスタンス
   * @param {Object} data 要求データ
   * @param {string} spaceId 空間ID
   */
  handleKeyExchangeRequest: async (socket, data, spaceId) => {
    if (data.spaceId !== spaceId) return;
    
    window.Utils.log('info', 'キー交換要求受信', {
      spaceId,
      fromSession: data.sessionId?.substring(0, 12) + '...'
    });
    
    try {
      const currentSession = window.SessionManager.getCurrentSession();
      if (!currentSession || currentSession.spaceId !== spaceId) {
        throw new Error('有効なセッションがありません');
      }
      
      // 自分の公開鍵を送信
      const spaceKeyInfo = window.Crypto.getSpaceKeyInfo(spaceId);
      if (spaceKeyInfo && spaceKeyInfo.publicKeyJWK) {
        socket.emit('key-exchange-response', {
          spaceId: spaceId,
          sessionId: currentSession.sessionId,
          publicKey: spaceKeyInfo.publicKeyJWK,
          requestId: data.requestId,
          timestamp: new Date().toISOString()
        });
        
        window.Utils.log('success', 'キー交換応答送信完了', { spaceId });
      }
      
    } catch (error) {
      window.Utils.log('error', 'キー交換要求処理エラー', {
        spaceId,
        error: error.message
      });
    }
  },
  
  /**
   * キー交換応答処理
   * @param {Object} data 応答データ
   * @param {string} spaceId 空間ID
   */
  handleKeyExchangeResponse: async (data, spaceId) => {
    if (data.spaceId !== spaceId) return;
    
    window.Utils.log('info', 'キー交換応答受信', {
      spaceId,
      fromSession: data.sessionId?.substring(0, 12) + '...'
    });
    
    // 公開鍵受信処理と同じ処理
    await window.KeyExchangeManager.handlePublicKeyReceived(data, spaceId);
  },
  
  /**
   * 新しいセッションとのキー同期
   * @param {Object} socket Socket.IOインスタンス
   * @param {Object} data セッション参加データ
   * @param {string} spaceId 空間ID
   */
  syncKeysWithNewSession: async (socket, data, spaceId) => {
    if (data.spaceId !== spaceId) return;
    
    window.Utils.log('info', '新セッションとのキー同期開始', {
      spaceId,
      newSession: data.sessionId?.substring(0, 12) + '...'
    });
    
    try {
      const currentSession = window.SessionManager.getCurrentSession();
      if (!currentSession || currentSession.spaceId !== spaceId) return;
      
      // 自分の公開鍵を新しいセッションに送信
      const spaceKeyInfo = window.Crypto.getSpaceKeyInfo(spaceId);
      if (spaceKeyInfo && spaceKeyInfo.publicKeyJWK) {
        // 少し遅延してからキー交換要求を送信（接続安定化）
        setTimeout(() => {
          socket.emit('key-exchange-request', {
            spaceId: spaceId,
            sessionId: currentSession.sessionId,
            targetSessionId: data.sessionId,
            publicKey: spaceKeyInfo.publicKeyJWK,
            requestId: `sync_${Date.now()}`,
            timestamp: new Date().toISOString()
          });
        }, 1000);
        
        window.Utils.log('debug', '新セッション向けキー交換要求送信予約', { spaceId });
      }
      
    } catch (error) {
      window.Utils.log('error', '新セッションキー同期エラー', {
        spaceId,
        error: error.message
      });
    }
  },
  
  /**
   * キー検証要求処理
   * @param {Object} socket Socket.IOインスタンス
   * @param {Object} data 検証要求データ
   * @param {string} spaceId 空間ID
   */
  handleKeyVerificationRequest: async (socket, data, spaceId) => {
    if (data.spaceId !== spaceId) return;
    
    window.Utils.log('info', 'キー検証要求受信', { spaceId });
    
    try {
      // テストメッセージでキー検証
      const testMessage = `key_verification_${Date.now()}`;
      const encrypted = await window.Crypto.encryptMessage(testMessage, spaceId);
      
      socket.emit('key-verification-response', {
        spaceId: spaceId,
        requestId: data.requestId,
        testData: encrypted,
        timestamp: new Date().toISOString()
      });
      
      window.Utils.log('success', 'キー検証応答送信完了', { spaceId });
      
    } catch (error) {
      window.Utils.log('error', 'キー検証エラー', {
        spaceId,
        error: error.message
      });
    }
  },
  
  /**
   * キー交換状態取得
   * @param {string} spaceId 空間ID
   * @returns {Object} キー交換状態
   */
  getKeyExchangeStatus: (spaceId) => {
    const exchangeInfo = window.KeyExchangeManager.exchangeState.activeExchanges.get(spaceId);
    const peerKeys = window.KeyExchangeManager.exchangeState.peerPublicKeys.get(spaceId);
    const negotiationStatus = window.KeyExchangeManager.exchangeState.keyNegotiationStatus.get(spaceId);
    
    return {
      status: exchangeInfo?.status || 'not_started',
      peerCount: peerKeys ? peerKeys.size : 0,
      negotiationStatus: negotiationStatus?.status || 'unknown',
      lastExchange: window.KeyExchangeManager.exchangeState.lastExchange.get(spaceId),
      hasSharedKeys: !!window.Crypto.getSpaceKeyInfo(spaceId)?.peerKeys?.size
    };
  },
  
  /**
   * キー交換リスナー追加
   * @param {Function} listener リスナー関数
   */
  addKeyExchangeListener: (listener) => {
    window.KeyExchangeManager.keyExchangeListeners.add(listener);
  },
  
  /**
   * キー交換リスナー削除
   * @param {Function} listener リスナー関数
   */
  removeKeyExchangeListener: (listener) => {
    window.KeyExchangeManager.keyExchangeListeners.delete(listener);
  },
  
  /**
   * キー交換リスナーに通知
   * @param {Object} event イベントデータ
   */
  notifyKeyExchangeListeners: (event) => {
    window.KeyExchangeManager.keyExchangeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('キー交換リスナーエラー:', error);
      }
    });
  },
  
  /**
   * クリーンアップ
   * @param {string} spaceId 空間ID
   */
  cleanup: (spaceId) => {
    window.KeyExchangeManager.exchangeState.activeExchanges.delete(spaceId);
    window.KeyExchangeManager.exchangeState.peerPublicKeys.delete(spaceId);
    window.KeyExchangeManager.exchangeState.keyNegotiationStatus.delete(spaceId);
    window.KeyExchangeManager.exchangeState.lastExchange.delete(spaceId);
    
    window.Utils.log('info', 'キー交換状態クリーンアップ完了', { spaceId });
  },
  
  /**
   * デバッグ情報取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo: () => {
    return {
      activeExchanges: window.KeyExchangeManager.exchangeState.activeExchanges.size,
      totalPeerKeys: Array.from(window.KeyExchangeManager.exchangeState.peerPublicKeys.values())
        .reduce((total, peerMap) => total + peerMap.size, 0),
      keyNegotiationStatuses: Object.fromEntries(
        Array.from(window.KeyExchangeManager.exchangeState.keyNegotiationStatus.entries())
      ),
      lastExchangeTimes: Object.fromEntries(
        Array.from(window.KeyExchangeManager.exchangeState.lastExchange.entries())
      )
    };
  }
};

// デバッグ用グローバル関数
if (window.DEBUG_MODE) {
  window.getKeyExchangeDebugInfo = () => window.KeyExchangeManager.getDebugInfo();
}

console.log('✅ FRIENDLYモード リアルタイムキー交換システム 読み込み完了');