// 独自のID生成ユーティリティ
// nanoidの代替として使用

const crypto = require('crypto');

/**
 * ランダムなIDを生成
 * @param {number} length - IDの長さ（デフォルト: 21）
 * @returns {string} 生成されたID
 */
function generateId(length = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * より強力な暗号学的に安全なIDを生成
 * @param {number} length - IDの長さ（デフォルト: 21）
 * @returns {string} 生成されたID
 */
function generateSecureId(length = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = crypto.randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

/**
 * タイムスタンプ付きIDを生成（デバッグに便利）
 * @param {string} prefix - IDのプレフィックス
 * @returns {string} 生成されたID
 */
function generateTimestampId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = generateId(8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * UUIDv4を生成（標準的なUUID）
 * @returns {string} UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

module.exports = {
  generateId,
  generateSecureId,
  generateTimestampId,
  generateUUID,
  // nanoid互換のエイリアス
  nanoid: generateSecureId
};