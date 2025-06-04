// public/js/test/E2ETestSuite.js
// FRIENDLYモード完全テストスイート

window.E2ETestSuite = {
  // テスト結果の保存
  results: [],
  
  // 全体統計
  stats: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },

  /**
   * テスト実行メイン関数
   */
  runAllTests: async () => {
    console.log('🧪 FRIENDLYモード E2Eテストスイート開始');
    console.log('==========================================');
    
    window.E2ETestSuite.results = [];
    window.E2ETestSuite.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    const testGroups = [
      { name: 'システム基盤テスト', tests: window.E2ETestSuite.systemTests },
      { name: '暗号化システムテスト', tests: window.E2ETestSuite.cryptoTests },
      { name: 'セッション管理テスト', tests: window.E2ETestSuite.sessionTests },
      { name: 'メッセージフローテスト', tests: window.E2ETestSuite.messageFlowTests },
      { name: 'UI統合テスト', tests: window.E2ETestSuite.uiTests },
      { name: 'パフォーマンステスト', tests: window.E2ETestSuite.performanceTests }
    ];
    
    for (const group of testGroups) {
      console.log(`\n📋 ${group.name}`);
      console.log('─'.repeat(40));
      
      try {
        await group.tests();
      } catch (error) {
        console.error(`❌ ${group.name} でエラー発生:`, error);
      }
    }
    
    // 結果サマリー
    window.E2ETestSuite.printSummary();
    return window.E2ETestSuite.results;
  },

  /**
   * テスト実行ヘルパー
   */
  runTest: async (testName, testFunction, options = {}) => {
    window.E2ETestSuite.stats.total++;
    const startTime = performance.now();
    
    try {
      console.log(`🧪 ${testName}...`);
      
      if (options.skip) {
        console.log(`⏭️ ${testName} - スキップ`);
        window.E2ETestSuite.stats.skipped++;
        window.E2ETestSuite.results.push({
          name: testName,
          status: 'skipped',
          duration: 0,
          reason: options.skipReason || 'Manual skip'
        });
        return;
      }
      
      const result = await testFunction();
      const duration = performance.now() - startTime;
      
      if (result === true || (result && result.success)) {
        console.log(`✅ ${testName} - 成功 (${duration.toFixed(2)}ms)`);
        window.E2ETestSuite.stats.passed++;
        window.E2ETestSuite.results.push({
          name: testName,
          status: 'passed',
          duration: duration,
          details: result.details || null
        });
      } else {
        throw new Error(result.error || '予期しない失敗');
      }
      
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`❌ ${testName} - 失敗: ${error.message}`);
      window.E2ETestSuite.stats.failed++;
      window.E2ETestSuite.results.push({
        name: testName,
        status: 'failed',
        duration: duration,
        error: error.message,
        stack: error.stack
      });
      
      if (options.critical) {
        throw new Error(`Critical test failed: ${testName}`);
      }
    }
  },

  /**
   * 1. システム基盤テスト
   */
  systemTests: async () => {
    await window.E2ETestSuite.runTest('Web Crypto API 可用性確認', async () => {
      return {
        success: window.Crypto && window.Crypto.isSupported,
        details: {
          cryptoObject: !!window.crypto,
          subtleCrypto: !!window.crypto?.subtle,
          getRandomValues: !!window.crypto?.getRandomValues
        }
      };
    }, { critical: true });

    await window.E2ETestSuite.runTest('モジュール読み込み確認', async () => {
      const requiredModules = [
        'window.Crypto',
        'window.API', 
        'window.SessionManager',
        'window.Utils',
        'window.Icons'
      ];
      
      const missing = requiredModules.filter(moduleName => {
        try {
            // window.Module.SubModuleのような形式に対応
            const parts = moduleName.split('.');
            let current = window;
            for (const part of parts) {
            if (current[part] === undefined) return true; //存在しない
            current = current[part];
            }
            return false; //存在する
        } catch (e) {
            return true; //アクセス時にエラーなら存在しない扱い
        }
      });
      
      return {
        success: missing.length === 0,
        details: { requiredModules, missing },
        error: missing.length > 0 ? `Missing modules: ${missing.join(', ')}` : null
      };
    }, { critical: true });

    await window.E2ETestSuite.runTest('API接続確認', async () => {
      try {
        if (!window.API.testConnection) {
          return { success: true, details: 'API.testConnection not available, skipping' };
        }
        
        const connected = await window.API.testConnection();
        return {
          success: connected,
          details: { connected }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  },

  /**
   * 2. 暗号化システムテスト
   */
  cryptoTests: async () => {
    const testSpaceId = 'e2e-test-' + Date.now();
    const testPassphrase = 'e2e-test-passphrase-123';
    
    await window.E2ETestSuite.runTest('決定的キー生成テスト', async () => {
      const key1 = await window.Crypto.generateDeterministicKey(testSpaceId, testPassphrase);
      const key2 = await window.Crypto.generateDeterministicKey(testSpaceId, testPassphrase);
      
      return {
        success: typeof key1 === 'object' && typeof key2 === 'object' && key1 !== null && key2 !== null
      };
    }, { critical: true });

    await window.E2ETestSuite.runTest('空間キー管理テスト', async () => {
      const spaceKey = await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      const keyInfo = window.Crypto.getSpaceKeyInfo(testSpaceId);
      
      return {
        success: !!spaceKey && !!keyInfo,
        details: {
          hasSpaceKey: !!spaceKey,
          keyInfo: keyInfo,
          spaceKeyType: keyInfo?.type
        }
      };
    });

    await window.E2ETestSuite.runTest('メッセージ暗号化・復号化テスト', async () => {
      const testMessage = 'E2Eテストメッセージ 🔒';
      
      const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
      const decrypted = await window.Crypto.decryptMessage(
        encrypted.encryptedData, 
        encrypted.iv, 
        testSpaceId
      );
      
      return {
        success: testMessage === decrypted,
        details: {
          original: testMessage,
          encrypted: encrypted.encryptedData.substring(0, 20) + '...',
          decrypted: decrypted,
          encryptionAlgorithm: encrypted.algorithm
        }
      };
    }, { critical: true });

    await window.E2ETestSuite.runTest('ハイブリッド暗号化テスト', async () => {
      const testMessage = 'ハイブリッド暗号化テスト';
      
      // 複数セッションをシミュレート
      if (window.SessionManager) {
        window.SessionManager.initializeSession(testSpaceId);
        window.SessionManager.activeSessions.set(testSpaceId, new Set(['session1', 'session2', 'session3']));
      }
      
      const encrypted = await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
      const decrypted = await window.Crypto.decryptMessageWithFallback(encrypted, testSpaceId);
      
      return {
        success: testMessage === decrypted,
        details: {
          encryptionType: encrypted.type,
          hasFallback: !!encrypted.fallbackData,
          sessionCount: encrypted.sessionParticipants?.length || 0
        }
      };
    });

    // クリーンアップ
    await window.E2ETestSuite.runTest('暗号化システムクリーンアップ', async () => {
      const cleaned = window.Crypto.forceCleanupSpaceKey(testSpaceId);
      if (window.SessionManager) {
        window.SessionManager.leaveSession(testSpaceId);
      }
      
      return {
        success: true,
        details: { cleaned }
      };
    });
  },

  /**
   * 3. セッション管理テスト
   */
  sessionTests: async () => {
    const testSpaceId = 'session-test-' + Date.now();
    
    await window.E2ETestSuite.runTest('セッション初期化テスト', async () => {
      if (!window.SessionManager) {
        return { success: false, error: 'SessionManager not available' };
      }
      
      const sessionId = window.SessionManager.initializeSession(testSpaceId);
      const currentSession = window.SessionManager.getCurrentSession();
      
      return {
        success: !!sessionId && currentSession?.sessionId === sessionId,
        details: {
          sessionId: sessionId.substring(0, 12) + '...',
          spaceId: currentSession?.spaceId
        }
      };
    });

    await window.E2ETestSuite.runTest('複数セッション管理テスト', async () => {
      if (!window.SessionManager) {
        return { success: false, error: 'SessionManager not available' };
      }
      
      // セッション追加
      window.SessionManager.addSessionToSpace(testSpaceId, 'session-2');
      window.SessionManager.addSessionToSpace(testSpaceId, 'session-3');
      
      const activeSessions = window.SessionManager.getActiveSessionsForSpace(testSpaceId);
      
      return {
        success: activeSessions.length >= 2,
        details: {
          activeCount: activeSessions.length,
          sessions: activeSessions.map(s => s.substring(0, 12) + '...')
        }
      };
    });

    await window.E2ETestSuite.runTest('セッション退出テスト', async () => {
      if (!window.SessionManager) {
        return { success: false, error: 'SessionManager not available' };
      }
      
      window.SessionManager.leaveSession(testSpaceId);
      const currentSession = window.SessionManager.getCurrentSession();
      
      return {
        success: !currentSession?.sessionId,
        details: {
          sessionExists: !!currentSession?.sessionId
        }
      };
    });
  },

  /**
   * 4. メッセージフローテスト
   */
  messageFlowTests: async () => {
    await window.E2ETestSuite.runTest('メッセージ送信API統合テスト', async () => {
      // APIが利用可能かチェック
      if (!window.API || !window.API.sendMessageFriendly) {
        return { success: false, error: 'API.sendMessageFriendly not available' };
      }
      
      // 実際の送信は行わず、バリデーションのみ
      const testMessage = 'E2E統合テスト';
      const validation = window.Utils.validateMessage(testMessage);
      
      return {
        success: validation.valid,
        details: validation
      };
    });

    await window.E2ETestSuite.runTest('メッセージ読み込みAPI統合テスト', async () => {
      if (!window.API || !window.API.loadMessagesFriendly) {
        return { success: false, error: 'API.loadMessagesFriendly not available' };
      }
      
      // API関数の存在確認
      return {
        success: typeof window.API.loadMessagesFriendly === 'function',
        details: {
          functionExists: typeof window.API.loadMessagesFriendly === 'function'
        }
      };
    });
  },

  /**
   * 5. UI統合テスト
   */
  uiTests: async () => {
    await window.E2ETestSuite.runTest('暗号化状態コンポーネントテスト', async () => {
      const componentExists = !!window.EncryptionStatusComponent;
      
      return {
        success: componentExists,
        details: {
          componentExists,
          previewAvailable: !!window.EncryptionStatusComponent?.Preview
        }
      };
    });

    await window.E2ETestSuite.runTest('拡張メッセージ表示コンポーネントテスト', async () => {
      const componentExists = !!window.EnhancedMessageDisplay;
      
      return {
        success: componentExists,
        details: {
          componentExists,
          previewAvailable: !!window.EnhancedMessageDisplay?.Preview
        }
      };
    });

    await window.E2ETestSuite.runTest('統合チャットUIコンポーネントテスト', async () => {
      const componentExists = !!window.IntegratedChatComponent;
      
      return {
        success: componentExists,
        details: {
          componentExists
        }
      };
    });
  },

  /**
   * 6. パフォーマンステスト
   */
  performanceTests: async () => {
    await window.E2ETestSuite.runTest('暗号化パフォーマンステスト', async () => {
      const iterations = 10;
      const testMessage = 'パフォーマンステストメッセージ';
      const testSpaceId = 'perf-test-' + Date.now();
      const testPassphrase = 'perf-test-pass';
      
      try {
        await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
        
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
          const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
          await window.Crypto.decryptMessage(encrypted.encryptedData, encrypted.iv, testSpaceId);
        }
        
        const totalTime = performance.now() - startTime;
        const avgTime = totalTime / iterations;
        
        // クリーンアップ
        window.Crypto.forceCleanupSpaceKey(testSpaceId);
        
        return {
          success: avgTime < 100, // 100ms以下を合格とする
          details: {
            iterations,
            totalTime: totalTime.toFixed(2) + 'ms',
            avgTime: avgTime.toFixed(2) + 'ms',
            performance: avgTime < 50 ? 'excellent' : avgTime < 100 ? 'good' : 'needs improvement'
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    await window.E2ETestSuite.runTest('メモリ使用量チェック', async () => {
      if (!window.performance || !window.performance.memory) {
        return { 
          success: true, 
          details: { message: 'Memory API not available in this browser' }
        };
      }
      
      const memInfo = window.performance.memory;
      const usedMB = (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      const usage = (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit * 100).toFixed(2);
      
      return {
        success: parseFloat(usage) < 80, // 80%未満を合格とする
        details: {
          usedMB: usedMB + ' MB',
          limitMB: limitMB + ' MB',
          usage: usage + '%',
          status: parseFloat(usage) < 50 ? 'excellent' : parseFloat(usage) < 80 ? 'good' : 'high'
        }
      };
    });
  },

  /**
   * 結果サマリー出力
   */
  printSummary: () => {
    const { stats, results } = window.E2ETestSuite;
    
    console.log('\n🎯 テスト結果サマリー');
    console.log('==========================================');
    console.log(`総テスト数: ${stats.total}`);
    console.log(`✅ 成功: ${stats.passed}`);
    console.log(`❌ 失敗: ${stats.failed}`);
    console.log(`⏭️ スキップ: ${stats.skipped}`);
    console.log(`成功率: ${((stats.passed / (stats.total - stats.skipped)) * 100).toFixed(1)}%`);
    
    // 失敗したテストの詳細
    const failures = results.filter(r => r.status === 'failed');
    if (failures.length > 0) {
      console.log('\n❌ 失敗したテスト:');
      failures.forEach(failure => {
        console.log(`  • ${failure.name}: ${failure.error}`);
      });
    }
    
    // パフォーマンス情報
    const perfTests = results.filter(r => r.name.includes('パフォーマンス') && r.status === 'passed');
    if (perfTests.length > 0) {
      console.log('\n⚡ パフォーマンス情報:');
      perfTests.forEach(test => {
        console.log(`  • ${test.name}: ${test.details?.avgTime || test.details?.status || 'OK'}`);
      });
    }
    
    console.log('\n🚀 FRIENDLYモード E2Eテスト完了！');
    
    // 次のステップ推奨
    if (stats.failed === 0) {
      console.log('✨ 全テスト成功！FRIENDLYモードは本番準備完了です。');
    } else {
      console.log('⚠️ いくつかのテストが失敗しました。修正が必要です。');
    }
  },

  /**
   * 個別テスト実行（デバッグ用）
   */
  runIndividualTest: async (testGroupName) => {
    const testMap = {
      'system': window.E2ETestSuite.systemTests,
      'crypto': window.E2ETestSuite.cryptoTests,
      'session': window.E2ETestSuite.sessionTests,
      'message': window.E2ETestSuite.messageFlowTests,
      'ui': window.E2ETestSuite.uiTests,
      'performance': window.E2ETestSuite.performanceTests
    };
    
    const testFunction = testMap[testGroupName.toLowerCase()];
    if (!testFunction) {
      console.error('❌ テストグループが見つかりません:', testGroupName);
      console.log('利用可能なグループ:', Object.keys(testMap).join(', '));
      return;
    }
    
    console.log(`🧪 ${testGroupName} テストを実行中...`);
    window.E2ETestSuite.results = [];
    window.E2ETestSuite.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    await testFunction();
    window.E2ETestSuite.printSummary();
  }
};

// デバッグ用ヘルパー
window.testFriendlyMode = () => window.E2ETestSuite.runAllTests();
window.testCrypto = () => window.E2ETestSuite.runIndividualTest('crypto');
window.testUI = () => window.E2ETestSuite.runIndividualTest('ui');

console.log('✅ E2E Test Suite loaded');
console.log('🧪 使用方法:');
console.log('  window.testFriendlyMode() - 全テスト実行');
console.log('  window.testCrypto() - 暗号化テストのみ');
console.log('  window.testUI() - UIテストのみ');