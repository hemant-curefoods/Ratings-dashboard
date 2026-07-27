import { C, FONT } from "./theme";

const Icon = ({ d }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const ICONS = {
  toggle: <Icon d={<><rect x="1" y="6" width="22" height="12" rx="6" /><circle cx="16" cy="12" r="3" /></>} />,
  timing: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />,
  reviews: <Icon d={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>} />,
  backfill: <Icon d={<><path d="M3 12h6l3 8 3-16 3 8h3" /></>} />,
  ratings: <Icon d={<><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></>} />,
  settings: <Icon d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.6 1.5 2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>} />,
  theme: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /></>} />,
  logout: <Icon d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>} />,
};

export const NAV_ITEMS = [
  { key: "toggle", label: "Toggle", subtitle: "Outlet & item availability control" },
  { key: "timing", label: "Timing", subtitle: "Operational hours and slot health" },
  { key: "reviews", label: "Dine-in Reviews", subtitle: "Dine-in guest feedback stream" },
  { key: "backfilling", label: "Route Backfilling", subtitle: "Rider route gap reconciliation" },
  { key: "ratings", label: "Ratings & Insights", subtitle: "27 analytical insights across the portfolio" },
  { key: "settings", label: "Settings", subtitle: "Profile and connected platforms" },
  { key: "theme", label: "System Theme", subtitle: "Appearance configuration" },
];

const ICON_FOR = {
  toggle: "toggle",
  timing: "timing",
  reviews: "reviews",
  backfilling: "backfill",
  ratings: "ratings",
  settings: "settings",
  theme: "theme",
};

export default function Sidebar({ active, onNavigate, collapsed, onToggleCollapse }) {
  return (
    <aside
      style={{
        width: collapsed ? 0 : 260,
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        backgroundColor: C.primary,
        color: "#ffffff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        fontFamily: FONT,
      }}
    >
      <div style={{ padding: "22px 18px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1, color: "#ffffff" }}>CUREFOODS</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
            Partner Dashboard
          </div>
        </div>
        <button
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "none",
            borderRadius: 8,
            width: 28,
            height: 28,
            color: "#ffffff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <nav style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: 4, flex: 1, overflowY: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: FONT,
                fontSize: 13,
                whiteSpace: "nowrap",
                backgroundColor: isActive ? "#ffffff" : "transparent",
                color: isActive ? C.primary : "rgba(255,255,255,0.8)",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {ICONS[ICON_FOR[item.key]]}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 10px 18px", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
        <button
          onClick={() => onNavigate("logout")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 12px",
            borderRadius: 9,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            width: "100%",
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            color: "#ff8888",
            whiteSpace: "nowrap",
          }}
        >
          {ICONS.logout}
          Logout
        </button>
      </div>
    </aside>
  );
}
