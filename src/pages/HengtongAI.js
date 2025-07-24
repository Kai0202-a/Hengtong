import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const HengtongAI = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '您好！我是恆通AI助手，可以協助您處理庫存管理、訂單查詢、數據分析等相關問題。請問有什麼可以幫助您的嗎？'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(!apiKey);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey.trim());
      setShowApiKeyInput(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    if (!apiKey) {
      alert('請先設定 OpenAI API Key');
      setShowApiKeyInput(true);
      return;
    }

    const userMessage = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是恆通公司的AI助手，專門協助處理庫存管理、訂單處理、數據分析等業務。請用繁體中文回答，並保持專業且友善的語調。'
            },
            ...messages,
            userMessage
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.choices[0].message.content
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('發送訊息失敗:', error);
      const errorMessage = {
        role: 'assistant',
        content: '抱歉，發生錯誤。請檢查您的 API Key 是否正確，或稍後再試。'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '您好！我是恆通AI助手，可以協助您處理庫存管理、訂單查詢、數據分析等相關問題。請問有什麼可以幫助您的嗎？'
      }
    ]);
  };

  return (
    <div style={{
      background: '#23272f',
      minHeight: '100vh',
      padding: 20
    }}>
      {/* 標題欄 */}
      <div style={{
        background: '#2c3e50',
        padding: 24,
        borderRadius: 12,
        marginBottom: 24,
        boxShadow: '0 2px 12px #0002',
        color: '#f5f6fa'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#f5f6fa', fontSize: 28, fontWeight: '600' }}>🤖 恆通AI助手</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              style={{
                padding: '8px 16px',
                background: '#34495e',
                color: '#f5f6fa',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              🔑 API設定
            </button>
            <button
              onClick={clearChat}
              style={{
                padding: '8px 16px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              🗑️ 清除對話
            </button>
            <button
              onClick={() => navigate('/admin')}
              style={{
                padding: '8px 16px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              ← 返回管理頁面
            </button>
          </div>
        </div>

        {/* API Key 設定區域 */}
        {showApiKeyInput && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: '#34495e',
            borderRadius: 8,
            border: '1px solid #4a5f7a'
          }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#f5f6fa', fontSize: 14 }}>
              OpenAI API Key：
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="請輸入您的 OpenAI API Key"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#23272f',
                  color: '#f5f6fa',
                  outline: 'none'
                }}
              />
              <button
                onClick={saveApiKey}
                style={{
                  padding: '8px 16px',
                  background: '#27ae60',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                保存
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#bdc3c7' }}>
              API Key 將安全地儲存在您的瀏覽器本地，不會上傳到伺服器。
            </p>
          </div>
        )}
      </div>

      {/* 聊天區域 */}
      <div style={{
        background: '#2c3e50',
        borderRadius: 12,
        height: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 12px #0002'
      }}>
        {/* 訊息列表 */}
        <div style={{
          flex: 1,
          padding: 20,
          overflowY: 'auto',
          background: '#23272f',
          borderRadius: '12px 12px 0 0'
        }}>
          {messages.map((message, index) => (
            <div
              key={index}
              style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: message.role === 'user' ? '#667eea' : '#34495e',
                  color: '#f5f6fa',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5
                }}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: '#34495e',
                color: '#f5f6fa'
              }}>
                正在思考中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 輸入區域 */}
        <div style={{
          padding: 20,
          background: '#2c3e50',
          borderRadius: '0 0 12px 12px',
          borderTop: '1px solid #34495e'
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="請輸入您的問題..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                background: '#34495e',
                color: '#f5f6fa',
                outline: 'none',
                resize: 'none',
                minHeight: 50,
                maxHeight: 120
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: '12px 24px',
                background: isLoading || !inputMessage.trim() ? '#7f8c8d' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                minWidth: 80
              }}
            >
              {isLoading ? '⏳' : '發送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HengtongAI;