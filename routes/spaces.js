const express = require('express');
const { nanoid } = require('nanoid');

module.exports = (db) => {
  const router = express.Router();

  // 空間に入室
  router.post('/enter', (req, res) => {
    const { passphrase } = req.body;
    
    if (!passphrase?.trim()) {
      return res.status(400).json({ error: '合言葉を入力してください' });
    }

    db.get(
      'SELECT * FROM spaces WHERE passphrase = ?',
      [passphrase],
      (err, space) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'サーバーエラー' });
        }
        
        if (!space) {
          return res.status(404).json({ error: 'その合言葉の空間は存在しません' });
        }

        // 最終アクティビティ更新
        db.run(
          'UPDATE spaces SET last_activity_at = CURRENT_TIMESTAMP WHERE id = ?',
          [space.id]
        );

        res.json({
          success: true,
          space: {
            id: space.id,
            passphrase: space.passphrase,
            createdAt: space.created_at,
            lastActivityAt: new Date().toISOString()
          }
        });
      }
    );
  });

  // 空間作成
  router.post('/create', (req, res) => {
    const { passphrase } = req.body;
    
    if (!passphrase?.trim()) {
      return res.status(400).json({ error: '合言葉を入力してください' });
    }

    const spaceId = nanoid();
    
    db.run(
      'INSERT INTO spaces (id, passphrase) VALUES (?, ?)',
      [spaceId, passphrase],
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'その合言葉は既に使用されています' });
          }
          console.error('Database error:', err);
          return res.status(500).json({ error: 'サーバーエラー' });
        }

        res.json({
          success: true,
          message: '新しい空間を作成しました',
          space: {
            id: spaceId,
            passphrase,
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString()
          }
        });
      }
    );
  });

  return router;
};
