// セキュアチャット E2EE暗号化モジュール - Phase 1B
// ECDH鍵交換 + AES-256-GCM + 空間共有キーシステム

window.Crypto = {
  // Web Crypto API サポート確認
  isSupported: (() => {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  })(),

  // 鍵ペア生成（ECDH P-256）
  generateKeyPair: async () => {
    try {
      if (!window.Crypto.isSupported) {
        throw new Error('Web Crypto API がサポートされていません');
      }

      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true, // extractable
        ['deriveKey']
      );

      window.Utils.log('debug', 'ECDH鍵ペア生成完了', { 
        publicKey: 'Generated', 
        privateKey: 'Generated' 
      });

      return keyPair;
    } catch (error) {
      window.Utils.log('error', 'ECDH鍵ペア生成エラー', { error: error.message });
      throw new Error(`鍵ペア生成に失敗しました: ${error.message}`);
    }
  },

  // 公開キーのエクスポート（JWK形式）
  exportPublicKey: async (publicKey) => {
    try {
      const jwk = await crypto.subtle.exportKey('jwk', publicKey);
      window.Utils.log('debug', '公開キーエクスポート完了');
      return jwk;
    } catch (error) {
      window.Utils.log('error', '公開キーエクスポートエラー', { error: error.message });
      throw new Error(`公開キーのエクスポートに失敗しました: ${error.message}`);
    }
  },

  // 公開キーのインポート（JWK形式）
  importPublicKey: async (jwk) => {
    try {
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );
      window.Utils.log('debug', '公開キーインポート完了');
      return publicKey;
    } catch (error) {
      window.Utils.log('error', '公開キーインポートエラー', { error: error.message });
      throw new Error(`公開キーのインポートに失敗しました: ${error.message}`);
    }
  },

  // ECDH共有秘密導出
  deriveSharedSecret: async (privateKey, publicKey, spaceId) => {
    try {
      // 共有秘密を導出
      const sharedKey = await crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: publicKey
        },
        privateKey,
        {
          name: 'AES-GCM',
          length: 256
        },
        false, // not extractable
        ['encrypt', 'decrypt']
      );

      // 空間固有のキー導出（追加のセキュリティレイヤー）
      const spaceSpecificKey = await window.Crypto.deriveSpaceKey(sharedKey, spaceId);

      window.Utils.log('success', 'ECDH共有秘密導出完了', { 
        spaceId, 
        keyType: 'AES-256-GCM' 
      });

      return spaceSpecificKey;
    } catch (error) {
      window.Utils.log('error', 'ECDH共有秘密導出エラー', { 
        spaceId, 
        error: error.message 
      });
      throw new Error(`共有秘密の導出に失敗しました: ${error.message}`);
    }
  },

  // 空間固有キー導出（HKDF使用）
  deriveSpaceKey: async (baseKey, spaceId) => {
    try {
      // 空間IDをソルトとして使用
      const encoder = new TextEncoder();
      const salt = await crypto.subtle.digest('SHA-256', encoder.encode(spaceId));

      // HKDF-like derivation using PBKDF2
      const spaceKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 10000,
          hash: 'SHA-256'
        },
        await crypto.subtle.importKey(
          'raw',
          await crypto.subtle.exportKey('raw', baseKey),
          'PBKDF2',
          false,
          ['deriveKey']
        ),
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );

      window.Utils.log('debug', '空間固有キー導出完了', { spaceId });
      return spaceKey;
    } catch (error) {
      window.Utils.log('error', '空間固有キー導出エラー', { 
        spaceId, 
        error: error.message 
      });
      throw new Error(`空間固有キーの導出に失敗しました: ${error.message}`);
    }
  },

  // 🔑 空間共有キー管理システム
  spaceKeys: new Map(),

  // 空間共有キー生成・取得
  getOrCreateSpaceKey: async (spaceId, peerPublicKeys = []) => {
    try {
      // 既存のキーがあるかチェック
      if (window.Crypto.spaceKeys.has(spaceId)) {
        const existingKey = window.Crypto.spaceKeys.get(spaceId);
        window.Utils.log('debug', '既存の空間キーを使用', { spaceId });
        return existingKey.sharedKey;
      }

      // 新しい鍵ペアを生成
      const myKeyPair = await window.Crypto.generateKeyPair();
      const myPublicKeyJWK = await window.Crypto.exportPublicKey(myKeyPair.publicKey);

      // 空間キー情報を保存
      const keyInfo = {
        keyPair: myKeyPair,
        publicKeyJWK: myPublicKeyJWK,
        peerKeys: new Map(),
        sharedKey: null,
        createdAt: new Date(),
        lastUsed: new Date()
      };

      // 他のピアがいる場合は共有キー生成
      if (peerPublicKeys.length > 0) {
        // 最初のピアと共有キーを作成（後で複数ピア対応可能）
        const firstPeerKey = await window.Crypto.importPublicKey(peerPublicKeys[0]);
        keyInfo.sharedKey = await window.Crypto.deriveSharedSecret(
          myKeyPair.privateKey, 
          firstPeerKey, 
          spaceId
        );
        keyInfo.peerKeys.set('peer_0', peerPublicKeys[0]);
      } else {
        // 一人だけの場合は一時的なキーを作成
        const tempKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        keyInfo.sharedKey = tempKey;
      }

      window.Crypto.spaceKeys.set(spaceId, keyInfo);

      window.Utils.log('success', '空間共有キー生成完了', { 
        spaceId,
        peerCount: peerPublicKeys.length,
        keyType: peerPublicKeys.length > 0 ? 'ECDH-Derived' : 'Temporary'
      });

      return keyInfo.sharedKey;
    } catch (error) {
      window.Utils.log('error', '空間共有キー生成エラー', { 
        spaceId, 
        error: error.message 
      });
      throw new Error(`空間共有キーの生成に失敗しました: ${error.message}`);
    }
  },

  // ピアの公開キーを追加して共有キーを更新
  addPeerAndUpdateKey: async (spaceId, peerPublicKeyJWK, peerId) => {
    try {
      const keyInfo = window.Crypto.spaceKeys.get(spaceId);
      if (!keyInfo) {
        throw new Error('空間キー情報が見つかりません');
      }

      // ピアの公開キーを追加
      keyInfo.peerKeys.set(peerId, peerPublicKeyJWK);

      // 共有キーを新しく生成
      const peerPublicKey = await window.Crypto.importPublicKey(peerPublicKeyJWK);
      keyInfo.sharedKey = await window.Crypto.deriveSharedSecret(
        keyInfo.keyPair.privateKey,
        peerPublicKey,
        spaceId
      );

      keyInfo.lastUsed = new Date();

      window.Utils.log('success', 'ピア追加と共有キー更新完了', { 
        spaceId, 
        peerId,
        totalPeers: keyInfo.peerKeys.size 
      });

      return keyInfo.sharedKey;
    } catch (error) {
      window.Utils.log('error', 'ピア追加エラー', { 
        spaceId, 
        peerId, 
        error: error.message 
      });
      throw new Error(`ピアの追加に失敗しました: ${error.message}`);
    }
  },

  // 自分の公開キーを取得
  getMyPublicKey: (spaceId) => {
    const keyInfo = window.Crypto.spaceKeys.get(spaceId);
    if (!keyInfo) {
      throw new Error('空間キー情報が見つかりません');
    }
    return keyInfo.publicKeyJWK;
  },

  // メッセージ暗号化（空間共有キー使用）
  encryptMessage: async (message, spaceId) => {
    try {
      if (!message || typeof message !== 'string') {
        throw new Error('有効なメッセージが必要です');
      }

      // 空間の共有キーを取得
      const sharedKey = window.Crypto.spaceKeys.get(spaceId)?.sharedKey;
      if (!sharedKey) {
        throw new Error('空間の共有キーが見つかりません');
      }

      // ランダムなIVを生成
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // メッセージをエンコード
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // AES-GCM暗号化
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        sharedKey,
        data
      );
      
      // Base64エンコード
      const encryptedData = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      
      window.Utils.log('debug', 'メッセージ暗号化完了', { 
        spaceId,
        messageLength: message.length,
        encryptedLength: encryptedData.length 
      });
      
      return {
        encryptedData,
        iv: ivBase64,
        spaceId,
        algorithm: 'AES-GCM-256'
      };
    } catch (error) {
      window.Utils.log('error', 'メッセージ暗号化エラー', { 
        spaceId, 
        error: error.message 
      });
      throw new Error(`メッセージ暗号化に失敗しました: ${error.message}`);
    }
  },

  // メッセージ復号化（空間共有キー使用）
  decryptMessage: async (encryptedData, ivBase64, spaceId) => {
    try {
      if (!encryptedData || !ivBase64 || !spaceId) {
        throw new Error('暗号化データ、IV、空間IDが必要です');
      }

      // 空間の共有キーを取得
      const sharedKey = window.Crypto.spaceKeys.get(spaceId)?.sharedKey;
      if (!sharedKey) {
        window.Utils.log('warn', '共有キーが見つかりません', { spaceId });
        return '[暗号化済み - 共有キーなし]';
      }

      // Base64デコード
      const encrypted = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(ivBase64).split('').map(char => char.charCodeAt(0))
      );
      
      // AES-GCM復号化
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        sharedKey,
        encrypted
      );
      
      // テキストにデコード
      const decoder = new TextDecoder();
      const decryptedMessage = decoder.decode(decryptedBuffer);
      
      window.Utils.log('debug', 'メッセージ復号化完了', { 
        spaceId,
        decryptedLength: decryptedMessage.length 
      });
      
      return decryptedMessage;
    } catch (error) {
      window.Utils.log('warn', 'メッセージ復号化失敗', { 
        spaceId, 
        error: error.message 
      });
      return '[暗号化されたメッセージ - 復号化できませんでした]';
    }
  },

  // 🔧 空間キー管理ユーティリティ
  
  // 空間キー情報取得
  getSpaceKeyInfo: (spaceId) => {
    const keyInfo = window.Crypto.spaceKeys.get(spaceId);
    if (!keyInfo) return null;

    return {
      spaceId,
      hasSharedKey: !!keyInfo.sharedKey,
      peerCount: keyInfo.peerKeys.size,
      createdAt: keyInfo.createdAt,
      lastUsed: keyInfo.lastUsed,
      publicKeyJWK: keyInfo.publicKeyJWK
    };
  },

  // 全空間キー情報取得
  getAllSpaceKeyInfo: () => {
    const info = {};
    for (const [spaceId, keyInfo] of window.Crypto.spaceKeys) {
      info[spaceId] = window.Crypto.getSpaceKeyInfo(spaceId);
    }
    return info;
  },

  // 空間キークリーンアップ
  cleanupSpaceKey: (spaceId) => {
    const deleted = window.Crypto.spaceKeys.delete(spaceId);
    if (deleted) {
      window.Utils.log('info', '空間キーをクリーンアップ', { spaceId });
    }
    return deleted;
  },

  // 全キークリーンアップ
  cleanupAllKeys: () => {
    const count = window.Crypto.spaceKeys.size;
    window.Crypto.spaceKeys.clear();
    window.Utils.log('info', '全空間キーをクリーンアップ', { count });
    return count;
  },

  // 🧪 システムテスト関数（拡張版）
  testEncryption: async () => {
    try {
      window.Utils.log('info', '🧪 拡張暗号化テスト開始');
      
      const testMessage = 'これはグループ暗号化のテストメッセージです 🔒✨';
      const testSpaceId = 'test-space-' + Date.now();
      
      // 1. 空間キー生成テスト
      const sharedKey = await window.Crypto.getOrCreateSpaceKey(testSpaceId);
      window.Utils.log('info', '✅ 空間キー生成テスト成功');
      
      // 2. 暗号化テスト
      const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
      window.Utils.log('info', '✅ 暗号化テスト成功', { 
        encryptedLength: encrypted.encryptedData.length 
      });
      
      // 3. 復号化テスト
      const decrypted = await window.Crypto.decryptMessage(
        encrypted.encryptedData, 
        encrypted.iv, 
        testSpaceId
      );
      window.Utils.log('info', '✅ 復号化テスト成功', { 
        decryptedLength: decrypted.length 
      });
      
      // 4. 整合性テスト
      const isValid = testMessage === decrypted;
      window.Utils.log(isValid ? 'success' : 'error', '✅ 整合性テスト', { 
        original: testMessage,
        decrypted: decrypted,
        isValid 
      });
      
      // 5. 空間キー情報テスト
      const keyInfo = window.Crypto.getSpaceKeyInfo(testSpaceId);
      window.Utils.log('info', '✅ 空間キー情報テスト', keyInfo);
      
      // 6. クリーンアップテスト
      const cleaned = window.Crypto.cleanupSpaceKey(testSpaceId);
      window.Utils.log('info', '✅ クリーンアップテスト', { cleaned });
      
      const testResult = {
        success: isValid,
        message: '全テスト完了',
        details: {
          original: testMessage,
          encrypted: encrypted.encryptedData.substring(0, 50) + '...',
          decrypted: decrypted,
          algorithm: encrypted.algorithm,
          isValid,
          keyInfo
        }
      };
      
      window.Utils.log('success', '🧪 拡張暗号化テスト完了', testResult);
      return testResult;
      
    } catch (error) {
      const errorResult = {
        success: false,
        message: 'テスト失敗',
        error: error.message
      };
      
      window.Utils.log('error', '🧪 暗号化テスト失敗', errorResult);
      return errorResult;
    }
  },

  // 🧪 マルチユーザー暗号化テスト
  testMultiUserEncryption: async () => {
    try {
      window.Utils.log('info', '🧪 マルチユーザー暗号化テスト開始');
      
      const testSpaceId = 'multi-test-' + Date.now();
      const testMessage = 'マルチユーザーテストメッセージ 👥🔒';
      
      // ユーザーA（現在のユーザー）のキー生成
      const userAKey = await window.Crypto.getOrCreateSpaceKey(testSpaceId);
      const userAPublicKey = window.Crypto.getMyPublicKey(testSpaceId);
      
      // ユーザーB（シミュレート）のキー生成
      const userBKeyPair = await window.Crypto.generateKeyPair();
      const userBPublicKey = await window.Crypto.exportPublicKey(userBKeyPair.publicKey);
      
      // ユーザーAがユーザーBの公開キーを追加
      await window.Crypto.addPeerAndUpdateKey(testSpaceId, userBPublicKey, 'userB');
      
      // メッセージ暗号化
      const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
      
      // 復号化（共有キーで成功するはず）
      const decrypted = await window.Crypto.decryptMessage(
        encrypted.encryptedData,
        encrypted.iv,
        testSpaceId
      );
      
      const isValid = testMessage === decrypted;
      
      // クリーンアップ
      window.Crypto.cleanupSpaceKey(testSpaceId);
      
      const result = {
        success: isValid,
        message: 'マルチユーザーテスト完了',
        details: {
          userAPublicKey: userAPublicKey.x?.substring(0, 20) + '...',
          userBPublicKey: userBPublicKey.x?.substring(0, 20) + '...',
          original: testMessage,
          decrypted: decrypted,
          isValid
        }
      };
      
      window.Utils.log('success', '🧪 マルチユーザーテスト完了', result);
      return result;
      
    } catch (error) {
      const errorResult = {
        success: false,
        message: 'マルチユーザーテスト失敗',
        error: error.message
      };
      
      window.Utils.log('error', '🧪 マルチユーザーテスト失敗', errorResult);
      return errorResult;
    }
  },

  // デバッグ情報表示
  getDebugInfo: () => {
    return {
      isSupported: window.Crypto.isSupported,
      activeSpaces: window.Crypto.spaceKeys.size,
      spaceKeyInfo: window.Crypto.getAllSpaceKeyInfo(),
      browserInfo: {
        userAgent: navigator.userAgent,
        webCryptoSupport: typeof crypto?.subtle !== 'undefined',
        indexedDBSupport: typeof indexedDB !== 'undefined'
      }
    };
  }
};

// デバッグ用: 暗号化モジュールの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ Crypto module loaded (Phase 1B):', {
    methods: Object.keys(window.Crypto).length,
    isSupported: window.Crypto.isSupported,
    version: 'Phase 1B - Group Encryption'
  });
}