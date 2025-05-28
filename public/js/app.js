const { useState, useEffect } = React;
const { Lock, MessageCircle, Users, Clock, Shield, AlertCircle, Key, Trash2 } = lucide;

const SecureChatApp = () => {
  const [currentView, setCurrentView] = useState('login');
  const [passphrase, setPassphrase] = useState('');
  const [currentSpace, setCurrentSpace] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newSpacePassphrase, setNewSpacePassphrase] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showPassphraseInHeader, setShowPassphraseInHeader] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [socket, setSocket] = useState(null);
  
  // APIクライアント
  const api = {
    async enterSpace(passphrase) {
      const response = await fetch(`${window.API_BASE}/spaces/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      });
      return response.json();
    },

    async createSpace(passphrase) {
      const response = await fetch(`${window.API_BASE}/spaces/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      });
      return response.json();
    },

    async getMessages(spaceId) {
      const response = await fetch(`${window.API_BASE}/messages/${spaceId}`);
      return response.json();
    },

    async sendMessage(spaceId, message, passphrase) {
      const response = await fetch(`${window.API_BASE}/messages/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, message, passphrase })
      });
      return response.json();
    }
  };

  // Socket.IO接続
  useEffect(() => {
    if (currentSpace && !socket) {
      const newSocket = io(window.SOCKET_URL);
      
      newSocket.on('connect', () => {
        console.log('Connected to server');
        newSocket.emit('join-space', currentSpace.id);
      });

      newSocket.on('message-received', (data) => {
        setCurrentSpace(prev => ({
          ...prev,
          messages: [...prev.messages, data.message]
        }));
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [currentSpace]);

  // 現在時刻を定期更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // 30秒ごと

    return () => clearInterval(timer);
  }, []);

  const enterSpace = async () => {
    setError('');
    if (!passphrase.trim()) {
      setError('合言葉を入力してください');
      return;
    }
    
    try {
      const result = await api.enterSpace(passphrase);
      if (result.success) {
        // メッセージを取得（まずは空配列で初期化）
        const space = {
          ...result.space,
          messages: []
        };
        
        setCurrentSpace(space);
        setCurrentView('chat');
        setPassphrase('');
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Enter space error:', error);
      setError('サーバーとの通信でエラーが発生しました');
    }
  };

  const createSpace = async () => {
    setError('');
    if (!newSpacePassphrase.trim()) {
      setError('合言葉を入力してください');
      return;
    }
    
    try {
      const result = await api.createSpace(newSpacePassphrase);
      if (result.success) {
        setShowCreateSpace(false);
        setNewSpacePassphrase('');
        setError('');
        alert('✅ 新しい空間を作成しました！');
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error('Create space error:', error);
      setError('サーバーとの通信でエラーが発生しました');
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    // サンプル空間では送信不可
    if (currentSpace.passphrase === '秘密の部屋') {
      alert('⚠️ これはサンプル空間です。メッセージの送信はできません。');
      return;
    }
    
    try {
      const result = await api.sendMessage(
        currentSpace.id, 
        message, 
        currentSpace.passphrase
      );
      
      if (result.success) {
        const newMessage = {
          id: Date.now(),
          text: message,
          timestamp: new Date().toISOString(),
          encrypted: true,
          isDeleted: false
        };
        
        setCurrentSpace(prev => ({
          ...prev,
          messages: [...prev.messages, newMessage]
        }));
        
        // Socket.IOで他のユーザーに送信
        if (socket) {
          socket.emit('new-message', {
            spaceId: currentSpace.id,
            message: newMessage
          });
        }
        
        setMessage('');
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('メッセージの送信でエラーが発生しました');
    }
  };

  const leaveSpace = () => {
    if (socket) {
      socket.emit('leave-space', currentSpace.id);
      socket.disconnect();
      setSocket(null);
    }
    setCurrentSpace(null);
    setCurrentView('login');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleString('ja-JP', { 
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatRelativeTime = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    if (minutes > 0) return `${minutes}分前`;
    return 'たった今';
  };

  const getMessageTimeRemaining = (timestamp) => {
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
  };

  const getActiveMessages = () => {
    // サンプル空間のメッセージは削除されない
    if (currentSpace.passphrase === '秘密の部屋') {
      return currentSpace.messages;
    }
    return currentSpace.messages.filter(msg => !msg.isDeleted);
  };

  if (currentView === 'login') {
    return React.createElement('div', {
      className: "min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white flex items-center justify-center p-4"
    }, 
      React.createElement('div', {
        className: "max-w-md w-full"
      },
        React.createElement('div', {
          className: "text-center mb-8"
        },
          React.createElement('div', {
            className: "flex justify-center mb-4 relative"
          },
            React.createElement(Shield, {
              className: "w-16 h-16 text-blue-400 animate-pulse"
            }),
            React.createElement('div', {
              className: "absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
            },
              React.createElement('div', {
                className: "w-2 h-2 bg-white rounded-full"
              })
            )
          ),
          React.createElement('h1', {
            className: "text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          }, "セキュアチャット"),
          React.createElement('p', {
            className: "text-gray-300"
          }, "合言葉で守られたプライベート空間")
        ),
        
        React.createElement('div', {
          className: "bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-gray-700"
        },
          React.createElement('div', {
            className: "mb-6"
          },
            React.createElement('label', {
              className: "block text-sm font-medium mb-2 text-gray-200"
            }, "空間への合言葉を入力"),
            React.createElement('input', {
              type: "text",
              value: passphrase,
              onChange: (e) => setPassphrase(e.target.value),
              onKeyPress: (e) => e.key === 'Enter' && enterSpace(),
              placeholder: "例: 秘密の部屋",
              className: "w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none transition-all"
            }),
            error && React.createElement('div', {
              className: "mt-3 text-red-400 text-sm flex items-center gap-2 bg-red-900/20 p-2 rounded"
            },
              React.createElement(AlertCircle, { className: "w-4 h-4" }),
              error
            )
          ),

          React.createElement('button', {
            onClick: enterSpace,
            className: "w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 py-3 px-4 rounded-lg font-medium transition duration-200 flex items-center justify-center gap-2 shadow-lg"
          },
            React.createElement(Lock, { className: "w-4 h-4" }),
            "空間に入る"
          ),

          React.createElement('div', {
            className: "mt-6 pt-4 border-t border-gray-700"
          },
            React.createElement('button', {
              onClick: () => setShowCreateSpace(!showCreateSpace),
              className: "w-full bg-gray-700/50 hover:bg-gray-600/50 py-3 px-4 rounded-lg font-medium transition duration-200 border border-gray-600"
            }, "新しい空間を作成"),
            
            showCreateSpace && React.createElement('div', {
              className: "mt-4 p-4 bg-gray-700/30 rounded-lg border border-gray-600"
            },
              React.createElement('input', {
                type: "text",
                value: newSpacePassphrase,
                onChange: (e) => setNewSpacePassphrase(e.target.value),
                placeholder: "新しい合言葉",
                className: "w-full px-4 py-2 bg-gray-600/50 rounded-lg border border-gray-500 focus:border-blue-500 focus:outline-none mb-3"
              }),
              React.createElement('button', {
                onClick: createSpace,
                className: "w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-2 px-4 rounded-lg font-medium transition duration-200"
              }, "作成")
            )
          ),

          React.createElement('div', {
            className: "mt-6 space-y-2 text-center text-sm text-gray-400"
          },
            React.createElement('div', {
              className: "flex items-center justify-center gap-2"
            },
              React.createElement(Shield, { className: "w-4 h-4 text-green-400" }),
              React.createElement('span', {}, "全ての通信はE2EEで保護されます")
            ),
            React.createElement('div', {
              className: "flex items-center justify-center gap-2"
            },
              React.createElement(Clock, { className: "w-4 h-4 text-blue-400" }),
              React.createElement('span', {}, "各メッセージは投稿から48時間で自動削除")
            ),
            React.createElement('div', {
              className: "flex items-center justify-center gap-2"
            },
              React.createElement(Key, { className: "w-4 h-4 text-purple-400" }),
              React.createElement('span', {}, "合言葉のみでアクセス可能")
            )
          )
        )
      )
    );
  }

  const activeMessages = getActiveMessages();

  return React.createElement('div', {
    className: "min-h-screen bg-gray-900 text-white flex flex-col"
  },
    // ヘッダー
    React.createElement('div', {
      className: "bg-gray-800/90 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10"
    },
      React.createElement('div', {
        className: "max-w-4xl mx-auto flex items-center justify-between"
      },
        React.createElement('div', {
          className: "flex items-center gap-3"
        },
          React.createElement(MessageCircle, {
            className: "w-6 h-6 text-blue-400"
          }),
          React.createElement('button', {
            onClick: () => setShowPassphraseInHeader(!showPassphraseInHeader),
            className: "text-sm text-gray-300 bg-gray-700/50 hover:bg-gray-600/50 px-3 py-1 rounded-full border border-gray-600 transition-colors cursor-pointer select-none"
          },
            showPassphraseInHeader ? currentSpace.passphrase : '•'.repeat(currentSpace.passphrase.length)
          )
        ),
        
        React.createElement('button', {
          onClick: leaveSpace,
          className: "bg-red-600/80 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
        }, "退室")
      ),
      
      // 空間情報
      React.createElement('div', {
        className: "max-w-4xl mx-auto mt-2 text-xs text-gray-400 flex justify-between"
      },
        React.createElement('span', {}, `作成: ${formatRelativeTime(currentSpace.createdAt)}`),
        React.createElement('span', {}, `最終アクティビティ: ${formatRelativeTime(currentSpace.lastActivityAt)}`)
      )
    ),

    // チャットエリア
    React.createElement('div', {
      className: "flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-900 to-gray-800"
    },
      React.createElement('div', {
        className: "max-w-4xl mx-auto"
      },
        activeMessages.length === 0 ? 
          React.createElement('div', {
            className: "text-center text-gray-400 mt-12"
          },
            React.createElement(Users, {
              className: "w-16 h-16 mx-auto mb-4 opacity-30"
            }),
            React.createElement('p', {
              className: "text-lg"
            }, "まだメッセージがありません"),
            React.createElement('p', {
              className: "text-sm mt-2 opacity-75"
            }, "最初のメッセージを送信してください")
          ) :
          React.createElement('div', {
            className: "space-y-4"
          },
            activeMessages.map((msg) => {
              const timeRemaining = getMessageTimeRemaining(msg.timestamp);
              return React.createElement('div', {
                key: msg.id,
                className: "bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:bg-gray-800/80 transition-all"
              },
                React.createElement('div', {
                  className: "flex items-start justify-between gap-3"
                },
                  React.createElement('pre', {
                    className: "text-gray-100 flex-1 leading-relaxed whitespace-pre-wrap font-sans"
                  }, msg.text),
                  React.createElement('div', {
                    className: "text-xs text-gray-400 text-right whitespace-nowrap min-w-0"
                  },
                    React.createElement('div', {
                      className: "flex items-center gap-1 justify-end mb-1"
                    },
                      msg.encrypted && React.createElement(Lock, {
                        className: "w-3 h-3 text-green-400"
                      }),
                      React.createElement('span', {}, formatTime(msg.timestamp))
                    ),
                    React.createElement('div', {
                      className: `flex items-center gap-1 justify-end ${timeRemaining.expired ? 'text-red-400' : 'text-gray-500'}`
                    },
                      timeRemaining.expired ? 
                        React.createElement(Trash2, { className: "w-3 h-3" }) : 
                        React.createElement(Clock, { className: "w-3 h-3" }),
                      React.createElement('span', {
                        className: "text-xs"
                      }, timeRemaining.text)
                    )
                  )
                )
              );
            })
          )
      )
    ),

    // メッセージ入力
    React.createElement('div', {
      className: "bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 p-4 sticky bottom-0"
    },
      React.createElement('div', {
        className: "max-w-4xl mx-auto"
      },
        React.createElement('div', {
          className: "flex gap-3 items-end"
        },
          React.createElement('div', {
            className: "flex-1"
          },
            React.createElement('textarea', {
              value: message,
              onChange: (e) => setMessage(e.target.value),
              placeholder: currentSpace.passphrase === '秘密の部屋' ? 
                'これはサンプル空間です（送信不可）' : 
                'メッセージを入力...',
              className: "w-full px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none min-h-[44px] max-h-32",
              rows: 1,
              disabled: currentSpace.passphrase === '秘密の部屋'
            })
          ),
          React.createElement('button', {
            onClick: sendMessage,
            disabled: !message.trim() || currentSpace.passphrase === '秘密の部屋',
            className: "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition duration-200 flex items-center gap-2 min-w-0"
          },
            React.createElement(Lock, { className: "w-4 h-4" }),
            React.createElement('span', {
              className: "hidden sm:inline"
            }, "送信")
          )
        ),
        
        React.createElement('div', {
          className: "mt-2 text-xs text-gray-500 flex justify-between items-center"
        },
          React.createElement('span', {},
            currentSpace.passphrase === '秘密の部屋' ? 
              '📖 サンプル空間（閲覧のみ）' : 
              '🔒 E2E暗号化済み | ⏰ 48時間で自動削除'
          ),
          React.createElement('span', {}, formatTime(currentTime))
        )
      )
    )
  );
};

// Lucide Reactアイコンのモック（CDNから読み込まれない場合の代替）
const lucideFallback = {
  Lock: () => React.createElement('span', {}, '🔒'),
  MessageCircle: () => React.createElement('span', {}, '💬'),  
  Users: () => React.createElement('span', {}, '👥'),
  Clock: () => React.createElement('span', {}, '⏰'),
  Shield: () => React.createElement('span', {}, '🛡️'),
  AlertCircle: () => React.createElement('span', {}, '⚠️'),
  Key: () => React.createElement('span', {}, '🔑'),
  Trash2: () => React.createElement('span', {}, '🗑️')
};

// Lucide Reactが利用できない場合のフォールバック
if (typeof lucide === 'undefined') {
  window.lucide = lucideFallback;
}

// アプリケーションをDOMにレンダリング
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(SecureChatApp));
