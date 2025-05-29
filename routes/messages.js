const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();

  // 空間のメッセージ一覧取得
  router.get('/:spaceId', (req, res) => {
    try {
      const { spaceId } = req.params;
      
      if (!spaceId) {
        return res.status(400).json({ 
          success: false,
          error: '空間IDが必要です' 
        });
      }

      // 削除されていないメッセージのみ取得
      const messages = db.prepare(`
        SELECT id, encrypted_content as text, timestamp, expires_at, is_deleted 
        FROM messages 
        WHERE space_id = ? AND is_deleted = 0 
        ORDER BY timestamp ASC
      `).all(spaceId);

      // フロントエンド形式に変換
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        text: msg.text,
        timestamp: new Date(msg.timestamp),
        encrypted: true,
        isDeleted: Boolean(msg.is_deleted)
      }));

      console.log(`📄 メッセージ取得: 空間 ${spaceId} から ${formattedMessages.length}件`);

      res.json({
        success: true,
        messages: formattedMessages
      });

    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // メッセージ送信
  router.post('/create', (req, res) => {
    try {
      const { spaceId, message } = req.body;
      
      if (!spaceId || !message?.trim()) {
        return res.status(400).json({ 
          success: false,
          error: 'メッセージと空間IDが必要です' 
        });
      }

      // 空間存在確認とサンプル空間チェック
      const space = db.prepare('SELECT passphrase FROM spaces WHERE id = ?').get(spaceId);
      
      if (!space) {
        return res.status(404).json({ 
          success: false,
          error: '空間が見つかりません' 
        });
      }

      if (space.passphrase === '秘密の部屋') {
        return res.status(403).json({ 
          success: false,
          error: 'サンプル空間では送信できません' 
        });
      }

      const messageId = nanoid();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + parseInt(process.env.MESSAGE_EXPIRY_HOURS || '48') * 60 * 60 * 1000);

      // メッセージ保存
      const insertResult = db.prepare(`
        INSERT INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        messageId, 
        spaceId, 
        message.trim(), 
        now.toISOString(), 
        expiresAt.toISOString(), 
        0
      );

      if (insertResult.changes === 0) {
        throw new Error('メッセージ保存に失敗しました');
      }

      // 空間の最終アクティビティ更新
      db.prepare('UPDATE spaces SET last_activity_at = datetime(\'now\') WHERE id = ?').run(spaceId);

      const newMessage = {
        id: messageId,
        text: message.trim(),
        timestamp: now,
        encrypted: true,
        isDeleted: false
      };

      console.log(`📨 メッセージ送信: 空間 ${spaceId} に "${message.trim().substring(0, 30)}${message.trim().length > 30 ? '...' : ''}"`);

      res.json({
        success: true,
        message: newMessage
      });

    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // 期限切れメッセージの削除（内部API）
  router.post('/cleanup', (req, res) => {
    try {
      const now = new Date().toISOString();
      
      const result = db.prepare(`
        UPDATE messages 
        SET is_deleted = 1 
        WHERE expires_at <= ? AND is_deleted = 0
      `).run(now);

      console.log(`🗑️ メッセージクリーンアップ: ${result.changes}件削除`);

      res.json({
        success: true,
        deletedCount: result.changes,
        timestamp: now
      });

    } catch (error) {
      console.error('メッセージクリーンアップエラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // メッセージ統計情報取得（開発環境のみ）
  router.get('/stats/:spaceId', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false,
        error: 'この機能は本番環境では利用できません' 
      });
    }

    try {
      const { spaceId } = req.params;
      
      if (!spaceId) {
        return res.status(400).json({ 
          success: false,
          error: '空間IDが必要です' 
        });
      }

      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN is_deleted = 0 THEN 1 END) as active_messages,
          COUNT(CASE WHEN is_deleted = 1 THEN 1 END) as deleted_messages,
          MIN(timestamp) as first_message,
          MAX(timestamp) as last_message,
          COUNT(CASE WHEN expires_at <= datetime('now') AND is_deleted = 0 THEN 1 END) as expired_messages
        FROM messages 
        WHERE space_id = ?
      `).get(spaceId);

      res.json({
        success: true,
        spaceId,
        stats
      });

    } catch (error) {
      console.error('メッセージ統計取得エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // メッセージ削除（管理用・開発環境のみ）
  router.delete('/:messageId', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false,
        error: 'この機能は本番環境では利用できません' 
      });
    }

    try {
      const { messageId } = req.params;
      
      if (!messageId) {
        return res.status(400).json({ 
          success: false,
          error: 'メッセージIDが必要です' 
        });
      }

      // メッセージ存在確認
      const message = db.prepare('SELECT id, space_id FROM messages WHERE id = ?').get(messageId);
      
      if (!message) {
        return res.status(404).json({ 
          success: false,
          error: 'メッセージが見つかりません' 
        });
      }

      // 論理削除
      const result = db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(messageId);

      if (result.changes === 0) {
        throw new Error('メッセージの削除に失敗しました');
      }

      console.log(`🗑️ メッセージ削除: ID ${messageId} (空間: ${message.space_id})`);

      res.json({
        success: true,
        message: 'メッセージを削除しました',
        messageId
      });

    } catch (error) {
      console.error('メッセージ削除エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  return router;
};