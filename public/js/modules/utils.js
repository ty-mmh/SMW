// ユーティリティモジュール（統合版ベース・改修版）
// 時刻フォーマット、バリデーション、ログ機能など

window.Utils = {
  // 時刻フォーマット（日本語表示）
  formatTime: (date) => {
    try {
      if (!date) return '不明な時刻';
      
      const d = new Date(date);
      if (isNaN(d.getTime())) return '無効な日時';
      
      return d.toLocaleString('ja-JP', { 
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (error) {
      console.error('時刻フォーマットエラー:', error);
      return '時刻エラー';
    }
  },

  // 相対時間フォーマット（「3時間前」形式）
  formatRelativeTime: (date) => {
    try {
      if (!date) return '不明';
      
      const now = new Date();
      const target = new Date(date);
      
      if (isNaN(target.getTime())) return '無効な日時';
      
      const diff = now - target;
      const minutes = Math.floor(diff / (60 * 1000));
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      
      if (days > 7) {
        return window.Utils.formatTime(target);
      } else if (days > 0) {
        return `${days}日前`;
      } else if (hours > 0) {
        return `${hours}時間前`;
      } else if (minutes > 0) {
        return `${minutes}分前`;
      } else {
        return 'たった今';
      }
    } catch (error) {
      console.error('相対時間フォーマットエラー:', error);
      return '不明';
    }
  },

  // メッセージ削除までの残り時間計算
  getMessageTimeRemaining: (timestamp) => {
    try {
      if (!timestamp) return { text: '不明', expired: true };
      
      const created = new Date(timestamp);
      if (isNaN(created.getTime())) return { text: '無効な日時', expired: true };
      
      const expiryHours = parseInt(window.MESSAGE_EXPIRY_HOURS || '48', 10);
      const deleteTime = new Date(created.getTime() + expiryHours * 60 * 60 * 1000);
      const now = new Date();
      const remaining = deleteTime - now;
      
      if (remaining <= 0) return { text: '削除済み', expired: true };
      
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        return { 
          text: remainingHours > 0 ? `あと${days}日${remainingHours}時間` : `あと${days}日`, 
          expired: false 
        };
      } else if (hours > 0) {
        return { 
          text: minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`, 
          expired: false 
        };
      } else if (minutes > 5) {
        return { text: `あと${minutes}分`, expired: false };
      } else if (minutes > 0) {
        return { text: 'まもなく削除', expired: true };
      } else {
        return { text: '削除予定', expired: true };
      }
    } catch (error) {
      console.error('削除時間計算エラー:', error);
      return { text: 'エラー', expired: true };
    }
  },

  // 安全な値取得（undefined/null対策）
  getSafeValues: (currentSpace) => {
    if (!currentSpace || typeof currentSpace !== 'object') {
      return {
        passphrase: '',
        createdAt: new Date(),
        lastActivityAt: new Date()
      };
    }

    return {
      passphrase: currentSpace.passphrase || '',
      createdAt: currentSpace.createdAt instanceof Date ? 
        currentSpace.createdAt : 
        (currentSpace.createdAt ? new Date(currentSpace.createdAt) : new Date()),
      lastActivityAt: currentSpace.lastActivityAt instanceof Date ? 
        currentSpace.lastActivityAt : 
        (currentSpace.lastActivityAt ? new Date(currentSpace.lastActivityAt) : new Date())
    };
  },

  // 合言葉バリデーション
  validatePassphrase: (passphrase) => {
    if (!passphrase) {
      return { valid: false, error: '合言葉を入力してください' };
    }
    
    if (typeof passphrase !== 'string') {
      return { valid: false, error: '合言葉の形式が正しくありません' };
    }
    
    const trimmed = passphrase.trim();
    if (!trimmed) {
      return { valid: false, error: '合言葉を入力してください' };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: '合言葉は100文字以内で入力してください' };
    }
    
    if (trimmed.length < 2) {
      return { valid: false, error: '合言葉は2文字以上で入力してください' };
    }
    
    return { valid: true, passphrase: trimmed };
  },

  // メッセージバリデーション
  validateMessage: (message) => {
    if (!message) {
      return { valid: false, error: 'メッセージを入力してください' };
    }
    
    if (typeof message !== 'string') {
      return { valid: false, error: 'メッセージの形式が正しくありません' };
    }
    
    const trimmed = message.trim();
    if (!trimmed) {
      return { valid: false, error: 'メッセージを入力してください' };
    }
    
    if (trimmed.length > 5000) {
      return { valid: false, error: 'メッセージは5000文字以内で入力してください' };
    }
    
    return { valid: true, message: trimmed };
  },

  // 構造化ログ出力
  log: (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logPrefix = `[${timestamp}] SecureChat:`;
    
    const logData = data ? { message, data } : { message };
    
    switch (level) {
      case 'info':
        console.log(`ℹ️ ${logPrefix}`, logData);
        break;
      case 'warn':
        console.warn(`⚠️ ${logPrefix}`, logData);
        break;
      case 'error':
        console.error(`❌ ${logPrefix}`, logData);
        break;
      case 'debug':
        if (window.DEBUG_MODE || localStorage.getItem('debug') === 'true') {
          console.log(`🐛 ${logPrefix}`, logData);
        }
        break;
      case 'success':
        console.log(`✅ ${logPrefix}`, logData);
        break;
      default:
        console.log(`📝 ${logPrefix}`, logData);
    }
  },

  // エラーハンドリングヘルパー
  handleError: (error, context = '') => {
    const errorMessage = error?.message || 'Unknown error';
    const errorDetails = {
      message: errorMessage,
      context,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    };
    
    window.Utils.log('error', `Error in ${context}`, errorDetails);
    
    // 開発環境でのみスタックトレース表示
    if (window.location.hostname === 'localhost' || window.DEBUG_MODE) {
      console.error('Full error details:', error);
    }
    
    return errorMessage;
  },

  // デバウンス関数（検索機能など将来用）
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // スロットル関数（リアルタイム機能用）
  throttle: (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // ローカルストレージヘルパー（設定保存用）
  storage: {
    get: (key, defaultValue = null) => {
      try {
        const item = localStorage.getItem(`secureChat_${key}`);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        window.Utils.log('warn', 'Storage get error', { key, error: error.message });
        return defaultValue;
      }
    },
    
    set: (key, value) => {
      try {
        localStorage.setItem(`secureChat_${key}`, JSON.stringify(value));
        return true;
      } catch (error) {
        window.Utils.log('warn', 'Storage set error', { key, error: error.message });
        return false;
      }
    },
    
    remove: (key) => {
      try {
        localStorage.removeItem(`secureChat_${key}`);
        return true;
      } catch (error) {
        window.Utils.log('warn', 'Storage remove error', { key, error: error.message });
        return false;
      }
    }
  },

  // パフォーマンス測定ヘルパー
  performance: {
    start: (label) => {
      if (window.performance && window.performance.mark) {
        window.performance.mark(`${label}_start`);
      }
    },
    
    end: (label) => {
      if (window.performance && window.performance.mark && window.performance.measure) {
        window.performance.mark(`${label}_end`);
        window.performance.measure(label, `${label}_start`, `${label}_end`);
        
        const measure = window.performance.getEntriesByName(label)[0];
        window.Utils.log('debug', `Performance: ${label}`, { duration: `${measure.duration.toFixed(2)}ms` });
      }
    }
  }
};

// グローバル設定
window.MESSAGE_EXPIRY_HOURS = window.MESSAGE_EXPIRY_HOURS || '48';
window.DEBUG_MODE = window.location.hostname === 'localhost' || window.location.search.includes('debug=true');

// デバッグ用: ユーティリティの読み込み確認
if (typeof console !== 'undefined') {
  console.log('✅ Utils module loaded:', Object.keys(window.Utils).length + ' utilities available');
}