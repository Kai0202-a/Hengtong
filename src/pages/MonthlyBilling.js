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

  // 獲取選定的帳單資料
  const getSelectedBillingData = () => {
    if (!selectedCompany || !selectedMonth || !billingData[selectedCompany]) {
      return null;
    }
    return billingData[selectedCompany][selectedMonth];
  };

  useEffect(() => {
    fetchShipmentData();
    setSelectedMonth(getCurrentMonth());
  }, []);

  const selectedData = getSelectedBillingData();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        載入中...
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* 控制面板 */}
      <div style={{ 
        background: '#fff', 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 20, 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: '#333' }}>💰 月度帳單統計</h2>
          <button 
            onClick={() => navigate('/admin')}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            返回管理頁面
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>選擇商家：</label>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14
              }}
            >
              <option value="">請選擇商家</option>
              {companies.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>選擇月份：</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14
              }}
            >
              <option value="">請選擇月份</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedData && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={handlePrint}
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🖨️ 列印帳單
            </button>
            <button 
              onClick={generateImage}
              style={{
                padding: '10px 20px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
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
            borderRadius: 8,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            '@media print': {
              boxShadow: 'none',
              borderRadius: 0
            }
          }}
        >
          {/* 帳單標題 */}
          <div style={{ textAlign: 'center', marginBottom: 30, borderBottom: '2px solid #333', paddingBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 28, color: '#333' }}>月度出貨帳單</h1>
            <p style={{ margin: '10px 0 0 0', fontSize: 16, color: '#666' }}>Monthly Shipping Invoice</p>
          </div>

          {/* 帳單資訊 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginBottom: 30 }}>
            <div>
              <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>客戶資訊</h3>
              <p style={{ margin: '8px 0', fontSize: 16 }}><strong>公司名稱：</strong>{selectedCompany}</p>
              <p style={{ margin: '8px 0', fontSize: 16 }}><strong>帳單月份：</strong>{selectedMonth}</p>
            </div>
            <div>
              <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>帳單摘要</h3>
              <p style={{ margin: '8px 0', fontSize: 16 }}><strong>總數量：</strong>{selectedData.totalQuantity.toLocaleString()} 件</p>
              <p style={{ margin: '8px 0', fontSize: 16 }}><strong>總金額：</strong>{formatCurrency(selectedData.totalAmount)}</p>
              <p style={{ margin: '8px 0', fontSize: 16 }}><strong>開立日期：</strong>{formatDate(new Date())}</p>
            </div>
          </div>

          {/* 商品明細表格 */}
          <div style={{ marginBottom: 30 }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>商品明細</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: 12, border: '1px solid #ddd', textAlign: 'left' }}>出貨日期</th>
                  <th style={{ padding: 12, border: '1px solid #ddd', textAlign: 'left' }}>商品名稱</th>
                  <th style={{ padding: 12, border: '1px solid #ddd', textAlign: 'center' }}>數量</th>
                  <th style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>單價</th>
                  <th style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>小計</th>
                </tr>
              </thead>
              <tbody>
                {selectedData.items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 12, border: '1px solid #ddd' }}>{formatDate(item.time)}</td>
                    <td style={{ padding: 12, border: '1px solid #ddd' }}>{item.partName}</td>
                    <td style={{ padding: 12, border: '1px solid #ddd', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                    <td style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                  <td colSpan="2" style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>總計：</td>
                  <td style={{ padding: 12, border: '1px solid #ddd', textAlign: 'center' }}>{selectedData.totalQuantity}</td>
                  <td style={{ padding: 12, border: '1px solid #ddd' }}></td>
                  <td style={{ padding: 12, border: '1px solid #ddd', textAlign: 'right' }}>{formatCurrency(selectedData.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 帳單備註 */}
          <div style={{ marginTop: 30, padding: 20, background: '#f8f9fa', borderRadius: 4 }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>備註事項：</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              1. 本帳單為系統自動生成，如有疑問請聯繫相關人員。<br/>
              2. 請於收到帳單後 30 天內完成付款。<br/>
              3. 如有任何問題，請及時與我們聯繫。
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#fff',
          padding: 40,
          borderRadius: 8,
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ fontSize: 18, color: '#666' }}>請選擇商家和月份以查看帳單</p>
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