#!/bin/bash

# Fix TogglePage.jsx
sed -i '' 's/import { STORES }/import { getAuthHeaders } from "..\/..\/api";\nimport { STORES }/' src/features/toggle/TogglePage.jsx
sed -i '' 's/headers: { "Content-Type": "application\/json" },/headers: { ...getAuthHeaders() },/' src/features/toggle/TogglePage.jsx
sed -i '' 's/fetch(`${API_BASE}\/api\/toggle\/sidebar-data`)/fetch(`${API_BASE}\/api\/toggle\/sidebar-data`, { headers: getAuthHeaders() })/' src/features/toggle/TogglePage.jsx
sed -i '' 's/fetch(`${API_BASE}\/api\/toggle\/store-states`)/fetch(`${API_BASE}\/api\/toggle\/store-states`, { headers: getAuthHeaders() })/' src/features/toggle/TogglePage.jsx

# Fix ToggleSidebar.jsx
sed -i '' 's/import { C, FONT }/import { getAuthHeaders } from "..\/..\/api";\nimport { C, FONT }/' src/features/toggle/ToggleSidebar.jsx
sed -i '' 's/return fetch(`${API_BASE}${path}`, {/return fetch(`${API_BASE}${path}`, { headers: getAuthHeaders(), /' src/features/toggle/ToggleSidebar.jsx

# Fix AuditModal.jsx
sed -i '' 's/import { C, FONT }/import { getAuthHeaders } from "..\/..\/api";\nimport { C, FONT }/' src/features/toggle/AuditModal.jsx
sed -i '' 's/fetch(`${API_BASE}\/api\/toggle\/audit-log`)/fetch(`${API_BASE}\/api\/toggle\/audit-log`, { headers: getAuthHeaders() })/' src/features/toggle/AuditModal.jsx

# Fix ratingsApi.js
sed -i '' 's/const API_BASE/import { getAuthHeaders } from "..\/..\/api";\nconst API_BASE/' src/features/ratings/ratingsApi.js
sed -i '' 's/fetch(`${API_BASE}\/api\/insights\/${insightId}`, {/fetch(`${API_BASE}\/api\/insights\/${insightId}`, { headers: getAuthHeaders(), /' src/features/ratings/ratingsApi.js
sed -i '' 's/fetch(`${API_BASE}\/api\/filters`)/fetch(`${API_BASE}\/api\/filters`, { headers: getAuthHeaders() })/' src/features/ratings/ratingsApi.js
sed -i '' 's/fetch(`${API_BASE}\/api\/insights\/send-email`, {/fetch(`${API_BASE}\/api\/insights\/send-email`, { headers: getAuthHeaders(), /' src/features/ratings/ratingsApi.js
