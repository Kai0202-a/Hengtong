import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { partsData } from "../../car-parts-frontend/src/pages/partsData";
import { UserContext } from "../../car-parts-frontend/src/UserContext";

function Inventory(props) {
  const { parts, setParts } = props;
  const [search, setSearch] = useState("");
  const [inQty, setInQty] = useState({});
  const [outQty, setOutQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem("user"));
    if (!localUser || localUser.role !== "admin") {
      navigate("/"); // 未登入或非管理員自動跳回首頁
    }
  }, [user, navigate]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const handleInQtyChange = (id, value) => {
    setInQty({ ...inQty, [id]: value });
  };
  const handleOutQtyChange = (id, value) => {
    setOutQty({ ...outQty, [id]: value });
  };

  const handleBatchSubmit = async () => {
    setSubmitting(true);
    const updates = parts.map(part => {
      const inNum = parseInt(inQty[part.id], 10) || 0;
      const outNum = parseInt(outQty[part.id], 10) || 0;
      if (inNum === 0 && outNum === 0) return null;
      return {
        id: part.id,
        stock: part.stock + inNum - outNum
      };
    }).filter(Boolean);
    if (updates.length === 0) {
      setSubmitting(false);
      return;
    }
    try {
      await axios.put("/api/inventory", { updates });
      const newParts = parts.map(part => {
        const update = updates.find(u => u.id === part.id);
        return update ? { ...part, stock: update.stock } : part;
      });
      setParts(newParts);
      setInQty({});
      setOutQty({});
    } catch (e) {
      alert("送出失敗，請稍後再試");
    }
    setSubmitting(false);
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
                  min="0"
                  style={{ width: 60, marginRight: 8 }}
                  value={inQty[part.id] || ""}
                  onChange={e => handleInQtyChange(part.id, e.target.value)}
                  placeholder="入庫"
                />
                <input
                  type="number"
                  min="0"
                  style={{ width: 60, marginLeft: 8 }}
                  value={outQty[part.id] || ""}
                  onChange={e => handleOutQtyChange(part.id, e.target.value)}
                  placeholder="出庫"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0' }}>
        <button
          onClick={handleBatchSubmit}
          disabled={submitting}
          style={{ fontSize: '1.2rem', padding: '12px 48px', borderRadius: 8 }}
        >
          {submitting ? '送出中...' : '送出'}
        </button>
      </div>
    </div>
  );
}

export default Inventory;