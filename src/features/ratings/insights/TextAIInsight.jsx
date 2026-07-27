import { C, cardStyle, FONT } from "../../../theme";
import { useEffect } from "react";

export default function TextAIInsight({ title, textContent, onClose, onRegisterDownload }) {
  const text = String(textContent || "");

  useEffect(() => {
    if (!onRegisterDownload) return;
    onRegisterDownload(() => [
      {
        sheetName: "AI Summary",
        rows: text
          .split("\n")
          .filter(Boolean)
          .map((line) => ({ "AI Operations Report": line })),
      },
    ]);
  }, [text, onRegisterDownload]);

  return (
    <div style={{ ...cardStyle, padding: 24, fontFamily: FONT }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingBottom: 12,
          borderBottom: `2px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>✨</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{title}</span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 15 }}>
            ✕
          </button>
        )}
      </div>
      <div
        style={{
          marginTop: 16,
          backgroundColor: "rgba(19,38,100,0.02)",
          border: "1px solid rgba(19,38,100,0.08)",
          borderRadius: 8,
          padding: 20,
          maxHeight: 400,
          overflowY: "auto",
          fontSize: 13,
          color: C.text,
        }}
      >
        {text.split("\n").map((line, i) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          if (/^[-*]/.test(trimmed))
            return (
              <p key={i} style={{ marginBottom: 8, lineHeight: 1.6, margin: "0 0 8px 0", paddingLeft: 4 }}>
                {trimmed}
              </p>
            );
          if (trimmed.includes(":"))
            return (
              <p key={i} style={{ fontWeight: 700, margin: "0 0 10px 0", lineHeight: 1.6 }}>
                {trimmed}
              </p>
            );
          return (
            <p key={i} style={{ fontWeight: 500, margin: "0 0 10px 0", lineHeight: 1.6 }}>
              {trimmed}
            </p>
          );
        })}
      </div>
    </div>
  );
}
