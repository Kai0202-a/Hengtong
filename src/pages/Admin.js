import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";

function Admin() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/"); // 非管理員自動跳回首頁
    }
  }, [navigate]);
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 整同一經銷商同一時間的出貨記錄
  const groupShipmentsByCompanyAndTime = (shipments) => {
    const grouped = {};
    
    shipments.forEach(shipment => {
      const company = shipment.company || '未知公司';
      const time = shipment.time || new Date(shipment.createdAt).toLocaleString('zh-TW');
      
      // 使用公司名稱和時間作為分組鍵（精確到分鐘）
      const timeKey = time.substring(0, 16); // 只取到分鐘，忽略秒數
      const groupKey = `${company}-${timeKey}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          company,
          time: timeKey,
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          createdAt: shipment.createdAt || shipment.time
        };
      }
      
      grouped[groupKey].items.push({
        partName: shipment.partName || '未知商品',
        quantity: shipment.quantity || 0,
        price: shipment.price || 0,
        amount: shipment.amount || 0
      });
      
      grouped[groupKey].totalQuantity += shipment.quantity || 0;
      grouped[groupKey].totalAmount += shipment.amount || 0;
    });
    
    // 轉換為陣列並按時間排序
    return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  
  // 從 MongoDB API 獲取出貨數據
  const fetchShipments = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      const response = await fetch('/api/shipments');
      if (response.ok) {
        const result = await response.json();
        console.log('API 返回數據:', result);
        
        const shipments = result.data || [];
        
        // 使用新的分組函數整合數據
        const groupedOrders = groupShipmentsByCompanyAndTime(shipments);
        
        setOrders(groupedOrders);
        console.log('整合後數據:', groupedOrders);
      } else {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取出貨數據失敗:', error);
      setError(error.message);
      if (isInitialLoad) {
        setOrders([]);
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // 初始載入
    fetchShipments(true);
    
    // 定期更新數據（每10秒）
    const interval = setInterval(() => {
      fetchShipments(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 置中提醒區塊 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa' }}>
          貨況提醒 
          <span style={{ fontSize: 12, color: '#4CAF50' }}>(MongoDB)</span>
          {isRefreshing && (
            <span style={{ fontSize: 10, color: '#ffa726', marginLeft: 8 }}>更新中...</span>
          )}
        </h3>
        
        {loading && (
          <div style={{ color: '#aaa', padding: 20 }}>
            正在加載貨況數據...
          </div>
        )}
        
        {error && (
          <div style={{ color: '#ff6b6b', padding: 20, background: '#2d1b1b', borderRadius: 8, margin: '10px 0' }}>
            ⚠️ 連接失敗: {error}
            <br />
            <button 
              onClick={() => fetchShipments(true)}
              style={{ marginTop: 10, padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              重新載入
            </button>
          </div>
        )}
        
        {!loading && !error && (
          <ul style={{ paddingLeft: 0, maxHeight: 500, overflowY: 'auto', margin: 0, listStyle: 'none' }}>
            {orders.length === 0 && <li style={{ color: '#aaa' }}>暫無出貨紀錄</li>}
            {orders.map((order, idx) => (
              <li key={`${order.createdAt}-${idx}`} style={{ 
                marginBottom: 12, 
                fontSize: 14, 
                color: '#f5f6fa',
                padding: '12px',
                borderBottom: idx < orders.length - 1 ? '1px solid #333' : 'none',
                background: '#2a2e37',
                borderRadius: 8,
                textAlign: 'left'
              }}>
                <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold' }}>
                  <span style={{ color: '#4CAF50' }}>{order.company}</span> 於 
                  <span style={{ color: '#aaa', marginLeft: 4 }}>{order.time}</span>
                </div>
                
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#ffa726', fontWeight: 'bold' }}>出貨明細：</span>
                </div>
                
                <div style={{ marginLeft: 12, marginBottom: 8 }}>
                  {order.items.map((item, itemIdx) => (
                    <div key={itemIdx} style={{ marginBottom: 4, fontSize: 13 }}>
                      • <span style={{ color: '#e3f2fd' }}>{item.partName}</span> × 
                      <span style={{ color: '#81c784', fontWeight: 'bold' }}>{item.quantity}</span>
                      {item.amount > 0 && (
                        <span style={{ color: '#aaa', marginLeft: 8 }}>NT$ {item.amount.toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
                
                <div style={{ borderTop: '1px solid #444', paddingTop: 8, fontSize: 13 }}>
                  <span style={{ color: '#ffa726' }}>總計：</span>
                  <span style={{ color: '#81c784', fontWeight: 'bold', marginLeft: 4 }}>數量 {order.totalQuantity}</span>
                  {order.totalAmount > 0 && (
                    <span style={{ color: '#aaa', marginLeft: 8 }}>金額 NT$ {order.totalAmount.toLocaleString()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* 後台管理系統內容區塊 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2>後台管理系統</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 46, marginTop: 42 }}>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/inventory")}>庫存管理</button>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/shipping")}>銷售紀錄</button>
          <button style={{ padding: 16, fontSize: 18 }}>通路商帳號管理</button>
          <button style={{ padding: 16, fontSize: 18 }}>資料備份/還原</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button onClick={() => {
            localStorage.removeItem("user");
            setUser(null);
            navigate("/");
          }} style={{ width: 120, background: '#c00', color: '#fff', border: 'none', borderRadius: 6, padding: 8 }}>
            登出
          </button>
        </div>
      </div>
    </div>
  );
}

export default Admin;
