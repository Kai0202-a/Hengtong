import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";

function Admin() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 通路商管理相關狀態
  const [showDealerManagement, setShowDealerManagement] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersError, setDealersError] = useState(null);
  
  // 雲端庫存狀態
  const [cloudInventory, setCloudInventory] = useState([]);
  
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/");
    }
  }, [navigate]);
  
  // 獲取雲端庫存數據
  const fetchCloudInventory = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCloudInventory(result.data);
        }
      }
    } catch (error) {
      console.error('獲取雲端庫存數據失敗:', error);
    }
  };
  
  // 完全雲端化的庫存查詢函數
  const getStockByPartName = (partName) => {
    const cloudPart = cloudInventory.find(p => p.name === partName || p.id === partName);
    return cloudPart ? cloudPart.stock : 0;
  };

  // 獲取出貨數據
  const fetchShipments = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      const response = await fetch('https://hengtong.vercel.app/api/shipments');
      if (response.ok) {
        const result = await response.json();
        const shipments = result.data || [];
        const groupedOrders = groupShipmentsByCompanyAndTime(shipments);
        setOrders(groupedOrders);
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

  // 整合同一經銷商同一時間的出貨記錄
  // 首先需要導入 partsData 來獲取成本信息
  import { partsData } from './partsData';
  
  const groupShipmentsByCompanyAndTime = (shipments) => {
    const grouped = {};
    
    shipments.forEach(shipment => {
      const company = shipment.company || '未知公司';
      const time = shipment.time || new Date(shipment.createdAt).toLocaleString('zh-TW');
      const timeKey = time.substring(0, 16);
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
    
    return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  // 獲取通路商數據
  const fetchDealers = async () => {
    try {
      setDealersLoading(true);
      setDealersError(null);
      const response = await fetch('https://hengtong.vercel.app/api/dealers');
      if (response.ok) {
        const result = await response.json();
        setDealers(result.data || []);
      } else {
        throw new Error(`獲取通路商數據失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取通路商數據失敗:', error);
      setDealersError(error.message);
    } finally {
      setDealersLoading(false);
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
        body: JSON.stringify({
          id: dealerId,
          status: newStatus
        })
      });
      
      if (response.ok) {
        fetchDealers();
        alert(`狀態更新成功！`);
      } else {
        throw new Error('更新失敗');
      }
    } catch (error) {
      console.error('更新通路商狀態失敗:', error);
      alert('更新失敗，請稍後再試');
    }
  };
  
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'pending':
        return { text: '待審核', color: '#ffa726' };
      case 'active':
        return { text: '已啟用', color: '#4CAF50' };
      case 'suspended':
        return { text: '已停用', color: '#f44336' };
      default:
        return { text: '未知', color: '#999' };
    }
  };
  
  const handleDealerManagement = () => {
    setShowDealerManagement(!showDealerManagement);
    if (!showDealerManagement) {
      fetchDealers();
    }
  };

  useEffect(() => {
    // 初始載入
    fetchShipments(true);
    fetchCloudInventory();
    
    // 定期更新數據（每10秒）
    const interval = setInterval(() => {
      fetchShipments(false);
      fetchCloudInventory();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 貨況提醒區塊 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>        
        <h3 style={{ marginTop: 0, color: '#f5f6fa' }}>
          貨況提醒 
          <span style={{ fontSize: 12, color: '#4CAF50' }}>(完全雲端化)</span>
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
                      <span style={{ color: '#ff9800', marginLeft: 8, fontSize: 12 }}>
                        (雲端庫存: {getStockByPartName(item.partName)})
                      </span>
                    </div>
                  ))}
                </div>
                
                <div style={{ borderTop: '1px solid #444', paddingTop: 8, fontSize: 13 }}>
                  <span style={{ color: '#ffa726' }}>總計：</span>
                  <span style={{ color: '#81c784', fontWeight: 'bold', marginLeft: 4 }}>數量 {order.totalQuantity}</span>
                  {order.totalAmount > 0 && (
                    <>
                      <br />
                      <span style={{ color: '#aaa', marginTop: 4, display: 'inline-block' }}>銷售金額 NT$ {order.totalAmount.toLocaleString()}</span>
                      <br />
                      <span style={{ color: '#ff9800', marginTop: 2, display: 'inline-block' }}>成本金額 NT$ {order.totalCost.toLocaleString()}</span>
                      <br />
                      <span style={{ 
                        color: order.totalProfit >= 0 ? '#4CAF50' : '#f44336', 
                        marginTop: 2, 
                        display: 'inline-block',
                        fontWeight: 'bold'
                      }}>
                        淨利金額 NT$ {order.totalProfit.toLocaleString()}
                      </span>
                      <span style={{ 
                        color: '#aaa', 
                        marginLeft: 8, 
                        fontSize: 11 
                      }}>
                        (利潤率: {order.totalAmount > 0 ? ((order.totalProfit / order.totalAmount) * 100).toFixed(1) : 0}%)
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* 通路商管理區塊 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '24px auto', boxShadow: '0 2px 12px #0002' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#f5f6fa' }}>通路商賬號管理</h3>
          <button 
            onClick={handleDealerManagement}
            style={{ 
              padding: '8px 16px', 
              background: showDealerManagement ? '#f44336' : '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer' 
            }}
          >
            {showDealerManagement ? '隱藏' : '顯示'}
          </button>
        </div>
        
        {showDealerManagement && (
          <div>
            {dealersLoading && <div style={{ color: '#aaa' }}>載入中...</div>}
            {dealersError && <div style={{ color: '#ff6b6b' }}>錯誤: {dealersError}</div>}
            
            {!dealersLoading && !dealersError && (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {dealers.length === 0 ? (
                  <div style={{ color: '#aaa' }}>暫無通路商數據</div>
                ) : (
                  dealers.map(dealer => {
                    const statusInfo = getStatusDisplay(dealer.status);
                    return (
                      <div key={dealer.id} style={{ 
                        background: '#2a2e37', 
                        padding: 12, 
                        marginBottom: 8, 
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{dealer.name}</div>
                          <div style={{ fontSize: 12, color: '#aaa' }}>帳號: {dealer.username}</div>
                          <div style={{ fontSize: 12, color: '#aaa' }}>電話: {dealer.phone}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ 
                            color: statusInfo.color, 
                            fontWeight: 'bold', 
                            marginBottom: 8 
                          }}>
                            {statusInfo.text}
                          </div>
                          <div>
                            <button 
                              onClick={() => updateDealerStatus(dealer.id, 'active')}
                              style={{ 
                                padding: '4px 8px', 
                                background: '#4CAF50', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: 3, 
                                cursor: 'pointer',
                                marginRight: 4,
                                fontSize: 10
                              }}
                            >
                              啟用
                            </button>
                            <button 
                              onClick={() => updateDealerStatus(dealer.id, 'suspended')}
                              style={{ 
                                padding: '4px 8px', 
                                background: '#f44336', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: 3, 
                                cursor: 'pointer',
                                fontSize: 10
                              }}
                            >
                              停用
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 後台管理系統按鈕 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '24px auto', boxShadow: '0 2px 12px #0002' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa', textAlign: 'center' }}>後台管理系統</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <button 
            onClick={() => navigate('/inventory')}
            style={{ 
              padding: '16px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            📦 庫存管理
          </button>
          
          <button 
            onClick={() => navigate('/shipping-stats')}
            style={{ 
              padding: '16px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            📊 銷售記錄
          </button>
          
          <button 
            onClick={handleDealerManagement}
            style={{ 
              padding: '16px', 
              background: '#FF9800', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            👥 通路商賬號管理
          </button>
          
          <button 
            onClick={() => {
              const confirmed = window.confirm('確定要備份數據嗎？');
              if (confirmed) {
                const data = {
                  timestamp: new Date().toISOString(),
                  orders: JSON.parse(localStorage.getItem('orders') || '[]'),
                  cloudInventory: cloudInventory
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert('數據備份完成！');
              }
            }}
            style={{ 
              padding: '16px', 
              background: '#9C27B0', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            💾 數據備份/還原
          </button>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button 
            onClick={() => {
              localStorage.removeItem('user');
              setUser(null);
              navigate('/');
            }}
            style={{ 
              padding: '12px 24px', 
              background: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            🚪 登出
          </button>
        </div>
      </div>
    </div>
  );
}

export default Admin;
