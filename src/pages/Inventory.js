import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { partsData } from "./partsData";
import { UserContext } from "../UserContext";

// 防抖 Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}

function Inventory(props) {
  const { parts, setParts, updatePart } = props;
  const [search, setSearch] = useState("");
  const [inQty, setInQty] = useState({});
  const [outQty, setOutQty] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  
  // 使用防抖搜尋
  const debouncedSearch = useDebounce(search, 300);
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem("user"));
    if (!localUser || localUser.role !== "admin") {
      navigate("/");
      return;
    }
  }, [user, navigate]);

  // 使用 useMemo 優化搜尋過濾
  const filteredParts = useMemo(() => {
    if (!debouncedSearch) return parts;
    const searchLower = debouncedSearch.toLowerCase();
    return parts.filter(
      (part) =>
        part.name.toLowerCase().includes(searchLower) ||
        (part.type && part.type.toLowerCase().includes(searchLower))
    );
  }, [parts, debouncedSearch]);

  // 同步出貨記錄到 API (異步)
  const syncShipmentToAPI = useCallback(async (shipmentData) => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shipmentData)
      });
      
      if (!response.ok) {
        console.error('同步出貨記錄失敗:', response.statusText);
      }
    } catch (error) {
      console.error('同步出貨記錄到 API 失敗:', error);
    }
  }, []);

  // 處理搜尋輸入
  const handleSearch = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  // 處理入庫數量變更
  const handleInQtyChange = useCallback((id, value) => {
    setInQty(prev => ({ ...prev, [id]: value }));
  }, []);

  // 處理出庫數量變更
  const handleOutQtyChange = useCallback((id, value) => {
    setOutQty(prev => ({ ...prev, [id]: value }));
  }, []);
  
  // 入庫操作 - 優化版本
  const handleStockIn = useCallback(async (id) => {
    const qty = parseInt(inQty[id], 10);
    if (!qty || qty <= 0 || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const part = parts.find(p => p.id === id);
      const newStock = part.stock + qty;
      
      // 先更新 UI (樂觀更新)
      const updatedParts = parts.map(p => 
        p.id === id ? { ...p, stock: newStock } : p
      );
      setParts(updatedParts);
      setInQty(prev => ({ ...prev, [id]: "" }));
      
      // 異步更新到 MongoDB
      await updatePart(id, newStock);
    } catch (error) {
      console.error('入庫操作失敗:', error);
      // 如果失敗，回滾 UI 狀態
      const part = parts.find(p => p.id === id);
      const updatedParts = parts.map(p => 
        p.id === id ? { ...p, stock: part.stock } : p
      );
      setParts(updatedParts);
    } finally {
      setIsLoading(false);
    }
  }, [inQty, isLoading, parts, setParts, updatePart]);
  
  // 出庫操作 - 優化版本
  const handleStockOut = useCallback(async (id) => {
    const qty = parseInt(outQty[id], 10);
    const part = parts.find(p => p.id === id);
    if (!qty || qty <= 0 || qty > part.stock || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const newStock = part.stock - qty;
      const user = JSON.parse(localStorage.getItem("user"));
      
      const shipmentData = {
        partId: id,
        partName: part.name,
        quantity: qty,
        price: part.price,
        amount: qty * part.price,
        dealer: user?.username || "未知",
        company: user?.company || "",
        time: new Date().toLocaleString('zh-TW'),
        createdAt: new Date().toISOString()
      };
      
      // 先更新 UI (樂觀更新)
      const updatedParts = parts.map(p => 
        p.id === id ? { ...p, stock: newStock } : p
      );
      setParts(updatedParts);
      setOutQty(prev => ({ ...prev, [id]: "" }));
      
      // 保留本地備份
      const orders = JSON.parse(localStorage.getItem("orders") || "[]");
      orders.push(shipmentData);
      localStorage.setItem("orders", JSON.stringify(orders));
      
      // 異步更新到 MongoDB
      await Promise.all([
        updatePart(id, newStock),
        syncShipmentToAPI(shipmentData)
      ]);
    } catch (error) {
      console.error('出庫操作失敗:', error);
      // 如果失敗，回滾 UI 狀態
      const updatedParts = parts.map(p => 
        p.id === id ? { ...p, stock: part.stock } : p
      );
      setParts(updatedParts);
    } finally {
      setIsLoading(false);
    }
  }, [outQty, isLoading, parts, setParts, updatePart, syncShipmentToAPI]);

  return (
  <div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
      <img src="/images/logo2.png" alt="logo" style={{ width: 200, height: 200, margin: '24px 0 8px 0' }} />
      <div style={{ textAlign: 'center', fontSize: '1.6rem', fontWeight: 'lighter', margin: '0 0 24px 0' }}>庫存管理</div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <input
        type="text"
        placeholder="搜尋零件名稱或類型"
        value={search}
        onChange={handleSearch}
        style={{ marginBottom: 16, padding: 8, width: 300 }}
      />
    </div>
    {isLoading && (
      <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>
        處理中...
      </div>
    )}
    <table border="1" cellPadding="8" style={{ width: "100%", marginTop: 16 }}>
      <thead>
        <tr>
          <th>名稱</th>
          <th>庫存數量</th>
          <th>進價</th>
          <th>售價</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {filteredParts.map((part) => (
          <tr key={part.id}>
            <td>
              {part.image && <img src={part.image} alt={part.name} style={{ width: '50px', height: '50px', marginRight: 8, verticalAlign: 'middle' }} />}
              {part.name}
            </td>
            <td>{part.stock}</td>
            <td>{part.cost}</td>
            <td>{part.price}</td>
            <td>
              <input
                type="number"
                min="1"
                id={`stock-in-${part.id}`}
                name={`stockIn-${part.id}`}
                style={{ width: 60, marginRight: 8 }}
                value={inQty[part.id] || ""}
                onChange={e => handleInQtyChange(part.id, e.target.value)}
                placeholder="入庫"
                disabled={isLoading}
              />
              <button 
                onClick={() => handleStockIn(part.id)}
                disabled={isLoading}
              >
                入庫
              </button>
              <input
                type="number"
                min="1"
                id={`stock-out-${part.id}`}
                name={`stockOut-${part.id}`}
                style={{ width: 60, margin: '0 8px' }}
                value={outQty[part.id] || ""}
                onChange={e => handleOutQtyChange(part.id, e.target.value)}
                placeholder="出庫"
                disabled={isLoading}
              />
              <button 
                onClick={() => handleStockOut(part.id)}
                disabled={isLoading}
              >
                出庫
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
}

export default Inventory;