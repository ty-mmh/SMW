// API通信モジュール
window.API = {
  // 基本的なAPI呼び出し関数
  call: async (endpoint, options = {}) => {
    try {
      console.log(`🔄 API呼び出し: ${endpoint}`, options);
      
      if (!window.API_BASE) {
        throw new Error('API_BASE URLが設定されていません');
      }

      const url = `${window.API_BASE}${endpoint}`;
      console.log(`📡 リクエストURL: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      console.log(`📨 レスポンス: ${response.status} ${response.statusText}`);
      
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('❌ 非JSON レスポンス:', text);
        throw new Error(`サーバーから無効なレスポンス: ${response.status}`);
      }
      
      console.log('📊 レスポンスデータ:', data);
      
      if (!response.ok) {
        throw new Error(data.error || `APIエラー: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('❌ API呼び出しエラー:', error);
      throw error;
    }
  },

  // 空間入室
  enterSpace: async (passphrase) => {
    const result = await window.API.call('/spaces/enter', {
      method: 'POST',
      body: JSON.stringify({ passphrase: passphrase.trim() })
    });

    if (result && result.success && result.space) {
      // データの安全性確認
      if (!result.space.id || !result.space.passphrase) {
        throw new Error('不完全な空間データを受信しました');
      }

      return {
        id: result.space.id,
        passphrase: result.space.passphrase,
        createdAt: result.space.createdAt ? new Date(result.space.createdAt) : new Date(),
        lastActivityAt: result.space.lastActivityAt ? new Date(result.space.lastActivityAt) : new Date()
      };
    } else {
      throw new Error('空間入室に失敗しました');
    }
  },

  // 空間作成
  createSpace: async (passphrase) => {
    const result = await window.API.call('/spaces/create', {
      method: 'POST',
      body: JSON.stringify({ passphrase: passphrase.trim() })
    });

    if (result && result.success) {
      return result;
    } else {
      throw new Error('空間作成に失敗しました');
    }
  },

  // メッセージ読み込み
  loadMessages: async (spaceId) => {
    const result = await window.API.call(`/messages/${spaceId}`);
    
    if (result && result.success && Array.isArray(result.messages)) {
      return result.messages.map(msg => ({
        id: msg.id || Date.now(),
        text: msg.text || '',
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        encrypted: Boolean(msg.encrypted),
        isDeleted: Boolean(msg.isDeleted)
      }));
    } else {
      console.warn('⚠️ メッセージデータが不正です:', result);
      return [];
    }
  },

  // メッセージ送信
  sendMessage: async (spaceId, message) => {
    const result = await window.API.call('/messages/create', {
      method: 'POST',
      body: JSON.stringify({
        spaceId,
        message: message.trim()
      })
    });

    if (result && result.success && result.message) {
      return {
        id: result.message.id || Date.now(),
        text: result.message.text || message.trim(),
        timestamp: result.message.timestamp ? new Date(result.message.timestamp) : new Date(),
        encrypted: true,
        isDeleted: false
      };
    } else {
      throw new Error('メッセージ送信に失敗しました');
    }
  }
};