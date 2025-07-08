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
  const [showDealerManagement, setShowDealerManagement] = useState(false);
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [dealersError, setDealersError] = useState(null);
  
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
    console.log('=== 開始處理 shipments ===');
    console.log('原始 shipments 數量:', shipments.length);
    console.log('原始 shipments:', JSON.parse(JSON.stringify(shipments)));
    
    const grouped = {};
    
    shipments.forEach((shipment, index) => {
      console.log(`\n--- 處理第 ${index + 1} 筆 shipment ---`);
      console.log('當前 shipment:', JSON.parse(JSON.stringify(shipment)));
      
      // 檢查必要字段
      if (!shipment.company) {
        console.warn('警告：shipment 缺少 company 字段:', shipment);
      }
      if (!shipment.createdAt) {
        console.warn('警告：shipment 缺少 createdAt 字段:', shipment);
      }
      if (!shipment.partName) {
        console.warn('警告：shipment 缺少 partName 字段:', shipment);
      }
      
      const company = shipment.company || '未知公司';
      const date = new Date(shipment.createdAt);
      const timeKey = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      const groupKey = `${company}-${timeKey}`;
      
      console.log(`公司: ${company}`);
      console.log(`時間: ${timeKey}`);
      console.log(`分組鍵: ${groupKey}`);
      
      if (!grouped[groupKey]) {
        console.log(`創建新的分組: ${groupKey}`);
        grouped[groupKey] = {
          company,
          time: timeKey,
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          totalCost: 0,
          totalProfit: 0,
          createdAt: shipment.createdAt
        };
      } else {
        console.log(`使用現有分組: ${groupKey}`);
      }
      
      const itemCost = getCostByPartName(shipment.partName) * (shipment.quantity || 0);
      const itemProfit = (shipment.amount || 0) - itemCost;
      
      console.log(`商品: ${shipment.partName}`);
      console.log(`數量: ${shipment.quantity}`);
      console.log(`金額: ${shipment.amount}`);
      console.log(`成本: ${itemCost}`);
      console.log(`利潤: ${itemProfit}`);
      
      const existingItem = grouped[groupKey].items.find(item => item.partName === shipment.partName);
      
      if (existingItem) {
        console.log(`找到相同商品 ${shipment.partName}，進行累加`);
        console.log('累加前:', JSON.parse(JSON.stringify(existingItem)));
        existingItem.quantity += shipment.quantity || 0;
        existingItem.amount += shipment.amount || 0;
        existingItem.cost += itemCost;
        existingItem.profit += itemProfit;
        console.log('累加後:', JSON.parse(JSON.stringify(existingItem)));
      } else {
        console.log(`新增商品 ${shipment.partName}`);
        const newItem = {
          partName: shipment.partName || '未知商品',
          quantity: shipment.quantity || 0,
          price: shipment.price || 0,
          amount: shipment.amount || 0,
          cost: itemCost,
          profit: itemProfit
        };
        grouped[groupKey].items.push(newItem);
        console.log('新增的商品:', JSON.parse(JSON.stringify(newItem)));
      }
      
      // 重新計算總計
      const oldTotals = {
        totalQuantity: grouped[groupKey].totalQuantity,
        totalAmount: grouped[groupKey].totalAmount,
        totalCost: grouped[groupKey].totalCost,
        totalProfit: grouped[groupKey].totalProfit
      };
      
      grouped[groupKey].totalQuantity = grouped[groupKey].items.reduce((sum, item) => sum + item.quantity, 0);
      grouped[groupKey].totalAmount = grouped[groupKey].items.reduce((sum, item) => sum + item.amount, 0);
      grouped[groupKey].totalCost = grouped[groupKey].items.reduce((sum, item) => sum + item.cost, 0);
      grouped[groupKey].totalProfit = grouped[groupKey].items.reduce((sum, item) => sum + item.profit, 0);
      
      console.log('總計更新:');
      console.log('更新前:', oldTotals);
      console.log('更新後:', {
        totalQuantity: grouped[groupKey].totalQuantity,
        totalAmount: grouped[groupKey].totalAmount,
        totalCost: grouped[groupKey].totalCost,
        totalProfit: grouped[groupKey].totalProfit
      });
      
      console.log(`分組 ${groupKey} 當前商品數量: ${grouped[groupKey].items.length}`);
      console.log(`分組 ${groupKey} 當前總數量: ${grouped[groupKey].totalQuantity}`);
    });
    
    console.log('\n=== 處理完成 ===');
    console.log('所有分組鍵:', Object.keys(grouped));
    console.log('分組數量:', Object.keys(grouped).length);
    
    Object.keys(grouped).forEach(key => {
      console.log(`分組 ${key}:`);
      console.log(`  商品數量: ${grouped[key].items.length}`);
      console.log(`  總數量: ${grouped[key].totalQuantity}`);
      console.log(`  商品列表:`, grouped[key].items.map(item => `${item.partName}(${item.quantity})`).join(', '));
    });
    
    console.log('最終 grouped:', JSON.parse(JSON.stringify(grouped)));
    const finalResult = Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    console.log('最終結果數量:', finalResult.length);
    console.log('最終結果:', JSON.parse(JSON.stringify(finalResult)));
    return finalResult;
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
  // 在 getFilteredOrders 函數後添加調試日誌
  const getFilteredOrders = () => {
  console.log('=== getFilteredOrders 調試 ===');
  console.log('原始 orders 數量:', orders.length);
  console.log('原始 orders:', orders);
  console.log('lastClearTime:', lastClearTime);
  
  if (!lastClearTime) {
    console.log('沒有清空時間，返回所有訂單');
    return orders;
  }
  
  const clearTime = new Date(lastClearTime);
  const filtered = orders.filter(order => {
    const orderTime = new Date(order.createdAt);
    const shouldShow = orderTime > clearTime;
    console.log(`訂單 ${order.company} ${order.time}: ${orderTime} > ${clearTime} = ${shouldShow}`);
    return shouldShow;
  });
  
  console.log('過濾後的訂單數量:', filtered.length);
  console.log('過濾後的訂單:', filtered);
  return filtered;
  };

  // 新增：檢查是否需要自動清空（每月1號）
  // 修改自動清空檢查邏輯
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
                    <br />
                    <button 
                      onClick={() => {
                        setLastClearTime(null);
                        localStorage.removeItem('alertsClearTime');
                      }}
                      style={{ 
                        marginTop: 8, 
                        padding: '4px 8px', 
                        background: '#4CAF50', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 4, 
                        cursor: 'pointer',
                        fontSize: 10
                      }}
                    >
                      重新顯示所有提醒
                    </button>
                  </li>
                );
              }
              
              if (filteredOrders.length === 0) {
                return <li style={{ color: '#aaa' }}>暫無出貨紀錄</li>;
              }
              
              return filteredOrders.map((order, idx) => (
                <li key={`${order.createdAt}-${idx}`} style={{ 
                  marginBottom: 12, 
                  fontSize: 14, 
                  color: '#f5f6fa',
                  padding: '12px',
                  borderBottom: idx < filteredOrders.length - 1 ? '1px solid #333' : 'none',
                  background: '#2a2e37',
                  borderRadius: 8,
                  textAlign: 'left'
                }}>
                  {/* 原有的訂單顯示邏輯保持不變 */}
                  <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold' }}>
                    <span style={{ color: '#4CAF50' }}>{order.company}</span> 於 
                    <span style={{ color: '#aaa', marginLeft: 4 }}>{order.time}</span>
                  </div>
                  
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#ffa726', fontWeight: 'bold' }}>出貨明細：</span>
                  </div>
                  
                  // 在第488行 order.items.map 之前添加調試
                  <div style={{ marginLeft: 12, marginBottom: 8 }}>  
                  {(() => {
                  console.log(`渲染訂單 ${order.company} ${order.time}:`);
                  console.log(`  items 數量: ${order.items.length}`);
                  console.log(`  items 內容:`, order.items);
                  return order.items.map((item, itemIdx) => (
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
                  ));
                  })()} 
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
                        <span style={{ color: order.totalProfit >= 0 ? '#4CAF50' : '#f44336', marginTop: 2, display: 'inline-block', fontWeight: 'bold' }}>
                          淨利金額 NT$ {order.totalProfit.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              ));  
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
