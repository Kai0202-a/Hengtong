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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      role: 'user',
      content: inputMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: inputMessage
        })
      });

      if (!response.ok) {
        // 嘗試獲取詳細錯誤信息
        let errorDetails = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetails = errorData.details || errorData.error || errorDetails;
        } catch (e) {
          // 如果無法解析 JSON，使用狀態碼
        }
        throw new Error(`API 請求失敗: ${errorDetails}`);
      }

      const data = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: data.message
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('發送訊息失敗:', error);
      
      // 顯示詳細錯誤信息
      let errorMessage = '抱歉，發生錯誤。請稍後再試。';
      
      if (error.message.includes('API 請求失敗')) {
        errorMessage = `錯誤詳情: ${error.message}\n\n可能的解決方案：\n1. 檢查 Vercel 環境變數 OPENAI_API_KEY 設定\n2. 確認 OpenAI API Key 是否有效\n3. 檢查網路連接狀況\n4. 查看瀏覽器開發者工具的 Network 標籤獲取更多信息`;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = '網路連接失敗，請檢查您的網路連接。';
      }
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage
      }]);
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