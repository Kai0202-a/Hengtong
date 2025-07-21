import React, { useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
// 如果不需要本地 partsData，可以移除這行
// import { partsData } from './partsData';

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

  // 獲取成本價格 - 如果需要從雲端獲取
  const getCostByPartName = (partName) => {
    // 如果移除了 partsData，這個函數需要重新實作
    // 或者從 API 獲取商品資訊
    return 0; // 暫時返回 0
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

      // 使用環境變數替換硬編碼的 URL
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';
      const response = await fetch(`${API_BASE_URL}/api/shipments?company=${encodeURIComponent(userObj.company || userObj.username)}`);
      
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
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #444' }}>
            {record.items.map((item, itemIndex) => (
              <div key={itemIndex} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: itemIndex < record.items.length - 1 ? '1px solid #333' : 'none'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#fff' }}>{item.partName}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>數量: {item.quantity}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>NT$ {item.amount.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>單價: NT$ {item.price.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1e27',
        color: '#f5f6fa'
      }}>
        載入出貨歷史中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1e27',
        color: '#f5f6fa'
      }}>
        <div style={{ marginBottom: 16, color: '#ff6b6b' }}>載入失敗: {error}</div>
        <button
          onClick={fetchShippingHistory}
          style={{
            padding: '8px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1e27',
      color: '#f5f6fa',
      padding: isMobile ? '16px' : '24px'
    }}>
      {/* 標題和統計 */}
      <div style={{
        marginBottom: 24,
        textAlign: 'center'
      }}>
        <h1 style={{
          color: '#4CAF50',
          marginBottom: 16,
          fontSize: isMobile ? 24 : 32
        }}>
          出貨歷史
        </h1>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          marginBottom: 24,
          flexWrap: 'wrap'
        }}>
          <div style={{
            background: '#2a2e37',
            padding: '12px 24px',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ color: '#aaa', fontSize: 14 }}>總訂單數</div>
            <div style={{ color: '#4CAF50', fontSize: 20, fontWeight: 'bold' }}>
              {filteredRecords.length}
            </div>
          </div>
          
          <div style={{
            background: '#2a2e37',
            padding: '12px 24px',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ color: '#aaa', fontSize: 14 }}>總商品數量</div>
            <div style={{ color: '#2196F3', fontSize: 20, fontWeight: 'bold' }}>
              {getTotalQuantity(filteredRecords)}
            </div>
          </div>
          
          <div style={{
            background: '#2a2e37',
            padding: '12px 24px',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ color: '#aaa', fontSize: 14 }}>總金額</div>
            <div style={{ color: '#FF9800', fontSize: 20, fontWeight: 'bold' }}>
              NT$ {getTotalAmount(filteredRecords).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 日期篩選 */}
      <div style={{
        background: '#2a2e37',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <label style={{ color: '#aaa', fontSize: 14 }}>開始日期:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            padding: '6px 12px',
            background: '#1a1e27',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#f5f6fa'
          }}
        />
        
        <label style={{ color: '#aaa', fontSize: 14 }}>結束日期:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            padding: '6px 12px',
            background: '#1a1e27',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#f5f6fa'
          }}
        />
        
        <button
          onClick={handleDateFilter}
          style={{
            padding: '6px 16px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          篩選
        </button>
        
        <button
          onClick={clearFilter}
          style={{
            padding: '6px 16px',
            background: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          清除
        </button>
      </div>

      {/* 出貨記錄列表 */}
      {filteredRecords.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#aaa',
          padding: 48
        }}>
          沒有找到出貨記錄
        </div>
      ) : (
        <div>
          {isMobile ? (
            // 手機端：卡片式顯示
            filteredRecords.map((record, index) => (
              <MobileCard key={index} record={record} index={index} />
            ))
          ) : (
            // 桌面端：列表式顯示（參考Admin.js格式）
            <div style={{
              background: '#2a2e37',
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 100px 120px 80px',
                gap: 16,
                padding: 16,
                background: '#333',
                fontWeight: 'bold',
                color: '#4CAF50'
              }}>
                <div>公司/時間</div>
                <div>總數量</div>
                <div>總金額</div>
                <div>操作</div>
                <div></div>
              </div>
              
              {filteredRecords.map((record, index) => {
                const orderKey = `${record.createdAt}-${index}`;
                const isExpanded = expandedOrders[orderKey];
                
                return (
                  <div key={index}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 150px 100px 120px 80px',
                      gap: 16,
                      padding: 16,
                      borderBottom: '1px solid #444',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#4CAF50' }}>
                          {record.company}
                        </div>
                        <div style={{ color: '#aaa', fontSize: 14 }}>
                          {record.time}
                        </div>
                      </div>
                      
                      <div style={{ color: '#2196F3', fontWeight: 'bold' }}>
                        {record.totalQuantity}
                      </div>
                      
                      <div style={{ color: '#FF9800', fontWeight: 'bold' }}>
                        NT$ {record.totalAmount.toLocaleString()}
                      </div>
                      
                      <button
                        onClick={() => toggleOrderDetails(orderKey)}
                        style={{
                          padding: '4px 12px',
                          background: isExpanded ? '#666' : '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        {isExpanded ? '收起' : '展開'}
                      </button>
                      
                      <div style={{ color: '#ffa726' }}>
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div style={{
                        background: '#1a1e27',
                        padding: 16,
                        borderBottom: '1px solid #444'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 100px 120px 120px',
                          gap: 16,
                          marginBottom: 8,
                          fontWeight: 'bold',
                          color: '#aaa',
                          fontSize: 14
                        }}>
                          <div>商品名稱</div>
                          <div>數量</div>
                          <div>單價</div>
                          <div>小計</div>
                        </div>
                        
                        {record.items.map((item, itemIndex) => (
                          <div key={itemIndex} style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 100px 120px 120px',
                            gap: 16,
                            padding: '8px 0',
                            borderBottom: itemIndex < record.items.length - 1 ? '1px solid #333' : 'none'
                          }}>
                            <div style={{ color: '#fff' }}>{item.partName}</div>
                            <div style={{ color: '#2196F3' }}>{item.quantity}</div>
                            <div style={{ color: '#aaa' }}>NT$ {item.price.toLocaleString()}</div>
                            <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                              NT$ {item.amount.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* 返回按鈕 */}
      <div style={{
        textAlign: 'center',
        marginTop: 32
      }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            padding: '12px 24px',
            background: '#666',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          返回首頁
        </button>
      </div>
    </div>
  );
}

export default ShippingHistory;