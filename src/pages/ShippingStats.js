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
  const { parts, setParts, updatePart, updateMultipleParts } = props;
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 新增防重複提交狀態
  
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

  // 獲取歷史記錄
  // 修復歷史記錄獲取
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      const company = userObj?.company || userObj?.username || 'admin';
      
      const response = await fetch(`https://hengtong.vercel.app/api/shipments?company=${encodeURIComponent(company)}&limit=100`);
      const result = await response.json();
      
      if (result.success) {
        setHistoryData(result.data);
      } else {
        alert('獲取歷史記錄失敗：' + result.error);
      }
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
      alert('獲取歷史記錄失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 切換歷史記錄顯示
  const toggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 防止重複提交
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true); // 開始提交
    
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      console.log('當前用戶:', userObj);
      
      // 收集所有需要更新的庫存和出貨記錄
      const inventoryUpdates = [];
      const shipmentRecords = [];
      
      for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
          // 準備庫存更新數據
          const newStock = part.stock - qty;
          inventoryUpdates.push({
            partId: part.id,
            newStock: newStock
          });
          
          // 準備出貨記錄數據
          shipmentRecords.push({
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
      
      if (inventoryUpdates.length === 0) {
        alert('請輸入出貨數量');
        return;
      }
      
      // 批量更新庫存（一次性更新所有庫存）
      const inventorySuccess = await updateMultipleParts(inventoryUpdates);
      if (!inventorySuccess) {
        throw new Error('庫存更新失敗');
      }
      
      // 批量發送出貨記錄
      for (const shipmentData of shipmentRecords) {
        console.log('準備發送數據:', shipmentData);
        
        const res = await fetch('https://hengtong.vercel.app/api/shipments', {
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
      
      alert('發送完成！');
      setQuantities(Array(parts.length).fill(""));
      
      // 如果歷史記錄正在顯示，刷新數據
      if (showHistory) {
        fetchHistory();
      }
    } catch (err) {
      console.error('發送失敗:', err);
      alert(`發送失敗：${err.message}`);
    } finally {
      setIsSubmitting(false); // 結束提交，恢復按鈕狀態
    }
  }

  // 計算歷史記錄總金額
  const getTotalAmount = () => {
    return historyData.reduce((total, record) => total + (record.amount || 0), 0);
  };

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
        
        {/* 功能切換按鈕 */}
        <div style={{ marginBottom: 20 }}>
          <button 
            type="button" 
            onClick={() => setShowHistory(false)}
            style={{ 
              fontSize: 18, 
              padding: '8px 16px', 
              marginRight: 10,
              backgroundColor: !showHistory ? '#007bff' : '#f8f9fa',
              color: !showHistory ? 'white' : 'black',
              border: '1px solid #007bff'
            }}
          >
            出貨頁面
          </button>
          <button 
            type="button" 
            onClick={toggleHistory}
            style={{ 
              fontSize: 18, 
              padding: '8px 16px',
              backgroundColor: showHistory ? '#007bff' : '#f8f9fa',
              color: showHistory ? 'white' : 'black',
              border: '1px solid #007bff'
            }}
          >
            歷史記錄
          </button>
        </div>

        {/* 新增出貨界面 */}
        {!showHistory && (
          <>
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
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ 
                    fontSize: 24, 
                    padding: '12px 32px',
                    opacity: isSubmitting ? 0.6 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    backgroundColor: isSubmitting ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4
                  }}
                >
                  {isSubmitting ? '處理中...' : '送出'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* 歷史記錄界面 */}
        {showHistory && (
          <div style={{ backgroundColor: '#2c3e50', padding: 20, borderRadius: 8 }}>
            <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 'bold', fontSize: 28, color: 'white' }}>
              出貨歷史記錄
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'white' }}>載入中...</div>
            ) : (
              <>
                {historyData.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 16, fontWeight: 'bold', fontSize: 18, color: 'white' }}>
                      總記錄數：{historyData.length} 條 | 總金額：NT$ {getTotalAmount().toLocaleString()}
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto', border: '1px solid #34495e', borderRadius: 4 }}>
                      <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#34495e', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>日期時間</th>
                            <th style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>品號</th>
                            <th style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>數量</th>
                            <th style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>單價</th>
                            <th style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>總金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.map((record, index) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#34495e' : '#2c3e50' }}>
                              <td style={{ padding: 8, border: '1px solid #34495e', fontSize: 12, color: 'white' }}>
                                {record.time}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>
                                {record.partName}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>
                                {record.quantity}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>
                                NT$ {record.price?.toLocaleString()}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #34495e', color: 'white' }}>
                                NT$ {record.amount?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#bdc3c7' }}>
                    暫無出貨記錄
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShippingStats;