export const C = {
  primary: "#132664",
  bg: "#ffffff",
  text: "#132664",
  border: "rgba(19, 38, 100, 0.15)",
  borderSoft: "rgba(19, 38, 100, 0.08)",
  muted: "rgba(19, 38, 100, 0.55)",
  headerBg: "#f4f6fa",
  rowAlt: "rgba(19, 38, 100, 0.01)",
  danger: "#dc3545",
  warn: "#ffc107",
  ok: "#28a745",
};

export const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const cardStyle = {
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
  backgroundColor: "#ffffff",
};

export const pillButton = (active) => ({
  padding: "7px 14px",
  borderRadius: 18,
  border: `1.5px solid ${C.primary}`,
  backgroundColor: active ? C.primary : "#ffffff",
  color: active ? "#ffffff" : C.primary,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FONT,
  whiteSpace: "nowrap",
});

export const spinnerStyle = {
  width: 14,
  height: 14,
  border: `2px solid ${C.primary}`,
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
  display: "inline-block",
};
