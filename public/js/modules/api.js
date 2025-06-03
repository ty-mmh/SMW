// API通信モジュール（暗号化統合・恒久修正版）
// サーバーとの通信、決定的暗号化処理、エラーハンドリング

window.API = {
  // 暗号化システムの状態
  encryptionSystem: null,
  currentSpaceId: null,
  currentSpace: null, // 🔧 恒久修正: 空間情報保持
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
  // 暗号化システム管理（恒久修正版）
  // =============================================================================

  /**
   * 空間の暗号化システムを初期化（恒久版）
   * @param {string} spaceId 
   * @param {string} passphrase 空間のパスフレーズ
   * @returns {Promise<boolean>}
   */
  initializeEncryption: async (spaceId, passphrase = '') => {
    try {
      if (!window.Crypto || !window.Crypto.isSupported) {
        window.Utils.log('warn', 'Web Crypto API未サポート - 暗号化を無効化');
        return false;
      }

      window.Utils.log('info', '恒久版暗号化システム初期化開始', { spaceId, hasPassphrase: !!passphrase });
      
      // パスフレーズが空の場合、currentSpaceから取得を試行
      if (!passphrase && window.API.currentSpace?.passphrase) {
        passphrase = window.API.currentSpace.passphrase;
        window.Utils.log('debug', 'currentSpaceからパスフレーズ取得', { spaceId });
      }
      
      // それでも空の場合、キャッシュから取得を試行
      if (!passphrase && window.Crypto.passphraseCache?.has(spaceId)) {
        passphrase = window.Crypto.passphraseCache.get(spaceId);
        window.Utils.log('debug', 'キャッシュからパスフレーズ取得', { spaceId });
      }
      
      if (!passphrase) {
        window.Utils.log('error', 'パスフレーズが取得できません', { spaceId });
        return false;
      }
      
      // 🔧 修正: パスフレーズ付きで決定的キー生成
      const spaceKey = await window.Crypto.getOrCreateSpaceKey(spaceId, passphrase);
      
      // 暗号化システムオブジェクト作成
      window.API.encryptionSystem = {
        spaceId: spaceId,
        spaceKey: spaceKey,
        publicKey: null,
        keyType: 'deterministic',
        passphrase: passphrase, // パスフレーズも保存
        
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
      
      window.Utils.log('success', '恒久版暗号化システム初期化完了', { 
        spaceId,
        hasSpaceKey: !!spaceKey,
        keyType: 'deterministic',
        hasPassphrase: !!passphrase
      });
      
      return true;
      
    } catch (error) {
      window.Utils.log('error', '恒久版暗号化システム初期化エラー', error.message);
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
   * 暗号化システムをクリーンアップ（恒久版 - 無効化）
   */
  cleanupEncryption: () => {
    // 🔧 修正: クリーンアップを無効化（決定的キーを保持）
    window.Utils.log('info', '暗号化システムクリーンアップをスキップ（決定的キー保持）');
    
    // encryptionSystemのみリセット（spaceKeysは保持）
    window.API.encryptionSystem = null;
    window.API.currentSpaceId = null;
    window.API.otherUsers.clear();
    // window.API.currentSpace = null; // 🔧 重要: currentSpaceは保持
  },

  // =============================================================================
  // 空間管理API（恒久修正版）
  // =============================================================================

  // 空間入室API（恒久版）
  enterSpace: async (passphrase) => {
    window.Utils.log('info', '恒久版空間入室処理開始', { passphraseLength: passphrase?.length });
    
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
      passphrase: space.passphrase, // 🔧 重要: パスフレーズを保存
      createdAt: space.createdAt ? new Date(space.createdAt) : new Date(),
      lastActivityAt: space.lastActivityAt ? new Date(space.lastActivityAt) : new Date()
    };

    // 🔧 重要: 現在の空間情報をグローバルに保存
    window.API.currentSpace = safeSpace;

    // 🔒 暗号化システム初期化（パスフレーズ付き）
    window.Utils.log('info', '🔒 恒久版暗号化システム初期化開始', { 
      spaceId: safeSpace.id,
      passphrase: safeSpace.passphrase 
    });
    
    try {
      const encryptionInitialized = await window.API.initializeEncryption(safeSpace.id, safeSpace.passphrase);
      
      if (encryptionInitialized) {
        window.Utils.log('success', '🔒 恒久版暗号化システム初期化完了', { 
          spaceId: safeSpace.id,
          keyType: 'deterministic'
        });
      } else {
        window.Utils.log('warn', '🔒 恒久版暗号化システム初期化をスキップ', { 
          spaceId: safeSpace.id,
          reason: '初期化失敗またはサポート外' 
        });
      }
    } catch (encryptionError) {
      window.Utils.log('error', '🔒 恒久版暗号化システム初期化失敗', { 
        spaceId: safeSpace.id, 
        error: encryptionError.message,
        stack: encryptionError.stack
      });
      // 暗号化失敗でも入室は継続（フォールバック）
    }

    window.Utils.log('success', '恒久版空間入室成功', { 
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
  // メッセージAPI（恒久修正版）
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

    // デバッグ情報の表示
    if (result.debug) {
      window.Utils.log('debug', 'サーバーデバッグ情報', result.debug);
    }

    const messages = Array.isArray(result.messages) ? result.messages : [];
    
    const safeMessages = await Promise.all(messages.map(async (msg, index) => {
      try {
        let decryptedText = msg.text || '';
        
        window.Utils.log('debug', `メッセージ ${index + 1} 処理開始`, {
          id: msg.id,
          encrypted: msg.encrypted,
          hasEncryptedData: !!msg.encryptedData,
          hasIv: !!msg.iv,
          encryptedDataLength: msg.encryptedData?.length || 0,
          ivLength: msg.iv?.length || 0,
          algorithm: msg.algorithm
        });
        
        // 🔧 修正: より詳細な暗号化チェックと復号化処理
        if (msg.encrypted && window.API.encryptionSystem) {
          if (msg.encryptedData && msg.iv) {
            try {
              window.Utils.log('debug', `メッセージ ${msg.id} 復号化開始`, {
                encryptedDataLength: msg.encryptedData.length,
                ivLength: msg.iv.length,
                hasEncryptionSystem: !!window.API.encryptionSystem
              });
              
              // 復号化実行
              decryptedText = await window.API.decryptMessage({
                encryptedData: msg.encryptedData,
                iv: msg.iv,
                algorithm: msg.algorithm
              });
              
              window.Utils.log('success', `メッセージ ${msg.id} 復号化成功`, {
                originalLength: msg.encryptedData.length,
                decryptedLength: decryptedText.length
              });
              
            } catch (decryptError) {
              window.Utils.log('error', `メッセージ ${msg.id} 復号化失敗`, {
                error: decryptError.message,
                stack: decryptError.stack
              });
              
              // 復号化失敗の詳細な理由を表示
              if (decryptError.message.includes('space key')) {
                decryptedText = '[暗号化されたメッセージ - 空間キーが見つかりません]';
              } else if (decryptError.message.includes('invalid')) {
                decryptedText = '[暗号化されたメッセージ - 無効なデータ形式]';
              } else {
                decryptedText = `[暗号化されたメッセージ - 復号化エラー: ${decryptError.message}]`;
              }
            }
          } else {
            window.Utils.log('warn', `メッセージ ${msg.id} 暗号化データ不完全`, {
              hasEncryptedData: !!msg.encryptedData,
              hasIv: !!msg.iv,
              encryptedDataType: typeof msg.encryptedData,
              ivType: typeof msg.iv
            });
            decryptedText = '[暗号化されたメッセージ - データ不完全]';
          }
        } else if (msg.encrypted && !window.API.encryptionSystem) {
          window.Utils.log('warn', `メッセージ ${msg.id} 暗号化システム未初期化`);
          decryptedText = '[暗号化されたメッセージ - システム未初期化]';
        }
        
        const processedMessage = {
          id: msg.id || `temp_${Date.now()}_${index}`,
          text: decryptedText,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          encrypted: Boolean(msg.encrypted),
          isDeleted: Boolean(msg.isDeleted),
          // 元の暗号化データを保持
          encryptedData: msg.encryptedData,
          iv: msg.iv,
          algorithm: msg.algorithm
        };
        
        window.Utils.log('debug', `メッセージ ${index + 1} 処理完了`, {
          id: processedMessage.id,
          textPreview: processedMessage.text.substring(0, 30) + '...',
          encrypted: processedMessage.encrypted
        });
        
        return processedMessage;
        
      } catch (error) {
        window.Utils.log('error', `メッセージ ${index + 1} 処理エラー`, {
          error: error.message,
          msgData: {
            id: msg?.id,
            encrypted: msg?.encrypted,
            hasEncryptedData: !!msg?.encryptedData,
            hasIv: !!msg?.iv
          }
        });
        
        return {
          id: `error_${Date.now()}_${index}`,
          text: `[メッセージ処理エラー: ${error.message}]`,
          timestamp: new Date(),
          encrypted: false,
          isDeleted: false
        };
      }
    }));

    window.Utils.log('success', 'メッセージ読み込み完了', { 
      spaceId, 
      messageCount: safeMessages.length,
      encryptedCount: safeMessages.filter(m => m.encrypted).length,
      successfulDecryptions: safeMessages.filter(m => m.encrypted && !m.text.includes('[暗号化されたメッセージ')).length
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

    // 🔧 修正: 暗号化処理の強化
    if (window.API.encryptionSystem) {
      try {
        window.Utils.log('debug', '暗号化処理開始', {
          messageLength: validation.message.length,
          spaceId: spaceId
        });
        
        const encryptedResult = await window.API.encryptMessage(validation.message);
        
        window.Utils.log('debug', '暗号化処理完了', {
          encryptedDataLength: encryptedResult.encryptedData.length,
          ivLength: encryptedResult.iv.length,
          algorithm: encryptedResult.algorithm
        });
        
        // 🔧 修正: サーバーが期待する形式に合わせる
        messagePayload = {
          spaceId,
          message: '[ENCRYPTED]', // データベース保存用（サーバーで上書きされる）
          encrypted: true,
          encryptedPayload: {
            encryptedData: encryptedResult.encryptedData,
            iv: encryptedResult.iv,
            algorithm: encryptedResult.algorithm || 'AES-GCM-256'
          }
        };
        
        window.Utils.log('success', 'メッセージ暗号化完了');
        
      } catch (encryptError) {
        window.Utils.log('error', 'メッセージ暗号化失敗', {
          error: encryptError.message,
          stack: encryptError.stack
        });
        
        // 暗号化に失敗した場合は平文で送信
        window.Utils.log('warn', '平文モードにフォールバック');
      }
    } else {
      window.Utils.log('info', '暗号化システム未初期化のため平文で送信');
    }

    window.Utils.log('debug', 'サーバーに送信するペイロード', {
      spaceId: messagePayload.spaceId,
      messagePreview: messagePayload.message.substring(0, 20) + '...',
      encrypted: messagePayload.encrypted,
      hasEncryptedPayload: !!messagePayload.encryptedPayload
    });

    const result = await window.API.call('/messages/create', {
      method: 'POST',
      body: JSON.stringify(messagePayload)
    });

    if (!result || !result.success || !result.message) {
      throw new Error(result?.error || 'メッセージ送信に失敗しました');
    }

    // デバッグ情報の表示
    if (result.debug) {
      window.Utils.log('debug', 'サーバー送信デバッグ情報', result.debug);
    }

    // メッセージデータの安全性確認と変換
    const newMessage = {
      id: result.message.id || Date.now().toString(),
      text: validation.message, // ローカル表示用は元のテキスト
      timestamp: result.message.timestamp ? new Date(result.message.timestamp) : new Date(),
      encrypted: Boolean(messagePayload.encrypted),
      isDeleted: false,
      // 暗号化メタデータ
      encryptedData: result.message.encryptedData || messagePayload.encryptedPayload?.encryptedData,
      iv: result.message.iv || messagePayload.encryptedPayload?.iv,
      algorithm: result.message.algorithm || messagePayload.encryptedPayload?.algorithm
    };

    window.Utils.log('success', 'メッセージ送信完了', { 
      spaceId, 
      messageId: newMessage.id,
      messageLength: newMessage.text.length,
      encrypted: newMessage.encrypted,
      hasEncryptedData: !!newMessage.encryptedData,
      hasIv: !!newMessage.iv
    });

    return newMessage;
  },

  // =============================================================================
  // 暗号化ヘルパー関数（恒久修正版）
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
      throw new Error('暗号化データまたはIVが不足しています');
    }

    window.Utils.log('debug', '復号化処理開始', {
      encryptedDataLength: encryptedMessage.encryptedData.length,
      ivLength: encryptedMessage.iv.length,
      algorithm: encryptedMessage.algorithm,
      currentSpaceId: window.API.currentSpaceId
    });

    try {
      const decryptedText = await window.API.encryptionSystem.decryptMessage(
        encryptedMessage.encryptedData,
        encryptedMessage.iv
      );
      
      window.Utils.log('debug', '復号化成功', {
        decryptedLength: decryptedText.length,
        preview: decryptedText.substring(0, 20) + '...'
      });
      
      return decryptedText;
      
    } catch (error) {
      window.Utils.log('error', '復号化エラー詳細', {
        error: error.message,
        stack: error.stack,
        encryptedDataPreview: encryptedMessage.encryptedData.substring(0, 20) + '...',
        ivPreview: encryptedMessage.iv.substring(0, 20) + '...',
        hasEncryptionSystem: !!window.API.encryptionSystem,
        spaceId: window.API.currentSpaceId
      });
      
      throw error;
    }
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
  },

  // =============================================================================
  // デバッグ・管理関数（恒久修正版）
  // =============================================================================

  // 空間退室時のクリーンアップ（恒久版 - 修正）
  leaveSpace: () => {
    window.Utils.log('info', '恒久版空間退室 - 決定的キーを保持');
    
    // 🔧 修正: 暗号化キーは保持、その他のみクリーンアップ
    window.API.cleanupEncryption(); // 無効化されたクリーンアップ
    
    // currentSpaceは保持（パスフレーズ情報のため）
    // window.API.currentSpace = null; // コメントアウト
    
    window.Utils.log('info', '恒久版空間退室完了 - 暗号化キー保持中');
  },

  // デバッグ用: 強制リセット
  forceReset: () => {
    window.API.currentSpace = null;
    window.API.encryptionSystem = null;
    window.API.currentSpaceId = null;
    if (window.Crypto.passphraseCache) {
      window.Crypto.passphraseCache.clear();
    }
    if (window.Crypto.spaceKeys) {
      window.Crypto.spaceKeys.clear();
    }
    window.Utils.log('info', '強制リセット完了');
  },

  // デバッグ用: 暗号化状態確認
  getEncryptionDebugInfo: () => {
    return {
      currentSpace: window.API.currentSpace,
      currentSpaceId: window.API.currentSpaceId,
      hasEncryptionSystem: !!window.API.encryptionSystem,
      encryptionSystemType: window.API.encryptionSystem?.keyType,
      spaceKeyCount: window.Crypto?.spaceKeys?.size || 0,
      passphrasesCached: window.Crypto?.passphraseCache?.size || 0,
      passphrases: Array.from(window.Crypto?.passphraseCache?.keys() || [])
    };
  },

  // 暗号化統計取得
  getEncryptionStats: () => {
    return {
      encryptionSystemInitialized: !!window.API.encryptionSystem,
      currentSpaceId: window.API.currentSpaceId,
      cryptoSupported: window.Crypto?.isSupported,
      spaceKeyCount: window.Crypto?.spaceKeys?.size || 0,
      spaceKeyInfo: window.Crypto?.getAllSpaceKeyInfo?.() || null,
      currentSpace: window.API.currentSpace
    };
  },

  // デバッグ用: メッセージデータ確認
  debugMessage: async (spaceId) => {
    if (!spaceId) spaceId = window.API.currentSpaceId;
    if (!spaceId) {
      console.log('❌ 空間IDが必要です');
      return;
    }

    try {
      const debugResult = await window.API.call(`/messages/debug/${spaceId}`);
      console.log('🔍 メッセージデバッグ情報:', debugResult);
      return debugResult;
    } catch (error) {
      console.error('❌ デバッグ情報取得失敗:', error);
      return null;
    }
  },

  // メッセージフローテスト
  testMessageFlow: async () => {
    console.log('🧪 メッセージフロー完全テスト開始');
    
    try {
      if (!window.API.currentSpaceId) {
        console.log('❌ 空間に入室してください');
        return false;
      }
      
      const testMessage = 'テストメッセージ ' + new Date().toLocaleTimeString();
      
      // 1. 送信テスト
      console.log('📤 送信テスト:', testMessage);
      const sentMessage = await window.API.sendMessage(window.API.currentSpaceId, testMessage);
      console.log('✅ 送信成功:', sentMessage);
      
      // 2. 読み込みテスト
      console.log('📥 読み込みテスト実行中...');
      const messages = await window.API.loadMessages(window.API.currentSpaceId);
      console.log('✅ 読み込み成功:', messages.length + '件');
      
      // 3. 暗号化統計
      const stats = window.API.getEncryptionStats();
      console.log('📊 暗号化統計:', stats);
      
      console.log('🎉 メッセージフロー完全テスト完了');
      return true;
      
    } catch (error) {
      console.error('❌ メッセージフローテスト失敗:', error);
      return false;
    }
  }
};

// =============================================================================
// 初期化処理（恒久修正版）
// =============================================================================
window.API.init = async () => {
  try {
    window.Utils.log('info', 'API モジュール初期化開始（恒久修正版）');
    
    // 基本設定確認
    if (!window.API_BASE) {
      throw new Error('API_BASE URLが設定されていません');
    }
    
    // 暗号化システムの可用性確認
    if (window.Crypto && window.Crypto.isSupported) {
      window.Utils.log('success', '決定的暗号化システム利用可能');
    } else {
      window.Utils.log('warn', '暗号化システム利用不可 - 平文通信になります');
    }
    
    // 接続テスト実行
    const isConnected = await window.API.testConnection();
    
    if (isConnected) {
      window.Utils.log('success', 'API モジュール初期化完了（恒久修正版）');
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

// デバッグ用: APIモジュールの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ API module loaded (恒久修正版):', {
    methods: Object.keys(window.API).length + ' methods available',
    features: ['決定的暗号化', 'パスフレーズ永続化', 'クリーンアップ防止']
  });
}

console.log('🔄 FRIENDLYモード API機能追加中...');

Object.assign(window.API, {
  /**
   * FRIENDLYモード対応メッセージ送信
   * @param {string} spaceId 空間ID
   * @param {string} message メッセージ本文
   * @returns {Promise<Object>} 送信結果
   */
  sendMessageFriendly: async (spaceId, message) => {
    if (!spaceId || !message.trim()) {
      throw new Error('空間IDとメッセージが必要です');
    }
    
    window.Utils.performance.start('send_message_friendly');
    window.Utils.log('info', 'FRIENDLYモードメッセージ送信開始', { 
      spaceId, 
      messageLength: message.length 
    });
    
    try {
      // セッション活性度更新
      window.SessionManager.updateActivity();
      
      // ハイブリッド暗号化実行
      const encryptedResult = await window.Crypto.encryptMessageHybrid(message, spaceId);
      
      // サーバー送信用ペイロード作成
      const payload = {
        spaceId,
        message: message.trim(),
        encrypted: true,
        encryptedPayload: {
          type: encryptedResult.type,
          encryptedData: encryptedResult.encryptedData,
          iv: encryptedResult.iv,
          algorithm: encryptedResult.algorithm,
          timestamp: encryptedResult.timestamp || new Date().toISOString()
        }
      };
      
      // ハイブリッドの場合はフォールバック情報も追加
      if (encryptedResult.type === 'hybrid') {
        payload.encryptedPayload.sessionParticipants = encryptedResult.sessionParticipants;
        payload.encryptedPayload.fallbackData = encryptedResult.fallbackData;
      }
      
      window.Utils.log('debug', 'サーバーに送信するペイロード', {
        spaceId,
        encryptedType: encryptedResult.type,
        hasSessionData: !!encryptedResult.sessionParticipants,
        hasFallback: !!encryptedResult.fallbackData,
        payloadSize: JSON.stringify(payload.encryptedPayload).length
      });
      
      // API呼び出し
      const result = await window.API.call('/messages/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (!result.success || !result.message) {
        throw new Error(result.error || 'メッセージ送信に失敗しました');
      }
      
      // ローカル表示用メッセージ作成
      const newMessage = {
        id: result.message.id,
        text: message.trim(),
        timestamp: new Date(result.message.timestamp),
        encrypted: true,
        encryptionType: encryptedResult.type,
        sessionParticipants: encryptedResult.sessionParticipants || null,
        hasFallback: !!encryptedResult.fallbackData,
        isDeleted: false
      };
      
      window.Utils.log('success', 'FRIENDLYモードメッセージ送信完了', {
        messageId: newMessage.id,
        encryptionType: newMessage.encryptionType,
        textLength: newMessage.text.length,
        hasFallback: newMessage.hasFallback
      });
      
      window.Utils.performance.end('send_message_friendly');
      return newMessage;
      
    } catch (error) {
      window.Utils.performance.end('send_message_friendly');
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモードメッセージ送信');
      throw new Error(errorMessage);
    }
  },
  
  /**
   * FRIENDLYモード対応メッセージ読み込み
   * @param {string} spaceId 空間ID
   * @returns {Promise<Array>} メッセージ配列
   */
  loadMessagesFriendly: async (spaceId) => {
    if (!spaceId) {
      throw new Error('空間IDが必要です');
    }
    
    window.Utils.performance.start('load_messages_friendly');
    window.Utils.log('info', 'FRIENDLYモードメッセージ読み込み開始', { spaceId });
    
    try {
      const result = await window.API.call(`/messages/${spaceId}`);
      
      if (!result.success) {
        throw new Error('メッセージ取得に失敗しました');
      }
      
      const messages = Array.isArray(result.messages) ? result.messages : [];
      window.Utils.log('debug', '取得したメッセージ', { 
        messageCount: messages.length,
        encryptedCount: messages.filter(m => m.encrypted).length
      });
      
      const processedMessages = await Promise.all(messages.map(async (msg, index) => {
        try {
          let decryptedText = msg.text || '';
          let encryptionInfo = {
            encrypted: false,
            encryptionType: 'plaintext',
            sessionParticipants: null,
            hasFallback: false
          };
          
          window.Utils.log('debug', `メッセージ ${index + 1}/${messages.length} 処理開始`, {
            id: msg.id,
            encrypted: msg.encrypted,
            hasEncryptedData: !!msg.encryptedData,
            hasPayload: !!msg.encrypted_payload
          });
          
          if (msg.encrypted && (msg.encryptedData || msg.encrypted_payload)) {
            // 暗号化メッセージの復号化
            try {
              // 暗号化データの構築
              let encryptedMessage = {
                type: 'deterministic',
                encryptedData: msg.encryptedData,
                iv: msg.iv,
                algorithm: msg.algorithm || 'AES-GCM-256'
              };
              
              // サーバーからのencrypted_payloadを解析
              if (msg.encrypted_payload) {
                try {
                  const payloadData = typeof msg.encrypted_payload === 'string' ? 
                    JSON.parse(msg.encrypted_payload) : msg.encrypted_payload;
                  
                  encryptedMessage = {
                    type: payloadData.type || 'deterministic',
                    encryptedData: payloadData.encryptedData || msg.encryptedData,
                    iv: payloadData.iv || msg.iv,
                    algorithm: payloadData.algorithm || 'AES-GCM-256',
                    sessionParticipants: payloadData.sessionParticipants,
                    fallbackData: payloadData.fallbackData,
                    timestamp: payloadData.timestamp
                  };
                  
                  window.Utils.log('debug', `メッセージ ${msg.id} ペイロード解析成功`, {
                    type: encryptedMessage.type,
                    hasSessionData: !!encryptedMessage.sessionParticipants,
                    hasFallback: !!encryptedMessage.fallbackData
                  });
                } catch (parseError) {
                  window.Utils.log('warn', `メッセージ ${msg.id} ペイロード解析失敗`, parseError.message);
                }
              }
              
              // フォールバック付き復号化実行
              decryptedText = await window.Crypto.decryptMessageWithFallback(encryptedMessage, spaceId);
              
              encryptionInfo = {
                encrypted: true,
                encryptionType: encryptedMessage.type,
                sessionParticipants: encryptedMessage.sessionParticipants,
                hasFallback: !!encryptedMessage.fallbackData
              };
              
              window.Utils.log('success', `メッセージ ${msg.id} 復号化成功`, {
                type: encryptionInfo.encryptionType,
                textLength: decryptedText.length,
                method: encryptedMessage.type === 'hybrid' ? 'ハイブリッド' : '決定的'
              });
              
            } catch (decryptError) {
              window.Utils.log('error', `メッセージ ${msg.id} 復号化失敗`, {
                error: decryptError.message,
                hasEncryptedData: !!msg.encryptedData,
                hasPayload: !!msg.encrypted_payload
              });
              
              decryptedText = '[復号化できませんでした]';
              encryptionInfo.encrypted = true;
              encryptionInfo.encryptionType = 'error';
            }
          }
          
          return {
            id: msg.id || `temp_${Date.now()}_${index}`,
            text: decryptedText,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            isDeleted: Boolean(msg.is_deleted),
            ...encryptionInfo
          };
          
        } catch (error) {
          window.Utils.log('error', `メッセージ ${index + 1} 処理エラー`, {
            error: error.message,
            msgData: {
              id: msg?.id,
              encrypted: msg?.encrypted,
              hasEncryptedData: !!msg?.encryptedData
            }
          });
          
          return {
            id: `error_${Date.now()}_${index}`,
            text: `[メッセージ処理エラー: ${error.message}]`,
            timestamp: new Date(),
            encrypted: false,
            encryptionType: 'error',
            isDeleted: false
          };
        }
      }));
      
      window.Utils.log('success', 'FRIENDLYモードメッセージ読み込み完了', {
        spaceId,
        messageCount: processedMessages.length,
        encryptedCount: processedMessages.filter(m => m.encrypted).length,
        hybridCount: processedMessages.filter(m => m.encryptionType === 'hybrid').length,
        deterministicCount: processedMessages.filter(m => m.encryptionType === 'deterministic').length,
        errorCount: processedMessages.filter(m => m.encryptionType === 'error').length
      });
      
      window.Utils.performance.end('load_messages_friendly');
      return processedMessages;
      
    } catch (error) {
      window.Utils.performance.end('load_messages_friendly');
      const errorMessage = window.Utils.handleError(error, 'FRIENDLYモードメッセージ読み込み');
      throw new Error(errorMessage);
    }
  }
});

console.log('✅ FRIENDLYモード API機能追加完了');