import React, { useContext, useEffect, useState, useCallback } from "react";
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
  
  // 新增：控制每個訂單明細的展開狀態
  const [expandedOrders, setExpandedOrders] = useState({});
  
  // 通路商管理相關狀態
  const [showDealerManagement, setShowDealerManagement] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersError, setDealersError] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({}); // 新增：用戶上線狀態

    // 新增：獲取用戶上線狀態
  const fetchOnlineStatus = useCallback(async (dealersList) => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/user-status');
      if (response.ok) {
        const result = await response.json();
        setOnlineStatus(result.data || {});
      }
    } catch (error) {
      console.error('獲取上線狀態失敗:', error);
    }
  }, []);

  // 獲取通路商數據
  const fetchDealers = useCallback(async () => {
    try {
      setDealersLoading(true);
      setDealersError(null);
      const response = await fetch('https://hengtong.vercel.app/api/dealers');
      if (response.ok) {
        const result = await response.json();
        setDealers(result.data || []);
        // 獲取上線狀態
        fetchOnlineStatus(result.data || []);
      } else {
        throw new Error(`獲取通路商數據失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取通路商數據失敗:', error);
      setDealersError(error.message);
    } finally {
      setDealersLoading(false);
    }
  }, [fetchOnlineStatus]);

  // 新增：格式化最後上線時間
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return '從未登入';
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 5) return '🟢 線上';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    return `${diffDays} 天前`;
  };

  // 雲端庫存狀態
  const [cloudInventory, setCloudInventory] = useState([]);
  
  // 提醒欄清空狀態 - 只保留 lastClearTime
  const [lastClearTime, setLastClearTime] = useState(null);

   const checkAutoClearing = () => {
    const now = new Date();
    const lastClear = localStorage.getItem('alertsClearTime');
    
    if (lastClear) {
      const lastClearDate = new Date(lastClear);
      const currentMonth = now.getMonth();
      const lastClearMonth = lastClearDate.getMonth();
      
      // 如果是新的月份且今天是1號，自動清空
      if (currentMonth !== lastClearMonth && now.getDate() === 1) {
        setLastClearTime(now);
        localStorage.setItem('alertsClearTime', now.toISOString());
      } else {
        // 恢復上次的清空時間
        setLastClearTime(lastClearDate);
      }
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/");
    }
    
    // 檢查自動清空狀態
    checkAutoClearing();
  }, [navigate]);
  
  // 獲取雲端庫存數據
  // 將第 95 行的 inventory API 改為 products API
  const fetchCloudInventory = useCallback(async () => {
    try {
    // 改用 products API 獲取完整商品和庫存數據
    const response = await fetch('https://hengtong.vercel.app/api/products');
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        setCloudInventory(result.data);
      }
    }
  } catch (error) {
    console.error('獲取雲端庫存數據失敗:', error);
  }
}, []);
  
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
  const fetchShipments = useCallback(async (isInitialLoad = false) => {
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
  }, []);

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

  // 新增：切換訂單明細展開/收起的函數
  const toggleOrderDetails = (orderKey) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderKey]: !prev[orderKey]
    }));
  };

  // 移除定時刷新，改用 SSE
  // 將 SSE 邏輯替換為輪詢機制
  useEffect(() => {
    // 初始載入
    fetchCloudInventory();
    fetchShipments(true); // 初始載入
    
    // 設定輪詢，每 30 秒檢查一次
    const pollInterval = setInterval(() => {
      console.log('輪詢更新貨況數據...');
      fetchShipments(false); // 靜默更新，不顯示載入狀態
      fetchCloudInventory(); // 同時更新庫存
    }, 30000); // 30 秒
    
    // 頁面焦點事件：當用戶切換回頁面時自動刷新
    const handleFocus = () => {
      console.log('頁面重新獲得焦點，刷新數據...');
      fetchShipments(false);
      fetchCloudInventory();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // 清理函數
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // 修改清空提醒欄功能
  const clearAlerts = () => {
    const confirmed = window.confirm('確定要清空貨況提醒欄嗎？\n\n注意：這只會清空本地顯示，雲端資料不會被刪除。');
    if (confirmed) {
      const now = new Date();
      setLastClearTime(now);
      localStorage.setItem('alertsClearTime', now.toISOString());
      alert('提醒欄已清空！');
    }
  };

  // 修改過濾邏輯：只顯示清空時間之後的資料
  const getFilteredOrders = () => {
    if (!lastClearTime) {
      return orders;
    }
    
    const clearTime = new Date(lastClearTime);
    return orders.filter(order => {
      const orderTime = new Date(order.createdAt);
      return orderTime > clearTime;
    });
  };

  // 新增：檢查是否需要自動清空（每月1號）
  // 修改自動清空檢查邏輯
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 貨況提醒區塊 */}
      <div style={{ width: '95vw', maxWidth: 600, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#f5f6fa' }}>
            貨況提醒 
            <span style={{ fontSize: 12, color: '#4CAF50' }}>(完全雲端化)</span>
            {isRefreshing && (
              <span style={{ fontSize: 10, color: '#ffa726', marginLeft: 8 }}>更新中...</span>
            )}
          </h3>
          
          <button 
            onClick={clearAlerts}
            style={{ 
              padding: '6px 12px', 
              background: '#ff9800', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            🗑️ 清空提醒欄
          </button>
        </div>
        
        {/* 修改清空狀態顯示條件 */}
        {lastClearTime && (
          <div style={{ 
            background: '#2d5016', 
            color: '#81c784', 
            padding: 8, 
            borderRadius: 4, 
            marginBottom: 12, 
            fontSize: 12 
          }}>
            ✅ 提醒欄已於 {new Date(lastClearTime).toLocaleString('zh-TW')} 清空
            <br />
            <span style={{ fontSize: 10, color: '#aaa' }}>下次自動清空：每月1號</span>
          </div>
        )}
        
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
            {(() => {
              const filteredOrders = getFilteredOrders();
              
              if (filteredOrders.length === 0 && lastClearTime) {
                return (
                  <li style={{ color: '#aaa', padding: 20 }}>
                    📭 提醒欄已清空
                    <br />
                    <span style={{ fontSize: 12 }}>清空時間：{new Date(lastClearTime).toLocaleString('zh-TW')}</span>
                    <br />
                    <span style={{ fontSize: 12, color: '#4CAF50' }}>新的出貨資料會自動顯示</span>
                  </li>
                );
              }
              
              if (filteredOrders.length === 0) {
                return <li style={{ color: '#aaa' }}>暫無出貨紀錄</li>;
              }
              
              // 在 return 語句中的 filteredOrders.map() 部分需要修正
              return filteredOrders.map((order, idx) => {
                const orderKey = `${order.createdAt}-${idx}`;
                const isExpanded = expandedOrders[orderKey];
                
                return (
                  <li key={orderKey} style={{ 
                    marginBottom: 12, 
                    fontSize: 14, 
                    color: '#f5f6fa',
                    padding: '12px',
                    borderBottom: idx < filteredOrders.length - 1 ? '1px solid #333' : 'none',
                    background: '#2a2e37',
                    borderRadius: 8,
                    textAlign: 'left'
                  }}>
                    {/* 訂單標題 - 可點選展開/收起 */}
                    <div 
                      onClick={() => toggleOrderDetails(orderKey)}
                      style={{ 
                        marginBottom: 8, 
                        fontSize: 16, 
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span style={{ color: '#4CAF50' }}>{order.company}</span> 於 
                        <span style={{ color: '#aaa', marginLeft: 4 }}>{order.time}</span>
                      </div>
                      <span style={{ color: '#ffa726', fontSize: 14 }}>
                        {isExpanded ? '▼' : '▶'} 點選查看明細
                      </span>
                    </div>
                    
                    {/* 簡要資訊 - 始終顯示 */}
                    <div style={{ marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: '#81c784', fontWeight: 'bold' }}>總數量: {order.totalQuantity}</span>
                      {order.totalAmount > 0 && (
                        <span style={{ color: '#aaa', marginLeft: 16 }}>總金額: NT$ {order.totalAmount.toLocaleString()}</span>
                      )}
                    </div>
                    
                    {/* 詳細明細 - 可展開/收起 */}
                    {isExpanded && (
                      <>
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
                          <span style={{ color: '#ffa726' }}>詳細總計：</span>
                          <span style={{ color: '#81c784', fontWeight: 'bold', marginLeft: 4 }}>數量 {order.totalQuantity}</span>
                          {order.totalAmount > 0 && (
                            <>
                              <br />
                              <span style={{ color: '#aaa', marginTop: 4, display: 'inline-block' }}>銷售金額 NT$ {order.totalAmount.toLocaleString()}</span>
                              <br />
                              <span style={{ color: '#ff9800', marginTop: 2, display: 'inline-block' }}>成本金額 NT$ {order.totalCost.toLocaleString()}</span>
                              <br />
                              <span style={{ color: order.totalProfit >= 0 ? '#4CAF50' : '#f44336', marginTop: 2, display: 'inline-block', fontWeight: 'bold' }}>
                                淨利金額 NT$ {order.totalProfit.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              });
              
            })()}
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
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {dealers.length === 0 ? (
                  <div style={{ color: '#aaa' }}>暫無通路商數據</div>
                ) : (
                  dealers.map(dealer => {
                    const statusInfo = getStatusDisplay(dealer.status);
                    const userStatus = onlineStatus[dealer.username] || {};
                    const isOnline = userStatus.isOnline || false;
                    const lastSeen = formatLastSeen(userStatus.lastSeen);
                    
                    return (
                      <div key={dealer.id || dealer._id} style={{ 
                        background: '#2a2e37', 
                        padding: 16, 
                        marginBottom: 12, 
                        borderRadius: 8,
                        border: isOnline ? '2px solid #4CAF50' : '1px solid #444'
                      }}>
                        {/* 主要資訊區塊 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              marginBottom: 8 
                            }}>
                              <div style={{ fontWeight: 'bold', fontSize: 16, marginRight: 8 }}>
                                {dealer.name}
                              </div>
                              <div style={{ 
                                fontSize: 12, 
                                color: isOnline ? '#4CAF50' : '#aaa',
                                background: isOnline ? '#1b5e20' : '#333',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 'bold'
                              }}>
                                {lastSeen}
                              </div>
                            </div>
                            
                            {/* 基本資訊 */}
                            <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 4 }}>
                              <strong>公司：</strong>{dealer.company || '未提供'}
                            </div>
                            <div style={{ fontSize: 13, color: '#e0e0e0', marginBottom: 4 }}>
                              <strong>統編：</strong>{dealer.taxId || '未提供'}
                            </div>
                            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>
                              <strong>帳號：</strong>{dealer.username}
                            </div>
                            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>
                              <strong>電話：</strong>{dealer.phone || '未提供'}
                            </div>
                            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>
                              <strong>信箱：</strong>{dealer.email || '未提供'}
                            </div>
                            <div style={{ fontSize: 12, color: '#aaa' }}>
                              <strong>地址：</strong>{dealer.address || '未提供'}
                            </div>
                          </div>
                          
                          {/* 狀態和操作區塊 */}
                          <div style={{ textAlign: 'right', minWidth: 120 }}>
                            <div style={{ 
                              color: statusInfo.color, 
                              fontWeight: 'bold', 
                              marginBottom: 12,
                              fontSize: 14
                            }}>
                              {statusInfo.text}
                            </div>
                            
                            {/* 註冊時間 */}
                            {dealer.createdAt && (
                              <div style={{ 
                                fontSize: 10, 
                                color: '#666', 
                                marginBottom: 8 
                              }}>
                                註冊：{new Date(dealer.createdAt).toLocaleDateString('zh-TW')}
                              </div>
                            )}
                            
                            {/* 操作按鈕 */}
                            <div>
                              <button 
                                onClick={() => updateDealerStatus(dealer._id || dealer.id, 'active')}
                                style={{ 
                                  padding: '6px 10px', 
                                  background: '#4CAF50', 
                                  color: 'white', 
                                  border: 'none', 
                                  borderRadius: 4, 
                                  cursor: 'pointer',
                                  marginRight: 4,
                                  fontSize: 11,
                                  marginBottom: 4
                                }}
                              >
                                ✓ 啟用
                              </button>
                              <button 
                                onClick={() => updateDealerStatus(dealer._id || dealer.id, 'suspended')}
                                style={{ 
                                  padding: '6px 10px', 
                                  background: '#f44336', 
                                  color: 'white', 
                                  border: 'none', 
                                  borderRadius: 4, 
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  marginBottom: 4
                                }}
                              >
                                ✗ 停用
                              </button>
                            </div>
                            
                            {/* 刷新狀態按鈕 */}
                            <button 
                              onClick={() => fetchOnlineStatus([dealer])}
                              style={{ 
                                padding: '4px 8px', 
                                background: '#2196F3', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: 3, 
                                cursor: 'pointer',
                                fontSize: 10
                              }}
                            >
                              🔄 刷新狀態
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