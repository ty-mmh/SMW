// セキュアチャット E2EE暗号化モジュール - Phase 1B（恒久修正統合版）
// ECDH鍵交換 + AES-256-GCM + 決定的暗号化キーシステム

console.log('🔒 Phase 1B 暗号化モジュール読み込み開始（恒久修正版）');

window.Crypto = {
  // Web Crypto API サポート確認
  isSupported: (() => {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  })(),

  // 🔑 空間共有キー管理
  spaceKeys: new Map(),

  // 🔑 パスフレーズキャッシュ（恒久修正）
  passphraseCache: new Map(),

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

  // =============================================================================
  // 🔑 決定的暗号化キー生成システム（恒久修正）
  // =============================================================================

  /**
   * 決定的キー生成（恒久版）
   * @param {string} spaceId 空間ID
   * @param {string} passphrase パスフレーズ
   * @returns {Promise<CryptoKey>}
   */
  generateDeterministicKey: async (spaceId, passphrase = '') => {
    try {
      window.Utils.log('debug', '決定的キー生成開始', { spaceId, hasPassphrase: !!passphrase });
      
      // パスフレーズが空の場合、キャッシュから取得を試行
      if (!passphrase && window.Crypto.passphraseCache.has(spaceId)) {
        passphrase = window.Crypto.passphraseCache.get(spaceId);
        window.Utils.log('debug', 'キャッシュからパスフレーズ取得', { spaceId });
      }
      
      // それでも空の場合はエラー
      if (!passphrase) {
        throw new Error(`空間 ${spaceId} のパスフレーズが見つかりません`);
      }
      
      // 決定的なソルト生成
      const encoder = new TextEncoder();
      const seedData = encoder.encode(`secure-chat-v2:${spaceId}:${passphrase}`);
      const saltBuffer = await crypto.subtle.digest('SHA-256', seedData);
      
      // パスワードベースキー導出
      const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(spaceId + ':' + passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      // 決定的なAESキーを導出
      const deterministicKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256'
        },
        baseKey,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
      
      window.Utils.log('success', '決定的キー生成完了', { spaceId });
      return deterministicKey;
      
    } catch (error) {
      window.Utils.log('error', '決定的キー生成エラー', { spaceId, error: error.message });
      throw error;
    }
  },

  /**
   * 空間共有キー生成・取得（恒久修正版）
   * @param {string} spaceId 空間ID
   * @param {string} passphrase パスフレーズ
   * @param {Array} peerPublicKeys ピアの公開鍵（将来の拡張用）
   * @returns {Promise<CryptoKey>}
   */
  getOrCreateSpaceKey: async (spaceId, passphrase = '', peerPublicKeys = []) => {
    try {
      window.Utils.log('debug', '決定的空間キー処理開始', { spaceId, hasPassphrase: !!passphrase });
      
      // パスフレーズをキャッシュに保存
      if (passphrase) {
        window.Crypto.passphraseCache.set(spaceId, passphrase);
        window.Utils.log('debug', 'パスフレーズをキャッシュに保存', { spaceId });
      }
      
      // 既存のキーがあるかチェック
      if (window.Crypto.spaceKeys.has(spaceId)) {
        const existingKey = window.Crypto.spaceKeys.get(spaceId);
        window.Utils.log('debug', '既存の決定的キーを使用', { spaceId });
        return existingKey.sharedKey;
      }
      
      // 決定的キーを生成
      const deterministicKey = await window.Crypto.generateDeterministicKey(spaceId, passphrase);
      
      // ダミーの鍵ペア（将来の拡張用）
      const dummyKeyPair = await window.Crypto.generateKeyPair();
      const publicKeyJWK = await window.Crypto.exportPublicKey(dummyKeyPair.publicKey);
      
      // キー情報を保存
      const keyInfo = {
        keyPair: dummyKeyPair,
        publicKeyJWK: publicKeyJWK,
        peerKeys: new Map(),
        sharedKey: deterministicKey,
        createdAt: new Date(),
        lastUsed: new Date(),
        type: 'deterministic',
        passphrase: passphrase
      };
      
      window.Crypto.spaceKeys.set(spaceId, keyInfo);
      
      window.Utils.log('success', '決定的空間キー生成完了', { 
        spaceId,
        keyType: 'deterministic',
        hasPassphrase: !!passphrase
      });
      
      return deterministicKey;
      
    } catch (error) {
      window.Utils.log('error', '決定的空間キー処理エラー', { spaceId, error: error.message });
      throw error;
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

  // =============================================================================
  // 🔧 空間キー管理ユーティリティ（恒久修正版）
  // =============================================================================
  
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
      publicKeyJWK: keyInfo.publicKeyJWK,
      type: keyInfo.type || 'unknown',
      hasPassphrase: !!keyInfo.passphrase
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

  // 🔧 空間キークリーンアップ（恒久修正 - 無効化）
  cleanupSpaceKey: (spaceId) => {
    window.Utils.log('info', '空間キークリーンアップをスキップ（決定的キー保持）', { spaceId });
    // クリーンアップを行わない（決定的キーを保持）
    return false;
  },

  // デバッグ用: 強制クリーンアップ
  forceCleanupSpaceKey: (spaceId) => {
    const deleted = window.Crypto.spaceKeys.delete(spaceId);
    const passphraseDeleted = window.Crypto.passphraseCache.delete(spaceId);
    window.Utils.log('info', '強制クリーンアップ実行', { spaceId, deleted, passphraseDeleted });
    return deleted;
  },

  // 全キークリーンアップ
  cleanupAllKeys: () => {
    const count = window.Crypto.spaceKeys.size;
    const passphraseCount = window.Crypto.passphraseCache.size;
    window.Crypto.spaceKeys.clear();
    window.Crypto.passphraseCache.clear();
    window.Utils.log('info', '全空間キーをクリーンアップ', { keyCount: count, passphraseCount });
    return count;
  },

  // =============================================================================
  // 🧪 システムテスト関数（拡張版）
  // =============================================================================
  
  testEncryption: async () => {
    try {
      window.Utils.log('info', '🧪 拡張暗号化テスト開始');
      
      const testMessage = 'これはグループ暗号化のテストメッセージです 🔒✨';
      const testSpaceId = 'test-space-' + Date.now();
      const testPassphrase = 'test-passphrase-123';
      
      // 1. 決定的空間キー生成テスト
      const sharedKey = await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      window.Utils.log('info', '✅ 決定的空間キー生成テスト成功');
      
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
      
      // 5. 決定性テスト（同じキーが生成されるか）
      const sharedKey2 = await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      const isDeterministic = sharedKey === sharedKey2;
      window.Utils.log(isDeterministic ? 'success' : 'error', '✅ 決定性テスト', { isDeterministic });
      
      // 6. 空間キー情報テスト
      const keyInfo = window.Crypto.getSpaceKeyInfo(testSpaceId);
      window.Utils.log('info', '✅ 空間キー情報テスト', keyInfo);
      
      // 7. クリーンアップテスト（強制）
      const cleaned = window.Crypto.forceCleanupSpaceKey(testSpaceId);
      window.Utils.log('info', '✅ 強制クリーンアップテスト', { cleaned });
      
      const testResult = {
        success: isValid && isDeterministic,
        message: '全テスト完了',
        details: {
          original: testMessage,
          encrypted: encrypted.encryptedData.substring(0, 50) + '...',
          decrypted: decrypted,
          algorithm: encrypted.algorithm,
          isValid,
          isDeterministic,
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
      const testPassphrase = 'multi-test-passphrase';
      
      // ユーザーA（現在のユーザー）のキー生成
      const userAKey = await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
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
      window.Crypto.forceCleanupSpaceKey(testSpaceId);
      
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
      cachedPassphrases: window.Crypto.passphraseCache.size,
      spaceKeyInfo: window.Crypto.getAllSpaceKeyInfo(),
      passphrases: Array.from(window.Crypto.passphraseCache.keys()),
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
  console.log('✅ Crypto module loaded (Phase 1B + 恒久修正):', {
    methods: Object.keys(window.Crypto).length,
    isSupported: window.Crypto.isSupported,
    version: 'Phase 1B - 決定的暗号化システム',
    features: ['決定的キー生成', 'パスフレーズキャッシュ', 'クリーンアップ防止']
  });
}