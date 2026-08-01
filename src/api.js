export const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  if (!token) {
    // If we somehow have no token but are trying to fetch, force logout
    localStorage.removeItem('user');
    window.location.href = '/';
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

export function handleApiError(res) {
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
    return true; // Indicates error was handled
  }
  return false;
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
