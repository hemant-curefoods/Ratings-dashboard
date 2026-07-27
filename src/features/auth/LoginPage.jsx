import { useState } from "react";
import { C, FONT, cardStyle } from "../../theme";
import { API_BASE } from "../../api";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        onLogin(data.user);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An error occurred during login. Please check if the server is running.");
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

        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>Welcome Back</h2>
        
        {error && (
          <div style={{ backgroundColor: "#fee2e2", color: "#dc2626", padding: "10px", borderRadius: 8, fontSize: 13, marginBottom: 20, fontWeight: 600 }}>
            {error}
          </div>
        )}

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
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
