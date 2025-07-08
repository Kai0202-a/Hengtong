import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { partsData } from "./partsData";
import { UserContext } from "../UserContext";

function Inventory(props) {
  const { parts, setParts, updatePart } = props;
  const [search, setSearch] = useState("");
  const [inQty, setInQty] = useState({});
  const [outQty, setOutQty] = useState({});
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem("user"));
    if (!localUser || localUser.role !== "admin") {
      navigate("/"); // 未登入或非管理員自動跳回首頁
      return;
    }
  }, [user, navigate]);

  // 添加雲端庫存同步檢查
  const syncWithCloud = async () => {
    try {
      const response = await fetch('https://hengtong.vercel.app/api/inventory');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          const updatedParts = parts.map(part => {
            const cloudPart = result.data.find(cp => cp.id === part.id);
            return cloudPart ? { ...part, stock: cloudPart.stock } : part;
          });
          setParts(updatedParts);
        }
      }
    } catch (error) {
      console.error('同步雲端庫存失敗:', error);
    }
  };

  // 同步出貨記錄到 API
  const syncShipmentToAPI = async (shipmentData) => {
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
  };

  // 處理搜尋輸入
  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  // 處理入庫數量變更
  const handleInQtyChange = (id, value) => {
    setInQty({ ...inQty, [id]: value });
  };

  // 處理出庫數量變更
  const handleOutQtyChange = (id, value) => {
    setOutQty({ ...outQty, [id]: value });
  };
  
  // 在操作完成後手動同步
  const handleStockIn = async (id) => {
    const qty = parseInt(inQty[id], 10);
    if (!qty || qty <= 0) return;
    
    const part = parts.find(p => p.id === id);
    const newStock = part.stock + qty;
    
    // 使用 updatePart 函數來確保同步
    await updatePart(id, newStock);
    
    // 操作完成後同步雲端數據
    await syncWithCloud();
    
    setInQty({ ...inQty, [id]: "" });
  };
  
  const handleStockOut = async (id) => {
    const qty = parseInt(outQty[id], 10);
    const part = parts.find(p => p.id === id);
    if (!qty || qty <= 0 || qty > part.stock) return;
    
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
    
    // 使用 updatePart 函數來確保同步
    await updatePart(id, newStock);
    
    // 同步出貨記錄到雲端
    await syncShipmentToAPI(shipmentData);
    
    // 操作完成後同步雲端數據
    await syncWithCloud();
    
    // 保留本地備份
    const orders = JSON.parse(localStorage.getItem("orders") || "[]");
    orders.push(shipmentData);
    localStorage.setItem("orders", JSON.stringify(orders));
    
    setOutQty({ ...outQty, [id]: "" });
  };

  const filteredParts = parts.filter(
    (part) =>
      part.name.toLowerCase().includes(search.toLowerCase()) ||
      (part.type && part.type.toLowerCase().includes(search.toLowerCase()))
  );

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
                />
                <button onClick={() => handleStockIn(part.id)}>入庫</button>
                <input
                  type="number"
                  min="1"
                  id={`stock-out-${part.id}`}
                  name={`stockOut-${part.id}`}
                  style={{ width: 60, margin: '0 8px' }}
                  value={outQty[part.id] || ""}
                  onChange={e => handleOutQtyChange(part.id, e.target.value)}
                  placeholder="出庫"
                />
                <button onClick={() => handleStockOut(part.id)}>出庫</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Inventory;