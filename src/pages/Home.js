import React, { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dealersData } from "./dealersData";
import { useContext } from "react";
import { UserContext } from "../UserContext";

function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [registerInfo, setRegisterInfo] = useState({ username: "", password: "", name: "", email: "", phone: "" });
  const [registerMsg, setRegisterMsg] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      // 這裡不需要 navigate("/login")，直接留空或移除即可
      // 或者根本不需要這段 useEffect，因為 Home 就是登入頁
    }
  }, [navigate]);
  const { setUser } = useContext(UserContext);

  const handleLogin = () => {
    if (username === "admin" && password === "admin123") {
      const userObj = { username: "admin", role: "admin" };
      localStorage.setItem("user", JSON.stringify(userObj));
      setUser(userObj);
      setLoginMsg("管理者登入成功！");
      setTimeout(() => navigate("/admin"), 800);
    } else {
      // 先查 dealersData
      let dealer = dealersData.find(d => d.username === username && d.password === password);
      // 再查 localStorage 的 dealers
      if (!dealer) {
        const localDealers = JSON.parse(localStorage.getItem("dealers") || "[]");
        dealer = localDealers.find(d => d.username === username && d.password === password);
      }
      if (dealer) {
        const userObj = { username: dealer.username, role: "dealer", company: dealer.name };
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
        setLoginMsg("登入成功！");
        setTimeout(() => navigate("/shipping"), 800);
      } else {
        setLoginMsg("帳號或密碼錯誤");
      }
    }
  };

  const handleRegisterChange = (e) => {
    setRegisterInfo({ ...registerInfo, [e.target.name]: e.target.value });
  };

  const handleRegister = (e) => {
    e.preventDefault();
    // 檢查帳號是否重複
    if (dealersData.some(d => d.username === registerInfo.username)) {
      setRegisterMsg("帳號已存在，請更換帳號");
      return;
    }
    // 新增到 dealersData（僅前端模擬，實際應呼叫後端）
    dealersData.push({
      id: dealersData.length + 1,
      ...registerInfo,
      status: "active"
    });
    setRegisterMsg("申請成功，請直接登入");
    setRegisterInfo({ username: "", password: "", name: "", email: "", phone: "" });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
      <img src="images/logo2.png" alt="logo" style={{ width: 200, height: 200, marginBottom: 16 }} />
      {/* 其餘原本內容放這裡 */}
      <div>
        <div style={{ background: "#222", color: "#fff", padding: 24, borderRadius: 8, width: 320 }}>
          <h3>登入</h3>
          <div>
            <input
              type="text"
              placeholder="帳號"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
            />
          </div>
          <button onClick={handleLogin} style={{ width: "100%" }}>登入</button>
          <div style={{ marginTop: 8 }}>{loginMsg}</div>
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={() => navigate('/register')}>申請帳號</button>
          </div>
          {/* 申請表單已移除，僅保留按鈕 */}
          <div style={{ color: 'red', marginTop: 8 }}>{registerMsg}</div>
        </div>
      </div>
    </div>
  );
}
export default Home;