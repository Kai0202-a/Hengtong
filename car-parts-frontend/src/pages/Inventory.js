import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
// import partsData from "./partsData"; // 只有需要時才加

function Inventory(props) {
  const { parts, setParts, updatePart } = props;
  const [search, setSearch] = useState("");
  const [inQty, setInQty] = useState({});
  const [outQty, setOutQty] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem("user"));
    if (!localUser || localUser.role !== "admin") {
      navigate("/");
      return;
    }
  }, [user, navigate]);

  const filteredParts = useMemo(() => {
    if (!search) return parts;
    const searchLower = search.toLowerCase();
    return parts.filter(
      (part) =>
        part.name.toLowerCase().includes(searchLower) ||
        (part.type && part.type.toLowerCase().includes(searchLower))
    );
  }, [parts, search]);

  const handleSearch = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleInQtyChange = useCallback((id, value) => {
    setInQty((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleOutQtyChange = useCallback((id, value) => {
    setOutQty((prev) => ({ ...prev, [id]: value }));
  }, []);

  // 批次送出
  const handleBatchSubmit = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const updates = [];
      filteredParts.forEach((part) => {
        const inValue = parseInt(inQty[part.id], 10) || 0;
        const outValue = parseInt(outQty[part.id], 10) || 0;
        if (inValue > 0 || outValue > 0) {
          let newStock = part.stock + inValue - outValue;
          if (newStock < 0) newStock = 0;
          updates.push({ id: part.id, newStock });
        }
      });
      // 樂觀更新 UI
      const updatedParts = parts.map((part) => {
        const update = updates.find((u) => u.id === part.id);
        return update ? { ...part, stock: update.newStock } : part;
      });
      setParts(updatedParts);
      setInQty({});
      setOutQty({});
      // 批次送出到後端
      await Promise.all(updates.map((u) => updatePart(u.id, u.newStock)));
    } catch (error) {
      alert("批次送出失敗，請重試");
    } finally {
      setIsLoading(false);
    }
  };

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
            <th>入庫</th>
            <th>出庫</th>
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
                  value={inQty[part.id] || ""}
                  onChange={e => handleInQtyChange(part.id, e.target.value)}
                  style={{ width: 60 }}
                  disabled={isLoading}
                  placeholder="入庫"
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  value={outQty[part.id] || ""}
                  onChange={e => handleOutQtyChange(part.id, e.target.value)}
                  style={{ width: 60 }}
                  disabled={isLoading}
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
          disabled={isLoading}
          style={{ fontSize: '1.2rem', padding: '12px 48px', borderRadius: 8, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          送出
        </button>
      </div>
    </div>
  );
}

export default Inventory;