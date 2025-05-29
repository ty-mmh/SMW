// API通信モジュール（統合版ベース・改修版）
// サーバーとの通信、エラーハンドリング、レスポンス処理

window.API = {
  // 基本的なAPI呼び出し関数
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

    window.Utils.log('success', '空間入室成功', { 
      spaceId: safeSpace.id, 
      passphrase: safeSpace.passphrase 
    });

    return safeSpace;
  },

  // 空間作成API
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

  // メッセージ一覧取得API
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
    
    const safeMessages = messages.map((msg, index) => {
      try {
        return {
          id: msg.id || `temp_${Date.now()}_${index}`,
          text: msg.text || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          encrypted: Boolean(msg.encrypted),
          isDeleted: Boolean(msg.isDeleted)
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
    });

    window.Utils.log('success', 'メッセージ読み込み成功', { 
      spaceId, 
      messageCount: safeMessages.length 
    });

    return safeMessages;
  },

  // メッセージ送信API
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
      messageLength: validation.message.length 
    });

    const result = await window.API.call('/messages/create', {
      method: 'POST',
      body: JSON.stringify({
        spaceId,
        message: validation.message
      })
    });

    if (!result || !result.success || !result.message) {
      throw new Error('メッセージ送信に失敗しました');
    }

    // メッセージデータの安全性確認と変換
    const newMessage = {
      id: result.message.id || Date.now().toString(),
      text: result.message.text || validation.message,
      timestamp: result.message.timestamp ? new Date(result.message.timestamp) : new Date(),
      encrypted: true,
      isDeleted: false
    };

    window.Utils.log('success', 'メッセージ送信成功', { 
      spaceId, 
      messageId: newMessage.id,
      messageLength: newMessage.text.length 
    });

    return newMessage;
  },

  // 空間情報取得API（拡張用）
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

  // ヘルスチェックAPI
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

  // 統計情報取得API（開発用）
  getStats: async () => {
    try {
      const result = await window.API.call('/api/stats');
      
      window.Utils.log('info', '統計情報取得成功', result.stats);

      return result;
    } catch (error) {
      window.Utils.log('warn', '統計情報取得失敗', { error: error.message });
      // 統計情報は必須ではないので、エラーを投げずにnullを返す
      return null;
    }
  },

  // 接続テスト（初期化時の確認用）
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

  // リトライ機能付きAPI呼び出し（重要な処理用）
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
        
        // 最後の試行でない場合は待機
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数バックオフ、最大5秒
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

// 初期化処理
window.API.init = async () => {
  try {
    window.Utils.log('info', 'API モジュール初期化開始');
    
    // 基本設定確認
    if (!window.API_BASE) {
      throw new Error('API_BASE URLが設定されていません');
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

// デバッグ用: APIモジュールの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ API module loaded:', Object.keys(window.API).length + ' methods available');
}