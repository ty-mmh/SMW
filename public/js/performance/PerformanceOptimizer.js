// public/js/performance/PerformanceOptimizer.js
// FRIENDLYモード パフォーマンス最適化システム

window.PerformanceOptimizer = {
  // パフォーマンス測定データ
  metrics: {
    encryption: [],
    ui: [],
    memory: [],
    network: []
  },
  
  // 最適化設定
  optimizations: {
    cryptoWorkerEnabled: false,
    uiDebounceEnabled: true,
    memoryCacheEnabled: true,
    lazyLoadingEnabled: true
  },

  /**
   * パフォーマンス監視開始
   */
  startMonitoring: () => {
    console.log('📊 FRIENDLYモード パフォーマンス監視開始');
    
    // 暗号化処理の監視
    window.PerformanceOptimizer.monitorCryptoPerformance();
    
    // UI応答性の監視
    window.PerformanceOptimizer.monitorUIPerformance();
    
    // メモリ使用量の監視
    window.PerformanceOptimizer.monitorMemoryUsage();
    
    // 定期レポート
    setInterval(() => {
      window.PerformanceOptimizer.generateReport();
    }, 30000); // 30秒ごと
    
    console.log('✅ パフォーマンス監視システム起動完了');
  },

  /**
   * 暗号化パフォーマンス監視
   */
  monitorCryptoPerformance: () => {
    // 既存の暗号化関数をラップ
    if (window.Crypto && window.Crypto.encryptMessage) {
      const originalEncrypt = window.Crypto.encryptMessage;
      
      window.Crypto.encryptMessage = async function(message, spaceId) {
        const startTime = performance.now();
        const startMemory = window.performance?.memory?.usedJSHeapSize || 0;
        
        try {
          const result = await originalEncrypt.call(this, message, spaceId);
          const duration = performance.now() - startTime;
          const memoryDelta = (window.performance?.memory?.usedJSHeapSize || 0) - startMemory;
          
          window.PerformanceOptimizer.metrics.encryption.push({
            type: 'encrypt',
            duration,
            messageLength: message.length,
            memoryDelta,
            timestamp: Date.now(),
            spaceId
          });
          
          // 異常に遅い場合は警告
          if (duration > 500) {
            console.warn('⚠️ 暗号化処理が遅延:', {
              duration: duration.toFixed(2) + 'ms',
              messageLength: message.length,
              spaceId
            });
          }
          
          return result;
        } catch (error) {
          console.error('❌ 暗号化処理エラー:', error);
          throw error;
        }
      };
    }

    // 復号化監視
    if (window.Crypto && window.Crypto.decryptMessage) {
      const originalDecrypt = window.Crypto.decryptMessage;
      
      window.Crypto.decryptMessage = async function(encryptedData, iv, spaceId) {
        const startTime = performance.now();
        
        try {
          const result = await originalDecrypt.call(this, encryptedData, iv, spaceId);
          const duration = performance.now() - startTime;
          
          window.PerformanceOptimizer.metrics.encryption.push({
            type: 'decrypt',
            duration,
            encryptedLength: encryptedData.length,
            timestamp: Date.now(),
            spaceId
          });
          
          return result;
        } catch (error) {
          console.error('❌ 復号化処理エラー:', error);
          throw error;
        }
      };
    }
  },

  /**
   * UI応答性監視
   */
  monitorUIPerformance: () => {
    // React レンダリング時間の測定
    let renderStartTime = 0;
    
    // フレームレート監視
    let frameCount = 0;
    let lastFrameTime = performance.now();
    
    function measureFrameRate() {
      const now = performance.now();
      frameCount++;
      
      if (now - lastFrameTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
        
        window.PerformanceOptimizer.metrics.ui.push({
          type: 'fps',
          value: fps,
          timestamp: Date.now()
        });
        
        // 低FPSの警告
        if (fps < 30) {
          console.warn('⚠️ UI応答性低下:', { fps });
        }
        
        frameCount = 0;
        lastFrameTime = now;
      }
      
      requestAnimationFrame(measureFrameRate);
    }
    
    requestAnimationFrame(measureFrameRate);
    
    // 入力遅延の測定
    document.addEventListener('input', (e) => {
      const startTime = performance.now();
      
      setTimeout(() => {
        const delay = performance.now() - startTime;
        window.PerformanceOptimizer.metrics.ui.push({
          type: 'input_delay',
          value: delay,
          element: e.target.tagName,
          timestamp: Date.now()
        });
      }, 0);
    });
  },

  /**
   * メモリ使用量監視
   */
  monitorMemoryUsage: () => {
    if (!window.performance || !window.performance.memory) {
      console.warn('⚠️ Memory API not available');
      return;
    }
    
    setInterval(() => {
      const memory = window.performance.memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
      
      window.PerformanceOptimizer.metrics.memory.push({
        usedMB: parseFloat(usedMB.toFixed(2)),
        totalMB: parseFloat(totalMB.toFixed(2)),
        limitMB: parseFloat(limitMB.toFixed(2)),
        usage: parseFloat((usedMB / limitMB * 100).toFixed(2)),
        timestamp: Date.now()
      });
      
      // メモリ使用量が高い場合の警告
      if (usedMB / limitMB > 0.8) {
        console.warn('⚠️ メモリ使用量が高くなっています:', {
          used: usedMB.toFixed(2) + 'MB',
          limit: limitMB.toFixed(2) + 'MB',
          usage: (usedMB / limitMB * 100).toFixed(1) + '%'
        });
        
        // 自動最適化を試行
        window.PerformanceOptimizer.autoOptimizeMemory();
      }
    }, 5000); // 5秒ごと
  },

  /**
   * パフォーマンス最適化実行
   */
  applyOptimizations: () => {
    console.log('⚡ パフォーマンス最適化を適用中...');
    
    // 1. 暗号化処理の最適化
    window.PerformanceOptimizer.optimizeCrypto();
    
    // 2. UI応答性の最適化
    window.PerformanceOptimizer.optimizeUI();
    
    // 3. メモリ使用量の最適化
    window.PerformanceOptimizer.optimizeMemory();
    
    // 4. ネットワーク通信の最適化
    window.PerformanceOptimizer.optimizeNetwork();
    
    console.log('✅ パフォーマンス最適化完了');
  },

  /**
   * 暗号化処理最適化
   */
  optimizeCrypto: () => {
    // キーキャッシュの最適化
    if (window.Crypto && window.Crypto.spaceKeys) {
      // 古いキーの削除（1時間以上未使用）
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      
      for (const [spaceId, keyInfo] of window.Crypto.spaceKeys) {
        if (keyInfo.lastUsed && keyInfo.lastUsed.getTime() < oneHourAgo) {
          console.log(`🗑️ 古い暗号化キーを削除: ${spaceId}`);
          window.Crypto.spaceKeys.delete(spaceId);
        }
      }
    }
    
    // バッチ暗号化の実装（複数メッセージを一度に処理）
    window.Crypto.encryptBatch = async (messages, spaceId) => {
      const results = [];
      const sharedKey = window.Crypto.spaceKeys.get(spaceId)?.sharedKey;
      
      if (!sharedKey) {
        throw new Error('Space key not found');
      }
      
      for (const message of messages) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        
        const encryptedBuffer = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv, tagLength: 128 },
          sharedKey,
          data
        );
        
        results.push({
          encryptedData: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
          iv: btoa(String.fromCharCode(...iv)),
          algorithm: 'AES-GCM-256'
        });
      }
      
      return results;
    };
    
    console.log('✅ 暗号化処理最適化完了');
  },

  /**
   * UI応答性最適化
   */
  optimizeUI: () => {
    // メッセージ表示の仮想化（大量メッセージ対応）
    window.VirtualizedMessageList = (messages, containerHeight = 400) => {
      const [startIndex, setStartIndex] = React.useState(0);
      const [endIndex, setEndIndex] = React.useState(10);
      const itemHeight = 80; // 1メッセージあたりの高さ
      
      React.useEffect(() => {
        const handleScroll = window.Utils.throttle((e) => {
          const scrollTop = e.target.scrollTop;
          const newStartIndex = Math.floor(scrollTop / itemHeight);
          const visibleCount = Math.ceil(containerHeight / itemHeight);
          
          setStartIndex(newStartIndex);
          setEndIndex(Math.min(newStartIndex + visibleCount + 2, messages.length));
        }, 16); // 60fps
        
        return handleScroll;
      }, [messages.length]);
      
      const visibleMessages = messages.slice(startIndex, endIndex);
      const totalHeight = messages.length * itemHeight;
      const offsetY = startIndex * itemHeight;
      
      return {
        visibleMessages,
        totalHeight,
        offsetY,
        containerProps: {
          style: { height: containerHeight + 'px', overflow: 'auto' }
        }
      };
    };
    
    // 入力デバウンスの強化
    window.Utils.smartDebounce = (func, delay, immediate = false) => {
      let timeout;
      let lastArgs;
      
      return function executedFunction(...args) {
        lastArgs = args;
        
        const later = () => {
          timeout = null;
          if (!immediate) func.apply(this, lastArgs);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
        
        if (callNow) func.apply(this, args);
      };
    };
    
    console.log('✅ UI応答性最適化完了');
  },

  /**
   * メモリ使用量最適化
   */
  optimizeMemory: () => {
    // メッセージキャッシュの最適化
    if (window.API && window.API.messageCache) {
      const maxCacheSize = 100; // 最大100メッセージ
      const cache = window.API.messageCache;
      
      if (cache.size > maxCacheSize) {
        const entries = Array.from(cache.entries());
        const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = sorted.slice(0, sorted.length - maxCacheSize);
        
        toDelete.forEach(([key]) => cache.delete(key));
        console.log(`🗑️ メッセージキャッシュ整理: ${toDelete.length}件削除`);
      }
    }
    
    // ガベージコレクションの推奨
    if (window.gc) {
      window.gc();
      console.log('🗑️ ガベージコレクション実行');
    }
    
    console.log('✅ メモリ最適化完了');
  },

  /**
   * 自動メモリ最適化
   */
  autoOptimizeMemory: () => {
    // 暗号化キーキャッシュの削除
    if (window.Crypto && window.Crypto.spaceKeys) {
      const keysToDelete = [];
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      
      for (const [spaceId, keyInfo] of window.Crypto.spaceKeys) {
        if (keyInfo.lastUsed && keyInfo.lastUsed.getTime() < fiveMinutesAgo) {
          keysToDelete.push(spaceId);
        }
      }
      
      keysToDelete.forEach(spaceId => {
        window.Crypto.spaceKeys.delete(spaceId);
      });
      
      if (keysToDelete.length > 0) {
        console.log(`🗑️ 自動メモリ最適化: ${keysToDelete.length}個のキーを削除`);
      }
    }
  },

  /**
   * ネットワーク通信最適化
   */
  optimizeNetwork: () => {
    // メッセージ送信のバッチ化
    let messageQueue = [];
    let batchTimeout = null;
    
    window.API.queueMessage = (message, spaceId) => {
      messageQueue.push({ message, spaceId, timestamp: Date.now() });
      
      if (batchTimeout) {
        clearTimeout(batchTimeout);
      }
      
      batchTimeout = setTimeout(async () => {
        if (messageQueue.length > 0) {
          await window.API.sendMessageBatch(messageQueue);
          messageQueue = [];
        }
      }, 100); // 100ms後にバッチ送信
    };
    
    console.log('✅ ネットワーク最適化完了');
  },

  /**
   * パフォーマンスレポート生成
   */
  generateReport: () => {
    const { metrics } = window.PerformanceOptimizer;
    
    // 暗号化パフォーマンス
    const encryptionTimes = metrics.encryption
      .filter(m => m.timestamp > Date.now() - 60000) // 直近1分
      .map(m => m.duration);
    
    const avgEncryptionTime = encryptionTimes.length > 0 ? 
      encryptionTimes.reduce((a, b) => a + b, 0) / encryptionTimes.length : 0;
    
    // UI パフォーマンス
    const recentFPS = metrics.ui
      .filter(m => m.type === 'fps' && m.timestamp > Date.now() - 60000)
      .map(m => m.value);
    
    const avgFPS = recentFPS.length > 0 ? 
      recentFPS.reduce((a, b) => a + b, 0) / recentFPS.length : 0;
    
    // メモリ使用量
    const latestMemory = metrics.memory[metrics.memory.length - 1];
    
    const report = {
      timestamp: new Date().toISOString(),
      encryption: {
        avgTime: avgEncryptionTime.toFixed(2) + 'ms',
        operations: encryptionTimes.length,
        status: avgEncryptionTime < 50 ? 'excellent' : avgEncryptionTime < 100 ? 'good' : 'poor'
      },
      ui: {
        avgFPS: avgFPS.toFixed(1),
        status: avgFPS > 50 ? 'excellent' : avgFPS > 30 ? 'good' : 'poor'
      },
      memory: {
        current: latestMemory ? latestMemory.usedMB + 'MB' : 'N/A',
        usage: latestMemory ? latestMemory.usage + '%' : 'N/A',
        status: !latestMemory ? 'unknown' : 
          latestMemory.usage < 50 ? 'excellent' : 
          latestMemory.usage < 80 ? 'good' : 'high'
      }
    };
    
    if (window.DEBUG_MODE) {
      console.log('📊 パフォーマンスレポート:', report);
    }
    
    return report;
  },

  /**
   * ベンチマークテスト実行
   */
  runBenchmark: async () => {
    console.log('🏁 FRIENDLYモード ベンチマークテスト開始');
    
    const results = {
      encryption: await window.PerformanceOptimizer.benchmarkEncryption(),
      ui: await window.PerformanceOptimizer.benchmarkUI(),
      memory: await window.PerformanceOptimizer.benchmarkMemory()
    };
    
    console.log('🏁 ベンチマークテスト完了:', results);
    return results;
  },

  /**
   * 暗号化ベンチマーク
   */
  benchmarkEncryption: async () => {
    const testSpaceId = 'benchmark-' + Date.now();
    const testPassphrase = 'benchmark-pass';
    const testMessage = 'ベンチマークテストメッセージ'.repeat(10); // 長めのメッセージ
    
    try {
      await window.Crypto.getOrCreateSpaceKey(testSpaceId, testPassphrase);
      
      const iterations = 50;
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const encrypted = await window.Crypto.encryptMessage(testMessage, testSpaceId);
        await window.Crypto.decryptMessage(encrypted.encryptedData, encrypted.iv, testSpaceId);
        
        times.push(performance.now() - start);
      }
      
      window.Crypto.forceCleanupSpaceKey(testSpaceId);
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      return {
        iterations,
        avgTime: avgTime.toFixed(2) + 'ms',
        minTime: minTime.toFixed(2) + 'ms',
        maxTime: maxTime.toFixed(2) + 'ms',
        throughput: (1000 / avgTime).toFixed(1) + ' ops/sec'
      };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * UIベンチマーク
   */
  benchmarkUI: async () => {
    return new Promise((resolve) => {
      let frameCount = 0;
      let startTime = performance.now();
      
      function countFrames() {
        frameCount++;
        
        if (frameCount >= 60) {
          const endTime = performance.now();
          const duration = endTime - startTime;
          const fps = (frameCount / duration) * 1000;
          
          resolve({
            frames: frameCount,
            duration: duration.toFixed(2) + 'ms',
            fps: fps.toFixed(1)
          });
        } else {
          requestAnimationFrame(countFrames);
        }
      }
      
      requestAnimationFrame(countFrames);
    });
  },

  /**
   * メモリベンチマーク
   */
  benchmarkMemory: async () => {
    if (!window.performance || !window.performance.memory) {
      return { error: 'Memory API not available' };
    }
    
    const initialMemory = window.performance.memory.usedJSHeapSize;
    
    // メモリを意図的に使用
    const testData = [];
    for (let i = 0; i < 1000; i++) {
      testData.push({
        id: 'test-' + i,
        data: 'A'.repeat(1000),
        timestamp: Date.now()
      });
    }
    
    const peakMemory = window.performance.memory.usedJSHeapSize;
    
    // クリーンアップ
    testData.length = 0;
    
    // ガベージコレクションを待つ
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const finalMemory = window.performance.memory.usedJSHeapSize;
    
    return {
      initial: (initialMemory / 1024 / 1024).toFixed(2) + 'MB',
      peak: (peakMemory / 1024 / 1024).toFixed(2) + 'MB',
      final: (finalMemory / 1024 / 1024).toFixed(2) + 'MB',
      allocated: ((peakMemory - initialMemory) / 1024 / 1024).toFixed(2) + 'MB',
      cleaned: ((peakMemory - finalMemory) / 1024 / 1024).toFixed(2) + 'MB'
    };
  }
};

// デバッグ用ヘルパー
window.startPerformanceMonitoring = () => window.PerformanceOptimizer.startMonitoring();
window.optimizePerformance = () => window.PerformanceOptimizer.applyOptimizations();
window.benchmarkFriendlyMode = () => window.PerformanceOptimizer.runBenchmark();
window.getPerformanceReport = () => window.PerformanceOptimizer.generateReport();

console.log('✅ Performance Optimizer loaded');
console.log('⚡ 使用方法:');
console.log('  window.startPerformanceMonitoring() - 監視開始');
console.log('  window.optimizePerformance() - 最適化実行');
console.log('  window.benchmarkFriendlyMode() - ベンチマーク実行');
console.log('  window.getPerformanceReport() - レポート取得');