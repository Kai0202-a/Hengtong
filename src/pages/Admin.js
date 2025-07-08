import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import { partsData } from './partsData';

function Admin() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 通路商管理相關狀態
  const [showDealerStatus, setShowDealerStatus] = useState(false); // 改名：只顯示狀態
  const [showDealerData, setShowDealerData] = useState(false); // 新增：詳細資料管理
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersError, setDealersError] = useState(null);
  const [selectedDealer, setSelectedDealer] = useState(null);
  
  // 雲端庫存狀態
  const [cloudInventory, setCloudInventory] = useState([]);
  
  // 提醒欄清空狀態 - 只保留 lastClearTime
  const [lastClearTime, setLastClearTime] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/");
    }
    
    // 檢查自動清空狀態
    checkAutoClearing();
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

  // 根據零件名稱獲取成本
  const getCostByPartName = (partName) => {
    const part = partsData.find(p => p.name === partName);
    return part ? part.cost : 0;
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
          totalCost: 0,
          totalProfit: 0,
          createdAt: shipment.createdAt || shipment.time
        };
      }
      
      const itemCost = getCostByPartName(shipment.partName) * (shipment.quantity || 0);
      const itemProfit = (shipment.amount || 0) - itemCost;
      
      grouped[groupKey].items.push({
        partName: shipment.partName || '未知商品',
        quantity: shipment.quantity || 0,
        price: shipment.price || 0,
        amount: shipment.amount || 0,
        cost: itemCost,
        profit: itemProfit
      });
      
      grouped[groupKey].totalQuantity += shipment.quantity || 0;
      grouped[groupKey].totalAmount += shipment.amount || 0;
      grouped[groupKey].totalCost += itemCost;
      grouped[groupKey].totalProfit += itemProfit;
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
        const statusText = newStatus === 'active' ? '啟用' : newStatus === 'suspended' ? '停用' : '審核通過';
        alert(`通路商狀態已更新為：${statusText}`);
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
  
  // 修改：只顯示通路商狀態
  const handleDealerStatus = () => {
    setShowDealerStatus(!showDealerStatus);
    if (!showDealerStatus) {
      fetchDealers();
    }
  };
  
  // 新增：通路商資料管理
  const handleDealerData = () => {
    setShowDealerData(!showDealerData);
    if (!showDealerData) {
      fetchDealers();
    }
  };
  
  // 新增：顯示通路商詳細資料
  const showDealerDetails = (dealer) => {
    setSelectedDealer(dealer);
  };
  
  // 新增：關閉詳細資料視窗
  const closeDealerDetails = () => {
    setSelectedDealer(null);
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

  // 檢查自動清空狀態
  const checkAutoClearing = () => {
    // ... existing code ...
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1e26', color: '#f5f6fa', padding: 20 }}>
      {/* 貨況提醒區塊 - 新增 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '24px auto', boxShadow: '0 2px 12px #0002' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa', textAlign: 'center' }}>
          📦 貨況提醒
          <span style={{ fontSize: 12, color: '#4CAF50', marginLeft: 8 }}>(即時更新)</span>
          {isRefreshing && <span style={{ fontSize: 12, color: '#ffa726', marginLeft: 8 }}>🔄 更新中...</span>}
        </h3>
        
        {loading && (
          <div style={{ color: '#aaa', padding: 20, textAlign: 'center' }}>
            載入中...
          </div>
        )}
        
        {error && (
          <div style={{ color: '#ff6b6b', padding: 20, background: '#2d1b1b', borderRadius: 8, margin: '10px 0', textAlign: 'center' }}>
            ⚠️ 連接失敗: {error}
            <br />
            <button 
              onClick={() => fetchShipments(true)}
              style={{ marginTop: 10, padding: '8px 16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              🔄 重新載入
            </button>
          </div>
        )}
        
        {!loading && !error && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {orders.length === 0 ? (
              <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>暫無出貨紀錄</div>
            ) : (
              orders.slice(0, 10).map((order, idx) => (
                <div key={idx} style={{ 
                  marginBottom: 12, 
                  padding: 16, 
                  background: '#2a2e37', 
                  borderRadius: 8, 
                  border: '1px solid #444'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', color: '#4CAF50' }}>{order.company}</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>{order.time}</div>
                  </div>
                  
                  <div style={{ fontSize: 14 }}>
                    {order.items.map((item, itemIdx) => (
                      <div key={itemIdx} style={{ marginBottom: 4 }}>
                        <span style={{ color: '#f5f6fa' }}>📦 {item.partName}</span>
                        <span style={{ color: '#ffa726', marginLeft: 8 }}>數量: {item.quantity}</span>
                        <span style={{ color: '#4CAF50', marginLeft: 8 }}>金額: ${item.amount}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: 8, fontSize: 12, color: '#aaa', borderTop: '1px solid #444', paddingTop: 8 }}>
                    總數量: {order.totalQuantity} | 總金額: ${order.totalAmount} | 利潤: ${order.totalProfit}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {!loading && !error && orders.length > 10 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button 
              onClick={() => navigate('/shipping')}
              style={{ padding: '8px 16px', background: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              📊 查看完整記錄
            </button>
          </div>
        )}
      </div>
      
      {/* 通路商詳細資料管理區塊 */}
      {showDealerData && (
        <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '24px auto', boxShadow: '0 2px 12px #0002' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: '#f5f6fa' }}>通路商資料管理</h3>
            <button               
              onClick={() => setShowDealerData(false)}              
              style={{                 
                padding: '8px 16px',                 
                background: '#f44336',                 
                color: 'white',                 
                border: 'none',                 
                borderRadius: 4,                 
                cursor: 'pointer'               
              }}            
            >              
              關閉            
            </button>          
          </div>          
          
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
                        border: dealer.status === 'pending' ? '2px solid #ffa726' : '1px solid #444'                      
                      }}>                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>                          
                          <div>                            
                            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{dealer.name}</div>                            
                            <div style={{ fontSize: 12, color: '#aaa' }}>帳號: {dealer.username}</div>                            
                            <div style={{ fontSize: 12, color: '#aaa' }}>電話: {dealer.phone}</div>                          
                          </div>                          
                          <div style={{ textAlign: 'right' }}>                            
                            <div style={{                               
                              color: statusInfo.color,                               
                              fontWeight: 'bold',                               
                              marginBottom: 8,                              
                              padding: '4px 8px',                              
                              background: statusInfo.color + '20',                              
                              borderRadius: 4                            
                            }}>                              
                              {statusInfo.text}                            
                            </div>                          
                          </div>                        
                        </div>                        
                        
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>                          
                          {dealer.status === 'pending' && (                            
                            <button                               
                              onClick={() => updateDealerStatus(dealer.id, 'active')}                              
                              style={{                                 
                                padding: '6px 12px',                                 
                                background: '#4CAF50',                                 
                                color: 'white',                                 
                                border: 'none',                                 
                                borderRadius: 4,                                 
                                cursor: 'pointer',                                
                                fontSize: 12,                                
                                fontWeight: 'bold'                              
                              }}                            
                            >                              
                              ✅ 審核通過                            
                            </button>                          
                          )}                          
                          
                          <button                             
                            onClick={() => updateDealerStatus(dealer.id, 'active')}                            
                            disabled={dealer.status === 'active'}                            
                            style={{                               
                              padding: '6px 12px',                               
                              background: dealer.status === 'active' ? '#666' : '#4CAF50',                               
                              color: 'white',                               
                              border: 'none',                               
                              borderRadius: 4,                               
                              cursor: dealer.status === 'active' ? 'not-allowed' : 'pointer',                              
                              fontSize: 12                            
                            }}                          
                          >                            
                            🟢 啟用                          
                          </button>                          
                          
                          <button                             
                            onClick={() => updateDealerStatus(dealer.id, 'suspended')}                            
                            disabled={dealer.status === 'suspended'}                            
                            style={{                               
                              padding: '6px 12px',                               
                              background: dealer.status === 'suspended' ? '#666' : '#f44336',                               
                              color: 'white',                               
                              border: 'none',                               
                              borderRadius: 4,                               
                              cursor: dealer.status === 'suspended' ? 'not-allowed' : 'pointer',                              
                              fontSize: 12                            
                            }}                          
                          >                            
                            🔴 停用                          
                          </button>                          
                          
                          <button                             
                            onClick={() => showDealerDetails(dealer)}                            
                            style={{                               
                              padding: '6px 12px',                               
                              background: '#2196F3',                               
                              color: 'white',                               
                              border: 'none',                               
                              borderRadius: 4,                               
                              cursor: 'pointer',                              
                              fontSize: 12                            
                            }}                          
                          >                            
                            📋 詳細資料                          
                          </button>                        
                        </div>                      
                      </div>                    
                    );                  
                  })
                )}              
              </div>            
            )}          
          </div>        
        </div>
      )}
      
      {/* 通路商詳細資料彈窗 */}
      {selectedDealer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#23272f',
            padding: 24,
            borderRadius: 12,
            color: '#f5f6fa',
            maxWidth: 500,
            width: '90%',
            maxHeight: '80%',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>通路商詳細資料</h3>
              <button 
                onClick={closeDealerDetails}
                style={{
                  background: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 12px',
                  cursor: 'pointer'
                }}
              >
                ✕ 關閉
              </button>
            </div>
            
            <div style={{ lineHeight: 1.8 }}>
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>公司名稱：</strong>
                <span>{selectedDealer.name}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>帳號：</strong>
                <span>{selectedDealer.username}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>密碼：</strong>
                <span style={{ fontFamily: 'monospace', background: '#333', padding: '2px 6px', borderRadius: 3 }}>
                  {selectedDealer.password || '••••••••'}
                </span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>聯絡電話：</strong>
                <span>{selectedDealer.phone}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>電子郵件：</strong>
                <span>{selectedDealer.email || '未提供'}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>地址：</strong>
                <span>{selectedDealer.address || '未提供'}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>註冊時間：</strong>
                <span>{selectedDealer.createdAt ? new Date(selectedDealer.createdAt).toLocaleString('zh-TW') : '未知'}</span>
              </div>
              
              <div style={{ marginBottom: 12 }}>
                <strong style={{ color: '#4CAF50' }}>帳號狀態：</strong>
                <span style={{ 
                  color: getStatusDisplay(selectedDealer.status).color,
                  fontWeight: 'bold',
                  background: getStatusDisplay(selectedDealer.status).color + '20',
                  padding: '2px 8px',
                  borderRadius: 4
                }}>
                  {getStatusDisplay(selectedDealer.status).text}
                </span>
              </div>
              
              <div style={{ marginTop: 20, padding: 12, background: '#2a2e37', borderRadius: 8 }}>
                <strong style={{ color: '#ffa726' }}>快速操作：</strong>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedDealer.status === 'pending' && (
                    <button 
                      onClick={() => {
                        updateDealerStatus(selectedDealer.id, 'active');
                        closeDealerDetails();
                      }}
                      style={{ 
                        padding: '8px 16px', 
                        background: '#4CAF50', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4, 
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      ✅ 審核通過並啟用
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      updateDealerStatus(selectedDealer.id, selectedDealer.status === 'active' ? 'suspended' : 'active');
                      closeDealerDetails();
                    }}
                    style={{ 
                      padding: '8px 16px', 
                      background: selectedDealer.status === 'active' ? '#f44336' : '#4CAF50', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 4, 
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    {selectedDealer.status === 'active' ? '🔴 停用帳號' : '🟢 啟用帳號'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 後台管理系統按鈕 - 修改通路商按鈕 */}
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
            onClick={() => navigate('/shipping')}
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
            onClick={handleDealerData}
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
            👥 通路商資料
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
