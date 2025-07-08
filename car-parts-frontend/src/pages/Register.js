import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({ username: "", password: "", name: "", company: "", taxId: "", address: "", email: "", phone: "" });
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = await fetch("https://hengtong-515b4uhyv-kais-projects-975b317e.vercel.app/api/dealer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (response.ok) {
        setMsg("申請成功，請等待審核或直接登入");
        setTimeout(() => navigate("/"), 1200);
      } else {
        setMsg(data.message || "註冊失敗");
      }
    } catch (err) {
      setMsg("註冊失敗，請稍後再試");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 48 }}>
      <h2>申請通路商帳號</h2>
      <form onSubmit={handleSubmit} style={{ width: 320, background: "#222", color: "#fff", padding: 24, borderRadius: 8 }}>
        <input name="username" placeholder="帳號" value={form.username} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="password" type="password" placeholder="密碼" value={form.password} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="name" placeholder="姓名" value={form.name} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="company" placeholder="公司名稱" value={form.company} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="taxId" placeholder="公司統編" value={form.taxId} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="address" placeholder="公司地址" value={form.address} onChange={handleChange} required style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="phone" placeholder="電話" value={form.phone} onChange={handleChange} style={{ width: "100%", marginBottom: 8 }} /><br/>
        <button type="submit" style={{ width: "100%" }}>送出申請</button>
      </form>
      <div style={{ color: "red", marginTop: 8 }}>{msg}</div>
    </div>
  );
}
export default Register;