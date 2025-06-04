// UnifiedErrorDisplay.js - FRIENDLYモード エラー状態統一表示システム
// 全コンポーネント間でのエラー状態共有、統一表示、自動回復機能

console.log('⚠️ FRIENDLYモード エラー状態統一表示システム 読み込み開始');

window.UnifiedErrorDisplay = {
  // エラー状態管理
  errorState: {
    activeErrors: new Map(), // errorId -> errorInfo
    errorHistory: [],
    globalErrorLevel: 'none', // none, low, medium, high, critical
    lastErrorTime: null,
    errorCount: 0
  },
  
  // エラー表示設定
  displayConfig: {
    maxVisibleErrors: 3,
    autoHideTimeout: 5000,
    criticalErrorPersist: true,
    showErrorDetails: window.DEBUG_MODE,
    enableToast: true,
    enableBanner: true
  },
  
  // エラーリスナー
  errorListeners: new Set(),
  displayUpdateListeners: new Set(),
  
  /**
   * エラー状態統一表示システム初期化
   */
  initialize: () => {
    window.Utils.log('info', 'エラー状態統一表示システム初期化開始');
    
    // 既存のErrorHandlerとの統合
    if (window.ErrorHandler) {
      window.ErrorHandler.addErrorListener(window.UnifiedErrorDisplay.handleErrorFromSystem);
    }
    
    // グローバルエラーハンドラーとの統合
    window.addEventListener('error', (event) => {
      window.UnifiedErrorDisplay.addError({
        id: `global_${Date.now()}`,
        type: 'javascript_error',
        category: 'system',
        severity: 'high',
        title: 'JavaScript エラー',
        message: event.error?.message || event.message,
        details: {
          filename: event.filename,
          lineno: event.lineno,
          stack: event.error?.stack
        },
        autoRecover: false,
        persistent: true
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      window.UnifiedErrorDisplay.addError({
        id: `promise_${Date.now()}`,
        type: 'promise_rejection',
        category: 'system',
        severity: 'medium',
        title: 'Promise 拒否',
        message: event.reason?.message || String(event.reason),
        details: {
          stack: event.reason?.stack
        },
        autoRecover: true,
        persistent: false
      });
    });
    
    // 定期的なエラー状態評価
    setInterval(() => {
      window.UnifiedErrorDisplay.evaluateGlobalErrorLevel();
    }, 10000); // 10秒ごと
    
    window.Utils.log('success', 'エラー状態統一表示システム初期化完了');
  },
  
  /**
   * システムからのエラーハンドリング（ErrorHandlerからの通知）
   * @param {Object} errorInfo ErrorHandlerからのエラー情報
   */
  handleErrorFromSystem: (errorInfo) => {
    const unifiedError = {
      id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: errorInfo.type || 'system_error',
      category: errorInfo.category || 'unknown',
      severity: errorInfo.severity || 'medium',
      title: window.UnifiedErrorDisplay.getCategoryTitle(errorInfo.category),
      message: errorInfo.message,
      details: {
        operation: errorInfo.operation,
        endpoint: errorInfo.endpoint,
        socketType: errorInfo.socketType,
        userAction: errorInfo.userAction,
        timestamp: errorInfo.timestamp
      },
      autoRecover: window.UnifiedErrorDisplay.shouldAutoRecover(errorInfo),
      persistent: window.UnifiedErrorDisplay.shouldPersist(errorInfo),
      source: 'ErrorHandler'
    };
    
    window.UnifiedErrorDisplay.addError(unifiedError);
  },
  
  /**
   * エラー追加
   * @param {Object} errorInfo エラー情報
   */
  addError: (errorInfo) => {
    if (!errorInfo || !errorInfo.id) {
      console.warn('無効なエラー情報が渡されました');
      return;
    }
    
    const now = new Date();
    const completeErrorInfo = {
      ...errorInfo,
      timestamp: now,
      displayTime: now,
      isVisible: true,
      dismissCount: 0,
      lastDismissTime: null
    };
    
    // アクティブエラーに追加
    window.UnifiedErrorDisplay.errorState.activeErrors.set(errorInfo.id, completeErrorInfo);
    
    // エラー履歴に追加
    window.UnifiedErrorDisplay.errorState.errorHistory.push({
      ...completeErrorInfo,
      addedToHistory: now
    });
    
    // 履歴サイズ制限
    if (window.UnifiedErrorDisplay.errorState.errorHistory.length > 100) {
      window.UnifiedErrorDisplay.errorState.errorHistory = 
        window.UnifiedErrorDisplay.errorState.errorHistory.slice(-100);
    }
    
    // 統計更新
    window.UnifiedErrorDisplay.errorState.errorCount++;
    window.UnifiedErrorDisplay.errorState.lastErrorTime = now;
    
    // グローバルエラーレベル評価
    window.UnifiedErrorDisplay.evaluateGlobalErrorLevel();
    
    // 表示更新通知
    window.UnifiedErrorDisplay.notifyDisplayUpdate('error_added', completeErrorInfo);
    
    // 自動非表示設定
    window.UnifiedErrorDisplay.scheduleAutoHide(errorInfo.id);
    
    // 自動回復試行
    if (errorInfo.autoRecover) {
      window.UnifiedErrorDisplay.scheduleAutoRecover(errorInfo.id);
    }
    
    window.Utils.log('info', `統一エラー表示: ${errorInfo.title}`, {
      id: errorInfo.id,
      severity: errorInfo.severity,
      category: errorInfo.category
    });
  },
  
  /**
   * エラー削除
   * @param {string} errorId エラーID
   */
  removeError: (errorId) => {
    const errorInfo = window.UnifiedErrorDisplay.errorState.activeErrors.get(errorId);
    if (!errorInfo) return;
    
    window.UnifiedErrorDisplay.errorState.activeErrors.delete(errorId);
    
    // グローバルエラーレベル再評価
    window.UnifiedErrorDisplay.evaluateGlobalErrorLevel();
    
    // 表示更新通知
    window.UnifiedErrorDisplay.notifyDisplayUpdate('error_removed', errorInfo);
    
    window.Utils.log('debug', `統一エラー削除: ${errorInfo.title}`, { id: errorId });
  },
  
  /**
   * エラー一時非表示
   * @param {string} errorId エラーID
   */
  dismissError: (errorId) => {
    const errorInfo = window.UnifiedErrorDisplay.errorState.activeErrors.get(errorId);
    if (!errorInfo) return;
    
    errorInfo.isVisible = false;
    errorInfo.dismissCount++;
    errorInfo.lastDismissTime = new Date();
    
    // 表示更新通知
    window.UnifiedErrorDisplay.notifyDisplayUpdate('error_dismissed', errorInfo);
    
    // 重要でないエラーは完全削除
    if (!errorInfo.persistent && errorInfo.severity !== 'critical') {
      setTimeout(() => {
        window.UnifiedErrorDisplay.removeError(errorId);
      }, 30000); // 30秒後に削除
    }
  },
  
  /**
   * 全エラークリア
   */
  clearAllErrors: () => {
    const errorCount = window.UnifiedErrorDisplay.errorState.activeErrors.size;
    window.UnifiedErrorDisplay.errorState.activeErrors.clear();
    window.UnifiedErrorDisplay.errorState.globalErrorLevel = 'none';
    
    window.UnifiedErrorDisplay.notifyDisplayUpdate('all_errors_cleared', { count: errorCount });
    
    window.Utils.log('info', `全エラークリア: ${errorCount}件削除`);
  },
  
  /**
   * グローバルエラーレベル評価
   */
  evaluateGlobalErrorLevel: () => {
    const activeErrors = Array.from(window.UnifiedErrorDisplay.errorState.activeErrors.values());
    
    if (activeErrors.length === 0) {
      window.UnifiedErrorDisplay.errorState.globalErrorLevel = 'none';
      return;
    }
    
    // 最高深刻度で評価
    const severityLevels = ['critical', 'high', 'medium', 'low'];
    let globalLevel = 'low';
    
    for (const level of severityLevels) {
      if (activeErrors.some(error => error.severity === level && error.isVisible)) {
        globalLevel = level;
        break;
      }
    }
    
    const previousLevel = window.UnifiedErrorDisplay.errorState.globalErrorLevel;
    window.UnifiedErrorDisplay.errorState.globalErrorLevel = globalLevel;
    
    if (previousLevel !== globalLevel) {
      window.UnifiedErrorDisplay.notifyDisplayUpdate('global_level_changed', {
        previousLevel,
        newLevel: globalLevel,
        activeErrorCount: activeErrors.filter(e => e.isVisible).length
      });
    }
  },
  
  /**
   * 自動非表示スケジュール
   * @param {string} errorId エラーID
   */
  scheduleAutoHide: (errorId) => {
    const errorInfo = window.UnifiedErrorDisplay.errorState.activeErrors.get(errorId);
    if (!errorInfo || errorInfo.persistent || errorInfo.severity === 'critical') return;
    
    setTimeout(() => {
      window.UnifiedErrorDisplay.dismissError(errorId);
    }, window.UnifiedErrorDisplay.displayConfig.autoHideTimeout);
  },
  
  /**
   * 自動回復スケジュール
   * @param {string} errorId エラーID
   */
  scheduleAutoRecover: (errorId) => {
    const errorInfo = window.UnifiedErrorDisplay.errorState.activeErrors.get(errorId);
    if (!errorInfo || !errorInfo.autoRecover) return;
    
    // 回復試行の遅延時間（エラーカテゴリに応じて調整）
    const recoveryDelay = window.UnifiedErrorDisplay.getRecoveryDelay(errorInfo.category);
    
    setTimeout(async () => {
      try {
        const recovered = await window.UnifiedErrorDisplay.attemptAutoRecover(errorInfo);
        if (recovered) {
          window.UnifiedErrorDisplay.removeError(errorId);
          
          // 回復成功通知
          window.UnifiedErrorDisplay.addError({
            id: `recovery_${Date.now()}`,
            type: 'recovery_success',
            category: 'system',
            severity: 'low',
            title: '自動回復',
            message: `${errorInfo.title}の問題が自動的に解決されました`,
            autoRecover: false,
            persistent: false
          });
        }
      } catch (recoveryError) {
        window.Utils.log('warn', `自動回復失敗: ${errorInfo.title}`, {
          error: recoveryError.message
        });
      }
    }, recoveryDelay);
  },
  
  /**
   * 自動回復試行
   * @param {Object} errorInfo エラー情報
   * @returns {boolean} 回復成功フラグ
   */
  attemptAutoRecover: async (errorInfo) => {
    switch (errorInfo.category) {
      case 'socket':
        // Socket.IO再接続試行
        if (window.manualReconnect) {
          window.manualReconnect();
          return true;
        }
        break;
        
      case 'api':
        // API接続テスト
        if (window.API?.testConnection) {
          const connected = await window.API.testConnection();
          return connected;
        }
        break;
        
      case 'encryption':
        // 暗号化システム再初期化
        if (window.API?.initializeEncryption && errorInfo.details?.spaceId) {
          try {
            await window.API.initializeEncryption(errorInfo.details.spaceId);
            return true;
          } catch (error) {
            return false;
          }
        }
        break;
        
      case 'session':
        // セッション同期
        if (window.SessionManager?.forceSyncSpace && errorInfo.details?.spaceId) {
          return await window.SessionManager.forceSyncSpace(errorInfo.details.spaceId);
        }
        break;
    }
    
    return false;
  },
  
  /**
   * 表示可能エラー取得
   * @returns {Array} 表示すべきエラーの配列
   */
  getVisibleErrors: () => {
    const visibleErrors = Array.from(window.UnifiedErrorDisplay.errorState.activeErrors.values())
      .filter(error => error.isVisible)
      .sort((a, b) => {
        // 深刻度順、次に時刻順
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        
        return b.timestamp - a.timestamp;
      });
    
    return visibleErrors.slice(0, window.UnifiedErrorDisplay.displayConfig.maxVisibleErrors);
  },
  
  /**
   * エラー統計取得
   * @returns {Object} エラー統計
   */
  getErrorStats: () => {
    const activeErrors = Array.from(window.UnifiedErrorDisplay.errorState.activeErrors.values());
    const visibleErrors = activeErrors.filter(e => e.isVisible);
    
    return {
      total: window.UnifiedErrorDisplay.errorState.errorCount,
      active: activeErrors.length,
      visible: visibleErrors.length,
      globalLevel: window.UnifiedErrorDisplay.errorState.globalErrorLevel,
      lastErrorTime: window.UnifiedErrorDisplay.errorState.lastErrorTime,
      bySeverity: {
        critical: visibleErrors.filter(e => e.severity === 'critical').length,
        high: visibleErrors.filter(e => e.severity === 'high').length,
        medium: visibleErrors.filter(e => e.severity === 'medium').length,
        low: visibleErrors.filter(e => e.severity === 'low').length
      },
      byCategory: {
        encryption: visibleErrors.filter(e => e.category === 'encryption').length,
        socket: visibleErrors.filter(e => e.category === 'socket').length,
        api: visibleErrors.filter(e => e.category === 'api').length,
        session: visibleErrors.filter(e => e.category === 'session').length,
        ui: visibleErrors.filter(e => e.category === 'ui').length
      }
    };
  },
  
  /**
   * ヘルパー関数：カテゴリタイトル取得
   */
  getCategoryTitle: (category) => {
    const titles = {
      encryption: '🔒 暗号化エラー',
      socket: '🔌 接続エラー',
      api: '📡 API エラー',
      session: '👥 セッションエラー',
      ui: '🎨 画面エラー',
      system: '⚙️ システムエラー',
      network: '🌐 ネットワークエラー'
    };
    return titles[category] || '❌ エラー';
  },
  
  /**
   * ヘルパー関数：自動回復判定
   */
  shouldAutoRecover: (errorInfo) => {
    const recoverableCategories = ['socket', 'api', 'session'];
    return recoverableCategories.includes(errorInfo.category) && 
           errorInfo.severity !== 'critical';
  },
  
  /**
   * ヘルパー関数：永続化判定
   */
  shouldPersist: (errorInfo) => {
    return errorInfo.severity === 'critical' || 
           errorInfo.category === 'encryption' ||
           errorInfo.category === 'system';
  },
  
  /**
   * ヘルパー関数：回復遅延時間取得
   */
  getRecoveryDelay: (category) => {
    const delays = {
      socket: 3000,
      api: 5000,
      session: 2000,
      encryption: 10000
    };
    return delays[category] || 5000;
  },
  
  /**
   * リスナー管理
   */
  addDisplayUpdateListener: (listener) => {
    window.UnifiedErrorDisplay.displayUpdateListeners.add(listener);
  },
  
  removeDisplayUpdateListener: (listener) => {
    window.UnifiedErrorDisplay.displayUpdateListeners.delete(listener);
  },
  
  notifyDisplayUpdate: (type, data) => {
    const event = { type, data, timestamp: new Date() };
    window.UnifiedErrorDisplay.displayUpdateListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('表示更新リスナーエラー:', error);
      }
    });
  }
};

// =============================================================================
// React エラー表示コンポーネント
// =============================================================================

/**
 * 統一エラー表示コンポーネント
 */
window.UnifiedErrorDisplayComponent = () => {
  const [visibleErrors, setVisibleErrors] = React.useState([]);
  const [errorStats, setErrorStats] = React.useState({});
  const [globalLevel, setGlobalLevel] = React.useState('none');

  React.useEffect(() => {
    const updateDisplay = () => {
      setVisibleErrors(window.UnifiedErrorDisplay.getVisibleErrors());
      setErrorStats(window.UnifiedErrorDisplay.getErrorStats());
      setGlobalLevel(window.UnifiedErrorDisplay.errorState.globalErrorLevel);
    };

    const listener = (event) => {
      updateDisplay();
    };

    window.UnifiedErrorDisplay.addDisplayUpdateListener(listener);
    updateDisplay(); // 初期表示

    return () => {
      window.UnifiedErrorDisplay.removeDisplayUpdateListener(listener);
    };
  }, []);

  if (visibleErrors.length === 0 && globalLevel === 'none') {
    return null;
  }

  const getGlobalLevelStyle = () => {
    switch (globalLevel) {
      case 'critical': return 'bg-red-900/20 border-red-800/30 text-red-300';
      case 'high': return 'bg-orange-900/20 border-orange-800/30 text-orange-300';
      case 'medium': return 'bg-yellow-900/20 border-yellow-800/30 text-yellow-300';
      case 'low': return 'bg-blue-900/20 border-blue-800/30 text-blue-300';
      default: return 'bg-gray-900/20 border-gray-700/30 text-gray-300';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '❗';
    }
  };

  return React.createElement(
    'div',
    { className: 'fixed top-4 right-4 z-50 max-w-md space-y-2' },
    
    // グローバルエラーバナー（critical/high時のみ）
    (globalLevel === 'critical' || globalLevel === 'high') && React.createElement(
      'div',
      { className: `p-3 rounded-lg border ${getGlobalLevelStyle()} backdrop-blur-sm` },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between' },
        React.createElement('span', { className: 'font-medium' }, 
          `システム状態: ${globalLevel === 'critical' ? '重大' : '警告'}`
        ),
        React.createElement('span', { className: 'text-xs' }, 
          `${errorStats.visible}件のエラー`
        )
      )
    ),
    
    // 個別エラー表示
    visibleErrors.map(error => React.createElement(
      'div',
      { 
        key: error.id,
        className: 'bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded-lg p-4 shadow-lg'
      },
      React.createElement(
        'div',
        { className: 'flex items-start justify-between' },
        React.createElement(
          'div',
          { className: 'flex-1 min-w-0' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 mb-2' },
            React.createElement('span', { className: 'text-lg' }, getSeverityIcon(error.severity)),
            React.createElement('h3', { className: 'font-medium text-white' }, error.title)
          ),
          React.createElement('p', { className: 'text-sm text-gray-300 mb-2' }, error.message),
          
          // 詳細情報（デバッグモード時）
          window.DEBUG_MODE && error.details && React.createElement(
            'details',
            { className: 'text-xs text-gray-400' },
            React.createElement('summary', { className: 'cursor-pointer' }, 'エラー詳細'),
            React.createElement('pre', { className: 'mt-2 overflow-x-auto' }, 
              JSON.stringify(error.details, null, 2)
            )
          )
        ),
        React.createElement(
          'button',
          {
            onClick: () => window.UnifiedErrorDisplay.dismissError(error.id),
            className: 'ml-4 text-gray-400 hover:text-white transition-colors'
          },
          '✕'
        )
      ),
      
      // 自動回復状態表示
      error.autoRecover && React.createElement(
        'div',
        { className: 'mt-2 text-xs text-blue-400 flex items-center gap-1' },
        React.createElement('span', null, '🔄'),
        React.createElement('span', null, '自動回復を試行します...')
      )
    ))
  );
};

// デバッグ用グローバル関数
if (window.DEBUG_MODE) {
  window.getUnifiedErrorDebugInfo = () => ({
    errorState: window.UnifiedErrorDisplay.errorState,
    displayConfig: window.UnifiedErrorDisplay.displayConfig,
    stats: window.UnifiedErrorDisplay.getErrorStats(),
    visibleErrors: window.UnifiedErrorDisplay.getVisibleErrors()
  });
  
  window.testUnifiedError = (severity = 'medium') => {
    window.UnifiedErrorDisplay.addError({
      id: `test_${Date.now()}`,
      type: 'test_error',
      category: 'system',
      severity: severity,
      title: `テストエラー (${severity})`,
      message: 'これはテスト用のエラーメッセージです',
      autoRecover: severity !== 'critical',
      persistent: severity === 'critical'
    });
  };
}

console.log('✅ FRIENDLYモード エラー状態統一表示システム 読み込み完了');