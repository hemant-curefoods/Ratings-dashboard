import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Override fetch to inject Auth token globally
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.includes('/api/')) {
    config = config || {};
    config.headers = {
      ...config.headers,
    };
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await originalFetch(resource, config);
  
  // If unauthorized, log out immediately
  if (response.status === 401 && resource.includes('/api/')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
  
  return response;
};

const hostname = window.location.hostname;
if (hostname !== 'cfi-website-five.vercel.app' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
  document.body.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; flex-direction:column; background:#f4f4f5; text-align:center; padding:20px;">
      <h1 style="color:#e11d48; margin-bottom:10px;">Access Blocked</h1>
      <p style="color:#52525b; font-size:18px; max-width:500px;">This deployment link is disabled for security reasons.</p>
      <p style="color:#52525b; font-size:16px; margin-top:10px;">Please use the official verified dashboard link:</p>
      <a href="https://cfi-website-five.vercel.app" style="background:#2563eb; color:white; padding:14px 28px; text-decoration:none; border-radius:8px; font-weight:bold; margin-top:20px; font-size:16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Go to Official Dashboard</a>
    </div>
  `;
  throw new Error("Invalid deployment domain blocked by security policy.");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
