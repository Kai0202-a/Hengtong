import React, { useContext, useEffect, useState } from 'react';
import { partsData } from "./partsData";
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

function getToday() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ShippingStats(props) {
  const { parts, setParts, updatePart } = props;
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser || (localUser.role !== 'dealer' && localUser.role !== 'admin')) {
      navigate('/');
      return;
    }
    
    // 檢查通路商狀態 - 只允許 active 狀態的 dealer 進入
    if (localUser.role === 'dealer' && localUser.status !== 'active') {
      alert('您的帳號尚未審核通過或已被停用，請聯繫管理員');
      localStorage.removeItem('user');
      navigate('/');
      return;
    }
  }, [user, navigate]);
  
  const today = getToday();
  const [quantities, setQuantities] = useState(Array(parts.length).fill(""));

  const handleQuantityChange = (idx, value) => {
    const newQuantities = [...quantities];
    newQuantities[idx] = value;
    setQuantities(newQuantities);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 防止多次點擊
    if (submitting) {
      return;
    }
    
    setSubmitting(true); // 開始提交，禁用按鈕
    
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      console.log('當前用戶:', userObj);
      
      // 先處理出貨記錄和庫存更新
      for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
          // 更新雲端庫存
          const newStock = part.stock - qty;
          await updatePart(part.id, newStock);
          
          // 發送出貨記錄
          const shipmentData = {
            company: userObj?.company || userObj?.username || 'admin',
            partId: part.id,
            partName: part.name,
            quantity: qty,
            price: part.price,
            amount: qty * part.price,
            time: today
          };
          
          console.log('準備發送數據:', shipmentData);
          
          const res = await fetch('/api/shipments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(shipmentData)
          });
          
          const result = await res.json();
          console.log('API 響應:', result);
          
          if (!res.ok) {
            throw new Error(`API 錯誤: ${result.error || res.status}`);
          }
        }
      }
      
      alert('發送完成！');
      setQuantities(Array(parts.length).fill(""));
      
    } catch (err) {
      console.error('發送失敗:', err);
      alert(`發送失敗：${err.message}`);
    } finally {
      setSubmitting(false); // 完成提交，重新啟用按鈕
    }
  }

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
        
        {/* 功能按鈕 */}
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
              cursor: 'pointer'
            }}
          >
            📊 查看歷史記錄
          </button>
        </div>

        {/* 出貨界面 */}
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
                <th>出貨數量</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {item.image && <img src={item.image} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover' }} />}
                  </td>
                  <td>{item.name}</td>
                  <td>NT$ {item.price}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      id={`quantity-${item.id}`}
                      name={`quantity-${item.id}`}
                      value={quantities[idx]}
                      onChange={e => handleQuantityChange(idx, e.target.value)}
                      style={{ width: 60 }}
                      disabled={submitting}
                    />
                  </td>
                </tr>
              ))}
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