// FRIENDLYモード 完成度テストスイート
// ブラウザコンソールで実行してください

console.log('🏠 FRIENDLYモード 完成度テストスイート開始');
console.log('=' .repeat(60));

// FRIENDLYモード総合テストクラス
class FriendlyModeTestSuite {
  constructor() {
    this.testResults = [];
    this.testStartTime = Date.now();
  }

  // テスト結果記録
  recordTest(testName, success, details = {}, duration = 0) {
    const result = {
      testName,
      success,
      details,
      duration,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const status = success ? '✅' : '❌';
    const durationText = duration > 0 ? ` (${duration}ms)` : '';
    console.log(`${status} ${testName}${durationText}`, details);
    
    return result;
  }

  // 基盤システムテスト
  async testFoundationSystems() {
    console.log('\n📋 1. 基盤システムテスト');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    
    // 1.1 暗号化システム確認
    const cryptoSupported = window.Crypto && window.Crypto.isSupported;
    this.recordTest('暗号化システム利用可能性', cryptoSupported, {
      cryptoExists: !!window.Crypto,
      isSupported: window.Crypto?.isSupported,
      methods: window.Crypto ? Object.keys(window.Crypto).length : 0
    });
    
    // 1.2 SessionManager確認
    const sessionManagerExists = !!window.SessionManager;
    this.recordTest('SessionManager存在確認', sessionManagerExists, {
      exists: sessionManagerExists,
      methods: sessionManagerExists ? Object.keys(window.SessionManager).length : 0
    });
    
    // 1.3 API統合確認
    const apiExists = !!window.API;
    const friendlyFunctionsExist = !!(window.API?.sendMessageFriendly && window.API?.loadMessagesFriendly);
    this.recordTest('FRIENDLY API関数存在確認', friendlyFunctionsExist, {
      apiExists,
      sendMessageFriendly: !!window.API?.sendMessageFriendly,
      loadMessagesFriendly: !!window.API?.loadMessagesFriendly
    });
    
    // 1.4 決定的暗号化テスト
    if (cryptoSupported) {
      try {
        const testResult = await window.Crypto.testEncryption();
        this.recordTest('決定的暗号化機能テスト', testResult.success, testResult.details);
      } catch (error) {
        this.recordTest('決定的暗号化機能テスト', false, { error: error.message });
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`📊 基盤システムテスト完了 (${duration}ms)`);
    
    return this.testResults.filter(r => r.testName.includes('暗号化') || r.testName.includes('SessionManager') || r.testName.includes('API'));
  }

  // セッション管理テスト
  async testSessionManagement() {
    console.log('\n👥 2. セッション管理テスト');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    
    try {
      // 2.1 セッション初期化
      const testSpaceId = 'test-friendly-session-' + Date.now();
      const sessionId = window.SessionManager.initializeSession(testSpaceId);
      
      this.recordTest('セッション初期化', !!sessionId, {
        sessionId: sessionId ? sessionId.substring(0, 12) + '...' : null,
        spaceId: testSpaceId
      });
      
      // 2.2 現在セッション取得
      const currentSession = window.SessionManager.getCurrentSession();
      this.recordTest('現在セッション取得', !!currentSession, {
        hasSession: !!currentSession,
        sessionId: currentSession ? currentSession.sessionId.substring(0, 12) + '...' : null
      });
      
      // 2.3 アクティブセッション取得
      const activeSessions = window.SessionManager.getActiveSessionsForSpace(testSpaceId);
      this.recordTest('アクティブセッション取得', Array.isArray(activeSessions), {
        count: activeSessions ? activeSessions.length : 0,
        sessions: activeSessions ? activeSessions.map(s => s.substring(0, 8) + '...') : []
      });
      
      // 2.4 他セッション追加テスト
      const dummySessionId = 'dummy_session_' + Date.now();
      window.SessionManager.addSessionToSpace(testSpaceId, dummySessionId);
      const activeSessionsAfter = window.SessionManager.getActiveSessionsForSpace(testSpaceId);
      
      this.recordTest('セッション追加機能', activeSessionsAfter.length > activeSessions.length, {
        beforeCount: activeSessions.length,
        afterCount: activeSessionsAfter.length,
        addedSession: dummySessionId.substring(0, 12) + '...'
      });
      
      // 2.5 セッション退室
      window.SessionManager.leaveSession(testSpaceId);
      const sessionAfterLeave = window.SessionManager.getCurrentSession();
      
      this.recordTest('セッション退室機能', !sessionAfterLeave || sessionAfterLeave.spaceId !== testSpaceId, {
        leftSuccessfully: !sessionAfterLeave || sessionAfterLeave.spaceId !== testSpaceId
      });
      
    } catch (error) {
      this.recordTest('セッション管理テスト', false, { error: error.message });
    }
    
    const duration = Date.now() - startTime;
    console.log(`📊 セッション管理テスト完了 (${duration}ms)`);
  }

  // ハイブリッド暗号化テスト
  async testHybridEncryption() {
    console.log('\n🔗 3. ハイブリッド暗号化テスト');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    
    if (!window.Crypto?.testFriendlyEncryption) {
      this.recordTest('ハイブリッド暗号化テスト', false, { error: 'testFriendlyEncryption関数が見つかりません' });
      return;
    }
    
    try {
      const testResult = await window.Crypto.testFriendlyEncryption();
      this.recordTest('ハイブリッド暗号化統合テスト', testResult.success, {
        message: testResult.message,
        details: testResult.details,
        testData: testResult.testData
      });
      
      // 3.2 手動ハイブリッドテスト
      const testSpaceId = 'test-hybrid-' + Date.now();
      const testMessage = 'FRIENDLYモード ハイブリッド暗号化テスト';
      
      // セッション準備
      window.SessionManager.initializeSession(testSpaceId);
      await window.Crypto.getOrCreateSpaceKey(testSpaceId, 'test-passphrase');
      
      // 単独セッション暗号化
      const singleResult = await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
      this.recordTest('単独セッション暗号化', singleResult.type === 'deterministic', {
        encryptionType: singleResult.type,
        hasEncryptedData: !!singleResult.encryptedData,
        hasIv: !!singleResult.iv
      });
      
      // 複数セッション暗号化
      window.SessionManager.activeSessions.set(testSpaceId, new Set(['session1', 'session2']));
      const multiResult = await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
      this.recordTest('複数セッション暗号化', multiResult.type === 'hybrid', {
        encryptionType: multiResult.type,
        hasSessionParticipants: !!multiResult.sessionParticipants,
        hasFallback: !!multiResult.fallbackData
      });
      
      // フォールバック復号化テスト
      const decryptedResult = await window.Crypto.decryptMessageWithFallback(multiResult, testSpaceId);
      this.recordTest('フォールバック復号化', decryptedResult === testMessage, {
        originalMessage: testMessage,
        decryptedMessage: decryptedResult,
        isMatch: decryptedResult === testMessage
      });
      
      // クリーンアップ
      window.SessionManager.leaveSession(testSpaceId);
      
    } catch (error) {
      this.recordTest('ハイブリッド暗号化テスト', false, { error: error.message, stack: error.stack });
    }
    
    const duration = Date.now() - startTime;
    console.log(`📊 ハイブリッド暗号化テスト完了 (${duration}ms)`);
  }

  // 統合シナリオテスト
  async testIntegratedScenarios() {
    console.log('\n🎭 4. 統合シナリオテスト');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    
    try {
      // 4.1 空間作成〜入室シナリオ
      const testPassphrase = 'friendly-test-' + Date.now();
      
      if (window.API?.createSpace && window.API?.enterSpace) {
        // 空間作成
        await window.API.createSpace(testPassphrase);
        this.recordTest('空間作成', true, { passphrase: testPassphrase });
        
        // 空間入室
        const space = await window.API.enterSpace(testPassphrase);
        this.recordTest('空間入室', !!space && space.passphrase === testPassphrase, {
          spaceId: space ? space.id : null,
          passphrase: space ? space.passphrase : null
        });
        
        // 4.2 メッセージ送受信シナリオ
        if (space && window.API.sendMessageFriendly && window.API.loadMessagesFriendly) {
          const testMsg = 'FRIENDLYモード統合テストメッセージ';
          
          // メッセージ送信
          const sentMessage = await window.API.sendMessageFriendly(space.id, testMsg);
          this.recordTest('FRIENDLYメッセージ送信', !!sentMessage, {
            messageId: sentMessage ? sentMessage.id : null,
            encryptionType: sentMessage ? sentMessage.encryptionType : null,
            textLength: sentMessage ? sentMessage.text.length : 0
          });
          
          // メッセージ読み込み
          const messages = await window.API.loadMessagesFriendly(space.id);
          const ourMessage = messages.find(m => m.text === testMsg);
          this.recordTest('FRIENDLYメッセージ読み込み', !!ourMessage, {
            totalMessages: messages.length,
            foundTestMessage: !!ourMessage,
            encrypted: ourMessage ? ourMessage.encrypted : false
          });
        }
      }
      
      // 4.3 エラーハンドリングテスト
      try {
        await window.API.enterSpace('存在しない合言葉');
        this.recordTest('無効な合言葉エラーハンドリング', false, { note: 'エラーが発生すべきでした' });
      } catch (error) {
        this.recordTest('無効な合言葉エラーハンドリング', true, { error: error.message });
      }
      
    } catch (error) {
      this.recordTest('統合シナリオテスト', false, { error: error.message });
    }
    
    const duration = Date.now() - startTime;
    console.log(`📊 統合シナリオテスト完了 (${duration}ms)`);
  }

  // パフォーマンステスト
  async testPerformance() {
    console.log('\n⚡ 5. パフォーマンステスト');
    console.log('-'.repeat(40));
    
    const startTime = Date.now();
    
    try {
      const testSpaceId = 'perf-test-' + Date.now();
      const testPassphrase = 'perf-test-passphrase';
      
      // 5.1 キー生成速度
      const keyGenStart = performance.now();
      await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      const keyGenDuration = performance.now() - keyGenStart;
      
      this.recordTest('キー生成速度', keyGenDuration < 100, {
        duration: Math.round(keyGenDuration),
        threshold: '100ms',
        acceptable: keyGenDuration < 100
      }, Math.round(keyGenDuration));
      
      // 5.2 暗号化速度（決定的）
      const encryptStart = performance.now();
      const testMessage = 'パフォーマンステスト用メッセージ';
      const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
      const encryptDuration = performance.now() - encryptStart;
      
      this.recordTest('決定的暗号化速度', encryptDuration < 50, {
        duration: Math.round(encryptDuration),
        threshold: '50ms',
        messageLength: testMessage.length
      }, Math.round(encryptDuration));
      
      // 5.3 復号化速度
      const decryptStart = performance.now();
      const decrypted = await window.Crypto.decryptMessage(encrypted.encryptedData, encrypted.iv, testSpaceId);
      const decryptDuration = performance.now() - decryptStart;
      
      this.recordTest('決定的復号化速度', decryptDuration < 50, {
        duration: Math.round(decryptDuration),
        threshold: '50ms',
        success: decrypted === testMessage
      }, Math.round(decryptDuration));
      
      // 5.4 ハイブリッド暗号化速度
      if (window.Crypto.encryptMessageHybrid) {
        const hybridStart = performance.now();
        await window.Crypto.encryptMessageHybrid(testMessage, testSpaceId);
        const hybridDuration = performance.now() - hybridStart;
        
        this.recordTest('ハイブリッド暗号化速度', hybridDuration < 100, {
          duration: Math.round(hybridDuration),
          threshold: '100ms'
        }, Math.round(hybridDuration));
      }
      
    } catch (error) {
      this.recordTest('パフォーマンステスト', false, { error: error.message });
    }
    
    const duration = Date.now() - startTime;
    console.log(`📊 パフォーマンステスト完了 (${duration}ms)`);
  }

  // 最終結果レポート
  generateReport() {
    console.log('\n📋 FRIENDLYモード 完成度レポート');
    console.log('=' .repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = Math.round((passedTests / totalTests) * 100);
    const totalDuration = Date.now() - this.testStartTime;
    
    // 成功率による評価
    let grade, status, recommendations;
    
    if (successRate >= 95) {
      grade = 'A+';
      status = '🎉 完成度：優秀';
      recommendations = ['本番環境でのテストを実行', 'SECUREモードの開発に進む'];
    } else if (successRate >= 85) {
      grade = 'A';
      status = '✅ 完成度：良好';
      recommendations = ['細かい不具合を修正', '追加テストの実行'];
    } else if (successRate >= 70) {
      grade = 'B';
      status = '⚠️ 完成度：中程度';
      recommendations = ['主要な問題を解決', '機能の見直しが必要'];
    } else {
      grade = 'C';
      status = '❌ 完成度：要改善';
      recommendations = ['基盤システムの修正', '詳細なデバッグが必要'];
    }
    
    console.log(`📊 テスト結果: ${passedTests}/${totalTests} 成功 (${successRate}%)`);
    console.log(`🏆 評価: ${grade} - ${status}`);
    console.log(`⏱️ 実行時間: ${totalDuration}ms`);
    
    // 失敗したテストの詳細
    if (failedTests > 0) {
      console.log('\n❌ 失敗したテスト:');
      this.testResults.filter(r => !r.success).forEach(test => {
        console.log(`  • ${test.testName}: ${test.details.error || JSON.stringify(test.details)}`);
      });
    }
    
    // 推奨対応
    console.log('\n💡 推奨対応:');
    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
    
    // カテゴリ別結果
    console.log('\n📈 カテゴリ別結果:');
    const categories = {
      '基盤システム': ['暗号化', 'SessionManager', 'API'],
      'セッション管理': ['セッション'],
      'ハイブリッド暗号化': ['ハイブリッド', 'フォールバック'],
      '統合機能': ['空間', 'メッセージ', 'エラーハンドリング'],
      'パフォーマンス': ['速度', 'キー生成']
    };
    
    Object.entries(categories).forEach(([category, keywords]) => {
      const categoryTests = this.testResults.filter(test => 
        keywords.some(keyword => test.testName.includes(keyword))
      );
      const categoryPassed = categoryTests.filter(t => t.success).length;
      const categoryTotal = categoryTests.length;
      const categoryRate = categoryTotal > 0 ? Math.round((categoryPassed / categoryTotal) * 100) : 0;
      
      if (categoryTotal > 0) {
        console.log(`  • ${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);
      }
    });
    
    console.log('\n🏁 FRIENDLYモード完成度テスト完了');
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate,
      grade,
      status,
      recommendations,
      duration: totalDuration,
      results: this.testResults
    };
  }

  // 全テスト実行
  async runAllTests() {
    console.log('🚀 FRIENDLYモード 全テスト実行開始\n');
    
    await this.testFoundationSystems();
    await this.testSessionManagement();
    await this.testHybridEncryption();
    await this.testIntegratedScenarios();
    await this.testPerformance();
    
    return this.generateReport();
  }
}

// グローバル関数として登録
window.FriendlyModeTestSuite = FriendlyModeTestSuite;

// 便利関数
window.testFriendlyMode = async () => {
  const testSuite = new FriendlyModeTestSuite();
  return await testSuite.runAllTests();
};

window.quickFriendlyTest = async () => {
  console.log('🏃‍♂️ FRIENDLYモード クイックテスト');
  
  const results = [];
  
  // 基本機能確認
  results.push(['暗号化サポート', !!window.Crypto?.isSupported]);
  results.push(['SessionManager', !!window.SessionManager]);
  results.push(['FRIENDLY API', !!(window.API?.sendMessageFriendly && window.API?.loadMessagesFriendly)]);
  
  // 暗号化テスト
  try {
    const testResult = await window.Crypto?.testEncryption?.();
    results.push(['暗号化テスト', testResult?.success || false]);
  } catch (error) {
    results.push(['暗号化テスト', false]);
  }
  
  // 結果表示
  console.log('\n📋 クイックテスト結果:');
  results.forEach(([name, success]) => {
    console.log(`${success ? '✅' : '❌'} ${name}`);
  });
  
  const successCount = results.filter(([, success]) => success).length;
  const successRate = Math.round((successCount / results.length) * 100);
  
  console.log(`\n📊 成功率: ${successCount}/${results.length} (${successRate}%)`);
  
  if (successRate >= 75) {
    console.log('🎉 FRIENDLYモードは良好に動作しています！');
    console.log('💡 詳細テストを実行するには: testFriendlyMode()');
  } else {
    console.log('⚠️ 一部の機能に問題があります。詳細テストを実行してください。');
    console.log('🔧 詳細テストを実行するには: testFriendlyMode()');
  }
  
  return { successRate, results };
};

console.log('\n✅ FRIENDLYモード テストスイート準備完了');
console.log('📋 利用可能な関数:');
console.log('• testFriendlyMode() - 完全テスト実行');
console.log('• quickFriendlyTest() - クイックテスト実行');
console.log('• new FriendlyModeTestSuite() - カスタムテスト');

console.log('\n🚀 クイックテストを実行するには:');
console.log('quickFriendlyTest()');

console.log('\n🔬 完全テストを実行するには:');
console.log('testFriendlyMode()');