import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

function getToday() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ShippingStats({ parts, updateInventory, refreshInventory }) {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [submitting, setSubmitting] = useState(false);
  const [dealerInventory, setDealerInventory] = useState({}); // 新增：在店庫存狀態
  
  // 添加排序邏輯 - 按照商品編號排序
  const sortedParts = [...parts].sort((a, b) => {
    const getNumber = (name) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    return getNumber(a.name) - getNumber(b.name);
  });
  
  // 新增：獲取在店庫存的函數
  const fetchDealerInventory = async () => {
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      if (!userObj || userObj.role !== 'dealer') return;
      
      const response = await fetch(`/api/dealer-inventory?dealerUsername=${userObj.username}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDealerInventory(result.data.inventory || {});
        }
      }
    } catch (error) {
      console.error('獲取在店庫存失敗:', error);
    }
  };
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser || (localUser.role !== 'dealer' && localUser.role !== 'admin')) {
      navigate('/');
      return;
    }
    
    if (localUser.role === 'dealer' && localUser.status !== 'active') {
      alert('您的帳號尚未審核通過或已被停用，請聯繫管理員');
      localStorage.removeItem('user');
      navigate('/');
      return;
    }
    
    // 獲取在店庫存
    fetchDealerInventory();
  }, [user, navigate]);
  
  const today = getToday();
  const [quantities, setQuantities] = useState(Array(sortedParts.length).fill(""));

  const handleQuantityChange = (idx, value) => {
    const newQuantities = [...quantities];
    newQuantities[idx] = value;
    setQuantities(newQuantities);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (submitting) return;
    setSubmitting(true);
    
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      
      // 收集所有需要處理的項目
      const updates = [];
      const shipments = [];
      
      for (let idx = 0; idx < sortedParts.length; idx++) {
        const part = sortedParts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
          // 檢查庫存是否足夠
          if (part.stock < qty) {
            alert(`${part.name} 庫存不足！當前庫存：${part.stock}，需要：${qty}`);
            setSubmitting(false);
            return;
          }
          
          updates.push({
            partId: part.id,
            newStock: part.stock - qty // 基於當前雲端庫存計算
          });
          
          shipments.push({
            company: userObj?.company || userObj?.username || 'admin',
            partId: part.id,
            partName: part.name,
            quantity: qty,
            price: part.price,
            amount: qty * part.price,
            time: today
          });
        }
      }
      
      if (updates.length === 0) {
        alert('請輸入出貨數量');
        setSubmitting(false);
        return;
      }
      
      // 並行處理庫存更新和出貨記錄
      const promises = [];
      
      // 更新庫存
      promises.push(updateInventory(updates, false));
      
      // 新增出貨記錄
      if (shipments.length > 0) {
        promises.push(
          fetch('/api/shipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchShipments: shipments })
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // 檢查結果
      if (results[0] && (results[1]?.ok !== false)) {
        // 刷新庫存數據
        await refreshInventory();
        alert('發送完成！');
        setQuantities(Array(parts.length).fill(""));
      } else {
        throw new Error('部分操作失敗');
      }
      
    } catch (err) {
      console.error('發送失敗:', err);
      alert(`發送失敗：${err.message}`);
      // 發生錯誤時刷新庫存以確保數據一致性
      await refreshInventory();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
        
        <div style={{ marginBottom: 20 }}>
          <button 
            type="button" 
            onClick={() => navigate('/shipping-history')}
            style={{ 
              fontSize: 18, 
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: 16
            }}
          >
            📊 查看歷史記錄
          </button>
          
          <button 
            type="button" 
            onClick={() => {
              refreshInventory();
              fetchDealerInventory(); // 同時刷新在店庫存
            }}
            style={{ 
              fontSize: 18, 
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 刷新庫存
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 'bold', fontSize: 28 }}>
          出貨日期：{today}
        </div>
        
        <form onSubmit={handleSubmit}>
          <table style={{ width: '100%', textAlign: 'center', verticalAlign: 'middle', tableLayout: 'fixed' }} className="center-table">
            <thead>
              <tr>
                <th>圖片</th>
                <th>品號</th>
                <th>售價</th>
                <th>總庫存</th>
                <th style={{ backgroundColor: '#e8f5e8' }}>在店庫存</th>
                <th>出貨數量</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((item, idx) => {
                const storeStock = dealerInventory[item.id] || 0;
                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {item.image && <img src={item.image} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover' }} />}
                    </td>
                    <td>{item.name}</td>
                    <td>NT$ {item.price}</td>
                    <td style={{ fontWeight: 'bold', color: item.stock > 0 ? '#28a745' : '#dc3545' }}>
                      {item.stock}
                    </td>
                    <td style={{ 
                      fontWeight: 'bold', 
                      color: storeStock > 0 ? '#007bff' : '#6c757d',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {storeStock}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        id={`quantity-${item.id}`}
                        name={`quantity-${item.id}`}
                        value={quantities[idx]}
                        onChange={e => handleQuantityChange(idx, e.target.value)}
                        style={{ width: 60 }}
                        disabled={submitting || item.stock === 0}
                        placeholder={item.stock === 0 ? "缺貨" : "數量"}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button 
              type="submit" 
              disabled={submitting}
              style={{ 
                fontSize: 24, 
                padding: '12px 32px',
                backgroundColor: submitting ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? '處理中...' : '送出'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShippingStats;