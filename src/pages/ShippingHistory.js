import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

function ShippingHistory() {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const recordsPerPage = 20;

  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser || (localUser.role !== 'dealer' && localUser.role !== 'admin')) {
      navigate('/');
      return;
    }
    
    if (localUser.role === 'dealer' && localUser.status !== 'active') {
      alert('您的帳號尚未審核通過或已被停用，請聯繫管理員');
      localStorage.removeItem('user');
      navigate('/');
      return;
    }

    // 初始載入數據
    fetchHistory();
  }, [user, navigate]);

  const fetchHistory = async (page = 1) => {
    setLoading(true);
    try {
      const userObj = user || JSON.parse(localStorage.getItem('user'));
      const company = userObj?.company || userObj?.username || 'admin';
      
      let url = `/api/shipments?company=${encodeURIComponent(company)}&page=${page}&limit=${recordsPerPage}`;
      
      // 添加日期範圍查詢參數
      if (startDate) {
        url += `&startDate=${encodeURIComponent(startDate)}`;
      }
      if (endDate) {
        url += `&endDate=${encodeURIComponent(endDate)}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setHistoryData(result.data || []);
        setTotalRecords(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / recordsPerPage));
        setCurrentPage(page);
      } else {
        alert('獲取歷史記錄失敗：' + result.error);
      }
    } catch (error) {
      console.error('獲取歷史記錄失敗:', error);
      alert('獲取歷史記錄失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchHistory(1);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      fetchHistory(page);
    }
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    fetchHistory(1);
  };

  const getTotalAmount = () => {
    return historyData.reduce((total, record) => total + (record.amount || 0), 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW');
  };

  // 修正：將同一時間的記錄分組合併
  // 修正：完全參考 Admin.js 的成功邏輯
  const groupRecordsByTime = (records) => {
    const grouped = {};
    
    records.forEach(record => {
      const company = record.company || '未知公司';
      const time = record.time || new Date(record.createdAt).toLocaleString('zh-TW');
      const timeKey = time.substring(0, 16);
      const groupKey = `${company}-${timeKey}`; // 關鍵：加入公司分組
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          company,
          time: timeKey,
          items: [],
          totalAmount: 0,
          createdAt: record.createdAt || record.time
        };
      }
      
      grouped[groupKey].items.push({
        partName: record.partName || '未知商品',
        quantity: record.quantity || 0,
        price: record.price || 0,
        amount: record.amount || 0
      });
      
      grouped[groupKey].totalAmount += (record.amount || 0);
    });
    
    return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  // 處理分組後的數據
  const groupedData = groupRecordsByTime(historyData);

  // 添加響應式檢測
  // 優化手機端顯示
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsSmallMobile(window.innerWidth <= 480);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 手機端卡片式顯示組件
  const MobileCard = ({ group, index }) => (
    <div key={index} style={{
      backgroundColor: '#2d3748',
      margin: '10px 0',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid #4a5568',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      {/* 時間標題 */}
      <div style={{
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#e2e8f0',
        marginBottom: '8px',
        textAlign: 'center',
        borderBottom: '1px solid #4a5568',
        paddingBottom: '6px'
      }}>
        {group.time}
      </div>
      
      {/* 商品列表 */}
      <div style={{ marginBottom: '8px' }}>
        {group.items.map((item, itemIndex) => (
          <div key={itemIndex} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '6px 0',
            borderBottom: itemIndex < group.items.length - 1 ? '1px solid #4a5568' : 'none'
          }}>
            {/* 商品名稱 */}
            <div style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#e2e8f0'
            }}>
              {item.partName}
            </div>
            
            {/* 數量、單價、小計 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#cbd5e0'
            }}>
              <span style={{ color: '#63b3ed', fontWeight: 'bold' }}>
                數量: {item.quantity}
              </span>
              <span>
                單價: ${item.price?.toLocaleString()}
              </span>
              <span style={{ color: '#68d391', fontWeight: 'bold' }}>
                小計: ${item.amount?.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* 總金額 */}
      <div style={{
        textAlign: 'center',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#68d391',
        backgroundColor: '#1a202c',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #4a5568'
      }}>
        總計: ${group.totalAmount?.toLocaleString()}
      </div>
    </div>
  );

  return (
    <div style={{ 
      backgroundColor: '#1a1a1a', 
      minHeight: '100vh', 
      textAlign: 'center', 
      marginBottom: 16,
      color: '#ffffff'
    }}>
      <img src="/images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ 
        maxWidth: isMobile ? '100%' : 1200, 
        margin: '0 auto', 
        padding: isMobile ? '0 24px' : 16  // 手機端增加到24px
      }}>
        
        {/* 返回按鈕 */}
        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <button 
            type="button" 
            onClick={() => navigate('/shipping')}
            style={{ 
              fontSize: 16, 
              padding: '8px 16px',
              backgroundColor: '#495057',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.3s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#6c757d'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#495057'}
          >
            ← 返回出貨頁面
          </button>
        </div>

        {/* 標題 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: 20, 
          fontWeight: 'bold', 
          fontSize: 32, 
          color: '#e9ecef',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
        }}>
          出貨歷史記錄
        </div>

        {/* 日期範圍查詢 */}
        <div style={{ 
          backgroundColor: '#2d3748', 
          padding: isMobile ? '16px 16px' : 20,  // 手機端調整為16px上下，16px左右
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #4a5568',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: 15, 
            flexWrap: 'wrap',
            marginBottom: 15
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#e2e8f0', fontWeight: 'bold' }}>開始日期：</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #4a5568',
                  backgroundColor: '#1a202c',
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#e2e8f0', fontWeight: 'bold' }}>結束日期：</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                style={{ 
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #4a5568',
                  backgroundColor: '#1a202c',
                  color: '#e2e8f0',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 10, 
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={handleSearch}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2c5aa0'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#3182ce'}
            >
              查詢
            </button>
            <button 
              onClick={clearDateFilter}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#c53030'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#e53e3e'}
            >
              清除篩選
            </button>
          </div>
        </div>
        
        {/* 統計信息 */}
        {!loading && historyData.length > 0 && (
          <div style={{ 
            backgroundColor: '#2d3748', 
            padding: isMobile ? '15px 16px' : 15,  // 手機端增加左右padding
            borderRadius: 8, 
            marginBottom: 20,
            border: '1px solid #4a5568',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: 18, 
              marginBottom: 8,
              color: '#e2e8f0'
            }}>
              統計信息
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-around', 
              flexWrap: 'wrap',
              color: '#cbd5e0'
            }}>
              <div>總記錄數：<strong style={{ color: '#63b3ed' }}>{totalRecords.toLocaleString()}</strong> 條</div>
              <div>當前頁面：<strong style={{ color: '#63b3ed' }}>{currentPage}</strong> / <strong style={{ color: '#63b3ed' }}>{totalPages}</strong></div>
              <div>本頁金額：NT$ <strong style={{ color: '#68d391' }}>{getTotalAmount().toLocaleString()}</strong></div>
            </div>
          </div>
        )}

        {/* 歷史記錄表格 */}
        <div style={{ 
          backgroundColor: '#1a202c', 
          padding: isMobile ? '8px 12px' : 20,  // 手機端減少內部padding
          borderRadius: 8,
          border: '1px solid #2d3748',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
          overflowX: isMobile ? 'auto' : 'visible'
        }}>
          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: 40, 
              color: '#e2e8f0', 
              fontSize: 18 
            }}>
              載入中...
            </div>
          ) : (
            <>
              {historyData.length > 0 ? (
                <>
                  <div style={{ 
                    maxHeight: 600, 
                    overflowY: 'auto', 
                    border: '1px solid #2d3748', 
                    borderRadius: 4,
                    minWidth: isMobile ? '320px' : 'auto',  // 減少最小寬度
                    width: '100%'
                  }}>
                    <table style={{ 
                      width: '100%', 
                      textAlign: 'center', 
                      borderCollapse: 'collapse',
                      fontSize: isMobile ? '11px' : '14px',  // 手機端字體更小
                      tableLayout: isMobile ? 'fixed' : 'auto'  // 固定表格佈局
                    }}>
                      <thead style={{ 
                        backgroundColor: '#2d3748', 
                        position: 'sticky', 
                        top: 0 
                      }}>
                        <tr>
                          <th style={{ 
                            padding: isMobile ? 6 : 12, 
                            border: '1px solid #4a5568', 
                            color: '#e2e8f0', 
                            minWidth: isMobile ? 80 : 150,  // 減少最小寬度
                            width: isMobile ? '25%' : 'auto',  // 設定百分比寬度
                            backgroundColor: '#2d3748'
                          }}>日期時間</th>
                          <th style={{ 
                            padding: isMobile ? 6 : 12, 
                            border: '1px solid #4a5568', 
                            color: '#e2e8f0', 
                            minWidth: isMobile ? 150 : 300,
                            width: isMobile ? '50%' : 'auto',
                            backgroundColor: '#2d3748'
                          }}>出貨明細</th>
                          <th style={{ 
                            padding: isMobile ? 6 : 12, 
                            border: '1px solid #4a5568', 
                            color: '#e2e8f0', 
                            minWidth: isMobile ? 60 : 120,
                            width: isMobile ? '25%' : 'auto',
                            backgroundColor: '#2d3748'
                          }}>總金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedData.map((group, index) => (
                          <tr key={index} style={{ 
                            backgroundColor: index % 2 === 0 ? '#2d3748' : '#1a202c',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4a5568'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#2d3748' : '#1a202c'}
                          >
                            <td style={{ 
                              padding: isMobile ? 6 : 10, 
                              border: '1px solid #4a5568', 
                              fontSize: isMobile ? 11 : 13, 
                              color: '#cbd5e0',
                              wordBreak: 'break-word',
                              verticalAlign: 'top'
                            }}>
                              {group.time}
                            </td>
                            <td style={{
                              padding: '12px',
                              border: '1px solid #4a5568',
                              textAlign: 'center',
                              color: '#e2e8f0',
                              fontSize: isMobile ? '12px' : '14px',
                              fontWeight: 'bold'
                            }}>
                              {group.time}
                            </td>
                            <td style={{ 
                              padding: isMobile ? 6 : 10, 
                              border: '1px solid #4a5568', 
                              color: '#68d391', 
                              fontWeight: 'bold',
                              fontSize: isMobile ? '12px' : '16px',
                              textAlign: 'center',
                              verticalAlign: 'middle'
                            }}>
                              {isMobile ? `$${group.totalAmount?.toLocaleString()}` : `NT$ ${group.totalAmount?.toLocaleString()}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 分頁控制 */}
                  {totalPages > 1 && (
                    <div style={{ 
                      marginTop: 20, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: 10,
                      flexWrap: 'wrap'
                    }}>
                      <button 
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === 1 ? '#4a5568' : '#3182ce',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.3s'
                        }}
                        onMouseOver={(e) => currentPage !== 1 && (e.target.style.backgroundColor = '#2c5aa0')}
                        onMouseOut={(e) => currentPage !== 1 && (e.target.style.backgroundColor = '#3182ce')}
                      >
                        首頁
                      </button>
                      
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === 1 ? '#4a5568' : '#3182ce',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.3s'
                        }}
                        onMouseOver={(e) => currentPage !== 1 && (e.target.style.backgroundColor = '#2c5aa0')}
                        onMouseOut={(e) => currentPage !== 1 && (e.target.style.backgroundColor = '#3182ce')}
                      >
                        上一頁
                      </button>

                      <span style={{ 
                        color: '#e2e8f0', 
                        fontSize: 16, 
                        margin: '0 10px',
                        fontWeight: 'bold'
                      }}>
                        第 {currentPage} 頁，共 {totalPages} 頁
                      </span>

                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === totalPages ? '#4a5568' : '#3182ce',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.3s'
                        }}
                        onMouseOver={(e) => currentPage !== totalPages && (e.target.style.backgroundColor = '#2c5aa0')}
                        onMouseOut={(e) => currentPage !== totalPages && (e.target.style.backgroundColor = '#3182ce')}
                      >
                        下一頁
                      </button>
                      
                      <button 
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === totalPages ? '#4a5568' : '#3182ce',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.3s'
                        }}
                        onMouseOver={(e) => currentPage !== totalPages && (e.target.style.backgroundColor = '#2c5aa0')}
                        onMouseOut={(e) => currentPage !== totalPages && (e.target.style.backgroundColor = '#3182ce')}
                      >
                        末頁
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 40, 
                  color: '#a0aec0', 
                  fontSize: 18 
                }}>
                  {startDate || endDate ? '查詢範圍內暫無出貨記錄' : '暫無出貨記錄'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShippingHistory;