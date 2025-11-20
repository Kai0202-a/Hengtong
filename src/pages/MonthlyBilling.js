import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const MonthlyBilling = () => {
  const navigate = useNavigate();
  const printRef = useRef();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [billingData, setBillingData] = useState({});
  const [companies, setCompanies] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';

  // 處理出貨資料，按公司和月份分組（修正：明確接收 data 參數並在作用域內）
  const processShipmentData = useCallback((data) => {
    const grouped = {};
    const companiesSet = new Set();

    data.forEach((shipment) => {
      const rawTime = shipment.time || shipment.createdAt;
      const date = new Date(rawTime);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const company = shipment.company || '未知公司';

      companiesSet.add(company);

      if (!grouped[company]) grouped[company] = {};
      if (!grouped[company][monthKey]) {
        grouped[company][monthKey] = {
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          totalCost: 0
        };
      }

      grouped[company][monthKey].items.push({ ...shipment, time: rawTime });
      grouped[company][monthKey].totalQuantity += shipment.quantity || 0;
      grouped[company][monthKey].totalAmount += shipment.amount || 0;
      grouped[company][monthKey].totalCost += shipment.cost || 0;
    });

    setBillingData(grouped);
    setCompanies(Array.from(companiesSet).sort());
  }, []);

  // 獲取所有出貨資料（修正：依賴 processShipmentData，並對 result.data 做防呆）
  const fetchShipmentData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/shipments`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          processShipmentData(result.data);
          try {
            localStorage.setItem('mb_cache_shipments', JSON.stringify({ data: result.data, ts: Date.now() }));
          } catch {}
        } else {
          setBillingData({});
          setCompanies([]);
          setAvailableMonths([]);
        }
      }
    } catch (error) {
      console.error('獲取出貨資料失敗:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [API_BASE_URL, processShipmentData]);

  // 已移除未使用的輔助函式以修正 ESLint no-unused-vars

  // 列印功能（供按鈕使用）
  const handlePrint = () => {
    window.print();
  };

  // 用於顯示金額與日期（渲染中會使用）
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  // 獲取選定的帳單資料（固定按日期排序）
  const selectedData = useMemo(() => {
    if (!selectedCompany || !selectedMonth || !billingData[selectedCompany]) return null;
    const data = { ...billingData[selectedCompany][selectedMonth] };
    data.items = [...data.items].sort((a, b) => new Date(b.time) - new Date(a.time));
    return data;
  }, [selectedCompany, selectedMonth, billingData]);

  useEffect(() => {
    try {
      const cacheRaw = localStorage.getItem('mb_cache_shipments');
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        if (cache && Array.isArray(cache.data)) {
          processShipmentData(cache.data);
          setLoading(false);
        }
      }
    } catch {}
    const savedMonth = localStorage.getItem('mb_selectedMonth');
    if (savedMonth) setSelectedMonth(savedMonth);
    fetchShipmentData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 資料載入完成後，預設選第一個公司與最新月份（若尚未選）
  useEffect(() => {
    if (!selectedCompany && companies.length > 0) {
      const savedCompany = localStorage.getItem('mb_selectedCompany');
      const nextCompany = savedCompany && companies.includes(savedCompany) ? savedCompany : companies[0];
      setSelectedCompany(nextCompany);
    }
    if (!selectedMonth && availableMonths.length > 0) {
      const savedMonth = localStorage.getItem('mb_selectedMonth');
      const nextMonth = savedMonth && availableMonths.includes(savedMonth) ? savedMonth : availableMonths[0];
      setSelectedMonth(nextMonth);
    }
  }, [companies, availableMonths, selectedCompany, selectedMonth]);

  useEffect(() => {
    const monthsSet = new Set();
    if (selectedCompany && billingData[selectedCompany]) {
      Object.keys(billingData[selectedCompany]).forEach((m) => monthsSet.add(m));
    } else {
      Object.values(billingData).forEach((companyObj) => {
        Object.keys(companyObj).forEach((m) => monthsSet.add(m));
      });
    }
    const newMonths = Array.from(monthsSet).sort().reverse();
    setAvailableMonths(newMonths);
    if (newMonths.length > 0 && (!selectedMonth || !newMonths.includes(selectedMonth))) {
      setSelectedMonth(newMonths[0]);
    }
  }, [selectedCompany, billingData]);

  // 變更選項時保存
  useEffect(() => {
    if (selectedCompany) localStorage.setItem('mb_selectedCompany', selectedCompany);
  }, [selectedCompany]);
  useEffect(() => {
    if (selectedMonth) localStorage.setItem('mb_selectedMonth', selectedMonth);
  }, [selectedMonth]);
  


  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#23272f',
        color: '#f5f6fa',
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
      background: '#23272f', 
      minHeight: '100vh' 
    }}>
      {/* 控制面板 */}
      <div style={{ 
        background: '#2c3e50', 
        padding: 24, 
        borderRadius: 12, 
        marginBottom: 24, 
        boxShadow: '0 2px 12px #0002',
        color: '#f5f6fa'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#f5f6fa', fontSize: 28, fontWeight: '600' }}>💰 月度帳單統計</h2>
          <button 
            onClick={() => navigate('/admin')}
            style={{
              padding: '12px 24px',
              background: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: 14
            }}
          >
            ← 返回管理頁面
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#f5f6fa' }}>選擇商家：</label>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                background: '#34495e',
                color: '#f5f6fa',
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
            <label style={{ display: 'block', marginBottom: 8, fontWeight: '500', color: '#f5f6fa' }}>選擇月份：</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                background: '#34495e',
                color: '#f5f6fa',
                outline: 'none'
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
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button 
              onClick={handlePrint}
              style={{ 
                background: '#4CAF50', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 6, 
                padding: '10px 16px', 
                cursor: 'pointer' 
              }}
            >
              🖨️ 列印
            </button>
            {/* 其餘按鈕/內容保持 */}
          </div>
        )}
        {/* 帳單內容 */}
        {selectedData ? (
          <div ref={printRef} className="print-content">
            <div style={{ background: '#ffffff', color: '#333', padding: 24, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{selectedCompany || '未選擇商家'}</h3>
                <div style={{ color: '#666' }}>{selectedMonth || '未選擇月份'}</div>
              </div>

              {selectedData.items && selectedData.items.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
                    <div>總出貨數量：{selectedData.totalQuantity || 0}</div>
                    <div>總金額：{formatCurrency(selectedData.totalAmount || 0)}</div>
                    <div>總成本：{formatCurrency(selectedData.totalCost || 0)}</div>
                    <div>總利潤：{formatCurrency((selectedData.totalAmount || 0) - (selectedData.totalCost || 0))}</div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>日期</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>品項</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>數量</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>金額</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid #e0e0e0' }}>成本</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedData.items.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{formatDate(item.time)}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>{item.partName || item.productName || item.name || item.part || '—'}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.quantity || 0}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(item.amount || 0)}</td>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatCurrency(item.cost || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#666' }}>本月無出貨資料</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#2c3e50',
            padding: 60,
            borderRadius: 12,
            textAlign: 'center',
            boxShadow: '0 2px 12px #0002',
            color: '#f5f6fa'
          }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📊</div>
            <p style={{ fontSize: 20, color: '#f5f6fa', fontWeight: '500', margin: 0 }}>請選擇商家和月份以查看帳單</p>
          </div>
        )}
        {/* 列印樣式 */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-content, .print-content * {
              visibility: visible;
            }
            .print-content {
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
      {/* 補上：外層容器結尾 */}
    </div>
  );
};

export default MonthlyBilling;