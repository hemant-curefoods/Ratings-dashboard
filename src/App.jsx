import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar, { NAV_ITEMS } from "./Sidebar";
import GlobalFilters from "./GlobalFilters";
import { C, FONT } from "./theme";
import TogglePage from "./features/toggle/TogglePage";
import TimingPage from "./features/timing/TimingPage";
import ReviewsPage from "./features/reviews/ReviewsPage";
import RouteBackfillingPage from "./features/backfilling/RouteBackfillingPage";
import RatingsPage from "./features/ratings/RatingsPage";
import { SettingsPage, ThemePage } from "./features/static/StaticPages";
import LoginPage from "./features/auth/LoginPage";
import { fetchFilters } from "./features/ratings/ratingsApi";

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

const DEFAULT_FILTERS = {
  brands: [],
  cities: [],
  zones: [],
  areas: [],
  dateFrom: iso(7),
  dateTo: iso(1),
  timeFrom: "",
  timeTo: "",
};

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState("ratings");
  const [collapsed, setCollapsed] = useState(false);
  const [globalFilters, setGlobalFilters] = useState(DEFAULT_FILTERS);
  const [masterData, setMasterData] = useState([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchFilters()
      .then((res) => {
        if (alive) setMasterData(res.masterData || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  const allBrands = useMemo(() => [...new Set(masterData.map((r) => r.brand))].sort(), [masterData]);

  const updateFilters = useCallback((partial) => setGlobalFilters((prev) => ({ ...prev, ...partial })), []);

  const nav = NAV_ITEMS.find((n) => n.key === activeTab);
  const title = activeTab === "logout" ? "Session" : nav?.label || "Dashboard";
  const subtitle = activeTab === "logout" ? "You have signed out" : nav?.subtitle || "";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: C.bg, color: C.text, fontFamily: FONT }}>
      <Sidebar
        active={activeTab}
        onNavigate={(tab) => {
          if (tab === "logout") {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
          } else {
            setActiveTab(tab);
          }
        }}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(true)}
      />

      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            style={{
              position: "absolute",
              top: 22,
              left: 14,
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              border: `1.8px solid ${C.primary}`,
              color: C.primary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 40,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        <header
          style={{
            padding: collapsed ? "20px 28px 16px 58px" : "20px 28px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: -0.3 }}>{title}</h1>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{subtitle}</div>
          </div>
          {activeTab !== "toggle" && activeTab !== "settings" && (
            <GlobalFilters
              filters={globalFilters}
              masterData={masterData}
              onChange={updateFilters}
              onClearAll={() => setGlobalFilters({ ...DEFAULT_FILTERS, dateFrom: "", dateTo: "" })}
            />
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 60px" }}>
          {activeTab === "toggle" && <TogglePage />}
          {activeTab === "timing" && <TimingPage globalFilters={globalFilters} />}
          {activeTab === "reviews" && <ReviewsPage globalFilters={globalFilters} />}
          {activeTab === "backfilling" && <RouteBackfillingPage globalFilters={globalFilters} />}
          {activeTab === "ratings" && (
            <RatingsPage
              globalFilters={globalFilters}
              allBrands={allBrands}
              masterData={masterData}
              onUpdateFilters={updateFilters}
            />
          )}
          {activeTab === "settings" && <SettingsPage />}
          {activeTab === "theme" && <ThemePage />}
        </div>
      </main>
    </div>
  );
}
