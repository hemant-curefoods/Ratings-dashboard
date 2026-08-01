import { useState } from "react";
import { C, FONT, cardStyle } from "../../theme";
import { API_BASE } from "../../api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("login"); // 'login' or 'forgot'
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.reload();
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An error occurred during login. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("If the email exists, a new password has been sent to it.");
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setError("An error occurred. Please check if the server is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: C.bg, fontFamily: FONT }}>
      <div style={{ ...cardStyle, padding: "40px 32px", width: "100%", maxWidth: 400, textAlign: "center" }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 20 }}>
            KP
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>KitchenPulse</div>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>
          {mode === "login" ? "Welcome Back" : "Reset Password"}
        </h2>
        
        {error && (
          <div style={{ backgroundColor: "#fee2e2", color: "#dc2626", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
            {successMsg}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@curefoods.in"
                required
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: "100%", padding: "12px", paddingRight: 40, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: C.muted,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                marginTop: 10,
                padding: "14px", 
                borderRadius: 10, 
                border: "none", 
                backgroundColor: loading ? C.muted : C.primary, 
                color: "#fff", 
                fontSize: 14, 
                fontWeight: 800, 
                fontFamily: FONT, 
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            
            <button 
              type="button" 
              onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); }}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline", marginTop: 4 }}
            >
              Forgot Password?
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ textAlign: "left" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase" }}>Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@curefoods.in"
                required
                style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                marginTop: 10,
                padding: "14px", 
                borderRadius: 10, 
                border: "none", 
                backgroundColor: loading ? C.muted : C.primary, 
                color: "#fff", 
                fontSize: 14, 
                fontWeight: 800, 
                fontFamily: FONT, 
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s"
              }}
            >
              {loading ? "Sending..." : "Send New Password"}
            </button>
            <button 
              type="button" 
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
              style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", textDecoration: "underline", marginTop: 4 }}
            >
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
