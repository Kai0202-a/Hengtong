import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import { dealersData } from "./dealersData";

function Admin() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cloudInventory, setCloudInventory] = useState([]);
  const [dealers, setDealers] = useState(dealersData);
  const [showDealers, setShowDealers] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/"); // 非管理員自動跳回首頁
    }
  }, [navigate]);

  // 從 MongoDB API 獲取出貨數據
  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('https://hengtong.vercel.app/api/shipments');
      if (response.ok) {
        const result = await response.json();
        console.log('API 返回數據:', result);
        
        const shipments = result.data || [];
        
        const formattedOrders = shipments.map(shipment => ({
          company: shipment.company || '未知公司',
          time: shipment.time || new Date(shipment.createdAt).toLocaleString('zh-TW'),
          partName: shipment.partName || '未知商品',
          quantity: shipment.quantity || 0,
          poNumber: shipment.partName || `ID-${shipment._id?.slice(-6)}`
        })).reverse();
        
        setOrders(formattedOrders);
        console.log('轉換後數據:', formattedOrders);
      } else {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取出貨數據失敗:', error);
      setError(error.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // 獲取雲端庫存數據
  const fetchCloudInventory = async () => {
    try {
      setInventoryLoading(true);
      setInventoryError(null);
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCloudInventory(result.data || []);
        } else {
          throw new Error(result.message || '獲取庫存失敗');
        }
      } else {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取雲端庫存失敗:', error);
      setInventoryError(error.message);
      setCloudInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  // 更新通路商狀態
  const updateDealerStatus = async (dealerId, newStatus) => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/dealers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: dealerId, status: newStatus })
      });
      
      if (response.ok) {
        setDealers(prev => prev.map(dealer => 
          dealer.id === dealerId ? { ...dealer, status: newStatus } : dealer
        ));
      } else {
        throw new Error('更新失敗');
      }
    } catch (error) {
      console.error('更新通路商狀態失敗:', error);
      alert('更新失敗: ' + error.message);
    }
  };

  // 同步庫存到雲端
  const syncInventoryToCloud = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sync' })
      });
      
      if (response.ok) {
        alert('庫存同步成功');
        fetchCloudInventory(); // 重新獲取最新數據
      } else {
        throw new Error('同步失敗');
      }
    } catch (error) {
      console.error('同步庫存失敗:', error);
      alert('同步失敗: ' + error.message);
    }
  };

  useEffect(() => {
    fetchShipments();
    fetchCloudInventory();
    
    const interval = setInterval(() => {
      fetchShipments();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // 這裡是第219行附近，包含有問題的 useEffect
  useEffect(() => {
    // 定期更新雲端庫存
    const inventoryInterval = setInterval(() => {
      fetchCloudInventory();
    }, 30000);
    
    return () => clearInterval(inventoryInterval);
  }, []); // 這裡缺少 fetchCloudInventory 依賴，會觸發 ESLint 警告

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 貨況提醒區塊 */}
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

      {/* 雲端庫存顯示區塊 */}
      <div style={{ width: '95vw', maxWidth: 500, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '0 auto 24px auto', boxShadow: '0 2px 12px #0002' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa', textAlign: 'center' }}>
          雲端庫存狀態
          <button 
            onClick={syncInventoryToCloud}
            style={{ marginLeft: 10, padding: '5px 10px', background: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            同步
          </button>
        </h3>
        
        {inventoryLoading && (
          <div style={{ color: '#aaa', padding: 20, textAlign: 'center' }}>
            載入庫存中...
          </div>
        )}
        
        {inventoryError && (
          <div style={{ color: '#ff6b6b', padding: 20, background: '#2d1b1b', borderRadius: 8, margin: '10px 0', textAlign: 'center' }}>
            ⚠️ 庫存載入失敗: {inventoryError}
          </div>
        )}
        
        {!inventoryLoading && !inventoryError && (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {cloudInventory.length === 0 && <div style={{ color: '#aaa', textAlign: 'center' }}>暫無庫存數據</div>}
            {cloudInventory.map((item, idx) => (
              <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #333', fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.name || item.id}</span>
                  <span style={{ color: item.stock > 10 ? '#4CAF50' : item.stock > 0 ? '#FF9800' : '#f44336' }}>
                    庫存: {item.stock || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 後台管理系統內容區塊 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2>後台管理系統</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 46, marginTop: 42 }}>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/inventory")}>庫存管理</button>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/shipping")}>銷售紀錄</button>
          <button 
            style={{ padding: 16, fontSize: 18 }} 
            onClick={() => setShowDealers(!showDealers)}
          >
            通路商帳號管理 {showDealers ? '▼' : '▶'}
          </button>
          <button style={{ padding: 16, fontSize: 18 }}>資料備份/還原</button>
        </div>
        
        {/* 通路商管理區塊 */}
        {showDealers && (
          <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '20px auto', boxShadow: '0 2px 12px #0002' }}>
            <h3 style={{ marginTop: 0, textAlign: 'center' }}>通路商帳號管理</h3>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {dealers.map(dealer => (
                <div key={dealer.id} style={{ padding: '10px 0', borderBottom: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{dealer.name}</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{dealer.username} | {dealer.email}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: 4, 
                        fontSize: 12,
                        background: dealer.status === 'active' ? '#4CAF50' : dealer.status === 'suspended' ? '#FF9800' : '#f44336',
                        color: 'white'
                      }}>
                        {dealer.status === 'active' ? '啟用' : dealer.status === 'suspended' ? '暫停' : '停用'}
                      </span>
                      {dealer.status === 'active' ? (
                        <button 
                          onClick={() => updateDealerStatus(dealer.id, 'suspended')}
                          style={{ padding: '4px 8px', background: '#FF9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          暫停
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateDealerStatus(dealer.id, 'active')}
                          style={{ padding: '4px 8px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          啟用
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
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
