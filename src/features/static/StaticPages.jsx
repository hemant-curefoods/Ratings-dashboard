import { C, cardStyle, FONT } from "../../theme";

const row = (label, value) => (
  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 800, color: C.primary }}>{value}</span>
  </div>
);

import { useState, useEffect } from "react";
import { API_BASE } from "../../api";

export function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser.email === "ajel.henry@curefoods.in" || currentUser.role === "admin";

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`);
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (err) {}
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdmin]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        setEmail("");
        setPassword("");
        fetchUsers();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Failed to add user.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm("Remove access for this user?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchUsers();
      else alert(data.error);
    } catch (err) {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 620 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 8 }}>User Profile</div>
        {row("Name", currentUser.email ? currentUser.email.split('@')[0] : "Curefoods Admin")}
        {row("Email", currentUser.email || "Unknown")}
        {row("Role", currentUser.role === "admin" ? "Administrator" : "Operations Manager")}
      </div>
      
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 8 }}>Connected Platforms</div>
        {["Swiggy", "Zomato", "Google"].map((p) => row(p, "Connected"))}
      </div>

      {isAdmin && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 12 }}>User Management (Admin Only)</div>
          
          <form onSubmit={handleAddUser} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: FONT }}
            />
            <input 
              type="password" 
              placeholder="Temporary password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: FONT }}
            />
            <button 
              type="submit" 
              disabled={loading}
              style={{ padding: "8px 16px", borderRadius: 8, backgroundColor: C.primary, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: loading ? "not-allowed" : "pointer" }}
            >
              Add User
            </button>
          </form>

          {error && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>{error}</div>}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", backgroundColor: "#f9fafb", borderRadius: 8, border: `1px solid ${C.borderSoft}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "capitalize" }}>{u.role}</div>
                </div>
                {u.email !== currentUser.email && (
                  <button 
                    onClick={() => handleDeleteUser(u.id)}
                    style={{ padding: "6px 12px", borderRadius: 6, backgroundColor: "#fee2e2", color: "#dc2626", border: "none", fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ThemePage() {
  return (
    <div style={{ ...cardStyle, maxWidth: 620 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>System Theme</div>
      <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, marginTop: 10 }}>
        The Partner Dashboard theme is locked to <strong style={{ color: C.primary }}>Royal Blue &amp; White</strong> to keep
        reporting screenshots, exported Excel workbooks and PDF briefs visually identical across every Curefoods team.
        There is no light/dark switch — the palette is fixed at {C.primary} on pure white.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1, height: 54, borderRadius: 10, backgroundColor: C.primary }} />
        <div style={{ flex: 1, height: 54, borderRadius: 10, backgroundColor: "#ffffff", border: `1px solid ${C.border}` }} />
      </div>
    </div>
  );
}

