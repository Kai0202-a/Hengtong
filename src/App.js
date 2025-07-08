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

function App() {
  const [parts, setParts] = useState(partsData);
  const [loading, setLoading] = useState(true);

  // 從雲端獲取庫存數據
  const fetchInventory = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          const updatedParts = partsData.map(part => {
            const cloudPart = result.data.find(cp => cp.id === part.id);
            return cloudPart ? { ...part, stock: cloudPart.stock } : part;
          });
          setParts(updatedParts);
        }
      }
    } catch (error) {
      console.error('獲取庫存數據失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 簡化版：更新單個庫存項目
  const updateSinglePart = async (partId, newStock, retries = 3) => {
    try {
      // 更新本地狀態
      setParts(prevParts => 
        prevParts.map(part => 
          part.id === partId ? { ...part, stock: newStock } : part
        )
      );
      
      // 更新到雲端（添加重試機制）
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch('https://hengtong.vercel.app/api/inventory', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ partId, newStock })
          });
          
          if (response.ok) {
            console.log(`庫存已更新：ID ${partId}, 新庫存：${newStock}`);
            return; // 成功則退出
          }
          
          if (i === retries - 1) {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          if (i === retries - 1) {
            throw error;
          }
          // 等待後重試
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    } catch (error) {
      console.error('更新庫存失敗:', error);
      // 可以選擇回滾本地狀態或顯示錯誤提示
    }
  };

  // 新增：批量更新庫存
  const updateMultipleParts = async (updates) => {
    try {
      // 先更新本地狀態
      setParts(prevParts => {
        const updatedParts = [...prevParts];
        updates.forEach(({ partId, newStock }) => {
          const index = updatedParts.findIndex(part => part.id === partId);
          if (index !== -1) {
            updatedParts[index] = { ...updatedParts[index], stock: newStock };
          }
        });
        return updatedParts;
      });
      
      // 批量更新到雲端
      const response = await fetch('https://hengtong.vercel.app/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchUpdates: updates })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('批量庫存更新成功:', result.message);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('批量更新庫存失敗:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchInventory();
    
    // 添加定期同步機制（每30秒同步一次，避免過於頻繁）
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
        載入中...
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
            <Route path="/inventory" element={<Inventory parts={parts} setParts={setParts} updatePart={updateSinglePart} />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/shipping" element={<ShippingStats parts={parts} setParts={setParts} updatePart={updateSinglePart} updateMultipleParts={updateMultipleParts} />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;


// 添加節流機制
const updateQueue = [];
let isProcessing = false;

const processUpdateQueue = async () => {
  if (isProcessing || updateQueue.length === 0) return;
  
  isProcessing = true;
  while (updateQueue.length > 0) {
    const { partId, newStock } = updateQueue.shift();
    await updateSinglePart(partId, newStock);
    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 間隔
  }
  isProcessing = false;
};
