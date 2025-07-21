import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
import { partsData } from './partsData';

function ShippingHistory() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // 日期篩選狀態
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredRecords, setFilteredRecords] = useState([]);

  // 響應式檢測
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 獲取成本價格
  const getCostByPartName = (partName) => {
    const part = partsData.find(p => p.name === partName);
    return part ? part.cost : 0;
  };

  // 獲取出貨歷史數據
  const fetchShippingHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      if (!userObj) {
        navigate('/login');
        return;
      }

      const response = await fetch(`https://hengtong.vercel.app/api/shipments?company=${encodeURIComponent(userObj.company || userObj.username)}`);
      if (response.ok) {
        const result = await response.json();
        const shipments = result.data || [];
        const groupedRecords = groupRecordsByTime(shipments);
        setRecords(groupedRecords);
        setFilteredRecords(groupedRecords);
      } else {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
    } catch (error) {
      console.error('獲取出貨歷史失敗:', error);
      setError(error.message);
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user, navigate]);

  // 參考Admin.js的分組邏輯
  const groupRecordsByTime = (shipments) => {
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

  // 計算總商品數量
  const getTotalQuantity = (data) => {
    return data.reduce((total, record) => total + record.totalQuantity, 0);
  };

  // 計算總金額
  const getTotalAmount = (data) => {
    return data.reduce((total, record) => total + record.totalAmount, 0);
  };

  // 參考Admin.js的展開收起邏輯
  const toggleOrderDetails = (orderKey) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderKey]: !prev[orderKey]
    }));
  };

  // 日期篩選功能
  const handleDateFilter = () => {
    if (!startDate && !endDate) {
      setFilteredRecords(records);
      return;
    }

    const filtered = records.filter(record => {
      const recordDate = new Date(record.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate + ' 23:59:59') : null;

      if (start && end) {
        return recordDate >= start && recordDate <= end;
      } else if (start) {
        return recordDate >= start;
      } else if (end) {
        return recordDate <= end;
      }
      return true;
    });

    setFilteredRecords(filtered);
  };

  // 清除篩選
  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    setFilteredRecords(records);
  };

  // 初始載入
  useEffect(() => {
    fetchShippingHistory();
  }, [fetchShippingHistory]);

  // 手機端卡片組件
  const MobileCard = ({ record, index }) => {
    const orderKey = `${record.createdAt}-${index}`;
    const isExpanded = expandedOrders[orderKey];

    return (
      <div style={{
        background: '#2a2e37',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        color: '#f5f6fa'
      }}>
        <div 
          onClick={() => toggleOrderDetails(orderKey)}
          style={{
            cursor: 'pointer',
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <span style={{ color: '#4CAF50' }}>{record.company}</span>
            <br />
            <span style={{ color: '#aaa', fontSize: 14 }}>{record.time}</span>
          </div>
          <span style={{ color: '#ffa726', fontSize: 14 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>

        <div style={{ marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: '#81c784', fontWeight: 'bold' }}>總數量: {record.totalQuantity}</span>
          {record.totalAmount > 0 && (
            <span style={{ color: '#aaa', marginLeft: 16 }}>總金額: NT$ {record.totalAmount.toLocaleString()}</span>
          )}
        </div>

        {isExpanded && (
          <>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#ffa726', fontWeight: 'bold' }}>出貨明細：</span>
            </div>
            
            <div style={{ marginLeft: 12, marginBottom: 8 }}>  
              {record.items
                .sort((a, b) => {
                  // 提取商品編號進行排序
                  const getPartNumber = (partName) => {
                    const match = partName.match(/PO-(\d+)/);
                    return match ? parseInt(match[1]) : 9999;
                  };
                  return getPartNumber(a.partName) - getPartNumber(b.partName);
                })
                .map((item, itemIdx) => (
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
              <span style={{ color: '#ffa726' }}>詳細總計：</span>
              <span style={{ color: '#81c784', fontWeight: 'bold', marginLeft: 4 }}>數量 {record.totalQuantity}</span>
              {record.totalAmount > 0 && (
                <>
                  <br />
                  <span style={{ color: '#aaa', marginTop: 4, display: 'inline-block' }}>銷售金額 NT$ {record.totalAmount.toLocaleString()}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#181a20' }}>
        <div style={{ color: '#f5f6fa', fontSize: 18 }}>正在載入歷史記錄...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 標題區塊 */}
      <div style={{ width: '95vw', maxWidth: isMobile ? '100%' : 1200, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: '#f5f6fa' }}>
            📊 出貨歷史記錄
          </h3>
          
          <button 
            onClick={() => navigate('/shipping')}
            style={{ 
              padding: '8px 16px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            📦 返回出貨
          </button>
        </div>

        {/* 日期篩選器 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: 4,
              border: '1px solid #444',
              background: '#2a2e37',
              color: '#f5f6fa',
              fontSize: 14
            }}
          />
          <span style={{ color: '#aaa' }}>至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: 4,
              border: '1px solid #444',
              background: '#2a2e37',
              color: '#f5f6fa',
              fontSize: 14
            }}
          />
          <button
            onClick={handleDateFilter}
            style={{
              padding: '8px 16px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            查詢
          </button>
          <button
            onClick={clearFilter}
            style={{
              padding: '8px 16px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            清除篩選
          </button>
        </div>

        {/* 統計信息 */}
        <div style={{ background: '#2a2e37', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#81c784', fontWeight: 'bold', fontSize: 16 }}>{filteredRecords.length}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>總記錄數</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: 16 }}>{getTotalQuantity(filteredRecords)}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>商品總數量</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ffa726', fontWeight: 'bold', fontSize: 16 }}>NT$ {getTotalAmount(filteredRecords).toLocaleString()}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>總金額</div>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: '#ff6b6b', padding: 20, background: '#2d1b1b', borderRadius: 8, margin: '10px 0' }}>
            ⚠️ 載入失敗: {error}
            <br />
            <button 
              onClick={fetchShippingHistory}
              style={{ marginTop: 10, padding: '5px 10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              重新載入
            </button>
          </div>
        )}

        {!error && filteredRecords.length === 0 && (
          <div style={{ color: '#aaa', padding: 20 }}>
            📭 暫無出貨記錄
          </div>
        )}

        {/* 歷史記錄列表 */}
        {!error && filteredRecords.length > 0 && (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {isMobile ? (
              // 手機端：卡片式顯示
              <div>
                {filteredRecords.map((record, index) => (
                  <MobileCard key={`${record.createdAt}-${index}`} record={record} index={index} />
                ))}
              </div>
            ) : (
              // 桌面端：列表式顯示（參考Admin.js格式）
              <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }}>
                {filteredRecords.map((record, index) => {
                  const orderKey = `${record.createdAt}-${index}`;
                  const isExpanded = expandedOrders[orderKey];
                  
                  return (
                    <li key={orderKey} style={{ 
                      marginBottom: 12, 
                      fontSize: 14, 
                      color: '#f5f6fa',
                      padding: '12px',
                      borderBottom: index < filteredRecords.length - 1 ? '1px solid #333' : 'none',
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
                          <span style={{ color: '#4CAF50' }}>{record.company}</span> 於 
                          <span style={{ color: '#aaa', marginLeft: 4 }}>{record.time}</span>
                        </div>
                        <span style={{ color: '#ffa726', fontSize: 14 }}>
                          {isExpanded ? '▼' : '▶'} 點選查看明細
                        </span>
                      </div>
                      
                      {/* 簡要資訊 - 始終顯示 */}
                      <div style={{ marginBottom: 8, fontSize: 13 }}>
                        <span style={{ color: '#81c784', fontWeight: 'bold' }}>總數量: {record.totalQuantity}</span>
                        {record.totalAmount > 0 && (
                          <span style={{ color: '#aaa', marginLeft: 16 }}>總金額: NT$ {record.totalAmount.toLocaleString()}</span>
                        )}
                      </div>
                      
                      {/* 詳細明細 - 可展開/收起 */}
                      {isExpanded && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ color: '#ffa726', fontWeight: 'bold' }}>出貨明細：</span>
                          </div>
                          
                          <div style={{ marginLeft: 12, marginBottom: 8 }}>  
                            {record.items
                              .sort((a, b) => {
                                // 提取商品編號進行排序
                                const getPartNumber = (partName) => {
                                  const match = partName.match(/PO-(\d+)/);
                                  return match ? parseInt(match[1]) : 9999;
                                };
                                return getPartNumber(a.partName) - getPartNumber(b.partName);
                              })
                              .map((item, itemIdx) => (
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
                            <span style={{ color: '#ffa726' }}>詳細總計：</span>
                            <span style={{ color: '#81c784', fontWeight: 'bold', marginLeft: 4 }}>數量 {record.totalQuantity}</span>
                            {record.totalAmount > 0 && (
                              <>
                                <br />
                                <span style={{ color: '#aaa', marginTop: 4, display: 'inline-block' }}>銷售金額 NT$ {record.totalAmount.toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShippingHistory;