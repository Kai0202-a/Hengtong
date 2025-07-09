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

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="/images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
        
        {/* 返回按鈕 */}
        <div style={{ marginBottom: 20, textAlign: 'left' }}>
          <button 
            type="button" 
            onClick={() => navigate('/shipping')}
            style={{ 
              fontSize: 16, 
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← 返回出貨頁面
          </button>
        </div>

        {/* 標題 */}
        <div style={{ textAlign: 'center', marginBottom: 20, fontWeight: 'bold', fontSize: 32, color: '#2c3e50' }}>
          出貨歷史記錄
        </div>

        {/* 日期範圍查詢 */}
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 20,
          border: '1px solid #dee2e6'
        }}>
          <div style={{ marginBottom: 15, fontWeight: 'bold', fontSize: 18 }}>日期範圍查詢</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, flexWrap: 'wrap' }}>
            <div>
              <label style={{ marginRight: 8, fontWeight: 'bold' }}>開始日期：</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ marginRight: 8, fontWeight: 'bold' }}>結束日期：</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '查詢中...' : '查詢'}
            </button>
            <button 
              onClick={clearDateFilter}
              disabled={loading}
              style={{ 
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              清除篩選
            </button>
          </div>
        </div>

        {/* 統計信息 */}
        {!loading && historyData.length > 0 && (
          <div style={{ 
            backgroundColor: '#e9ecef', 
            padding: 15, 
            borderRadius: 8, 
            marginBottom: 20,
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
              統計信息
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
              <div>總記錄數：<strong>{totalRecords.toLocaleString()}</strong> 條</div>
              <div>當前頁面：<strong>{currentPage}</strong> / <strong>{totalPages}</strong></div>
              <div>本頁金額：NT$ <strong>{getTotalAmount().toLocaleString()}</strong></div>
            </div>
          </div>
        )}

        {/* 歷史記錄表格 */}
        <div style={{ backgroundColor: '#2c3e50', padding: 20, borderRadius: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'white', fontSize: 18 }}>
              載入中...
            </div>
          ) : (
            <>
              {historyData.length > 0 ? (
                <>
                  <div style={{ maxHeight: 600, overflowY: 'auto', border: '1px solid #34495e', borderRadius: 4 }}>
                    <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#34495e', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: 12, border: '1px solid #34495e', color: 'white', minWidth: 150 }}>日期時間</th>
                          <th style={{ padding: 12, border: '1px solid #34495e', color: 'white', minWidth: 120 }}>品號</th>
                          <th style={{ padding: 12, border: '1px solid #34495e', color: 'white', minWidth: 80 }}>數量</th>
                          <th style={{ padding: 12, border: '1px solid #34495e', color: 'white', minWidth: 100 }}>單價</th>
                          <th style={{ padding: 12, border: '1px solid #34495e', color: 'white', minWidth: 120 }}>總金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((record, index) => (
                          <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#34495e' : '#2c3e50' }}>
                            <td style={{ padding: 10, border: '1px solid #34495e', fontSize: 13, color: 'white' }}>
                              {formatDate(record.time || record.createdAt)}
                            </td>
                            <td style={{ padding: 10, border: '1px solid #34495e', color: 'white', fontWeight: 'bold' }}>
                              {record.partName}
                            </td>
                            <td style={{ padding: 10, border: '1px solid #34495e', color: 'white' }}>
                              {record.quantity}
                            </td>
                            <td style={{ padding: 10, border: '1px solid #34495e', color: 'white' }}>
                              NT$ {record.price?.toLocaleString()}
                            </td>
                            <td style={{ padding: 10, border: '1px solid #34495e', color: 'white', fontWeight: 'bold' }}>
                              NT$ {record.amount?.toLocaleString()}
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
                          backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        首頁
                      </button>
                      
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === 1 ? '#6c757d' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        上一頁
                      </button>

                      <span style={{ color: 'white', fontSize: 16, margin: '0 10px' }}>
                        第 {currentPage} 頁，共 {totalPages} 頁
                      </span>

                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        下一頁
                      </button>
                      
                      <button 
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        style={{ 
                          padding: '8px 12px',
                          backgroundColor: currentPage === totalPages ? '#6c757d' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        末頁
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#bdc3c7', fontSize: 18 }}>
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