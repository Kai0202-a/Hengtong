import React, { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../UserContext";

function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      // 這裡不需要 navigate("/login")，直接留空或移除即可
      // 或者根本不需要這段 useEffect，因為 Home 就是登入頁
    }
  }, [navigate]);

  const handleLogin = async () => {
    if (username === "admin" && password === "admin123") {
      const userObj = { username: "admin", role: "admin" };
      localStorage.setItem("user", JSON.stringify(userObj));
      setUser(userObj);
      setLoginMsg("管理者登入成功！");
      setTimeout(() => navigate("/admin"), 800);
      return;
    }

    setIsLoggingIn(true);
    setLoginMsg("");

    try {
      // 從雲端 API 獲取經銷商數據進行驗證
      const response = await fetch('https://hengtong.vercel.app/api/dealers');
      const result = await response.json();
      
      if (result.success) {
        const dealer = result.data.find(d => 
          d.username === username && 
          d.password === password
        );
        
        if (dealer) {
          // 檢查帳號狀態
          if (dealer.status === 'pending') {
            const userObj = { 
              username: dealer.username, 
              role: "dealer", 
              status: "pending",
              company: dealer.company || dealer.name 
            };
            localStorage.setItem("user", JSON.stringify(userObj));
            setUser(userObj);
            setLoginMsg("登入成功！帳號審核中，請等待管理員審核...");
            setTimeout(() => navigate("/pending"), 800);
          } else if (dealer.status === 'active') {
            const userObj = { 
              username: dealer.username, 
              role: "dealer", 
              status: "active",
              company: dealer.company || dealer.name 
            };
            localStorage.setItem("user", JSON.stringify(userObj));
            setUser(userObj);
            setLoginMsg("登入成功！");
            setTimeout(() => navigate("/shipping"), 800);
          } else if (dealer.status === 'suspended') {
            setLoginMsg("帳號已被停用，請聯繫管理員");
          } else {
            setLoginMsg("帳號狀態異常，請聯繫管理員");
          }
        } else {
          setLoginMsg("帳號或密碼錯誤");
        }
      } else {
        setLoginMsg("登入驗證失敗，請稍後再試");
      }
    } catch (error) {
      console.error('登入錯誤:', error);
      setLoginMsg("網路錯誤，請稍後再試");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
      <img src="images/logo2.png" alt="logo" style={{ width: 200, height: 200, marginBottom: 16 }} />
      <div>
        <div style={{ background: "#222", color: "#fff", padding: 24, borderRadius: 8, width: 320 }}>
          <h3>登入</h3>
          <div>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="帳號"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
              disabled={isLoggingIn}
            />
          </div>
          <div>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
              disabled={isLoggingIn}
            />
          </div>
          <button 
            onClick={handleLogin} 
            disabled={isLoggingIn}
            style={{ width: "100%", opacity: isLoggingIn ? 0.6 : 1 }}
          >
            {isLoggingIn ? "登入中..." : "登入"}
          </button>
          <div style={{ marginTop: 8, color: loginMsg.includes("成功") ? "green" : "red" }}>{loginMsg}</div>
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={() => navigate('/register')}>申請帳號</button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default Home;