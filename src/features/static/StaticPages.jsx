import { C, cardStyle, FONT } from "../../theme";

const row = (label, value) => (
  <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
    <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{label}</span>
    <span style={{ fontSize: 12, fontWeight: 800, color: C.primary }}>{value}</span>
  </div>
);

import { useState, useEffect } from "react";
import { API_BASE, getAuthHeaders } from "../../api";

export function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("dark_kitchen");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("general");
  
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = currentUser.email === "ajel.henry@curefoods.in" || currentUser.role === "admin";

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, { headers: getAuthHeaders() });
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email, password, role })
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

  const handleToggleLock = async (id, currentLockedStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${id}/lock`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_locked: !currentLockedStatus })
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      else alert(data.error);
    } catch (err) {
      alert("Failed to toggle lock status");
    }
  };

  const handleResetPassword = async (id, email) => {
    if (!confirm(`Are you sure you want to reset the password for ${email}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${id}/reset-password`, { 
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() }
      });
      const data = await res.json();
      if (data.success) {
        alert(`Password for ${email} has been reset to: \n\n${data.newPassword}\n\nAn email has also been sent to them.`);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to reset password");
    }
  };

  const formatName = (email) => {
    const parts = email.split('@')[0].split('.');
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  };

  const formatUsername = (email) => email.split('@')[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: activeTab === "employees" ? 1100 : 620 }}>
      
      {isAdmin && (
        <div style={{ display: "flex", gap: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12, marginBottom: 8 }}>
          <button 
            onClick={() => setActiveTab("general")}
            style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: activeTab === "general" ? C.primary : C.muted, cursor: "pointer", borderBottom: activeTab === "general" ? `2px solid ${C.primary}` : "none", paddingBottom: 4 }}
          >
            General Settings
          </button>
          <button 
            onClick={() => setActiveTab("employees")}
            style={{ background: "none", border: "none", fontSize: 14, fontWeight: 800, color: activeTab === "employees" ? C.primary : C.muted, cursor: "pointer", borderBottom: activeTab === "employees" ? `2px solid ${C.primary}` : "none", paddingBottom: 4 }}
          >
            Employees
          </button>
        </div>
      )}

      {activeTab === "general" && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 8 }}>User Profile</div>
            {row("Name", currentUser.email ? formatName(currentUser.email) : "Curefoods Admin")}
            {row("Email", currentUser.email || "Unknown")}
            {row("Role", currentUser.role === "admin" ? "Administrator" : "Operations Manager")}
          </div>
          
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 8 }}>Connected Platforms</div>
            {["Swiggy", "Zomato", "Google"].map((p) => row(p, "Connected"))}
          </div>
        </>
      )}

      {activeTab === "employees" && isAdmin && (
        <div style={{ ...cardStyle, padding: "24px 32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Employees</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Manage team members &amp; access</div>
            </div>
          </div>
          
          <form onSubmit={handleAddUser} style={{ display: "flex", gap: 10, marginBottom: 24, padding: 16, backgroundColor: "#f9fafb", borderRadius: 12, border: `1px solid ${C.borderSoft}` }}>
            <input 
              type="email" 
              placeholder="Employee Email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: FONT }}
            />
            <input 
              type="password" 
              placeholder="Temporary password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: FONT }}
            />
            <select 
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", fontFamily: FONT, backgroundColor: "#fff" }}
            >
              <option value="dark_kitchen">Dark Kitchen</option>
              <option value="supervisor">Supervisor</option>
              <option value="control_tower">Control Tower</option>
              <option value="admin">Admin</option>
            </select>
            <button 
              type="submit" 
              disabled={loading}
              style={{ padding: "10px 20px", borderRadius: 8, backgroundColor: "#0284c7", color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer" }}
            >
              + Add Employee
            </button>
          </form>

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</div>}

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.borderSoft}` }}>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase" }}>#</th>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase" }}>User Name</th>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase" }}>Email</th>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase" }}>Roles</th>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase" }}>Password</th>
                <th style={{ padding: "12px 8px", fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", textAlign: "right" }}>Lock</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${C.borderSoft}`, transition: "background-color 0.2s" }} onMouseOver={e => e.currentTarget.style.backgroundColor = "#f9fafb"} onMouseOut={e => e.currentTarget.style.backgroundColor = "transparent"}>
                  <td style={{ padding: "16px 8px", fontSize: 12, color: C.muted, fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "16px 8px", fontSize: 13, color: C.text, fontWeight: 700 }}>{formatName(u.email)}</td>
                  <td style={{ padding: "16px 8px", fontSize: 13, color: C.muted }}>{u.email}</td>
                  <td style={{ padding: "16px 8px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0284c7", backgroundColor: "#e0f2fe", padding: "4px 8px", borderRadius: 4, textTransform: "capitalize" }}>
                      {u.role === 'admin' ? 'Business Admin' : u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: "16px 8px" }}>
                    <button 
                      onClick={() => handleResetPassword(u.id, u.email)}
                      style={{ padding: "6px 10px", borderRadius: 6, backgroundColor: "#f1f5f9", color: "#334155", border: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
                      Reset
                    </button>
                  </td>
                  <td style={{ padding: "16px 8px", textAlign: "right" }}>
                    <div 
                      onClick={() => u.email !== currentUser.email && handleToggleLock(u.id, u.is_locked)}
                      style={{ 
                        display: "inline-block", 
                        width: 36, height: 20, 
                        borderRadius: 20, 
                        backgroundColor: u.is_locked ? "#ef4444" : "#e5e7eb",
                        position: "relative",
                        cursor: u.email === currentUser.email ? "not-allowed" : "pointer",
                        transition: "background-color 0.3s",
                        opacity: u.email === currentUser.email ? 0.5 : 1
                      }}
                    >
                      <div style={{
                        width: 16, height: 16, 
                        borderRadius: "50%", 
                        backgroundColor: "#fff",
                        position: "absolute", top: 2, 
                        left: u.is_locked ? 18 : 2,
                        transition: "left 0.3s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

