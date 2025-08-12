import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';
import { partsData } from './partsData'; // Fix: change 'partsdata' to 'partsData'

function getToday() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ShippingStats({ updateInventory, refreshInventory }) {  // 移除 parts 參數
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [submitting, setSubmitting] = useState(false);
  const [dealerInventory, setDealerInventory] = useState({});
  const [loading, setLoading] = useState(true);
  
  // API 基礎 URL
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';
  
  // 添加排序邏輯 - 按照商品編號排序
  // 修改這部分，使用 partsData 而不是 parts 參數
  const sortedParts = [...partsData].sort((a, b) => {
    const getNumber = (name) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    };
    return getNumber(a.name) - getNumber(b.name);
  });
  
  // 獲取店家專屬庫存
  const fetchDealerInventory = async () => {
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      if (!userObj || userObj.role !== 'dealer') {
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/dealer-inventory?dealerUsername=${userObj.username}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDealerInventory(result.data.inventory || {});
        }
      }
    } catch (error) {
      console.error('獲取店家庫存失敗:', error);
    } finally {
      setLoading(false);
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
    
    // 獲取店家庫存
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
      const dealerInventoryUpdates = [];
      
      for (let idx = 0; idx < sortedParts.length; idx++) {
        const part = sortedParts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
          const dealerStock = dealerInventory[part.id] || 0;
          
          // 檢查店家庫存是否足夠
          if (dealerStock < qty) {
            alert(`${part.name} 店內庫存不足！當前店內庫存：${dealerStock}，需要：${qty}`);
            setSubmitting(false);
            return;
          }
          
          // 更新總庫存
          updates.push({
            partId: part.id,
            newStock: part.stock - qty
          });
          
          // 更新店家庫存
          dealerInventoryUpdates.push({
            productId: part.id,
            quantity: qty,
            action: 'subtract'
          });
          
          // 在第120行附近加入除錯
          const shipmentItem = {
            company: userObj?.company || userObj?.username || 'admin',
            partId: part.id,
            partName: part.name,
            quantity: qty,
            price: part.price,
            cost: part.cost,  // 加入成本欄位
            amount: qty * part.price,
            time: today
          };
          
          console.log(`出貨記錄：${part.name}, 數量：${qty}, 單價：${part.price}, 總額：${qty * part.price}`);
          shipments.push(shipmentItem);
        }
      }
      
      if (updates.length === 0) {
        alert('請輸入出貨數量');
        setSubmitting(false);
        return;
      }
      
      // 並行處理所有更新
      const promises = [];
      
      // 更新總庫存
      promises.push(updateInventory(updates, false));
      
      // 更新店家庫存
      if (userObj.role === 'dealer' && dealerInventoryUpdates.length > 0) {
        dealerInventoryUpdates.forEach(update => {
          promises.push(
            fetch(`${API_BASE_URL}/api/dealer-inventory`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dealerUsername: userObj.username,
                ...update
              })
            })
          );
        });
      }
      
      // 新增出貨記錄
      if (shipments.length > 0) {
        promises.push(
          fetch(`${API_BASE_URL}/api/shipments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchShipments: shipments })
          })
        );
      }
      
      // 新增：更新用戶活動狀態
      promises.push(
        fetch(`${API_BASE_URL}/api/user-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: userObj.username,
            action: 'activity'
          })
        })
      );
      
      const results = await Promise.all(promises);
      
      // 檢查結果
      if (results[0]) {
        // 刷新數據
        await refreshInventory();
        await fetchDealerInventory();
        alert('發送完成！');
        setQuantities(Array(partsData.length).fill(""));  // 改為 partsData.length
      } else {
        throw new Error('部分操作失敗');
      }
      
    } catch (err) {
      console.error('發送失敗:', err);
      alert(`發送失敗：${err.message}`);
      await refreshInventory();
      await fetchDealerInventory();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        載入店家庫存中...
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
        
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
              fetchDealerInventory();
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
                <th>店內庫存</th>
                <th>售價</th>
                <th>出貨數量</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((item, idx) => {
                const dealerStock = dealerInventory[item.id] || 0;
                return (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {item.image && <img src={item.image} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover' }} />}
                    </td>
                    <td>{item.name}</td>
                    <td style={{ 
                      fontWeight: 'bold', 
                      color: dealerStock > 0 ? '#28a745' : '#dc3545',
                      fontSize: '16px'
                    }}>
                      {dealerStock}
                    </td>
                    <td>
                      <div>NT$ {item.price}</div>
                      <div style={{ color: 'red', fontSize: '12px', marginTop: '2px' }}>
                        末端價: {item.endPrice}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={dealerStock}
                        id={`quantity-${item.id}`}
                        name={`quantity-${item.id}`}
                        value={quantities[idx]}
                        onChange={e => handleQuantityChange(idx, e.target.value)}
                        style={{ width: 60 }}
                        disabled={submitting || dealerStock === 0}
                        placeholder={dealerStock === 0 ? "缺貨" : "數量"}
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