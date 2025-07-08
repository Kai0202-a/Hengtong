import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";
// 刪除這行：
// import { partsData } from './partsData';

// 將 parts 宣告移到 Admin 函數內部，並在每次渲染時取得最新資料：
function Admin() {
  const navigate = useNavigate();
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/"); // 非管理員自動跳回首頁
    }
  }, [navigate]);
  const { setUser } = useContext(UserContext);
  const [orders, setOrders] = useState([]);
  const [parts, setParts] = useState([]);
  useEffect(() => {
    const interval = setInterval(() => {
      const data = JSON.parse(localStorage.getItem("records") || "[]");
      setOrders(data.reverse());
      setParts(JSON.parse(localStorage.getItem('parts') || '[]'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100vh', background: '#181a20' }}>
      {/* 置中提醒區塊 */}
      <div style={{ width: '95vw', maxWidth: 500, background: '#23272f', padding: 20, borderRadius: 12, color: '#f5f6fa', margin: '32px auto 24px auto', boxShadow: '0 2px 12px #0002', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, color: '#f5f6fa' }}>貨況提醒</h3>
        <ul style={{ paddingLeft: 0, maxHeight: 400, overflowY: 'auto', margin: 0, listStyle: 'none' }}>
          {orders.length === 0 && <li style={{ color: '#aaa' }}>暫無出貨紀錄</li>}
          {orders.map((o, idx) => {
            const part = parts.find(p => p.name === o.partName);
            return (
              <li key={idx} style={{ marginBottom: 8, fontSize: 15, color: '#f5f6fa' }}>
                <b>{o.company}</b> 於 <span style={{ color: '#aaa' }}>{o.time}</span><br />
                商品：<b>{o.partName}</b>，數量：<b>{o.quantity}</b>
                {part && (
                  <span style={{ color: '#ffd700', marginLeft: 8 }}>｜庫存：{part.stock}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {/* 後台管理系統內容區塊 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2>後台管理系統</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 46, marginTop: 42 }}>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/inventory")}>庫存管理</button>
          <button style={{ padding: 16, fontSize: 18 }} onClick={() => navigate("/shipping")}>銷售紀錄</button>
          <button style={{ padding: 16, fontSize: 18 }}>通路商帳號管理</button>
          <button style={{ padding: 16, fontSize: 18 }}>資料備份/還原</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button onClick={() => {
            localStorage.removeItem("user");
            setUser(null);
            navigate("/");
          }} style={{ width: 120, background: '#c00', color: '#fff', border: 'none', borderRadius: 6, padding: 8 }}>
            登出
          </button>
        </div>
      </div>
    </div>
  );
}

export default Admin;
