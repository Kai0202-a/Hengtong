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
  const [parts, setParts] = useState(partsData); // 移除 localStorage 初始化
  const [loading, setLoading] = useState(true);

  // 從雲端獲取庫存數據
  const fetchInventory = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          // 合併雲端數據和本地數據
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

  // 更新庫存到雲端
  const updateInventory = async (partId, newStock) => {
    try {
      await fetch('https://hengtong.vercel.app/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partId, newStock })
      });
    } catch (error) {
      console.error('更新庫存失敗:', error);
    }
  };

  const updateParts = (newParts) => {
    setParts(newParts);
    
    // 只更新到雲端，移除 localStorage
    newParts.forEach(part => {
      const oldPart = parts.find(p => p.id === part.id);
      if (oldPart && oldPart.stock !== part.stock) {
        updateInventory(part.id, part.stock);
      }
    });
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    // 禁止右鍵
    const handleContextMenu = e => e.preventDefault();
    // 禁止拖曳
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
