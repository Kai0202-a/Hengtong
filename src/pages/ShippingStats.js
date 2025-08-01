import React, { useContext, useEffect, useState } from 'react';
import { partsData } from "./partsData";
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

function getToday() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ShippingStats(props) {
  const { parts, setParts } = props;
  const navigate = useNavigate();
  const { user } = useContext(UserContext); // 只保留這一行
  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser || (localUser.role !== 'dealer' && localUser.role !== 'admin')) {
      navigate('/');
    }
  }, [user, navigate]);
  const today = getToday();
  const [quantities, setQuantities] = useState(Array(parts.length).fill(""));
  // 刪除這一行：const { user } = useContext(UserContext);
  const handleQuantityChange = (idx, value) => {
    const newQuantities = [...quantities];
    newQuantities[idx] = value;
    setQuantities(newQuantities);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newParts = parts.map((part, idx) => {
      const qty = parseInt(quantities[idx], 10) || 0;
      return {
        ...part,
        stock: part.stock - qty
      };
    });
    setParts(newParts);
    try {
      for (let idx = 0; idx < parts.length; idx++) {
        const part = parts[idx];
        const qty = parseInt(quantities[idx], 10) || 0;
        if (qty > 0) {
          const res = await fetch('https://hengtong-jtzomz8qi-kais-projects-975b317e.vercel.app/api/shipments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              company: user?.company || user?.username || '',
              partId: part.id,
              partName: part.name,
              quantity: qty,
              price: part.price,
              amount: qty * part.price,
              time: today
            })
          });
          if (!res.ok) throw new Error('API 錯誤');
        }
      }
      alert('發送完成！');
    } catch (err) {
      alert('發送失敗，請稍後再試！');
    }
  }

  return (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <img src="images/logo2.png" alt="Logo" style={{ height: 150 }} />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 'bold', fontSize: 28 }}>
          出貨日期：{today}
        </div>
        <form onSubmit={handleSubmit}>
          <table style={{ width: '100%', textAlign: 'center', verticalAlign: 'middle', tableLayout: 'fixed' }} className="center-table">
            <thead>
              <tr>
                <th>圖片</th>
                <th>品號</th>
                <th>售價</th>
                <th>出貨數量</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((item, idx) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    {item.image && <img src={item.image} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover' }} />}
                  </td>
                  <td>{item.name}</td>
                  <td>{item.price}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={quantities[idx]}
                      onChange={e => handleQuantityChange(idx, e.target.value)}
                      style={{ width: 60 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="submit" style={{ fontSize: 24, padding: '12px 32px' }}>送出</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShippingStats;