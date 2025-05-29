// ユーティリティモジュール
window.Utils = {
  // 時刻フォーマット
  formatTime: (date) => {
    try {
      return new Date(date).toLocaleString('ja-JP', { 
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return '無効な日時';
    }
  },

  // 相対時間フォーマット
  formatRelativeTime: (date) => {
    try {
      const now = new Date();
      const diff = now - new Date(date);
      const minutes = Math.floor(diff / (60 * 1000));
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      
      if (days > 0) return `${days}日前`;
      if (hours > 0) return `${hours}時間前`;
      if (minutes > 0) return `${minutes}分前`;
      return 'たった今';
    } catch (error) {
      return '不明';
    }
  },

  // メッセージ削除までの残り時間
  getMessageTimeRemaining: (timestamp) => {
    try {
      const created = new Date(timestamp);
      const deleteTime = new Date(created.getTime() + 48 * 60 * 60 * 1000);
      const now = new Date();
      const remaining = deleteTime - now;
      
      if (remaining <= 0) return { text: '削除済み', expired: true };
      
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return { text: `あと${days}日${hours % 24}時間`, expired: false };
      } else if (hours > 0) {
        return { text: `あと${hours}時間${minutes}分`, expired: false };
      } else if (minutes > 0) {
        return { text: `あと${minutes}分`, expired: false };
      } else {
        return { text: 'まもなく削除', expired: true };
      }
    } catch (error) {
      return { text: '不明', expired: true };
    }
  },

  // 安全な値取得
  getSafeValues: (currentSpace) => ({
    passphrase: currentSpace?.passphrase || '',
    createdAt: currentSpace?.createdAt || new Date(),
    lastActivityAt: currentSpace?.lastActivityAt || new Date()
  }),

  // バリデーション
  validatePassphrase: (passphrase) => {
    if (!passphrase || !passphrase.trim()) {
      return { valid: false, error: '合言葉を入力してください' };
    }
    return { valid: true };
  },

  // デバッグログ
  log: (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(`ℹ️ ${logMessage}`, data || '');
        break;
      case 'warn':
        console.warn(`⚠️ ${logMessage}`, data || '');
        break;
      case 'error':
        console.error(`❌ ${logMessage}`, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  }
};