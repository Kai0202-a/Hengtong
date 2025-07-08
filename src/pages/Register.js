import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const [form, setForm] = useState({ username: "", password: "", name: "", company: "", taxId: "", address: "", email: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg("");
    
    try {
      const response = await fetch('https://hengtong.vercel.app/api/dealers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMsg("申請成功，請等待審核或直接登入");
        setTimeout(() => navigate("/"), 1200);
      } else {
        setMsg(result.error || "申請失敗，請稍後再試");
      }
    } catch (error) {
      console.error('申請失敗:', error);
      setMsg("網路錯誤，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 48 }}>
      <h2>申請帳號</h2>
      <form onSubmit={handleSubmit} style={{ width: 320, background: "#222", color: "#fff", padding: 24, borderRadius: 8 }}>
        <input name="username" placeholder="帳號" value={form.username} onChange={handleChange} required autocomplete="username" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="password" type="password" placeholder="密碼" value={form.password} onChange={handleChange} required autocomplete="new-password" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="name" placeholder="姓名" value={form.name} onChange={handleChange} required autocomplete="name" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="company" placeholder="公司名稱" value={form.company} onChange={handleChange} required autocomplete="organization" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="taxId" placeholder="公司統編" value={form.taxId} onChange={handleChange} required autocomplete="off" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="address" placeholder="公司地址" value={form.address} onChange={handleChange} required autocomplete="street-address" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} autocomplete="email" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <input name="phone" placeholder="電話" value={form.phone} onChange={handleChange} autocomplete="tel" style={{ width: "100%", marginBottom: 8 }} /><br/>
        <button type="submit" disabled={isSubmitting} style={{ width: "100%", opacity: isSubmitting ? 0.6 : 1 }}>
          {isSubmitting ? "提交中..." : "送出申請"}
        </button>
      </form>
      <div style={{ color: msg.includes("成功") ? "green" : "red", marginTop: 8 }}>{msg}</div>
    </div>
  );
}
export default Register;