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
  
  // 從 MongoDB API 獲取出貨數據
  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('https://hengtong.vercel.app/api/shipments');
      if (response.ok) {
        const result = await response.json();
        // 修正：使用 result.data 而不是直接使用 result
        const shipments = result.data || [];
        
        // 根據實際 API 數據結構轉換
        const formattedOrders = shipments.map(shipment => ({
          company: shipment.company || '未知公司',
          time: shipment.time || new Date(shipment.createdAt).toLocaleString('zh-TW'),
          partName: shipment.partName || '未知商品',
          quantity: shipment.quantity || 0,
          poNumber: shipment.partName || shipment.partId // 使用 partName 作為 PO 號
        })).reverse(); // 最新的在前面
        
        setOrders(formattedOrders);
      } else {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取出貨數據失敗:', error);
      setError(error.message);
      setOrders([]); // 清空數據
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初始載入
    fetchShipments();
    
    // 定期更新數據（每10秒）
    const interval = setInterval(() => {
      fetchShipments();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 置中提醒區塊 */}
      <div style={{ width: '95vw', maxWidth: 500, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa' }}>
          貨況提醒 
          <span style={{ fontSize: 12, color: '#4CAF50' }}>(MongoDB)</span>
        </h3>
        
        {loading && (
          <div style={{ color: '#aaa', padding: 20 }}>
            載入中...
          </div>
        )}
        
        {error && (
          <div style={{ color: '#ff6b6b', padding: 20, background: '#2d1b1b', borderRadius: 8, margin: '10px 0' }}>
            ⚠️ 連接失敗: {error}
            <br />
            <button 
              onClick={fetchShipments}
              style={{ marginTop: 10, padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              重新載入
            </button>
          </div>
        )}
        
        {!loading && !error && (
          <ul style={{ paddingLeft: 0, maxHeight: 400, overflowY: 'auto', margin: 0, listStyle: 'none' }}>
            {orders.length === 0 && <li style={{ color: '#aaa' }}>暫無出貨紀錄</li>}
            {orders.map((o, idx) => (
              <li key={idx} style={{ marginBottom: 8, fontSize: 15, color: '#f5f6fa' }}>
                <b>{o.company}</b> 於 <span style={{ color: '#aaa' }}>{o.time}</span><br />
                PO: <b>{o.poNumber}</b><br />
                商品：<b>{o.partName}</b>，數量：<b>{o.quantity}</b>
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
