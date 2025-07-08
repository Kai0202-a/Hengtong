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
  const updateSinglePart = async (partId, newStock) => {
    try {
      // 更新本地狀態
      setParts(prevParts => 
        prevParts.map(part => 
          part.id === partId ? { ...part, stock: newStock } : part
        )
      );
      
      // 更新到雲端
      await fetch('https://hengtong.vercel.app/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partId, newStock })
      });
      
      console.log(`庫存已更新：ID ${partId}, 新庫存：${newStock}`);
    } catch (error) {
      console.error('更新庫存失敗:', error);
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
            <Route path="/shipping" element={<ShippingStats parts={parts} setParts={setParts} updatePart={updateSinglePart} />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
