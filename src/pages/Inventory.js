import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";

function Inventory({ parts, updateInventory, refreshInventory }) {
  const [search, setSearch] = useState("");
  const [inQty, setInQty] = useState({});
  const [outQty, setOutQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const LOGO_URL = process.env.REACT_APP_LOGO_URL || '/images/logo%20ht.png';
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem("user"));
    if (!localUser || localUser.role !== "admin") {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const handleInQtyChange = (id, value) => {
    setInQty({ ...inQty, [id]: value });
  };
  
  const handleOutQtyChange = (id, value) => {
    setOutQty({ ...outQty, [id]: value });
  };

  const handleBatchSubmit = async () => {
    setSubmitting(true);
    
    const updates = parts.map(part => {
      const inNum = parseInt(inQty[part.id], 10) || 0;
      const outNum = parseInt(outQty[part.id], 10) || 0;
      if (inNum === 0 && outNum === 0) return null;
      
      return {
        partId: part.id,
        newStock: part.stock + inNum - outNum // 基於當前雲端庫存計算
      };
    }).filter(Boolean);
    
    if (updates.length === 0) {
      setSubmitting(false);
      return;
    }
    
    try {
      // 使用統一的庫存更新函數
      const success = await updateInventory(updates, true);
      
      if (success) {
        setInQty({});
        setOutQty({});
        alert('庫存更新成功！');
      } else {
        throw new Error('更新失敗');
      }
    } catch (e) {
      console.error('庫存更新失敗:', e);
      alert("送出失敗，請稍後再試");
    }
    
    setSubmitting(false);
  };

  // 手動刷新庫存
  const handleRefresh = async () => {
    await refreshInventory();
    alert('庫存已刷新！');
  };

  const filteredParts = parts.filter(
    (part) =>
      part.name.toLowerCase().includes(search.toLowerCase()) ||
      (part.type && part.type.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => {
    // 直接按照商品 ID 進行數字排序
    return parseInt(a.id) - parseInt(b.id);
  });

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
        <img src={LOGO_URL} alt="logo" style={{ width: 200, height: 200, margin: '24px 0 8px 0' }} onError={(e) => { e.currentTarget.src = '/images/logo2.png'; }} />
        <div style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 'lighter', margin: '0 0 24px 0' }}>
          庫存管理 <span style={{ fontSize: '0.8rem', color: '#4CAF50' }}>(雲端同步)</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: 16, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="搜尋零件名稱或類型"
          value={search}
          onChange={handleSearch}
          style={{ padding: 8, width: 300 }}
        />
        <button 
          onClick={handleRefresh}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4, 
            cursor: 'pointer' 
          }}
        >
          🔄 刷新庫存
        </button>
      </div>
      
      <table border="1" cellPadding="8" style={{ width: "100%", marginTop: 16 }}>
        <thead>
          <tr>
            <th>名稱</th>
            <th>雲端庫存</th>
            <th>進價</th>
            <th>售價</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredParts.map((part) => (
            <tr key={part.id}>
              <td>
                {part.image && <img src={part.image} alt={part.name} style={{ width: '50px', height: '50px', marginRight: 8, verticalAlign: 'middle' }} />}
                {part.name}
              </td>
              <td style={{ fontWeight: 'bold', color: part.stock > 0 ? '#4CAF50' : '#f44336' }}>
                {part.stock}
              </td>
              <td>{part.cost}</td>
              <td>{part.price}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  style={{ width: 60, marginRight: 8 }}
                  value={inQty[part.id] || ""}
                  onChange={e => handleInQtyChange(part.id, e.target.value)}
                  placeholder="入庫"
                />
                <input
                  type="number"
                  min="0"
                  style={{ width: 60, marginLeft: 8 }}
                  value={outQty[part.id] || ""}
                  onChange={e => handleOutQtyChange(part.id, e.target.value)}
                  placeholder="出庫"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
        <button
          onClick={handleBatchSubmit}
          disabled={submitting}
          style={{ 
            fontSize: '1.2rem', 
            padding: '12px 48px', 
            borderRadius: 8,
            backgroundColor: submitting ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? '更新中...' : '送出'}
        </button>
      </div>
    </div>
  );
}

export default Inventory;