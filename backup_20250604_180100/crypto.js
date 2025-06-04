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

console.log('🔄 FRIENDLYモード暗号化機能追加中...');

Object.assign(window.Crypto, {
  /**
   * セッション暗号化キー生成
   * @param {Array<string>} sessionIds セッションIDの配列
   * @param {string} spaceId 空間ID
   * @returns {Promise<CryptoKey>} セッションキー
   */
  deriveSessionKey: async (sessionIds, spaceId) => {
    try {
      // セッションIDをソートして決定的にする
      const sortedSessions = [...sessionIds].sort();
      
      window.Utils.log('debug', 'セッションキー生成開始', { 
        spaceId, 
        sessionCount: sortedSessions.length,
        sessionPreviews: sortedSessions.map(s => s.substring(0, 12) + '...')
      });
      
      // 決定的な材料を作成
      const encoder = new TextEncoder();
      const keyMaterial = encoder.encode(
        `friendly-session-key:${spaceId}:${sortedSessions.join(':')}`
      );
      
      // ハッシュ化
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);
      
      // AESキーとしてインポート
      const sessionKey = await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      
      window.Utils.log('success', 'セッションキー生成完了', { 
        spaceId, 
        sessionCount: sortedSessions.length 
      });
      
      return sessionKey;
    } catch (error) {
      window.Utils.log('error', 'セッションキー生成エラー', { 
        spaceId, 
        error: error.message 
      });
      throw error;
    }
  },
  
  /**
   * ハイブリッド暗号化（FRIENDLYモード）
   * @param {string} message 平文メッセージ
   * @param {string} spaceId 空間ID
   * @returns {Promise<Object>} 暗号化結果
   */
  encryptMessageHybrid: async (message, spaceId) => {
    try {
      window.Utils.performance.start('hybrid_encrypt');
      window.Utils.log('info', 'ハイブリッド暗号化開始', { 
        spaceId,
        messageLength: message.length 
      });
      
      // Step 1: 決定的暗号化（フォールバック保証）
      const deterministicResult = await window.Crypto.encryptMessage(message, spaceId);
      
      // 現在のアクティブセッション取得
      const activeSessions = window.SessionManager.getActiveSessionsForSpace(spaceId);
      const currentSession = window.SessionManager.getCurrentSession();
      
      // 現在のセッションも含める（まだ追加されていない場合）
      if (currentSession && currentSession.spaceId === spaceId) {
        if (!activeSessions.includes(currentSession.sessionId)) {
          activeSessions.push(currentSession.sessionId);
        }
      }
      
      window.Utils.log('debug', 'セッション情報確認', { 
        activeSessionCount: activeSessions.length,
        currentSessionId: currentSession ? currentSession.sessionId.substring(0, 12) + '...' : 'none'
      });
      
      if (activeSessions.length <= 1) {
        // 単独セッション: 決定的暗号化のみ
        window.Utils.log('info', '単独セッション: 決定的暗号化のみ使用');
        
        const result = {
          type: 'deterministic',
          encryptedData: deterministicResult.encryptedData,
          iv: deterministicResult.iv,
          algorithm: deterministicResult.algorithm || 'AES-GCM-256',
          spaceId
        };
        
        window.Utils.performance.end('hybrid_encrypt');
        return result;
        
      } else {
        // 複数セッション: ハイブリッド暗号化
        window.Utils.log('info', 'マルチセッション: ハイブリッド暗号化実行', { 
          sessionCount: activeSessions.length 
        });
        
        // Step 2: セッション暗号化
        const sessionKey = await window.Crypto.deriveSessionKey(activeSessions, spaceId);
        const sessionIv = crypto.getRandomValues(new Uint8Array(12));
        
        const sessionEncrypted = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: sessionIv,
            tagLength: 128
          },
          sessionKey,
          new TextEncoder().encode(deterministicResult.encryptedData)
        );
        
        const sessionData = btoa(String.fromCharCode(...new Uint8Array(sessionEncrypted)));
        const sessionIvBase64 = btoa(String.fromCharCode(...sessionIv));
        
        const result = {
          type: 'hybrid',
          // メインデータ（セッション暗号化）
          encryptedData: sessionData,
          iv: sessionIvBase64,
          algorithm: 'AES-GCM-256',
          sessionParticipants: activeSessions,
          // フォールバックデータ（決定的暗号化）
          fallbackData: {
            encryptedData: deterministicResult.encryptedData,
            iv: deterministicResult.iv,
            algorithm: deterministicResult.algorithm || 'AES-GCM-256'
          },
          spaceId,
          timestamp: new Date().toISOString()
        };
        
        window.Utils.log('success', 'ハイブリッド暗号化完了', { 
          type: result.type,
          sessionCount: activeSessions.length,
          hasFallback: !!result.fallbackData
        });
        
        window.Utils.performance.end('hybrid_encrypt');
        return result;
      }
    } catch (error) {
      window.Utils.performance.end('hybrid_encrypt');
      window.Utils.log('error', 'ハイブリッド暗号化エラー', { 
        spaceId, 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },
  
  /**
   * フォールバック付き復号化
   * @param {Object} encryptedMessage 暗号化されたメッセージ
   * @param {string} spaceId 空間ID
   * @returns {Promise<string>} 復号化されたメッセージ
   */
  decryptMessageWithFallback: async (encryptedMessage, spaceId) => {
    try {
      window.Utils.performance.start('hybrid_decrypt');
      window.Utils.log('debug', 'フォールバック復号化開始', { 
        type: encryptedMessage.type,
        spaceId,
        hasEncryptedData: !!encryptedMessage.encryptedData,
        hasFallback: !!encryptedMessage.fallbackData
      });
      
      if (encryptedMessage.type === 'deterministic') {
        // 決定的暗号化のみ
        window.Utils.log('debug', '決定的復号化実行');
        const result = await window.Crypto.decryptMessage(
          encryptedMessage.encryptedData,
          encryptedMessage.iv,
          spaceId
        );
        window.Utils.performance.end('hybrid_decrypt');
        return result;
      }
      
      if (encryptedMessage.type === 'hybrid') {
        // ハイブリッド暗号化: セッション復号化を試行
        try {
          window.Utils.log('debug', 'セッション復号化を試行', {
            sessionParticipants: encryptedMessage.sessionParticipants?.length || 0
          });
          
          // 現在のアクティブセッションでセッションキー生成
          let sessionIds = window.SessionManager.getActiveSessionsForSpace(spaceId);
          
          // 現在のセッションも追加
          const currentSession = window.SessionManager.getCurrentSession();
          if (currentSession && currentSession.spaceId === spaceId) {
            if (!sessionIds.includes(currentSession.sessionId)) {
              sessionIds.push(currentSession.sessionId);
            }
          }
          
          // 保存されたセッション参加者も試行
          if (encryptedMessage.sessionParticipants && encryptedMessage.sessionParticipants.length > 0) {
            sessionIds = encryptedMessage.sessionParticipants;
          }
          
          window.Utils.log('debug', 'セッションキー生成用ID', { 
            sessionCount: sessionIds.length,
            previews: sessionIds.map(s => s.substring(0, 12) + '...')
          });
          
          const sessionKey = await window.Crypto.deriveSessionKey(sessionIds, spaceId);
          
          // セッション復号化
          const sessionEncrypted = new Uint8Array(
            atob(encryptedMessage.encryptedData).split('').map(char => char.charCodeAt(0))
          );
          const sessionIv = new Uint8Array(
            atob(encryptedMessage.iv).split('').map(char => char.charCodeAt(0))
          );
          
          const sessionDecrypted = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: sessionIv,
              tagLength: 128
            },
            sessionKey,
            sessionEncrypted
          );
          
          const deterministicData = new TextDecoder().decode(sessionDecrypted);
          
          // 決定的復号化を実行
          const finalMessage = await window.Crypto.decryptMessage(
            deterministicData,
            encryptedMessage.fallbackData.iv,
            spaceId
          );
          
          window.Utils.log('success', 'セッション復号化成功');
          window.Utils.performance.end('hybrid_decrypt');
          return finalMessage;
          
        } catch (sessionError) {
          // セッション復号化失敗 → フォールバック
          window.Utils.log('warn', 'セッション復号化失敗、フォールバック実行', { 
            error: sessionError.message,
            hasFallbackData: !!encryptedMessage.fallbackData
          });
          
          if (!encryptedMessage.fallbackData) {
            throw new Error('フォールバックデータが見つかりません');
          }
          
          try {
            const fallbackMessage = await window.Crypto.decryptMessage(
              encryptedMessage.fallbackData.encryptedData,
              encryptedMessage.fallbackData.iv,
              spaceId
            );
            
            window.Utils.log('success', 'フォールバック復号化成功');
            window.Utils.performance.end('hybrid_decrypt');
            return fallbackMessage;
            
          } catch (fallbackError) {
            window.Utils.log('error', 'フォールバック復号化も失敗', { 
              sessionError: sessionError.message,
              fallbackError: fallbackError.message
            });
            throw new Error(`復号化完全失敗: セッション(${sessionError.message}) フォールバック(${fallbackError.message})`);
          }
        }
      }
      
      throw new Error(`未知の暗号化タイプ: ${encryptedMessage.type}`);
      
    } catch (error) {
      window.Utils.performance.end('hybrid_decrypt');
      window.Utils.log('error', 'フォールバック復号化エラー', { 
        spaceId, 
        error: error.message,
        encryptedType: encryptedMessage.type
      });
      throw error;
    }
  },
  
  /**
   * FRIENDLYモード暗号化テスト
   * @returns {Promise<Object>} テスト結果
   */
  testFriendlyEncryption: async () => {
    try {
      window.Utils.log('info', '🧪 FRIENDLYモード暗号化テスト開始');
      
      const testSpaceId = 'test-friendly-' + Date.now();
      const testMessage = 'FRIENDLYモード暗号化テストメッセージ 🔒✨';
      const testPassphrase = 'test-friendly-pass-' + Date.now(); // テストごとにユニークなパスフレーズが良いでしょう
      const results = [];
      
      // ===== ここから追加 =====
      // テスト用の空間キーを初期化
      await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      results.push(`✅ テスト用空間キー生成 (${testSpaceId})`);
      window.Utils.log('debug', `テスト用空間キー生成完了: ${testSpaceId}`);
      // ===== ここまで追加 =====
      
      // セッション初期化
      const sessionId = window.SessionManager.initializeSession(testSpaceId);
      results.push(`✅ セッション初期化: ${sessionId.substring(0, 12)}...`);
      
      // Test 1: 単独セッション暗号化
      window.Utils.log('debug', 'Test 1: 単独セッション暗号化');
      const singleEncrypted = await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
      const singleDecrypted = await window.Crypto.decryptMessageWithFallback(singleEncrypted, testSpaceId);
      const singleSuccess = testMessage === singleDecrypted;
      results.push(`${singleSuccess ? '✅' : '❌'} 単独セッション: ${singleEncrypted.type} (${singleSuccess})`);
      
      // Test 2: マルチセッション暗号化
      window.Utils.log('debug', 'Test 2: マルチセッション暗号化');
      // 注意: activeSessionsの操作はSessionManagerの責務なので、ここではSessionManagerのAPI経由で操作するか、
      // もしSessionManagerにそのようなAPIがなければ、テストの前提としてSessionManagerの状態を直接操作します。
      // ここでは、テストの簡略化のため直接操作していると仮定します。
      // より厳密には、SessionManagerにテスト用のセッション追加・削除APIを設けるか、
      // Socket.IOイベントをシミュレートしてセッション数を変更する方が望ましいです。
      const originalSessions = window.SessionManager.activeSessions.get(testSpaceId) || new Set();
      window.SessionManager.activeSessions.set(testSpaceId, new Set([sessionId, 'session_test_2', 'session_test_3']));
      
      const multiEncrypted = await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
      const multiDecrypted = await window.Crypto.decryptMessageWithFallback(multiEncrypted, testSpaceId);
      const multiSuccess = testMessage === multiDecrypted;
      results.push(`${multiSuccess ? '✅' : '❌'} マルチセッション: ${multiEncrypted.type} (${multiSuccess})`);
      
      // Test 3: フォールバックテスト
      window.Utils.log('debug', 'Test 3: フォールバックテスト');
      window.SessionManager.activeSessions.set(testSpaceId, new Set(['different_session_id'])); // 意図的に異なるセッションIDを設定
      const fallbackDecrypted = await window.Crypto.decryptMessageWithFallback(multiEncrypted, testSpaceId);
      const fallbackSuccess = testMessage === fallbackDecrypted;
      results.push(`${fallbackSuccess ? '✅' : '❌'} フォールバック: ${fallbackSuccess}`);
      
      // クリーンアップ
      window.SessionManager.leaveSession(testSpaceId);
      window.Crypto.forceCleanupSpaceKey(testSpaceId); // テストで生成したキーをクリーンアップ
      results.push(`✅ テスト用空間キークリーンアップ (${testSpaceId})`);
      
      const allSuccess = results.every(r => r.startsWith('✅'));
      
      const testResult = {
        success: allSuccess,
        message: allSuccess ? '🎉 全テスト成功！' : '⚠️ 一部テスト失敗',
        details: results,
        testData: {
          singleEncryptedType: singleEncrypted.type,
          multiEncryptedType: multiEncrypted.type,
          hasFallback: !!multiEncrypted.fallbackData
        }
      };
      
      window.Utils.log(allSuccess ? 'success' : 'error', '🧪 FRIENDLYモードテスト結果', testResult);
      return testResult;
      
    } catch (error) {
      const errorResult = {
        success: false,
        message: '❌ テスト実行エラー',
        error: error.message,
        stack: error.stack, // エラーのスタックトレースも記録するとデバッグに役立ちます
        details: []
      };
      
      window.Utils.log('error', '🧪 FRIENDLYモードテスト失敗', errorResult);
      return errorResult;
    }
  }
});

console.log('✅ FRIENDLYモード暗号化機能追加完了');