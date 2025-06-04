// MemoryPerformanceManager.js - FRIENDLYモード メモリリーク防止・パフォーマンス統合管理
// メモリ使用量監視、自動クリーンアップ、最適化タイミング制御

console.log('⚡ FRIENDLYモード メモリ・パフォーマンス統合管理 読み込み開始');

window.MemoryPerformanceManager = {
  // メモリ管理状態
  memoryState: {
    tracked: new Map(), // trackingId -> resourceInfo
    cleanupCallbacks: new Map(), // trackingId -> cleanupFunction
    memorySnapshots: [],
    leakDetections: [],
    lastGarbageCollection: null,
    peakUsage: 0
  },
  
  // パフォーマンス管理状態
  performanceState: {
    optimizationTriggers: new Map(), // triggerName -> triggerInfo
    autoOptimizationEnabled: false,
    optimizationHistory: [],
    lastOptimization: null,
    scheduledOptimizations: new Map() // optimizationId -> timeoutId
  },
  
  // 設定
  config: {
    memoryCheckInterval: 30000, // 30秒
    memoryThreshold: 0.8, // 80%でアラート
    criticalMemoryThreshold: 0.9, // 90%で強制クリーンアップ
    autoOptimizationInterval: 300000, // 5分
    performanceSnapshotInterval: 60000, // 1分
    maxMemorySnapshots: 20,
    enabledOptimizations: ['crypto', 'ui', 'memory', 'network']
  },
  
  /**
   * メモリ・パフォーマンス統合管理初期化
   */
  initialize: () => {
    window.Utils.log('info', 'メモリ・パフォーマンス統合管理初期化開始');
    
    // メモリ監視開始
    window.MemoryPerformanceManager.startMemoryMonitoring();
    
    // パフォーマンス監視開始
    window.MemoryPerformanceManager.startPerformanceMonitoring();
    
    // 自動最適化設定
    window.MemoryPerformanceManager.setupAutoOptimization();
    
    // React開発ツール対応（開発環境のみ）
    if (window.DEBUG_MODE) {
      window.MemoryPerformanceManager.setupReactDevToolsIntegration();
    }
    
    // ページ閉じ時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      window.MemoryPerformanceManager.performEmergencyCleanup();
    });
    
    // ページ非表示時の最適化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.MemoryPerformanceManager.performBackgroundOptimization();
      }
    });
    
    window.Utils.log('success', 'メモリ・パフォーマンス統合管理初期化完了');
  },
  
  /**
   * メモリ監視開始
   */
  startMemoryMonitoring: () => {
    if (!window.performance || !window.performance.memory) {
      window.Utils.log('warn', 'Memory API未対応のため、メモリ監視をスキップ');
      return;
    }
    
    const memoryMonitorInterval = setInterval(() => {
      window.MemoryPerformanceManager.checkMemoryUsage();
    }, window.MemoryPerformanceManager.config.memoryCheckInterval);
    
    // クリーンアップ登録
    window.MemoryPerformanceManager.trackResource('memoryMonitorInterval', {
      type: 'interval',
      resource: memoryMonitorInterval,
      description: 'メモリ監視インターバル'
    }, () => clearInterval(memoryMonitorInterval));
    
    // 初回チェック
    window.MemoryPerformanceManager.checkMemoryUsage();
    
    window.Utils.log('success', 'メモリ監視開始');
  },
  
  /**
   * パフォーマンス監視開始
   */
  startPerformanceMonitoring: () => {
    // 既存のPerformanceOptimizerとの統合
    if (window.PerformanceOptimizer) {
      window.PerformanceOptimizer.startMonitoring();
      
      // 定期スナップショット
      const perfSnapshotInterval = setInterval(() => {
        const report = window.PerformanceOptimizer.generateReport();
        window.MemoryPerformanceManager.analyzePerformanceReport(report);
      }, window.MemoryPerformanceManager.config.performanceSnapshotInterval);
      
      window.MemoryPerformanceManager.trackResource('perfSnapshotInterval', {
        type: 'interval',
        resource: perfSnapshotInterval,
        description: 'パフォーマンススナップショット'
      }, () => clearInterval(perfSnapshotInterval));
    }
    
    // 最適化トリガー設定
    window.MemoryPerformanceManager.setupOptimizationTriggers();
    
    window.Utils.log('success', 'パフォーマンス監視開始');
  },
  
  /**
   * メモリ使用量チェック
   */
  checkMemoryUsage: () => {
    const memInfo = window.performance.memory;
    const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;
    const limitMB = memInfo.jsHeapSizeLimit / 1024 / 1024;
    const usage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
    
    // スナップショット保存
    const snapshot = {
      timestamp: new Date(),
      usedMB: parseFloat(usedMB.toFixed(2)),
      limitMB: parseFloat(limitMB.toFixed(2)),
      usage: parseFloat((usage * 100).toFixed(2)),
      activeResources: window.MemoryPerformanceManager.memoryState.tracked.size
    };
    
    window.MemoryPerformanceManager.memoryState.memorySnapshots.push(snapshot);
    
    // スナップショット数制限
    if (window.MemoryPerformanceManager.memoryState.memorySnapshots.length > 
        window.MemoryPerformanceManager.config.maxMemorySnapshots) {
      window.MemoryPerformanceManager.memoryState.memorySnapshots = 
        window.MemoryPerformanceManager.memoryState.memorySnapshots.slice(-window.MemoryPerformanceManager.config.maxMemorySnapshots);
    }
    
    // ピーク使用量更新
    if (usedMB > window.MemoryPerformanceManager.memoryState.peakUsage) {
      window.MemoryPerformanceManager.memoryState.peakUsage = usedMB;
    }
    
    // メモリリーク検出
    window.MemoryPerformanceManager.detectMemoryLeaks();
    
    // 閾値チェック
    if (usage >= window.MemoryPerformanceManager.config.criticalMemoryThreshold) {
      window.MemoryPerformanceManager.performEmergencyCleanup();
    } else if (usage >= window.MemoryPerformanceManager.config.memoryThreshold) {
      window.MemoryPerformanceManager.performPreventiveCleanup();
    }
    
    window.Utils.log('debug', 'メモリ使用量チェック', {
      used: usedMB.toFixed(2) + 'MB',
      usage: (usage * 100).toFixed(1) + '%',
      peak: window.MemoryPerformanceManager.memoryState.peakUsage.toFixed(2) + 'MB'
    });
  },
  
  /**
   * メモリリーク検出
   */
  detectMemoryLeaks: () => {
    const snapshots = window.MemoryPerformanceManager.memoryState.memorySnapshots;
    if (snapshots.length < 5) return; // 最低5つのスナップショットが必要
    
    const recent = snapshots.slice(-5);
    const growthTrend = recent.every((snapshot, index) => {
      if (index === 0) return true;
      return snapshot.usedMB > recent[index - 1].usedMB;
    });
    
    if (growthTrend) {
      const totalGrowth = recent[recent.length - 1].usedMB - recent[0].usedMB;
      if (totalGrowth > 10) { // 10MB以上の増加
        const leakDetection = {
          timestamp: new Date(),
          totalGrowth: totalGrowth.toFixed(2) + 'MB',
          timeSpan: recent[recent.length - 1].timestamp - recent[0].timestamp,
          activeResources: window.MemoryPerformanceManager.memoryState.tracked.size,
          suspectedCategories: window.MemoryPerformanceManager.identifySuspectedLeakSources()
        };
        
        window.MemoryPerformanceManager.memoryState.leakDetections.push(leakDetection);
        
        window.Utils.log('warn', 'メモリリーク疑いを検出', leakDetection);
        
        // エラー表示システムに通知
        if (window.UnifiedErrorDisplay) {
          window.UnifiedErrorDisplay.addError({
            id: `memory_leak_${Date.now()}`,
            type: 'memory_leak',
            category: 'memory',
            severity: 'medium',
            title: 'メモリリーク疑い',
            message: `${totalGrowth.toFixed(1)}MBのメモリ増加を検出しました`,
            details: leakDetection,
            autoRecover: true,
            persistent: false
          });
        }
      }
    }
  },
  
  /**
   * 疑われるリークソース特定
   */
  identifySuspectedLeakSources: () => {
    const suspects = [];
    
    // 追跡中リソースの分析
    for (const [trackingId, resourceInfo] of window.MemoryPerformanceManager.memoryState.tracked) {
      const age = Date.now() - resourceInfo.createdAt;
      if (age > 600000) { // 10分以上存在
        suspects.push({
          type: resourceInfo.type,
          description: resourceInfo.description,
          age: Math.floor(age / 60000) + '分'
        });
      }
    }
    
    // FRIENDLYモード関連の潜在的リーク源
    if (window.Crypto?.spaceKeys?.size > 5) {
      suspects.push({
        type: 'crypto_keys',
        description: '暗号化キーの蓄積',
        count: window.Crypto.spaceKeys.size
      });
    }
    
    if (window.SessionManager?.activeSessions?.size > 10) {
      suspects.push({
        type: 'sessions',
        description: 'セッション管理の蓄積',
        count: window.SessionManager.activeSessions.size
      });
    }
    
    return suspects;
  },
  
  /**
   * リソース追跡登録
   * @param {string} trackingId 追跡ID
   * @param {Object} resourceInfo リソース情報
   * @param {Function} cleanupCallback クリーンアップ関数
   */
  trackResource: (trackingId, resourceInfo, cleanupCallback) => {
    window.MemoryPerformanceManager.memoryState.tracked.set(trackingId, {
      ...resourceInfo,
      createdAt: Date.now(),
      trackingId
    });
    
    if (cleanupCallback) {
      window.MemoryPerformanceManager.memoryState.cleanupCallbacks.set(trackingId, cleanupCallback);
    }
    
    window.Utils.log('debug', 'リソース追跡登録', {
      trackingId,
      type: resourceInfo.type,
      total: window.MemoryPerformanceManager.memoryState.tracked.size
    });
  },
  
  /**
   * リソース追跡解除
   * @param {string} trackingId 追跡ID
   */
  untrackResource: (trackingId) => {
    const cleanupCallback = window.MemoryPerformanceManager.memoryState.cleanupCallbacks.get(trackingId);
    if (cleanupCallback) {
      try {
        cleanupCallback();
      } catch (error) {
        window.Utils.log('error', 'リソースクリーンアップエラー', {
          trackingId,
          error: error.message
        });
      }
      window.MemoryPerformanceManager.memoryState.cleanupCallbacks.delete(trackingId);
    }
    
    window.MemoryPerformanceManager.memoryState.tracked.delete(trackingId);
    
    window.Utils.log('debug', 'リソース追跡解除', { trackingId });
  },
  
  /**
   * 予防的クリーンアップ
   */
  performPreventiveCleanup: () => {
    window.Utils.log('info', '予防的メモリクリーンアップ開始');
    
    let cleanedCount = 0;
    
    // 古いリソースのクリーンアップ
    const tenMinutesAgo = Date.now() - 600000;
    for (const [trackingId, resourceInfo] of window.MemoryPerformanceManager.memoryState.tracked) {
      if (resourceInfo.createdAt < tenMinutesAgo && resourceInfo.type !== 'persistent') {
        window.MemoryPerformanceManager.untrackResource(trackingId);
        cleanedCount++;
      }
    }
    
    // FRIENDLYモード関連クリーンアップ
    window.MemoryPerformanceManager.cleanupFriendlyModeResources(false);
    
    // ガベージコレクション推奨
    if (window.gc) {
      window.gc();
      window.MemoryPerformanceManager.memoryState.lastGarbageCollection = new Date();
    }
    
    window.Utils.log('success', '予防的クリーンアップ完了', { cleanedCount });
  },
  
  /**
   * 緊急クリーンアップ
   */
  performEmergencyCleanup: () => {
    window.Utils.log('warn', '緊急メモリクリーンアップ開始');
    
    let cleanedCount = 0;
    
    // 全ての非永続リソースをクリーンアップ
    for (const [trackingId, resourceInfo] of window.MemoryPerformanceManager.memoryState.tracked) {
      if (resourceInfo.type !== 'persistent' && resourceInfo.type !== 'critical') {
        window.MemoryPerformanceManager.untrackResource(trackingId);
        cleanedCount++;
      }
    }
    
    // FRIENDLYモード関連の強制クリーンアップ
    window.MemoryPerformanceManager.cleanupFriendlyModeResources(true);
    
    // メモリスナップショットの削減
    window.MemoryPerformanceManager.memoryState.memorySnapshots = 
      window.MemoryPerformanceManager.memoryState.memorySnapshots.slice(-5);
    
    // 強制ガベージコレクション
    if (window.gc) {
      window.gc();
      window.MemoryPerformanceManager.memoryState.lastGarbageCollection = new Date();
    }
    
    window.Utils.log('warn', '緊急クリーンアップ完了', { cleanedCount });
    
    // 緊急クリーンアップ通知
    if (window.UnifiedErrorDisplay) {
      window.UnifiedErrorDisplay.addError({
        id: `emergency_cleanup_${Date.now()}`,
        type: 'emergency_cleanup',
        category: 'memory',
        severity: 'high',
        title: '緊急メモリクリーンアップ',
        message: `メモリ使用量が危険レベルに達したため、緊急クリーンアップを実行しました`,
        details: { cleanedCount },
        autoRecover: false,
        persistent: false
      });
    }
  },
  
  /**
   * FRIENDLYモード関連リソースクリーンアップ
   * @param {boolean} aggressive 強制的なクリーンアップ
   */
  cleanupFriendlyModeResources: (aggressive = false) => {
    let cleanedItems = 0;
    
    // 暗号化キーキャッシュクリーンアップ
    if (window.Crypto && window.Crypto.spaceKeys) {
      const fiveMinutesAgo = Date.now() - (aggressive ? 60000 : 300000);
      const keysToDelete = [];
      
      for (const [spaceId, keyInfo] of window.Crypto.spaceKeys) {
        if (keyInfo.lastUsed && keyInfo.lastUsed.getTime() < fiveMinutesAgo) {
          keysToDelete.push(spaceId);
        }
      }
      
      keysToDelete.forEach(spaceId => {
        if (aggressive || !window.API.currentSpaceId || window.API.currentSpaceId !== spaceId) {
          window.Crypto.spaceKeys.delete(spaceId);
          cleanedItems++;
        }
      });
    }
    
    // パフォーマンスデータクリーンアップ
    if (window.PerformanceOptimizer && window.PerformanceOptimizer.metrics) {
      const metrics = window.PerformanceOptimizer.metrics;
      Object.keys(metrics).forEach(category => {
        if (Array.isArray(metrics[category])) {
          const keepCount = aggressive ? 10 : 50;
          if (metrics[category].length > keepCount) {
            metrics[category] = metrics[category].slice(-keepCount);
            cleanedItems++;
          }
        }
      });
    }
    
    // エラー履歴クリーンアップ
    if (window.UnifiedErrorDisplay && aggressive) {
      const originalCount = window.UnifiedErrorDisplay.errorState.errorHistory.length;
      window.UnifiedErrorDisplay.errorState.errorHistory = 
        window.UnifiedErrorDisplay.errorState.errorHistory.slice(-20);
      cleanedItems += originalCount - window.UnifiedErrorDisplay.errorState.errorHistory.length;
    }
    
    if (cleanedItems > 0) {
      window.Utils.log('info', 'FRIENDLYモードリソースクリーンアップ', { 
        cleanedItems, 
        aggressive 
      });
    }
  },
  
  /**
   * 最適化トリガー設定
   */
  setupOptimizationTriggers: () => {
    // メモリ使用量トリガー
    window.MemoryPerformanceManager.performanceState.optimizationTriggers.set('memory_usage', {
      condition: () => {
        if (!window.performance || !window.performance.memory) return false;
        const usage = window.performance.memory.usedJSHeapSize / window.performance.memory.jsHeapSizeLimit;
        return usage > 0.7; // 70%を超えたら最適化
      },
      action: () => window.MemoryPerformanceManager.triggerOptimization('memory_pressure'),
      lastTriggered: null,
      cooldown: 120000 // 2分間のクールダウン
    });
    
    // 暗号化パフォーマンストリガー
    window.MemoryPerformanceManager.performanceState.optimizationTriggers.set('encryption_performance', {
      condition: () => {
        if (!window.PerformanceOptimizer || !window.PerformanceOptimizer.metrics.encryption) return false;
        const recentEncryptions = window.PerformanceOptimizer.metrics.encryption
          .filter(e => e.timestamp > Date.now() - 60000); // 過去1分
        if (recentEncryptions.length === 0) return false;
        const avgTime = recentEncryptions.reduce((sum, e) => sum + e.duration, 0) / recentEncryptions.length;
        return avgTime > 100; // 100ms超えで最適化
      },
      action: () => window.MemoryPerformanceManager.triggerOptimization('encryption_slowdown'),
      lastTriggered: null,
      cooldown: 300000 // 5分間のクールダウン
    });
    
    // UI応答性トリガー
    window.MemoryPerformanceManager.performanceState.optimizationTriggers.set('ui_performance', {
      condition: () => {
        if (!window.PerformanceOptimizer || !window.PerformanceOptimizer.metrics.ui) return false;
        const recentFPS = window.PerformanceOptimizer.metrics.ui
          .filter(u => u.type === 'fps' && u.timestamp > Date.now() - 30000)
          .map(u => u.value);
        if (recentFPS.length === 0) return false;
        const avgFPS = recentFPS.reduce((sum, fps) => sum + fps, 0) / recentFPS.length;
        return avgFPS < 40; // 40FPS未満で最適化
      },
      action: () => window.MemoryPerformanceManager.triggerOptimization('ui_lag'),
      lastTriggered: null,
      cooldown: 180000 // 3分間のクールダウン
    });
  },
  
  /**
   * 自動最適化設定
   */
  setupAutoOptimization: () => {
    if (!window.MemoryPerformanceManager.performanceState.autoOptimizationEnabled) return;
    
    const autoOptimizationInterval = setInterval(() => {
      window.MemoryPerformanceManager.checkOptimizationTriggers();
    }, 30000); // 30秒ごとにチェック
    
    window.MemoryPerformanceManager.trackResource('autoOptimizationInterval', {
      type: 'interval',
      resource: autoOptimizationInterval,
      description: '自動最適化チェック'
    }, () => clearInterval(autoOptimizationInterval));
    
    // 定期最適化
    const periodicOptimizationInterval = setInterval(() => {
      window.MemoryPerformanceManager.triggerOptimization('periodic');
    }, window.MemoryPerformanceManager.config.autoOptimizationInterval);
    
    window.MemoryPerformanceManager.trackResource('periodicOptimizationInterval', {
      type: 'interval',
      resource: periodicOptimizationInterval,
      description: '定期最適化'
    }, () => clearInterval(periodicOptimizationInterval));
    
    window.Utils.log('success', '自動最適化設定完了');
  },
  
  /**
   * 最適化トリガーチェック
   */
  checkOptimizationTriggers: () => {
    for (const [triggerName, trigger] of window.MemoryPerformanceManager.performanceState.optimizationTriggers) {
      try {
        // クールダウン時間チェック
        if (trigger.lastTriggered && 
            Date.now() - trigger.lastTriggered.getTime() < trigger.cooldown) {
          continue;
        }
        
        // 条件チェック
        if (trigger.condition()) {
          trigger.lastTriggered = new Date();
          trigger.action();
          
          window.Utils.log('info', `最適化トリガー発動: ${triggerName}`);
        }
      } catch (error) {
        window.Utils.log('error', `最適化トリガーエラー: ${triggerName}`, {
          error: error.message
        });
      }
    }
  },
  
  /**
   * 最適化実行
   * @param {string} reason 最適化理由
   */
  triggerOptimization: (reason) => {
    if (window.MemoryPerformanceManager.performanceState.lastOptimization &&
        Date.now() - window.MemoryPerformanceManager.performanceState.lastOptimization.getTime() < 60000) {
      window.Utils.log('debug', '最適化スキップ（クールダウン中）', { reason });
      return;
    }
    
    window.Utils.log('info', '自動最適化開始', { reason });
    
    const optimizationStart = performance.now();
    let optimizationsApplied = [];
    
    try {
      // PerformanceOptimizerとの連携
      if (window.PerformanceOptimizer && window.MemoryPerformanceManager.config.enabledOptimizations.includes('memory')) {
        window.PerformanceOptimizer.optimizeMemory();
        optimizationsApplied.push('memory');
      }
      
      if (window.PerformanceOptimizer && window.MemoryPerformanceManager.config.enabledOptimizations.includes('crypto')) {
        window.PerformanceOptimizer.optimizeCrypto();
        optimizationsApplied.push('crypto');
      }
      
      if (window.PerformanceOptimizer && window.MemoryPerformanceManager.config.enabledOptimizations.includes('ui')) {
        window.PerformanceOptimizer.optimizeUI();
        optimizationsApplied.push('ui');
      }
      
      // FRIENDLYモード固有の最適化
      window.MemoryPerformanceManager.performPreventiveCleanup();
      optimizationsApplied.push('friendly_cleanup');
      
      const optimizationDuration = performance.now() - optimizationStart;
      
      window.MemoryPerformanceManager.performanceState.lastOptimization = new Date();
      window.MemoryPerformanceManager.performanceState.optimizationHistory.push({
        timestamp: new Date(),
        reason,
        optimizationsApplied,
        duration: optimizationDuration,
        success: true
      });
      
      window.Utils.log('success', '自動最適化完了', {
        reason,
        optimizations: optimizationsApplied,
        duration: optimizationDuration.toFixed(2) + 'ms'
      });
      
    } catch (error) {
      window.Utils.log('error', '自動最適化エラー', {
        reason,
        error: error.message
      });
      
      window.MemoryPerformanceManager.performanceState.optimizationHistory.push({
        timestamp: new Date(),
        reason,
        optimizationsApplied,
        duration: performance.now() - optimizationStart,
        success: false,
        error: error.message
      });
    }
  },
  
  /**
   * バックグラウンド最適化
   */
  performBackgroundOptimization: () => {
    window.Utils.log('info', 'バックグラウンド最適化開始');
    
    // 非表示時の軽量最適化
    window.MemoryPerformanceManager.cleanupFriendlyModeResources(false);
    
    // 必要に応じて最適化実行
    window.MemoryPerformanceManager.checkOptimizationTriggers();
  },
  
  /**
   * React開発ツール統合（開発環境用）
   */
  setupReactDevToolsIntegration: () => {
    // React DevToolsのプロファイラー統合
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const originalOnCommitFiberRoot = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot;
      
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = function(id, root, ...args) {
        // React更新のパフォーマンス測定
        if (window.MemoryPerformanceManager.config.enableReactProfiling) {
          window.MemoryPerformanceManager.trackReactUpdate(root);
        }
        
        return originalOnCommitFiberRoot?.call(this, id, root, ...args);
      };
    }
  },
  
  /**
   * 統計情報取得
   */
  getStatistics: () => {
    const memInfo = window.performance?.memory;
    const currentUsage = memInfo ? memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit : 0;
    
    return {
      memory: {
        current: memInfo ? (memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB' : 'N/A',
        usage: memInfo ? (currentUsage * 100).toFixed(1) + '%' : 'N/A',
        peak: window.MemoryPerformanceManager.memoryState.peakUsage.toFixed(2) + 'MB',
        snapshots: window.MemoryPerformanceManager.memoryState.memorySnapshots.length,
        leakDetections: window.MemoryPerformanceManager.memoryState.leakDetections.length
      },
      resources: {
        tracked: window.MemoryPerformanceManager.memoryState.tracked.size,
        withCleanup: window.MemoryPerformanceManager.memoryState.cleanupCallbacks.size
      },
      performance: {
        autoOptimizationEnabled: window.MemoryPerformanceManager.performanceState.autoOptimizationEnabled,
        lastOptimization: window.MemoryPerformanceManager.performanceState.lastOptimization,
        optimizationHistory: window.MemoryPerformanceManager.performanceState.optimizationHistory.length,
        activeTriggers: window.MemoryPerformanceManager.performanceState.optimizationTriggers.size
      }
    };
  },
  
  /**
   * 設定変更
   */
  updateConfig: (newConfig) => {
    window.MemoryPerformanceManager.config = {
      ...window.MemoryPerformanceManager.config,
      ...newConfig
    };
    
    window.Utils.log('info', 'メモリ・パフォーマンス設定更新', newConfig);
  },
  
  /**
   * 自動最適化有効化/無効化
   */
  setAutoOptimization: (enabled) => {
    window.MemoryPerformanceManager.performanceState.autoOptimizationEnabled = enabled;
    
    if (enabled) {
      window.MemoryPerformanceManager.setupAutoOptimization();
    }
    
    window.Utils.log('info', `自動最適化${enabled ? '有効化' : '無効化'}`);
  }
};

// 自動初期化（開発環境のみ）
if (window.DEBUG_MODE) {
  window.MemoryPerformanceManager.initialize();
  window.MemoryPerformanceManager.setAutoOptimization(true);
}

// デバッグ用グローバル関数
if (window.DEBUG_MODE) {
  window.getMemoryPerformanceStats = () => window.MemoryPerformanceManager.getStatistics();
  window.forceOptimization = (reason = 'manual') => window.MemoryPerformanceManager.triggerOptimization(reason);
  window.forceCleanup = () => window.MemoryPerformanceManager.performEmergencyCleanup();
}

console.log('✅ FRIENDLYモード メモリ・パフォーマンス統合管理 読み込み完了');