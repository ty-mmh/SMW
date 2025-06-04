// routes/messages.js - 暗号化対応完全修正版

const express = require('express');
const { nanoid } = require('../utils/id-generator');

module.exports = (db) => {
  const router = express.Router();

  // 空間のメッセージ一覧取得（暗号化対応修正版）
  router.get('/:spaceId', (req, res) => {
    try {
      const { spaceId } = req.params;
      
      if (!spaceId) {
        return res.status(400).json({ 
          success: false,
          error: '空間IDが必要です' 
        });
      }

      console.log(`📄 メッセージ取得要求: 空間 ${spaceId}`);

      // 削除されていないメッセージのみ取得（暗号化フィールド含む）
      const messages = db.prepare(`
        SELECT 
          id, 
          encrypted_content as text, 
          timestamp, 
          expires_at, 
          is_deleted, 
          encrypted, 
          encrypted_payload
        FROM messages 
        WHERE space_id = ? AND is_deleted = 0 
        ORDER BY timestamp ASC
      `).all(spaceId);

      console.log(`📦 生データ取得: ${messages.length}件のメッセージ`);

      // フロントエンド形式に変換（デバッグ強化）
      const formattedMessages = messages.map((msg, index) => {
        let messageData = {
          id: msg.id,
          text: msg.text,
          timestamp: msg.timestamp,
          encrypted: Boolean(msg.encrypted),
          isDeleted: Boolean(msg.is_deleted)
        };

        console.log(`メッセージ ${index + 1} 処理中:`, {
          id: msg.id,
          encrypted: msg.encrypted,
          hasPayload: !!msg.encrypted_payload,
          payloadLength: msg.encrypted_payload?.length || 0
        });

        // 🔧 修正: 暗号化データの処理を強化
        if (msg.encrypted && msg.encrypted_payload) {
          try {
            console.log(`🔓 暗号化ペイロード解析中: ${msg.id}`);
            const payloadData = JSON.parse(msg.encrypted_payload);
            
            // 必要なフィールドの確認
            if (payloadData.encryptedData && payloadData.iv) {
              messageData.encryptedData = payloadData.encryptedData;
              messageData.iv = payloadData.iv;
              messageData.algorithm = payloadData.algorithm || 'AES-GCM-256';
              
              console.log(`✅ 暗号化データ設定完了: ${msg.id}`, {
                encryptedDataLength: payloadData.encryptedData.length,
                ivLength: payloadData.iv.length,
                algorithm: payloadData.algorithm
              });
            } else {
              console.warn(`⚠️ 暗号化ペイロード不完全: ${msg.id}`, payloadData);
              messageData.encryptedData = null;
              messageData.iv = null;
            }
          } catch (parseError) {
            console.error(`❌ 暗号化ペイロード解析エラー: ${msg.id}`, parseError);
            messageData.encryptedData = null;
            messageData.iv = null;
          }
        } else if (msg.encrypted) {
          // 暗号化フラグが立っているがペイロードがない場合
          console.warn(`⚠️ 暗号化フラグがあるがペイロードなし: ${msg.id}`);
          messageData.encryptedData = null;
          messageData.iv = null;
        }

        return messageData;
      });

      console.log(`📨 レスポンス送信: ${formattedMessages.length}件のメッセージ`);
      console.log('暗号化メッセージ数:', formattedMessages.filter(m => m.encrypted).length);

      res.json({
        success: true,
        messages: formattedMessages,
        debug: {
          totalMessages: formattedMessages.length,
          encryptedMessages: formattedMessages.filter(m => m.encrypted).length,
          messagesWithData: formattedMessages.filter(m => m.encryptedData && m.iv).length
        }
      });

    } catch (error) {
      console.error('❌ メッセージ取得エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // メッセージ送信（暗号化対応修正版）
  router.post('/create', (req, res) => {
    try {
      const { spaceId, message, encrypted, encryptedPayload } = req.body;
      
      console.log('📤 メッセージ送信要求:', {
        spaceId,
        messageLength: message?.length || 0,
        encrypted: Boolean(encrypted),
        hasEncryptedPayload: !!encryptedPayload
      });
      
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

      // 🔧 修正: 暗号化データの処理を強化
      let storedContent = message.trim();
      let storedEncryptedPayload = null;
      let isEncrypted = false;

      if (encrypted && encryptedPayload) {
        // 暗号化メッセージの場合
        console.log('🔒 暗号化メッセージ処理中:', {
          encryptedDataLength: encryptedPayload.encryptedData?.length || 0,
          ivLength: encryptedPayload.iv?.length || 0,
          algorithm: encryptedPayload.algorithm
        });

        // 暗号化ペイロードの検証
        if (encryptedPayload.encryptedData && encryptedPayload.iv) {
          storedContent = '[ENCRYPTED]'; // データベース識別用
          storedEncryptedPayload = JSON.stringify({
            encryptedData: encryptedPayload.encryptedData,
            iv: encryptedPayload.iv,
            algorithm: encryptedPayload.algorithm || 'AES-GCM-256',
            timestamp: now.toISOString()
          });
          isEncrypted = true;
          
          console.log('✅ 暗号化ペイロード作成完了');
        } else {
          console.warn('⚠️ 暗号化ペイロード不完全 - 平文として保存');
        }
      } else {
        console.log('📝 平文メッセージとして処理');
      }

      console.log('💾 データベース保存中:', {
        messageId,
        encrypted: isEncrypted,
        contentLength: storedContent.length,
        hasPayload: !!storedEncryptedPayload
      });

      // メッセージ保存（暗号化ペイロード対応）
      const insertResult = db.prepare(`
        INSERT INTO messages (
          id, 
          space_id, 
          encrypted_content, 
          timestamp, 
          expires_at, 
          is_deleted, 
          encrypted, 
          encrypted_payload
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        messageId, 
        spaceId, 
        storedContent, 
        now.toISOString(), 
        expiresAt.toISOString(), 
        0,
        isEncrypted ? 1 : 0,
        storedEncryptedPayload
      );

      if (insertResult.changes === 0) {
        throw new Error('メッセージ保存に失敗しました');
      }

      // 空間の最終アクティビティ更新
      db.prepare('UPDATE spaces SET last_activity_at = datetime(\'now\') WHERE id = ?').run(spaceId);

      // レスポンス用メッセージオブジェクト
      const newMessage = {
        id: messageId,
        text: message.trim(), // フロントエンドには元のメッセージを返す
        timestamp: now.toISOString(),
        encrypted: isEncrypted,
        isDeleted: false
      };

      // 暗号化データがある場合は追加
      if (isEncrypted && encryptedPayload) {
        newMessage.encryptedData = encryptedPayload.encryptedData;
        newMessage.iv = encryptedPayload.iv;
        newMessage.algorithm = encryptedPayload.algorithm;
      }

      console.log('✅ メッセージ送信完了:', {
        messageId,
        encrypted: isEncrypted,
        responseSize: JSON.stringify(newMessage).length
      });

      res.json({
        success: true,
        message: newMessage,
        debug: {
          messageId,
          encrypted: isEncrypted,
          hasEncryptedData: !!newMessage.encryptedData,
          hasIv: !!newMessage.iv
        }
      });

    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // 🔧 新規追加: メッセージデバッグエンドポイント（開発環境のみ）
  router.get('/debug/:spaceId', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        success: false,
        error: 'この機能は本番環境では利用できません' 
      });
    }

    try {
      const { spaceId } = req.params;
      
      console.log(`🔍 デバッグ情報取得: 空間 ${spaceId}`);

      // 全メッセージ取得（削除済み含む）
      const allMessages = db.prepare(`
        SELECT * FROM messages WHERE space_id = ? ORDER BY timestamp ASC
      `).all(spaceId);

      const debugInfo = allMessages.map(msg => ({
        id: msg.id,
        encrypted_content_preview: msg.encrypted_content?.substring(0, 50) + '...',
        encrypted: Boolean(msg.encrypted),
        has_encrypted_payload: !!msg.encrypted_payload,
        encrypted_payload_preview: msg.encrypted_payload?.substring(0, 100) + '...',
        is_deleted: Boolean(msg.is_deleted),
        timestamp: msg.timestamp,
        expires_at: msg.expires_at
      }));

      res.json({
        success: true,
        spaceId,
        messageCount: allMessages.length,
        encryptedCount: allMessages.filter(m => m.encrypted).length,
        messages: debugInfo
      });

    } catch (error) {
      console.error('❌ デバッグ情報取得エラー:', error);
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
      console.error('❌ メッセージクリーンアップエラー:', error);
      res.status(500).json({ 
        success: false,
        error: 'サーバーエラーが発生しました' 
      });
    }
  });

  return router;
};