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
  const [parts, setParts] = useState(() => {
    const saved = localStorage.getItem('parts');
    return saved ? JSON.parse(saved) : partsData;
  });

  useEffect(() => {
    localStorage.setItem("parts", JSON.stringify(parts));
  }, [parts]);

  const updateParts = (newParts) => {
    setParts(newParts);
    localStorage.setItem('parts', JSON.stringify(newParts));
  };

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
            {/* <Route path="/admin-login" element={<AdminLogin />} /> 這行刪除 */}
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
// ... existing code ...
