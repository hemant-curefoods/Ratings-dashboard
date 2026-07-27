const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

function handleAuthError(res) {
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
}

export async function toggleStore(location_id, action, brand, store_name) {
  const res = await fetch(`${API_BASE}/api/toggle`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ location_id, action, brand, store_name })
  });
  
  handleAuthError(res);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Toggle failed");
  }
  return data;
}

export const bulkToggleStores = async (stores, action, filterContext = "") => {
  const res = await fetch(`${API_BASE}/api/toggle/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stores, action, filterContext })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Bulk toggle failed');
  }
  return res.json();
};
