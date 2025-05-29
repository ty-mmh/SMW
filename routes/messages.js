const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();

  // 空間のメッセージ一覧取得
  router.get('/:spaceId', (req, res) => {
    const { spaceId } = req.params;
    
    if (!spaceId) {
      return res.status(400).json({ error: '空間IDが必要です' });
    }

    // 削除されていないメッセージのみ取得
    db.all(
      `SELECT id, encrypted_content as text, timestamp, expires_at, is_deleted 
       FROM messages 
       WHERE space_id = ? AND is_deleted = FALSE 
       ORDER BY timestamp ASC`,
      [spaceId],
      (err, messages) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'サーバーエラー' });
        }

        // フロントエンド形式に変換
        const formattedMessages = messages.map(msg => ({
          id: parseInt(msg.id),
          text: msg.text,
          timestamp: new Date(msg.timestamp),
          encrypted: true,
          isDeleted: Boolean(msg.is_deleted)
        }));

        res.json({
          success: true,
          messages: formattedMessages
        });
      }
    );
  });

  // メッセージ送信
  router.post('/create', (req, res) => {
    const { spaceId, message } = req.body;
    
    if (!spaceId || !message?.trim()) {
      return res.status(400).json({ error: 'メッセージと空間IDが必要です' });
    }

    // サンプル空間では送信不可
    db.get(
      'SELECT passphrase FROM spaces WHERE id = ?',
      [spaceId],
      (err, space) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'サーバーエラー' });
        }

        if (!space) {
          return res.status(404).json({ error: '空間が見つかりません' });
        }

        if (space.passphrase === '秘密の部屋') {
          return res.status(403).json({ error: 'サンプル空間では送信できません' });
        }

        const messageId = nanoid();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48時間後

        // メッセージ保存
        db.run(
          `INSERT INTO messages (id, space_id, encrypted_content, timestamp, expires_at, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, spaceId, message.trim(), now.toISOString(), expiresAt.toISOString(), false],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'メッセージ保存エラー' });
            }

            // 空間の最終アクティビティ更新
            db.run(
              'UPDATE spaces SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?',
              [spaceId]
            );

            const newMessage = {
              id: parseInt(messageId, 36),
              text: message.trim(),
              timestamp: now,
              encrypted: true,
              isDeleted: false
            };

            res.json({
              success: true,
              message: newMessage
            });
          }
        );
      }
    );
  });

  // 期限切れメッセージの削除（内部API）
  router.post('/cleanup', (req, res) => {
    const now = new Date().toISOString();
    
    db.run(
      'UPDATE messages SET is_deleted = TRUE WHERE expires_at <= ? AND is_deleted = FALSE',
      [now],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'クリーンアップエラー' });
        }

        res.json({
          success: true,
          deletedCount: this.changes
        });
      }
    );
  });

  return router;
};