const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();

  // バリデーション関数
  const validatePassphrase = (passphrase) => {
    if (!passphrase || typeof passphrase !== 'string') {
      return { valid: false, error: '合言葉が必要です' };
    }
    
    const trimmed = passphrase.trim();
    if (!trimmed) {
      return { valid: false, error: '合言葉を入力してください' };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: '合言葉は100文字以内で入力してください' };
    }
    
    return { valid: true, passphrase: trimmed };
  };

  // 空間に入室
  router.post('/enter', (req, res) => {
    try {
      const validation = validatePassphrase(req.body.passphrase);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false,
          error: validation.error 
        });
      }

      const { passphrase } = validation;

      // データベースから空間を検索
      const space = db.prepare('SELECT * FROM spaces WHERE passphrase = ?').get(passphrase);
      
      if (!space) {
        return res.status(404).json({ 
          success: false,
          error: 'その合言葉の空間は存在しません' 
        });
      }

      // 最終アクティビティ更新
      const updateResult = db.prepare(`
        UPDATE spaces 
        SET last_activity_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(space.id);

      if (updateResult.changes === 0) {
        console.warn(`空間の更新に失敗: ${space.id}`);
      }

      // レスポンス用データ整形
      const responseSpace = {
        id: space.id,
        passphrase: space.passphrase,
        createdAt: space.created_at,
        lastActivityAt: new Date().toISOString()
      };

      console.log(`✅ 空間入室: ${passphrase} (ID: ${space.id})`);

      res.json({
        success: true,
        space: responseSpace
      });

    } catch (error) {
      console.error('空間入室エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // 空間作成
  router.post('/create', (req, res) => {
    try {
      const validation = validatePassphrase(req.body.passphrase);
      
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false,
          error: validation.error 
        });
      }

      const { passphrase } = validation;

      // 重複チェック
      const existingSpace = db.prepare(
        'SELECT id FROM spaces WHERE passphrase = ?'
      ).get(passphrase);
      
      if (existingSpace) {
        return res.status(409).json({ 
          success: false,
          error: 'その合言葉は既に使用されています' 
        });
      }

      // 新しい空間を作成
      const spaceId = nanoid();
      const now = new Date().toISOString();
      
      const insertResult = db.prepare(`
        INSERT INTO spaces (id, passphrase, created_at, last_activity_at) 
        VALUES (?, ?, ?, ?)
      `).run(spaceId, passphrase, now, now);

      if (insertResult.changes === 0) {
        throw new Error('空間の作成に失敗しました');
      }

      const newSpace = {
        id: spaceId,
        passphrase,
        createdAt: now,
        lastActivityAt: now
      };

      console.log(`✅ 空間作成: ${passphrase} (ID: ${spaceId})`);

      res.json({
        success: true,
        message: '新しい空間を作成しました',
        space: newSpace
      });

    } catch (error) {
      console.error('空間作成エラー:', error);
      
      // SQLite制約エラーのハンドリング
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ 
          success: false,
          error: 'その合言葉は既に使用されています' 
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // 空間情報取得
  router.get('/:spaceId', (req, res) => {
    try {
      const { spaceId } = req.params;
      
      if (!spaceId) {
        return res.status(400).json({ 
          success: false,
          error: '空間IDが必要です' 
        });
      }

      const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(spaceId);
      
      if (!space) {
        return res.status(404).json({ 
          success: false,
          error: '空間が見つかりません' 
        });
      }

      // メッセージ数を取得
      const messageCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE space_id = ? AND is_deleted = FALSE
      `).get(spaceId);

      const responseSpace = {
        id: space.id,
        passphrase: space.passphrase,
        createdAt: space.created_at,
        lastActivityAt: space.last_activity_at,
        messageCount: messageCount.count
      };

      res.json({
        success: true,
        space: responseSpace
      });

    } catch (error) {
      console.error('空間情報取得エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // 空間一覧取得（管理用・開発環境のみ）
  router.get('/', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false,
        error: 'この機能は本番環境では利用できません' 
      });
    }

    try {
      const spaces = db.prepare(`
        SELECT s.*, 
               COUNT(m.id) as message_count,
               MAX(m.timestamp) as last_message_at
        FROM spaces s
        LEFT JOIN messages m ON s.id = m.space_id AND m.is_deleted = FALSE
        GROUP BY s.id
        ORDER BY s.last_activity_at DESC
        LIMIT 50
      `).all();

      const formattedSpaces = spaces.map(space => ({
        id: space.id,
        passphrase: space.passphrase,
        createdAt: space.created_at,
        lastActivityAt: space.last_activity_at,
        messageCount: space.message_count,
        lastMessageAt: space.last_message_at
      }));

      res.json({
        success: true,
        spaces: formattedSpaces,
        total: formattedSpaces.length
      });

    } catch (error) {
      console.error('空間一覧取得エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  // 空間削除（管理用・開発環境のみ）
  router.delete('/:spaceId', (req, res) => {
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

      // 空間存在確認
      const space = db.prepare('SELECT passphrase FROM spaces WHERE id = ?').get(spaceId);
      
      if (!space) {
        return res.status(404).json({ 
          success: false,
          error: '空間が見つかりません' 
        });
      }

      // サンプル空間は削除不可
      if (space.passphrase === '秘密の部屋') {
        return res.status(403).json({ 
          success: false,
          error: 'サンプル空間は削除できません' 
        });
      }

      // トランザクション実行
      const deleteTransaction = db.transaction(() => {
        // メッセージ削除
        const deleteMessages = db.prepare('DELETE FROM messages WHERE space_id = ?').run(spaceId);
        
        // 空間削除
        const deleteSpace = db.prepare('DELETE FROM spaces WHERE id = ?').run(spaceId);
        
        return { messagesDeleted: deleteMessages.changes, spaceDeleted: deleteSpace.changes };
      });

      const result = deleteTransaction();

      console.log(`🗑️ 空間削除: ${space.passphrase} (ID: ${spaceId}) - メッセージ${result.messagesDeleted}件も削除`);

      res.json({
        success: true,
        message: '空間を削除しました',
        deletedMessages: result.messagesDeleted
      });

    } catch (error) {
      console.error('空間削除エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  return router;
};