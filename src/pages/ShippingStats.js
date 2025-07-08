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
  const { parts, setParts } = props;
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser || (localUser.role !== 'dealer' && localUser.role !== 'admin')) {
      navigate('/');
    }
  }, [user, navigate]);
  
  const today = getToday();
  const [quantities, setQuantities] = useState(Array(parts.length).fill(""));

  const handleQuantityChange = (idx, value) => {
    const newQuantities = [...quantities];
    newQuantities[idx] = value;
    setQuantities(newQuantities);
  };

  // 获取历史记录
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      const company = userObj?.company || userObj?.username || 'admin';
      
      const response = await fetch(`/api/shipments?company=${encodeURIComponent(company)}&limit=100`);
      const result = await response.json();
      
      if (result.success) {
        setHistoryData(result.data);
      } else {
        alert('获取历史记录失败：' + result.error);
      }
    } catch (error) {
      console.error('获取历史记录失败:', error);
      alert('获取历史记录失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 切换历史记录显示
  const toggleHistory = () => {
    if (!showHistory) {
      fetchHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newParts = parts.map((part, idx) => {
      const qty = parseInt(quantities[idx], 10) || 0;
      return {
        ...part,
        stock: part.stock - qty
      };
    });
    setParts(newParts);
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      console.log('當前用戶:', userObj);
      
      for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
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
      
      // 如果历史记录正在显示，刷新数据
      if (showHistory) {
        fetchHistory();
      }
    } catch (err) {
      console.error('發送失敗:', err);
      alert(`發送失敗：${err.message}`);
    }
  }

  // 计算历史记录总金额
  const getTotalAmount = () => {
    return historyData.reduce((total, record) => total + (record.amount || 0), 0);
  };

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
        
        {/* 功能切换按钮 */}
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
            新增出货
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
            历史记录
          </button>
        </div>

        {/* 新增出货界面 */}
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
                      <td>{item.price}</td>
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
                <button type="submit" style={{ fontSize: 24, padding: '12px 32px' }}>送出</button>
              </div>
            </form>
          </>
        )}

        {/* 历史记录界面 */}
        {showHistory && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 'bold', fontSize: 28 }}>
              出货历史记录
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
            ) : (
              <>
                {historyData.length > 0 ? (
                  <>
                    <div style={{ marginBottom: 16, fontWeight: 'bold', fontSize: 18 }}>
                      总记录数：{historyData.length} 条 | 总金额：NT$ {getTotalAmount().toLocaleString()}
                    </div>
                    <div style={{ maxHeight: 500, overflowY: 'auto', border: '1px solid #ddd' }}>
                      <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ padding: 8, border: '1px solid #ddd' }}>日期时间</th>
                            <th style={{ padding: 8, border: '1px solid #ddd' }}>品号</th>
                            <th style={{ padding: 8, border: '1px solid #ddd' }}>数量</th>
                            <th style={{ padding: 8, border: '1px solid #ddd' }}>单价</th>
                            <th style={{ padding: 8, border: '1px solid #ddd' }}>金额</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyData.map((record, index) => (
                            <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white' }}>
                              <td style={{ padding: 8, border: '1px solid #ddd', fontSize: 12 }}>
                                {record.time}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #ddd' }}>
                                {record.partName}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #ddd' }}>
                                {record.quantity}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #ddd' }}>
                                NT$ {record.price?.toLocaleString()}
                              </td>
                              <td style={{ padding: 8, border: '1px solid #ddd' }}>
                                NT$ {record.amount?.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                    暂无出货记录
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ShippingStats;