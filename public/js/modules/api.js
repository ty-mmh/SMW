// API通信モジュール（暗号化統合版・修正版）
// サーバーとの通信、暗号化処理、エラーハンドリング

window.API = {
  // 暗号化システムの状態
  encryptionSystem: null,
  currentSpaceId: null,
  otherUsers: new Map(), // 他のユーザーの公開鍵を管理

  // =============================================================================
  // 基本API呼び出し（暗号化対応）
  // =============================================================================
  
  call: async (endpoint, options = {}) => {
    // パフォーマンス測定開始
    window.Utils.performance.start(`api_${endpoint.replace(/[\/\:]/g, '_')}`);
    
    try {
      window.Utils.log('debug', 'API呼び出し開始', { endpoint, options: { ...options, body: options.body ? '[BODY_HIDDEN]' : undefined } });
      
      if (!window.API_BASE) {
        throw new Error('API_BASE URLが設定されていません');
      }

      const url = `${window.API_BASE}${endpoint}`;
      
      // デフォルトオプション設定
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      };

      const response = await fetch(url, defaultOptions);
      
      window.Utils.log('debug', 'API レスポンス受信', { 
        url, 
        status: response.status, 
        statusText: response.statusText,
        contentType: response.headers.get('content-type')
      });
      
      // レスポンス内容の解析
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseError) {
          window.Utils.log('error', 'JSON解析エラー', { 
            url, 
            status: response.status,
            parseError: parseError.message 
          });
          throw new Error(`サーバーから無効なJSONレスポンス: ${response.status}`);
        }
      } else {
        const text = await response.text();
        window.Utils.log('error', '非JSON レスポンス', { url, status: response.status, text: text.substring(0, 200) });
        throw new Error(`サーバーから無効なレスポンス形式: ${response.status}`);
      }
      
      // エラーレスポンスの処理
      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        window.Utils.log('error', 'API エラーレスポンス', { 
          url, 
          status: response.status, 
          error: errorMessage,
          data 
        });
        throw new Error(errorMessage);
      }
      
      // 成功レスポンスのログ
      window.Utils.log('debug', 'API 成功レスポンス', { 
        url, 
        status: response.status,
        dataKeys: data ? Object.keys(data) : []
      });
      
      return data;
      
    } catch (error) {
      const errorMessage = window.Utils.handleError(error, `API call to ${endpoint}`);
      throw new Error(errorMessage);
    } finally {
      // パフォーマンス測定終了
      window.Utils.performance.end(`api_${endpoint.replace(/[\/\:]/g, '_')}`);
    }
  },

  // =============================================================================
  // 暗号化システム管理
  // =============================================================================

  /**
   * 空間の暗号化システムを初期化
   * @param {string} spaceId 
   * @returns {Promise<boolean>}
   */
  initializeEncryption: async (spaceId) => {
    try {
      if (!window.Crypto || !window.Crypto.isSupported) {
        window.Utils.log('warn', 'Web Crypto API未サポート - 暗号化を無効化');
        return false;
      }

      window.Utils.log('info', '暗号化システム初期化開始', { spaceId });
      
      // 🔧 修正: 正しい関数名を使用
      const spaceKey = await window.Crypto.getOrCreateSpaceKey(spaceId);
      
      // 暗号化システムオブジェクト作成
      window.API.encryptionSystem = {
        spaceId: spaceId,
        spaceKey: spaceKey,
        publicKey: null,
        
        // メッセージ暗号化関数
        encryptMessage: async (message) => {
          return await window.Crypto.encryptMessage(message, spaceId);
        },
        
        // メッセージ復号化関数
        decryptMessage: async (encData, iv) => {
          return await window.Crypto.decryptMessage(encData, iv, spaceId);
        }
      };
      
      window.API.currentSpaceId = spaceId;
      
      // 公開鍵設定の試行
      try {
        if (window.Crypto.getMyPublicKey) {
          window.API.encryptionSystem.publicKey = window.Crypto.getMyPublicKey(spaceId);
        }
      } catch (keyError) {
        window.Utils.log('warn', '公開鍵取得をスキップ', keyError.message);
      }
      
      // 公開鍵をサーバーに送信（将来の実装）
      if (window.API.encryptionSystem.publicKey) {
        await window.API.announcePublicKey(spaceId, window.API.encryptionSystem.publicKey);
      }
      
      window.Utils.log('success', '暗号化システム初期化完了', { 
        spaceId,
        hasSpaceKey: !!spaceKey,
        hasPublicKey: !!window.API.encryptionSystem.publicKey
      });
      
      return true;
      
    } catch (error) {
      window.Utils.log('error', '暗号化システム初期化エラー', error.message);
      // 暗号化エラーでもアプリケーションは継続
      window.API.encryptionSystem = null;
      return false;
    }
  },

  /**
   * 公開鍵をサーバーに通知（将来の実装）
   * @param {string} spaceId 
   * @param {string} publicKey 
   */
  announcePublicKey: async (spaceId, publicKey) => {
    try {
      // 現在はローカルストレージに保存（将来はサーバー経由）
      const announcement = {
        spaceId,
        publicKey,
        timestamp: new Date().toISOString(),
        userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      window.Utils.storage.set('publicKeyAnnouncement', announcement);
      window.Utils.log('debug', '公開鍵通知完了', announcement);
      
    } catch (error) {
      window.Utils.log('warn', '公開鍵通知エラー', error.message);
    }
  },

  /**
   * 暗号化システムをクリーンアップ
   */
  cleanupEncryption: () => {
    if (window.API.currentSpaceId && window.Crypto && window.Crypto.cleanupSpaceKey) {
      window.Crypto.cleanupSpaceKey(window.API.currentSpaceId);
    }
    window.API.encryptionSystem = null;
    window.API.currentSpaceId = null;
    window.API.otherUsers.clear();
    window.Utils.log('info', '暗号化システムクリーンアップ完了');
  },

  // =============================================================================
  // 空間管理API（暗号化対応）
  // =============================================================================

  // 空間入室API
  enterSpace: async (passphrase) => {
    window.Utils.log('info', '空間入室処理開始', { passphraseLength: passphrase?.length });
    
    // バリデーション
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const result = await window.API.call('/spaces/enter', {
      method: 'POST',
      body: JSON.stringify({ passphrase: validation.passphrase })
    });

    if (!result || !result.success || !result.space) {
      throw new Error('空間入室レスポンスが不正です');
    }

    // データの安全性確認と変換
    const space = result.space;
    if (!space.id || !space.passphrase) {
      throw new Error('不完全な空間データを受信しました');
    }

    const safeSpace = {
      id: space.id,
      passphrase: space.passphrase,
      createdAt: space.createdAt ? new Date(space.createdAt) : new Date(),
      lastActivityAt: space.lastActivityAt ? new Date(space.lastActivityAt) : new Date()
    };

    // 🔒 暗号化システム初期化
    window.Utils.log('info', '🔒 暗号化システム初期化開始', { spaceId: safeSpace.id });
    
    try {
      const encryptionInitialized = await window.API.initializeEncryption(safeSpace.id);
      
      if (encryptionInitialized) {
        window.Utils.log('success', '🔒 暗号化システム初期化完了', { 
          spaceId: safeSpace.id,
          keyPairGenerated: true 
        });
      } else {
        window.Utils.log('warn', '🔒 暗号化システム初期化をスキップ', { 
          spaceId: safeSpace.id,
          reason: '初期化失敗またはサポート外' 
        });
      }
    } catch (encryptionError) {
      window.Utils.log('error', '🔒 暗号化システム初期化失敗', { 
        spaceId: safeSpace.id, 
        error: encryptionError.message,
        stack: encryptionError.stack
      });
      // 暗号化失敗でも入室は継続（フォールバック）
    }

    window.Utils.log('success', '空間入室成功', { 
      spaceId: safeSpace.id, 
      passphrase: safeSpace.passphrase 
    });

    return safeSpace;
  },

  createSpace: async (passphrase) => {
    window.Utils.log('info', '空間作成処理開始', { passphraseLength: passphrase?.length });
    
    // バリデーション
    const validation = window.Utils.validatePassphrase(passphrase);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const result = await window.API.call('/spaces/create', {
      method: 'POST',
      body: JSON.stringify({ passphrase: validation.passphrase })
    });

    if (!result || !result.success) {
      throw new Error(result?.message || '空間作成に失敗しました');
    }

    window.Utils.log('success', '空間作成成功', { 
      passphrase: validation.passphrase,
      spaceId: result.space?.id 
    });

    return result;
  },

  // =============================================================================
  // メッセージAPI（暗号化対応）
  // =============================================================================

  loadMessages: async (spaceId) => {
    if (!spaceId) {
      throw new Error('空間IDが必要です');
    }

    window.Utils.log('info', 'メッセージ読み込み処理開始', { spaceId });

    const result = await window.API.call(`/messages/${spaceId}`);
    
    if (!result || !result.success) {
      throw new Error('メッセージ取得に失敗しました');
    }

    // メッセージデータの安全性確認と変換
    const messages = Array.isArray(result.messages) ? result.messages : [];
    
    const safeMessages = await Promise.all(messages.map(async (msg, index) => {
      try {
        let decryptedText = msg.text || '';
        
        // 暗号化されたメッセージの復号化を試行
        if (window.API.encryptionSystem && msg.encrypted && msg.encryptedData && msg.iv) {
          try {
            // 現在は自分の鍵で復号化（将来は送信者の公開鍵を使用）
            decryptedText = await window.API.decryptMessage(msg);
            window.Utils.log('debug', 'メッセージ復号化成功', { messageId: msg.id });
          } catch (decryptError) {
            window.Utils.log('warn', 'メッセージ復号化失敗', { 
              messageId: msg.id, 
              error: decryptError.message 
            });
            decryptedText = '[暗号化されたメッセージ - 復号化できませんでした]';
          }
        }
        
        return {
          id: msg.id || `temp_${Date.now()}_${index}`,
          text: decryptedText,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          encrypted: Boolean(msg.encrypted),
          isDeleted: Boolean(msg.isDeleted),
          // 暗号化メタデータ
          encryptedData: msg.encryptedData,
          iv: msg.iv
        };
      } catch (error) {
        window.Utils.log('warn', 'メッセージデータ変換エラー', { msg, error: error.message });
        return {
          id: `error_${Date.now()}_${index}`,
          text: '[メッセージの読み込みに失敗しました]',
          timestamp: new Date(),
          encrypted: false,
          isDeleted: false
        };
      }
    }));

    window.Utils.log('success', 'メッセージ読み込み成功', { 
      spaceId, 
      messageCount: safeMessages.length,
      encryptedCount: safeMessages.filter(m => m.encrypted).length
    });

    return safeMessages;
  },

  sendMessage: async (spaceId, message) => {
    if (!spaceId) {
      throw new Error('空間IDが必要です');
    }

    // メッセージバリデーション
    const validation = window.Utils.validateMessage(message);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    window.Utils.log('info', 'メッセージ送信処理開始', { 
      spaceId, 
      messageLength: validation.message.length,
      encryptionEnabled: !!window.API.encryptionSystem
    });

    let messagePayload = {
      spaceId,
      message: validation.message,
      encrypted: false
    };

    // 暗号化が有効な場合はメッセージを暗号化
    if (window.API.encryptionSystem) {
      try {
        const encryptedResult = await window.API.encryptMessage(validation.message);
        messagePayload = {
          spaceId,
          encryptedData: encryptedResult.encryptedData,
          iv: encryptedResult.iv,
          encrypted: true,
          // プレーンテキストは送信しない
          message: '[暗号化済み]'
        };
        
        window.Utils.log('debug', 'メッセージ暗号化完了', { 
          originalLength: validation.message.length,
          encryptedLength: encryptedResult.encryptedData.length
        });
        
      } catch (encryptError) {
        window.Utils.log('warn', 'メッセージ暗号化失敗 - 平文で送信', encryptError.message);
        // 暗号化に失敗した場合は平文で送信
      }
    }

    const result = await window.API.call('/messages/create', {
      method: 'POST',
      body: JSON.stringify(messagePayload)
    });

    if (!result || !result.success || !result.message) {
      throw new Error('メッセージ送信に失敗しました');
    }

    // メッセージデータの安全性確認と変換
    const newMessage = {
      id: result.message.id || Date.now().toString(),
      text: messagePayload.encrypted ? validation.message : result.message.text, // ローカル表示用は元のテキスト
      timestamp: result.message.timestamp ? new Date(result.message.timestamp) : new Date(),
      encrypted: messagePayload.encrypted,
      isDeleted: false,
      encryptedData: messagePayload.encryptedData,
      iv: messagePayload.iv
    };

    window.Utils.log('success', 'メッセージ送信成功', { 
      spaceId, 
      messageId: newMessage.id,
      messageLength: newMessage.text.length,
      encrypted: newMessage.encrypted
    });

    return newMessage;
  },

  // =============================================================================
  // 暗号化ヘルパー関数
  // =============================================================================

  /**
   * メッセージを暗号化
   * @param {string} message 平文メッセージ
   * @returns {Promise<{encryptedData: string, iv: string}>}
   */
  encryptMessage: async (message) => {
    if (!window.API.encryptionSystem) {
      throw new Error('暗号化システムが初期化されていません');
    }

    return await window.API.encryptionSystem.encryptMessage(message);
  },

  /**
   * メッセージを復号化
   * @param {Object} encryptedMessage 暗号化されたメッセージオブジェクト
   * @returns {Promise<string>}
   */
  decryptMessage: async (encryptedMessage) => {
    if (!window.API.encryptionSystem) {
      throw new Error('暗号化システムが初期化されていません');
    }

    if (!encryptedMessage.encryptedData || !encryptedMessage.iv) {
      throw new Error('暗号化データが不完全です');
    }

    return await window.API.encryptionSystem.decryptMessage(
      encryptedMessage.encryptedData,
      encryptedMessage.iv
    );
  },

  // =============================================================================
  // その他のAPI（既存機能）
  // =============================================================================

  getSpaceInfo: async (spaceId) => {
    if (!spaceId) {
      throw new Error('空間IDが必要です');
    }

    window.Utils.log('info', '空間情報取得処理開始', { spaceId });

    const result = await window.API.call(`/spaces/${spaceId}`);
    
    if (!result || !result.success || !result.space) {
      throw new Error('空間情報の取得に失敗しました');
    }

    const safeSpace = {
      id: result.space.id,
      passphrase: result.space.passphrase,
      createdAt: result.space.createdAt ? new Date(result.space.createdAt) : new Date(),
      lastActivityAt: result.space.lastActivityAt ? new Date(result.space.lastActivityAt) : new Date(),
      messageCount: result.space.messageCount || 0
    };

    window.Utils.log('success', '空間情報取得成功', { 
      spaceId: safeSpace.id,
      messageCount: safeSpace.messageCount 
    });

    return safeSpace;
  },

  healthCheck: async () => {
    try {
      const result = await window.API.call('/health');
      
      window.Utils.log('info', 'ヘルスチェック結果', { 
        status: result.status,
        environment: result.environment,
        database: result.database
      });

      return result;
    } catch (error) {
      window.Utils.log('error', 'ヘルスチェック失敗', { error: error.message });
      throw error;
    }
  },

  getStats: async () => {
    try {
      const result = await window.API.call('/api/stats');
      
      window.Utils.log('info', '統計情報取得成功', result.stats);

      return result;
    } catch (error) {
      window.Utils.log('warn', '統計情報取得失敗', { error: error.message });
      return null;
    }
  },

  testConnection: async () => {
    try {
      window.Utils.log('info', 'API接続テスト開始');
      
      const health = await window.API.healthCheck();
      
      if (health && health.status === 'OK') {
        window.Utils.log('success', 'API接続テスト成功', { 
          status: health.status,
          environment: health.environment 
        });
        return true;
      } else {
        window.Utils.log('warn', 'API接続テスト警告', { health });
        return false;
      }
    } catch (error) {
      window.Utils.log('error', 'API接続テスト失敗', { error: error.message });
      return false;
    }
  },

  callWithRetry: async (endpoint, options = {}, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        window.Utils.log('debug', 'API リトライ実行', { 
          endpoint, 
          attempt, 
          maxRetries 
        });
        
        const result = await window.API.call(endpoint, options);
        
        if (attempt > 1) {
          window.Utils.log('success', 'API リトライ成功', { 
            endpoint, 
            attempt 
          });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        window.Utils.log('warn', 'API リトライが必要', { 
          endpoint, 
          attempt, 
          maxRetries,
          error: error.message 
        });
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    window.Utils.log('error', 'API リトライ失敗（全試行完了）', { 
      endpoint, 
      maxRetries,
      finalError: lastError.message 
    });
    
    throw lastError;
  }
};

// =============================================================================
// 初期化処理
// =============================================================================
window.API.init = async () => {
  try {
    window.Utils.log('info', 'API モジュール初期化開始');
    
    // 基本設定確認
    if (!window.API_BASE) {
      throw new Error('API_BASE URLが設定されていません');
    }
    
    // 暗号化システムの可用性確認
    if (window.Crypto && window.Crypto.isSupported) {
      window.Utils.log('success', '暗号化システム利用可能');
    } else {
      window.Utils.log('warn', '暗号化システム利用不可 - 平文通信になります');
    }
    
    // 接続テスト実行
    const isConnected = await window.API.testConnection();
    
    if (isConnected) {
      window.Utils.log('success', 'API モジュール初期化完了');
      return true;
    } else {
      window.Utils.log('warn', 'API モジュール初期化完了（接続不安定）');
      return false;
    }
    
  } catch (error) {
    window.Utils.log('error', 'API モジュール初期化失敗', { error: error.message });
    return false;
  }
};

// 空間退室時のクリーンアップ
window.API.leaveSpace = () => {
  window.API.cleanupEncryption();
  window.Utils.log('info', '空間退室 - 暗号化システムクリーンアップ完了');
};

// デバッグ用: APIモジュールの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ API module loaded (with encryption):', Object.keys(window.API).length + ' methods available');
}