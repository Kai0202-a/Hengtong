import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

const MonthlyBilling = () => {
  const navigate = useNavigate();
  const printRef = useRef();
  const [shipmentData, setShipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [billingData, setBillingData] = useState({});
  const [companies, setCompanies] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [sortBy, setSortBy] = useState('date'); // 新增排序選項

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';

  // 獲取所有出貨資料
  const fetchShipmentData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/shipments`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setShipmentData(result.data);
          processShipmentData(result.data);
        }
      }
    } catch (error) {
      console.error('獲取出貨資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 處理出貨資料，按公司和月份分組
  const processShipmentData = (data) => {
    const grouped = {};
    const companiesSet = new Set();
    const monthsSet = new Set();

    data.forEach(shipment => {
      const date = new Date(shipment.time);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const company = shipment.company;
      
      companiesSet.add(company);
      monthsSet.add(monthKey);

      if (!grouped[company]) {
        grouped[company] = {};
      }
      if (!grouped[company][monthKey]) {
        grouped[company][monthKey] = {
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          totalCost: 0
        };
      }

      grouped[company][monthKey].items.push(shipment);
      grouped[company][monthKey].totalQuantity += shipment.quantity;
      grouped[company][monthKey].totalAmount += shipment.amount;
      grouped[company][monthKey].totalCost += shipment.cost || 0;
    });

    setBillingData(grouped);
    setCompanies(Array.from(companiesSet).sort());
    setAvailableMonths(Array.from(monthsSet).sort().reverse());
  };

  // 獲取當前月份
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // 列印功能
  const handlePrint = () => {
    window.print();
  };

  // 生成圖片功能
  const generateImage = async () => {
    if (printRef.current) {
      try {
        const canvas = await html2canvas(printRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        
        const link = document.createElement('a');
        link.download = `月度帳單_${selectedCompany}_${selectedMonth}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error('生成圖片失敗:', error);
        alert('生成圖片失敗，請稍後再試');
      }
    }
  };

  // 格式化金額
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // 格式化日期
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  // 獲取選定的帳單資料並排序
  const getSelectedBillingData = () => {
    if (!selectedCompany || !selectedMonth || !billingData[selectedCompany]) {
      return null;
    }
    
    const data = { ...billingData[selectedCompany][selectedMonth] };
    
    // 根據選擇的排序方式排序品項
    data.items = [...data.items].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.time) - new Date(a.time); // 最新日期在前
        case 'name':
          return a.partName.localeCompare(b.partName, 'zh-TW'); // 商品名稱 A-Z
        case 'quantity':
          return b.quantity - a.quantity; // 數量大到小
        case 'amount':
          return b.amount - a.amount; // 金額大到小
        default:
          return 0;
      }
    });
    
    return data;
  };

  useEffect(() => {
    fetchShipmentData();
    setSelectedMonth(getCurrentMonth());
  }, []);

  const selectedData = getSelectedBillingData();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: 18
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16, fontSize: 24 }}>⏳</div>
          載入中...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: 20, 
      maxWidth: 1200, 
      margin: '0 auto', 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', 
      minHeight: '100vh' 
    }}>
      {/* 控制面板 */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
        padding: 24, 
        borderRadius: 16, 
        marginBottom: 24, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: 'white', fontSize: 28, fontWeight: '600' }}>💰 月度帳單統計</h2>
          <button 
            onClick={() => navigate('/admin')}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
          >
            ← 返回管理頁面
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>選擇商家：</label>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                background: 'rgba(255,255,255,0.9)',
                color: '#333',
                outline: 'none'
              }}
            >
              <option value="">請選擇商家</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>選擇月份：</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                background: 'rgba(255,255,255,0.9)',
                color: '#333',
                outline: 'none'
              }}
            >
              <option value="">請選擇月份</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>排序方式：</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                background: 'rgba(255,255,255,0.9)',
                color: '#333',
                outline: 'none'
              }}
            >
              <option value="date">依日期排序</option>
              <option value="name">依商品名稱</option>
              <option value="quantity">依數量排序</option>
              <option value="amount">依金額排序</option>
            </select>
          </div>
        </div>

        {selectedData && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button 
              onClick={handlePrint}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: 14,
                boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🖨️ 列印帳單
            </button>
            <button 
              onClick={generateImage}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: 14,
                boxShadow: '0 4px 15px rgba(33, 150, 243, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              📷 生成圖片
            </button>
          </div>
        )}
      </div>

      {/* 帳單內容 */}
      {selectedData ? (
        <div 
          ref={printRef}
          style={{
            background: '#fff',
            padding: 40,
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            border: '1px solid rgba(0,0,0,0.05)'
          }}
        >
          {/* 帳單標題 */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: 40, 
            borderBottom: '3px solid #667eea', 
            paddingBottom: 24,
            background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
            margin: '-40px -40px 40px -40px',
            padding: '40px 40px 24px 40px',
            borderRadius: '16px 16px 0 0'
          }}>
            <h1 style={{ margin: 0, fontSize: 32, color: '#667eea', fontWeight: '700' }}>月度出貨帳單</h1>
            <p style={{ margin: '12px 0 0 0', fontSize: 16, color: '#8892b0', fontWeight: '500' }}>Monthly Shipping Invoice</p>
          </div>

          {/* 帳單資訊 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
            <div style={{ 
              padding: 24, 
              background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)', 
              borderRadius: 12,
              border: '1px solid #e1e5f2'
            }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#667eea', borderBottom: '2px solid #667eea', paddingBottom: 8, fontWeight: '600' }}>客戶資訊</h3>
              <p style={{ margin: '12px 0', fontSize: 16, color: '#2d3748' }}><strong style={{ color: '#667eea' }}>公司名稱：</strong>{selectedCompany}</p>
              <p style={{ margin: '12px 0', fontSize: 16, color: '#2d3748' }}><strong style={{ color: '#667eea' }}>帳單月份：</strong>{selectedMonth}</p>
            </div>
            <div style={{ 
              padding: 24, 
              background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)', 
              borderRadius: 12,
              border: '1px solid #feb2b2'
            }}>
              <h3 style={{ margin: '0 0 20px 0', color: '#e53e3e', borderBottom: '2px solid #e53e3e', paddingBottom: 8, fontWeight: '600' }}>帳單摘要</h3>
              <p style={{ margin: '12px 0', fontSize: 16, color: '#2d3748' }}><strong style={{ color: '#e53e3e' }}>總數量：</strong>{selectedData.totalQuantity.toLocaleString()} 件</p>
              <p style={{ margin: '12px 0', fontSize: 16, color: '#2d3748' }}><strong style={{ color: '#e53e3e' }}>總金額：</strong>{formatCurrency(selectedData.totalAmount)}</p>
              <p style={{ margin: '12px 0', fontSize: 16, color: '#2d3748' }}><strong style={{ color: '#e53e3e' }}>開立日期：</strong>{formatDate(new Date())}</p>
            </div>
          </div>

          {/* 商品明細表格 */}
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#2d3748', 
              borderBottom: '2px solid #667eea', 
              paddingBottom: 12, 
              fontWeight: '600',
              fontSize: 20
            }}>商品明細</h3>
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <th style={{ padding: 16, border: 'none', textAlign: 'left', color: 'white', fontWeight: '600' }}>出貨日期</th>
                    <th style={{ padding: 16, border: 'none', textAlign: 'left', color: 'white', fontWeight: '600' }}>商品名稱</th>
                    <th style={{ padding: 16, border: 'none', textAlign: 'center', color: 'white', fontWeight: '600' }}>數量</th>
                    <th style={{ padding: 16, border: 'none', textAlign: 'right', color: 'white', fontWeight: '600' }}>單價</th>
                    <th style={{ padding: 16, border: 'none', textAlign: 'right', color: 'white', fontWeight: '600' }}>小計</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedData.items.map((item, index) => (
                    <tr key={index} style={{ 
                      background: index % 2 === 0 ? '#f8f9ff' : 'white',
                      transition: 'background-color 0.2s ease'
                    }}>
                      <td style={{ padding: 16, border: 'none', borderBottom: '1px solid #e2e8f0', color: '#4a5568' }}>{formatDate(item.time)}</td>
                      <td style={{ padding: 16, border: 'none', borderBottom: '1px solid #e2e8f0', color: '#2d3748', fontWeight: '500' }}>{item.partName}</td>
                      <td style={{ padding: 16, border: 'none', borderBottom: '1px solid #e2e8f0', textAlign: 'center', color: '#667eea', fontWeight: '600' }}>{item.quantity}</td>
                      <td style={{ padding: 16, border: 'none', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#4a5568' }}>{formatCurrency(item.price)}</td>
                      <td style={{ padding: 16, border: 'none', borderBottom: '1px solid #e2e8f0', textAlign: 'right', color: '#e53e3e', fontWeight: '600' }}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)' }}>
                    <td colSpan="2" style={{ padding: 16, border: 'none', textAlign: 'right', color: 'white', fontWeight: '700', fontSize: 16 }}>總計：</td>
                    <td style={{ padding: 16, border: 'none', textAlign: 'center', color: '#ffd700', fontWeight: '700', fontSize: 16 }}>{selectedData.totalQuantity}</td>
                    <td style={{ padding: 16, border: 'none' }}></td>
                    <td style={{ padding: 16, border: 'none', textAlign: 'right', color: '#ffd700', fontWeight: '700', fontSize: 16 }}>{formatCurrency(selectedData.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 帳單備註 */}
          <div style={{ 
            marginTop: 40, 
            padding: 24, 
            background: 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)', 
            borderRadius: 12,
            border: '1px solid #9ae6b4'
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#22543d', fontWeight: '600' }}>📋 備註事項：</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#2f855a', lineHeight: 1.8 }}>
              1. 本帳單為系統自動生成，如有疑問請聯繫相關人員。<br/>
              2. 請於收到帳單後 30 天內完成付款。<br/>
              3. 如有任何問題，請及時與我們聯繫。
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)',
          padding: 60,
          borderRadius: 16,
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
          <p style={{ fontSize: 20, color: '#667eea', fontWeight: '500', margin: 0 }}>請選擇商家和月份以查看帳單</p>
        </div>
      )}

      {/* 列印樣式 */}
      <style jsx>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 1cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
};

export default MonthlyBilling;