// ErrorHandler.js - FRIENDLYモード統合エラーハンドリング強化版
// Socket.IO、暗号化、セッション管理の包括的エラーハンドリング

console.log('🛡️ FRIENDLYモード統合エラーハンドリング強化版 読み込み開始');

window.ErrorHandler = {
  // エラー履歴管理
  errorHistory: [],
  
  // エラー統計
  errorStats: {
    total: 0,
    byCategory: {
      network: 0,
      encryption: 0,
      session: 0,
      ui: 0,
      socket: 0,
      api: 0
    },
    recent: []
  },
  
  // リトライ管理
  retryQueue: new Map(),
  
  // エラー通知リスナー
  errorListeners: new Set(),
  
  /**
   * エラーハンドリング初期化
   */
  initialize: () => {
    window.Utils.log('info', 'FRIENDLYモード統合エラーハンドリング初期化開始');
    
    // グローバルエラーハンドラー設定
    window.ErrorHandler.setupGlobalHandlers();
    
    // FRIENDLYモード専用エラーハンドラー設定
    window.ErrorHandler.setupFriendlyModeHandlers();
    
    // Socket.IOエラーハンドラー設定
    window.ErrorHandler.setupSocketErrorHandlers();
    
    // 定期的なエラー統計更新
    setInterval(() => {
      window.ErrorHandler.updateErrorStats();
    }, 60000); // 1分ごと
    
    window.Utils.log('success', 'FRIENDLYモード統合エラーハンドリング初期化完了');
  },
  
  /**
   * グローバルエラーハンドラー設定
   */
  setupGlobalHandlers: () => {
    // JavaScript エラー
    window.addEventListener('error', (event) => {
      window.ErrorHandler.handleGlobalError({
        type: 'javascript_error',
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    // Promise拒否
    window.addEventListener('unhandledrejection', (event) => {
      window.ErrorHandler.handleGlobalError({
        type: 'promise_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString()
      });
    });
  },
  
  /**
   * FRIENDLYモード専用エラーハンドラー設定
   */
  setupFriendlyModeHandlers: () => {
    // 暗号化エラー監視
    if (window.Crypto) {
      const originalEncrypt = window.Crypto.encryptMessage;
      if (originalEncrypt) {
        window.Crypto.encryptMessage = async function(...args) {
          try {
            return await originalEncrypt.apply(this, args);
          } catch (error) {
            window.ErrorHandler.handleEncryptionError(error, 'encrypt', args);
            throw error;
          }
        };
      }
      
      const originalDecrypt = window.Crypto.decryptMessage;
      if (originalDecrypt) {
        window.Crypto.decryptMessage = async function(...args) {
          try {
            return await originalDecrypt.apply(this, args);
          } catch (error) {
            window.ErrorHandler.handleEncryptionError(error, 'decrypt', args);
            throw error;
          }
        };
      }
    }
    
    // API呼び出しエラー監視
    if (window.API) {
      const originalCall = window.API.call;
      if (originalCall) {
        window.API.call = async function(...args) {
          try {
            return await originalCall.apply(this, args);
          } catch (error) {
            window.ErrorHandler.handleAPIError(error, args[0], args[1]);
            throw error;
          }
        };
      }
    }
  },
  
  /**
   * Socket.IOエラーハンドラー設定
   */
  setupSocketErrorHandlers: () => {
    // Socket.IOエラー監視は、socket接続時に動的に設定される
    // app.js側で呼び出される
  },
  
  /**
   * Socket.IOエラーハンドラーをsocketに追加
   * @param {Object} socket Socket.IOインスタンス
   */
  attachSocketErrorHandlers: (socket) => {
    if (!socket) return;
    
    socket.on('error', (error) => {
      window.ErrorHandler.handleSocketError(error, 'socket_error');
    });
    
    socket.on('connect_error', (error) => {
      window.ErrorHandler.handleSocketError(error, 'connect_error');
    });
    
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
        window.ErrorHandler.handleSocketError(new Error(reason), 'disconnect');
      }
    });
    
    socket.on('error-response', (data) => {
      window.ErrorHandler.handleSocketError(new Error(data.error), 'server_error', data);
    });
  },
  
  /**
   * グローバルエラー処理
   * @param {Object} errorInfo エラー情報
   */
  handleGlobalError: (errorInfo) => {
    window.ErrorHandler.recordError({
      category: 'ui',
      severity: 'high',
      ...errorInfo,
      userAction: 'auto_detected'
    });
    
    window.Utils.log('error', 'グローバルエラー検出', errorInfo);
    
    // 開発環境では詳細ログ
    if (window.DEBUG_MODE) {
      console.group('🐛 グローバルエラー詳細');
      console.error('エラー情報:', errorInfo);
      console.trace('スタックトレース');
      console.groupEnd();
    }
  },
  
  /**
   * 暗号化エラー処理
   * @param {Error} error エラーオブジェクト
   * @param {string} operation 操作種別
   * @param {Array} args 引数
   */
  handleEncryptionError: (error, operation, args) => {
    const errorInfo = {
      category: 'encryption',
      severity: window.ErrorHandler.determineEncryptionSeverity(error, operation),
      type: 'encryption_error',
      operation,
      message: error.message,
      stack: error.stack,
      args: window.ErrorHandler.sanitizeArgs(args),
      timestamp: new Date().toISOString(),
      userAction: 'encryption_operation'
    };
    
    window.ErrorHandler.recordError(errorInfo);
    
    // 🆕 自動リトライ判定
    if (window.ErrorHandler.shouldRetryEncryption(error, operation)) {
      window.ErrorHandler.scheduleRetry('encryption', {
        operation,
        args,
        error: errorInfo
      });
    }
    
    window.Utils.log('error', `暗号化エラー (${operation})`, {
      message: error.message,
      operation,
      retryable: window.ErrorHandler.shouldRetryEncryption(error, operation)
    });
  },
  
  /**
   * APIエラー処理
   * @param {Error} error エラーオブジェクト
   * @param {string} endpoint APIエンドポイント
   * @param {Object} options APIオプション
   */
  handleAPIError: (error, endpoint, options) => {
    const errorInfo = {
      category: 'api',
      severity: window.ErrorHandler.determineAPISeverity(error, endpoint),
      type: 'api_error',
      endpoint,
      message: error.message,
      stack: error.stack,
      options: window.ErrorHandler.sanitizeOptions(options),
      timestamp: new Date().toISOString(),
      userAction: 'api_call'
    };
    
    window.ErrorHandler.recordError(errorInfo);
    
    // 🆕 自動リトライ判定
    if (window.ErrorHandler.shouldRetryAPI(error, endpoint)) {
      window.ErrorHandler.scheduleRetry('api', {
        endpoint,
        options,
        error: errorInfo
      });
    }
    
    window.Utils.log('error', `API呼び出しエラー (${endpoint})`, {
      message: error.message,
      endpoint,
      retryable: window.ErrorHandler.shouldRetryAPI(error, endpoint)
    });
  },
  
  /**
   * Socket.IOエラー処理
   * @param {Error} error エラーオブジェクト
   * @param {string} type エラータイプ
   * @param {Object} data 追加データ
   */
  handleSocketError: (error, type, data = {}) => {
    const errorInfo = {
      category: 'socket',
      severity: window.ErrorHandler.determineSocketSeverity(error, type),
      type: 'socket_error',
      socketType: type,
      message: error.message || String(error),
      stack: error.stack,
      data: window.ErrorHandler.sanitizeData(data),
      timestamp: new Date().toISOString(),
      userAction: 'socket_operation'
    };
    
    window.ErrorHandler.recordError(errorInfo);
    
    // 🆕 自動リトライ判定
    if (window.ErrorHandler.shouldRetrySocket(error, type)) {
      window.ErrorHandler.scheduleRetry('socket', {
        type,
        error: errorInfo
      });
    }
    
    window.Utils.log('error', `Socket.IOエラー (${type})`, {
      message: error.message || String(error),
      type,
      retryable: window.ErrorHandler.shouldRetrySocket(error, type)
    });
  },
  
  /**
   * セッション管理エラー処理
   * @param {Error} error エラーオブジェクト
   * @param {string} operation 操作種別
   * @param {Object} context コンテキスト情報
   */
  handleSessionError: (error, operation, context = {}) => {
    const errorInfo = {
      category: 'session',
      severity: window.ErrorHandler.determineSessionSeverity(error, operation),
      type: 'session_error',
      operation,
      message: error.message,
      stack: error.stack,
      context: window.ErrorHandler.sanitizeData(context),
      timestamp: new Date().toISOString(),
      userAction: 'session_operation'
    };
    
    window.ErrorHandler.recordError(errorInfo);
    
    window.Utils.log('error', `セッション管理エラー (${operation})`, {
      message: error.message,
      operation,
      context
    });
  },
  
  /**
   * エラー記録
   * @param {Object} errorInfo エラー情報
   */
  recordError: (errorInfo) => {
    // エラー履歴に追加
    window.ErrorHandler.errorHistory.push(errorInfo);
    
    // 履歴サイズ制限（最新100件）
    if (window.ErrorHandler.errorHistory.length > 100) {
      window.ErrorHandler.errorHistory = window.ErrorHandler.errorHistory.slice(-100);
    }
    
    // 統計更新
    window.ErrorHandler.errorStats.total++;
    window.ErrorHandler.errorStats.byCategory[errorInfo.category]++;
    window.ErrorHandler.errorStats.recent.push({
      category: errorInfo.category,
      severity: errorInfo.severity,
      timestamp: errorInfo.timestamp
    });
    
    // 最近のエラーは50件まで
    if (window.ErrorHandler.errorStats.recent.length > 50) {
      window.ErrorHandler.errorStats.recent = window.ErrorHandler.errorStats.recent.slice(-50);
    }
    
    // エラーリスナーに通知
    window.ErrorHandler.notifyErrorListeners(errorInfo);
  },
  
  /**
   * 自動リトライスケジュール
   * @param {string} category エラーカテゴリ
   * @param {Object} retryInfo リトライ情報
   */
  scheduleRetry: (category, retryInfo) => {
    const retryKey = `${category}_${Date.now()}`;
    const retryCount = window.ErrorHandler.getRetryCount(category, retryInfo);
    
    if (retryCount >= 3) {
      window.Utils.log('warn', `リトライ上限到達 (${category})`, { retryCount });
      return;
    }
    
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 最大10秒
    
    window.ErrorHandler.retryQueue.set(retryKey, {
      category,
      retryInfo,
      retryCount: retryCount + 1,
      scheduledAt: new Date(),
      executeAt: new Date(Date.now() + delay)
    });
    
    setTimeout(() => {
      window.ErrorHandler.executeRetry(retryKey);
    }, delay);
    
    window.Utils.log('info', `リトライスケジュール (${category})`, {
      retryCount: retryCount + 1,
      delay: delay + 'ms'
    });
  },
  
  /**
   * リトライ実行
   * @param {string} retryKey リトライキー
   */
  executeRetry: async (retryKey) => {
    const retryData = window.ErrorHandler.retryQueue.get(retryKey);
    if (!retryData) return;
    
    try {
      window.Utils.log('info', `リトライ実行開始 (${retryData.category})`, {
        retryCount: retryData.retryCount
      });
      
      let success = false;
      
      switch (retryData.category) {
        case 'encryption':
          success = await window.ErrorHandler.retryEncryption(retryData.retryInfo);
          break;
        case 'api':
          success = await window.ErrorHandler.retryAPI(retryData.retryInfo);
          break;
        case 'socket':
          success = await window.ErrorHandler.retrySocket(retryData.retryInfo);
          break;
      }
      
      if (success) {
        window.Utils.log('success', `リトライ成功 (${retryData.category})`, {
          retryCount: retryData.retryCount
        });
        window.ErrorHandler.retryQueue.delete(retryKey);
      } else {
        // 失敗した場合は再スケジュール
        window.ErrorHandler.scheduleRetry(retryData.category, retryData.retryInfo);
      }
      
    } catch (error) {
      window.Utils.log('error', `リトライ実行エラー (${retryData.category})`, {
        error: error.message,
        retryCount: retryData.retryCount
      });
      
      // エラーが発生した場合も再スケジュール
      window.ErrorHandler.scheduleRetry(retryData.category, retryData.retryInfo);
    }
  },
  
  /**
   * 暗号化リトライ実行
   * @param {Object} retryInfo リトライ情報
   * @returns {boolean} 成功フラグ
   */
  retryEncryption: async (retryInfo) => {
    try {
      if (retryInfo.operation === 'encrypt' && window.Crypto.encryptMessage) {
        await window.Crypto.encryptMessage(...retryInfo.args);
        return true;
      } else if (retryInfo.operation === 'decrypt' && window.Crypto.decryptMessage) {
        await window.Crypto.decryptMessage(...retryInfo.args);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * APIリトライ実行
   * @param {Object} retryInfo リトライ情報
   * @returns {boolean} 成功フラグ
   */
  retryAPI: async (retryInfo) => {
    try {
      if (window.API.call) {
        await window.API.call(retryInfo.endpoint, retryInfo.options);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * Socket.IOリトライ実行
   * @param {Object} retryInfo リトライ情報
   * @returns {boolean} 成功フラグ
   */
  retrySocket: async (retryInfo) => {
    // Socket.IOの再接続は自動的に行われるため、
    // ここでは接続状態の確認のみ
    if (window.SessionManager?.realtimeState?.isConnected) {
      return true;
    }
    return false;
  },
  
  /**
   * エラー深刻度判定 - 暗号化
   */
  determineEncryptionSeverity: (error, operation) => {
    if (error.message.includes('not supported')) return 'critical';
    if (error.message.includes('key not found')) return 'high';
    if (error.message.includes('invalid')) return 'medium';
    return 'low';
  },
  
  /**
   * エラー深刻度判定 - API
   */
  determineAPISeverity: (error, endpoint) => {
    if (endpoint.includes('/auth') || endpoint.includes('/login')) return 'critical';
    if (error.message.includes('500') || error.message.includes('503')) return 'high';
    if (error.message.includes('404') || error.message.includes('400')) return 'medium';
    return 'low';
  },
  
  /**
   * エラー深刻度判定 - Socket.IO
   */
  determineSocketSeverity: (error, type) => {
    if (type === 'connect_error') return 'high';
    if (type === 'disconnect') return 'medium';
    return 'low';
  },
  
  /**
   * エラー深刻度判定 - セッション
   */
  determineSessionSeverity: (error, operation) => {
    if (operation === 'initialize') return 'critical';
    if (operation === 'sync') return 'high';
    return 'medium';
  },
  
  /**
   * リトライ判定 - 暗号化
   */
  shouldRetryEncryption: (error, operation) => {
    if (error.message.includes('not supported')) return false;
    if (error.message.includes('temporary')) return true;
    if (error.message.includes('network')) return true;
    return false;
  },
  
  /**
   * リトライ判定 - API
   */
  shouldRetryAPI: (error, endpoint) => {
    if (error.message.includes('500') || error.message.includes('503')) return true;
    if (error.message.includes('timeout')) return true;
    if (error.message.includes('network')) return true;
    return false;
  },
  
  /**
   * リトライ判定 - Socket.IO
   */
  shouldRetrySocket: (error, type) => {
    if (type === 'connect_error') return true;
    if (type === 'disconnect') return true;
    return false;
  },
  
  /**
   * データ無害化
   */
  sanitizeArgs: (args) => {
    if (!args) return [];
    return args.map(arg => {
      if (typeof arg === 'string' && arg.length > 100) {
        return arg.substring(0, 100) + '...[truncated]';
      }
      if (typeof arg === 'object') {
        return '[object]';
      }
      return arg;
    });
  },
  
  sanitizeOptions: (options) => {
    if (!options) return {};
    const sanitized = { ...options };
    if (sanitized.body) {
      sanitized.body = '[body_hidden]';
    }
    return sanitized;
  },
  
  sanitizeData: (data) => {
    if (!data) return {};
    const sanitized = { ...data };
    // 機密情報を除去
    ['password', 'passphrase', 'key', 'token'].forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[hidden]';
      }
    });
    return sanitized;
  },
  
  /**
   * リトライ回数取得
   */
  getRetryCount: (category, retryInfo) => {
    let count = 0;
    for (const retry of window.ErrorHandler.retryQueue.values()) {
      if (retry.category === category) {
        count++;
      }
    }
    return count;
  },
  
  /**
   * エラー統計更新
   */
  updateErrorStats: () => {
    // 過去1時間のエラー率計算
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = window.ErrorHandler.errorStats.recent.filter(err => 
      new Date(err.timestamp) > oneHourAgo
    );
    
    window.ErrorHandler.errorStats.hourlyRate = recentErrors.length;
    
    // 深刻度別統計
    window.ErrorHandler.errorStats.bySeverity = {
      critical: recentErrors.filter(e => e.severity === 'critical').length,
      high: recentErrors.filter(e => e.severity === 'high').length,
      medium: recentErrors.filter(e => e.severity === 'medium').length,
      low: recentErrors.filter(e => e.severity === 'low').length
    };
  },
  
  /**
   * エラーリスナー追加
   */
  addErrorListener: (listener) => {
    window.ErrorHandler.errorListeners.add(listener);
  },
  
  /**
   * エラーリスナー削除
   */
  removeErrorListener: (listener) => {
    window.ErrorHandler.errorListeners.delete(listener);
  },
  
  /**
   * エラーリスナーに通知
   */
  notifyErrorListeners: (errorInfo) => {
    window.ErrorHandler.errorListeners.forEach(listener => {
      try {
        listener(errorInfo);
      } catch (error) {
        console.error('エラーリスナー実行エラー:', error);
      }
    });
  },
  
  /**
   * エラー統計取得
   */
  getErrorStats: () => {
    return {
      ...window.ErrorHandler.errorStats,
      retryQueueSize: window.ErrorHandler.retryQueue.size,
      errorHistorySize: window.ErrorHandler.errorHistory.length
    };
  },
  
  /**
   * エラー履歴取得
   */
  getErrorHistory: (limit = 20) => {
    return window.ErrorHandler.errorHistory.slice(-limit);
  },
  
  /**
   * エラー履歴クリア
   */
  clearErrorHistory: () => {
    window.ErrorHandler.errorHistory = [];
    window.ErrorHandler.errorStats = {
      total: 0,
      byCategory: {
        network: 0,
        encryption: 0,
        session: 0,
        ui: 0,
        socket: 0,
        api: 0
      },
      recent: []
    };
    window.Utils.log('info', 'エラー履歴をクリアしました');
  }
};

// 自動初期化（開発環境のみ）
if (window.DEBUG_MODE) {
  window.ErrorHandler.initialize();
}

// デバッグ用関数
window.getErrorStats = () => window.ErrorHandler.getErrorStats();
window.getErrorHistory = (limit) => window.ErrorHandler.getErrorHistory(limit);
window.clearErrorHistory = () => window.ErrorHandler.clearErrorHistory();

console.log('✅ FRIENDLYモード統合エラーハンドリング強化版 読み込み完了');