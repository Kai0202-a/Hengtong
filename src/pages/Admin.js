import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";

// 在檔案開頭添加 API_BASE_URL 常數
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';

function Admin() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('adminExpandedOrders');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleOrderDetails = useCallback((orderKey) => {
    setExpandedOrders(prev => {
      const next = { ...prev, [orderKey]: !prev[orderKey] };
      localStorage.setItem('adminExpandedOrders', JSON.stringify(next));
      return next;
    });
  }, []);
  const [showDealerManagement, setShowDealerManagement] = useState(false);
  
  // 新增：庫存管理相關狀態
  const [showInventoryManagement, setShowInventoryManagement] = useState({});
  const [dealerInventories, setDealerInventories] = useState({});
  const [inventoryLoading, setInventoryLoading] = useState({});
  const [products, setProducts] = useState([]);
  
  // 新增：訂單單據相關狀態
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  

  // 新增：關閉訂單單據的函數
  const closeOrderModal = () => {
    setSelectedOrder(null);
    setShowOrderModal(false);
  };
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersError, setDealersError] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({}); // 新增：用戶上線狀態

    // 新增：獲取用戶上線狀態
  const fetchOnlineStatus = useCallback(async (dealersList) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-status`);
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
      const response = await fetch(`${API_BASE_URL}/api/dealers`);
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
    const response = await fetch(`${API_BASE_URL}/api/products`);
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

  // 根據零件名稱獲取成本 - 改為使用雲端數據
  const getCostByPartName = useCallback((partName) => {
    const cloudPart = cloudInventory.find(p => p.name === partName || p.id === partName);
    return cloudPart ? cloudPart.cost : 0;
  }, [cloudInventory]);

  // 整合同銷商同一時間的出貨記錄
  const groupShipmentsByCompanyAndTime = useCallback((shipments) => {
    const grouped = {};
    
    shipments.forEach(shipment => {
      const company = shipment.company || '未知公司';
      const rawTime = shipment.time || shipment.createdAt;
      const date = new Date(rawTime);

      // 使用穩定鍵：YYYY-MM-DD HH:mm（避免 substring 截斷造成不一致）
      const timeKey = isNaN(date.getTime())
        ? String(rawTime).slice(0, 16)
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

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
          createdAt: rawTime
        };
      }
      
      const itemCost = shipment.cost ? (shipment.cost * (shipment.quantity || 0)) : (getCostByPartName(shipment.partName) * (shipment.quantity || 0));
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
  }, [getCostByPartName]);

  // 獲取出貨數據
  const fetchShipments = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/shipments`);
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
  }, [groupShipmentsByCompanyAndTime]);
  
  
  // 更新通路商狀態
  const updateDealerStatus = async (dealerId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dealers`, {
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

  // 新增：切換庫存管理顯示的函數
  const toggleInventoryManagement = async (dealerUsername) => {
    setShowInventoryManagement(prev => ({
      ...prev,
      [dealerUsername]: !prev[dealerUsername]
    }));
    
    // 如果是打開庫存管理，則載入相關數據
    if (!showInventoryManagement[dealerUsername]) {
      await fetchProducts();
      await fetchDealerInventory(dealerUsername);
    }
  };

  // 新增：獲取商品列表
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setProducts(result.data);
        }
      }
    } catch (error) {
      console.error('獲取商品列表失敗:', error);
    }
  };

  // 修正：獲取特定通路商的庫存
  const fetchDealerInventory = async (dealerUsername) => {
    try {
      setInventoryLoading(prev => ({ ...prev, [dealerUsername]: true }));
      
      // 修正參數名稱：dealer -> dealerUsername
      const response = await fetch(`${API_BASE_URL}/api/dealer-inventory?dealerUsername=${dealerUsername}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setDealerInventories(prev => ({
            ...prev,
            [dealerUsername]: result.data.inventory || {}
          }));
        }
      }
    } catch (error) {
      console.error('獲取通路商庫存失敗:', error);
    } finally {
      setInventoryLoading(prev => ({ ...prev, [dealerUsername]: false }));
    }
  };

  // 修正：更新通路商庫存
  const updateDealerInventory = async (dealerUsername, productId, quantity, action) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dealer-inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealerUsername: dealerUsername, // 修正欄位名稱：dealer -> dealerUsername
          productId: productId,
          quantity: parseInt(quantity),
          action: action
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchDealerInventory(dealerUsername);
          alert(`庫存${action === 'add' ? '增加' : action === 'subtract' ? '減少' : '設定'}成功！`);
        } else {
          alert(result.message || '操作失敗');
        }
      } else {
        throw new Error('API 請求失敗');
      }
    } catch (error) {
      console.error('更新庫存失敗:', error);
      alert('更新庫存失敗，請稍後再試');
    }
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
  }, [fetchShipments, fetchCloudInventory]);

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
                const orderKey = `${order.company}-${order.time}`;
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
                  (dealers || []).map(dealer => {
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
                        
                        {/* 新增：庫存管理按鈕 */}
                        <div style={{ marginTop: 12, borderTop: '1px solid #444', paddingTop: 12 }}>
                          <button
                            onClick={() => toggleInventoryManagement(dealer.username)}
                            style={{
                              padding: '8px 16px',
                              background: showInventoryManagement[dealer.username] ? '#ff9800' : '#2196F3',
                              color: 'white',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 'bold',
                              marginRight: 8
                            }}
                          >
                            {showInventoryManagement[dealer.username] ? '隱藏庫存管理' : '📦 管理在店庫存'}
                          </button>
                        </div>

                        {/* 新增：庫存管理介面 */}
                        {showInventoryManagement[dealer.username] && (
                          <div style={{
                            marginTop: 16,
                            padding: 16,
                            background: '#1a1e26',
                            borderRadius: 8,
                            border: '1px solid #333'
                          }}>
                            <h4 style={{ margin: '0 0 12px 0', color: '#4CAF50' }}>📦 {dealer.name} - 在店庫存管理</h4>
                            
                            {inventoryLoading[dealer.username] ? (
                              <div style={{ color: '#aaa', textAlign: 'center', padding: 20 }}>載入庫存數據中...</div>
                            ) : (
                              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {products
                                  .sort((a, b) => {
                                    // 提取商品 ID 中的數字部分進行比較
                                    const getIdNumber = (productName) => {
                                      const match = productName.match(/PO-(\d+)/);
                                      return match ? parseInt(match[1]) : 0;
                                    };
                                    return getIdNumber(a.name) - getIdNumber(b.name);
                                  })
                                  .map(product => {
                                  const currentStock = dealerInventories[dealer.username]?.[product.id] || 0;
                                  
                                  return (
                                    <div key={product.id} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 12px',
                                      marginBottom: 8,
                                      background: '#2a2e37',
                                      borderRadius: 6,
                                      border: '1px solid #444'
                                    }}>
                                      {/* 商品資訊 */}
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold', color: '#e3f2fd', fontSize: 14 }}>
                                          {product.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#aaa' }}>
                                          雲端總庫存: {product.stock}
                                        </div>
                                      </div>
                                      
                                      {/* 當前在店庫存 */}
                                      <div style={{
                                        padding: '4px 8px',
                                        background: currentStock > 0 ? '#1b5e20' : '#424242',
                                        color: currentStock > 0 ? '#4CAF50' : '#aaa',
                                        borderRadius: 4,
                                        fontSize: 12,
                                        fontWeight: 'bold',
                                        minWidth: 60,
                                        textAlign: 'center',
                                        marginRight: 12
                                      }}>
                                        在店: {currentStock}
                                      </div>
                                      
                                      {/* 操作按鈕 */}
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button
                                          onClick={() => {
                                            const quantity = prompt('請輸入要增加的數量:');
                                            if (quantity && !isNaN(quantity) && parseInt(quantity) > 0) {
                                              updateDealerInventory(dealer.username, product.id, quantity, 'add');
                                            }
                                          }}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#4CAF50',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 3,
                                            cursor: 'pointer',
                                            fontSize: 11
                                          }}
                                        >
                                          +
                                        </button>
                                        
                                        <button
                                          onClick={() => {
                                            const quantity = prompt('請輸入要減少的數量:');
                                            if (quantity && !isNaN(quantity) && parseInt(quantity) > 0) {
                                              if (parseInt(quantity) <= currentStock) {
                                                updateDealerInventory(dealer.username, product.id, quantity, 'subtract');
                                              } else {
                                                alert('減少數量不能超過當前庫存！');
                                              }
                                            }
                                          }}
                                          style={{
                                            padding: '4px 8px',
                                            background: '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 3,
                                            cursor: 'pointer',
                                            fontSize: 11
                                          }}
                                        >
                                          -
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
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
            onClick={() => navigate('/monthly-billing')}
            style={{ 
              padding: '16px', 
              background: '#E91E63', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold'
            }}
          >
            💰 月度帳單統計
          </button>
          
          <button 
            onClick={() => navigate('/hengtong-ai')}
            style={{ 
              padding: '16px', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: 8, 
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
            }}
          >
            🤖 恆通AI
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
            🚪 登出
          </button>
        </div>
      </div>
      
      {/* 訂單單據彈出視窗 */}
      {showOrderModal && selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.8)', // 增加背景透明度
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#2c3e50', // 深色背景
            width: '90vw',
            maxWidth: 600,
            maxHeight: '90vh',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)' // 增強陰影
          }}>
            {/* 單據標題 */}
            <div style={{
              background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)', // 深色漸變
              color: '#ecf0f1',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#ecf0f1' }}>📋 出貨單據</h3>
              <button 
                onClick={closeOrderModal}
                style={{
                  background: 'rgba(236, 240, 241, 0.2)',
                  border: '1px solid rgba(236, 240, 241, 0.3)',
                  color: '#ecf0f1',
                  fontSize: 18,
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: '4px 8px',
                  transition: 'all 0.2s ease'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* 單據內容 */}
            <div style={{ padding: 20, maxHeight: 'calc(90vh - 80px)', overflowY: 'auto', background: '#2c3e50' }}>
              {/* 公司資訊 */}
              <div style={{ marginBottom: 20, padding: 16, background: '#34495e', borderRadius: 8, border: '1px solid #4a5f7a' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#ecf0f1' }}>客戶資訊</h4>
                <div style={{ color: '#bdc3c7' }}>
                  <strong>公司名稱：</strong>{selectedOrder.company}<br/>
                  <strong>出貨時間：</strong>{selectedOrder.time}
                </div>
              </div>
              
              {/* 商品明細表格 */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#ecf0f1' }}>商品明細</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #4a5f7a', borderRadius: 8, overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)' }}>
                      <th style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'left', color: '#ecf0f1', fontWeight: '600' }}>商品名稱</th>
                      <th style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'center', color: '#ecf0f1', fontWeight: '600' }}>數量</th>
                      <th style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'right', color: '#ecf0f1', fontWeight: '600' }}>單價</th>
                      <th style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'right', color: '#ecf0f1', fontWeight: '600' }}>小計</th>
                      <th style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'center', color: '#ecf0f1', fontWeight: '600' }}>庫存</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items
                      .sort((a, b) => {
                        // 提取商品 ID 中的數字部分進行比較
                        const getIdNumber = (partName) => {
                          const match = partName.match(/PO-(\d+)/);
                          return match ? parseInt(match[1]) : 0;
                        };
                        return getIdNumber(a.partName) - getIdNumber(b.partName);
                      })
                      .map((item, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#34495e' : '#2c3e50' }}>
                        <td style={{ padding: 12, border: '1px solid #4a5f7a', color: '#ecf0f1' }}>{item.partName}</td>
                        <td style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'center', color: '#ecf0f1', fontWeight: '500' }}>{item.quantity}</td>
                        <td style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'right', color: '#ecf0f1' }}>
                          {item.amount > 0 ? `NT$ ${(item.amount / item.quantity).toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'right', color: '#ecf0f1', fontWeight: '500' }}>
                          {item.amount > 0 ? `NT$ ${item.amount.toLocaleString()}` : '-'}
                        </td>
                        <td style={{ padding: 12, border: '1px solid #4a5f7a', textAlign: 'center', color: '#f39c12', fontWeight: '500' }}>
                          {getStockByPartName(item.partName)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* 總計資訊 */}
              <div style={{ padding: 16, background: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)', borderRadius: 8, border: '2px solid #4a5f7a' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#ecf0f1' }}>總計資訊</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, color: '#bdc3c7' }}>
                  <div><strong>總數量：</strong>{selectedOrder.totalQuantity}</div>
                  <div><strong>總金額：</strong>NT$ {selectedOrder.totalAmount.toLocaleString()}</div>
                  <div><strong>總成本：</strong>NT$ {selectedOrder.totalCost.toLocaleString()}</div>
                  <div style={{ color: selectedOrder.totalProfit >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: '600' }}>
                    <strong>淨利潤：</strong>NT$ {selectedOrder.totalProfit.toLocaleString()}
                  </div>
                </div>
              </div>
              
              {/* 操作按鈕 */}
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button 
                  onClick={() => window.print()}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    marginRight: 12,
                    fontSize: 14,
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(39, 174, 96, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🖨️ 列印單據
                </button>
                <button 
                  onClick={closeOrderModal}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #7f8c8d 0%, #95a5a6 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(127, 140, 141, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
