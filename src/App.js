import './App.css';
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Admin from "./pages/Admin";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ShippingStats from './pages/ShippingStats';
import { partsData } from './pages/partsData';
import { useState, useEffect } from 'react';
import Register from './pages/Register';
import { UserProvider, UserContext } from './UserContext';
import ShippingHistory from './pages/ShippingHistory';

function App() {
  // 移除本地庫存，只保留零件基本資訊
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 完全從雲端獲取庫存數據
  const fetchInventory = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          // 合併本地零件資訊與雲端庫存
          const updatedParts = partsData.map(part => {
            const cloudPart = result.data.find(cp => cp.id === part.id);
            return {
              ...part,
              stock: cloudPart ? cloudPart.stock : 0 // 完全使用雲端庫存
            };
          });
          setParts(updatedParts);
        } else {
          // 如果雲端沒有數據，使用本地數據但庫存設為0
          const partsWithZeroStock = partsData.map(part => ({
            ...part,
            stock: 0
          }));
          setParts(partsWithZeroStock);
        }
      }
    } catch (error) {
      console.error('獲取庫存數據失敗:', error);
      // 錯誤時使用本地數據但庫存設為0
      const partsWithZeroStock = partsData.map(part => ({
        ...part,
        stock: 0
      }));
      setParts(partsWithZeroStock);
    } finally {
      setLoading(false);
    }
  };

  // 統一的庫存更新函數 - 所有更新都同步到雲端
  const updateInventory = async (updates, shouldRefresh = true) => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchUpdates: updates })
      });
      
      if (response.ok) {
        if (shouldRefresh) {
          // 更新成功後重新獲取最新數據
          await fetchInventory();
        }
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('更新庫存失敗:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchInventory();
    
    // 定期同步雲端庫存（每30秒）
    const interval = setInterval(() => {
      fetchInventory();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleContextMenu = e => e.preventDefault();
    const handleDragStart = e => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        載入雲端庫存中...
      </div>
    );
  }

  return (
    <UserProvider>
      <Router>
        <div className="App">
          <UserContext.Consumer>
            {({ user }) => (
              <div style={{ position: 'absolute', top: 16, right: 24, color: '#333', fontWeight: 'bold' }}>
                {user ? `登入者：${user.company || user.username}` : '未登入'}
              </div>
            )}
          </UserContext.Consumer>
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/inventory" element={<Inventory parts={parts} updateInventory={updateInventory} refreshInventory={fetchInventory} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/shipping" element={<ShippingStats parts={parts} updateInventory={updateInventory} refreshInventory={fetchInventory} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/shipping-history" element={<ShippingHistory />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;

// 移除以下所有代碼（第182-189行）
// 添加節流機制
// const updateQueue = [];
// let isProcessing = false;

// const processUpdateQueue = async () => {
//   if (isProcessing || updateQueue.length === 0) return;
//   
//   isProcessing = true;
//   while (updateQueue.length > 0) {
//     const { partId, newStock } = updateQueue.shift();
//     await updateSinglePart(partId, newStock);
//     await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 間隔
//   }
//   isProcessing = false;
// };
