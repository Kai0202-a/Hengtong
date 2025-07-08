import './App.css';
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Admin from "./pages/Admin";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ShippingStats from './pages/ShippingStats';
import { partsData } from './pages/partsData';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Register from './pages/Register';
import { UserProvider, UserContext } from './UserContext';

function App() {
  const [parts, setParts] = useState(partsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // 網絡狀態監聽
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // 網絡恢復時重新同步數據
      if (lastSyncTime && Date.now() - lastSyncTime > 30000) {
        fetchInventory();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [lastSyncTime]);

  // 帶重試機制的 API 請求
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          timeout: 10000, // 10秒超時
        });
        if (response.ok) {
          return response;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        if (i === retries - 1) throw error;
        // 指數退避重試
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }, []);

  // 優化的庫存獲取函數
  const fetchInventory = useCallback(async () => {
    if (!isOnline) {
      setError('網絡連接不可用，使用本地數據');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await fetchWithRetry('https://hengtong.vercel.app/api/inventory');
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        // 合併雲端數據和本地數據
        const updatedParts = partsData.map(part => {
          const cloudPart = result.data.find(cp => cp.id === part.id);
          return cloudPart ? { ...part, stock: cloudPart.stock } : part;
        });
        setParts(updatedParts);
        setLastSyncTime(Date.now());
        
        // 緩存到 sessionStorage 作為備份
        sessionStorage.setItem('partsCache', JSON.stringify({
          data: updatedParts,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('獲取庫存數據失敗:', error);
      setError(`同步失敗: ${error.message}`);
      
      // 嘗試使用緩存數據
      const cached = sessionStorage.getItem('partsCache');
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          // 如果緩存不超過1小時，使用緩存數據
          if (Date.now() - timestamp < 3600000) {
            setParts(data);
            setError('使用緩存數據，可能不是最新版本');
          }
        } catch (e) {
          console.error('緩存數據解析失敗:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchWithRetry]);

  // 優化的庫存更新函數
  const updateInventory = useCallback(async (partId, newStock) => {
    if (!isOnline) {
      console.warn('離線狀態，庫存更新將在網絡恢復後同步');
      // 可以在這裡實現離線隊列機制
      return;
    }

    try {
      await fetchWithRetry('https://hengtong.vercel.app/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partId, newStock })
      });
    } catch (error) {
      console.error('更新庫存失敗:', error);
      setError(`庫存更新失敗: ${error.message}`);
      throw error; // 重新拋出錯誤，讓調用方知道更新失敗
    }
  }, [isOnline, fetchWithRetry]);

  // 使用 useCallback 優化 updateParts 函數
  const updateParts = useCallback((newParts) => {
    setParts(newParts);
    
    // 批量更新庫存變更
    const updates = [];
    newParts.forEach(part => {
      const oldPart = parts.find(p => p.id === part.id);
      if (oldPart && oldPart.stock !== part.stock) {
        updates.push({ partId: part.id, newStock: part.stock });
      }
    });

    // 批量執行更新
    if (updates.length > 0) {
      Promise.allSettled(
        updates.map(({ partId, newStock }) => updateInventory(partId, newStock))
      ).then(results => {
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          console.error(`${failed.length} 個庫存更新失敗`);
        }
      });
    }
  }, [parts, updateInventory]);

  // 初始化數據獲取
  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // 定期同步數據（每5分鐘）
  useEffect(() => {
    if (!isOnline) return;
    
    const interval = setInterval(() => {
      fetchInventory();
    }, 300000); // 5分鐘

    return () => clearInterval(interval);
  }, [fetchInventory, isOnline]);

  // 安全功能設置
  useEffect(() => {
    const handleContextMenu = e => e.preventDefault();
    const handleDragStart = e => e.preventDefault();
    const handleKeyDown = e => {
      // 禁用 F12, Ctrl+Shift+I, Ctrl+U 等開發者工具快捷鍵
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 使用 useMemo 優化狀態顯示
  const statusDisplay = useMemo(() => {
    if (loading) return '載入中...';
    if (error) return `錯誤: ${error}`;
    if (!isOnline) return '離線模式';
    if (lastSyncTime) {
      const minutes = Math.floor((Date.now() - lastSyncTime) / 60000);
      return `最後同步: ${minutes}分鐘前`;
    }
    return '已連線';
  }, [loading, error, isOnline, lastSyncTime]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        gap: '20px'
      }}>
        <div className="loading-spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div>載入庫存數據中...</div>
        {!isOnline && <div style={{ color: '#e74c3c' }}>網絡連接不可用</div>}
      </div>
    );
  }

  return (
    <UserProvider>
      <Router>
        <div className="App">
          {/* 用戶信息顯示 */}
          <UserContext.Consumer>
            {({ user }) => (
              <div style={{ 
                position: 'absolute', 
                top: 16, 
                right: 24, 
                color: '#333', 
                fontWeight: 'bold',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px'
              }}>
                <div>{user ? `登入者：${user.company || user.username}` : '未登入'}</div>
                <div style={{ 
                  fontSize: '12px', 
                  color: isOnline ? '#27ae60' : '#e74c3c',
                  fontWeight: 'normal'
                }}>
                  {statusDisplay}
                </div>
              </div>
            )}
          </UserContext.Consumer>

          {/* 錯誤提示 */}
          {error && (
            <div style={{
              position: 'fixed',
              top: '60px',
              right: '24px',
              background: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '4px',
              padding: '8px 12px',
              fontSize: '14px',
              color: '#856404',
              zIndex: 1000,
              maxWidth: '300px'
            }}>
              {error}
              <button 
                onClick={() => setError(null)}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#856404',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ×
              </button>
            </div>
          )}

          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/inventory" element={<Inventory parts={parts} setParts={updateParts} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/shipping" element={<ShippingStats parts={parts} setParts={updateParts} />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
// ... existing code ...
