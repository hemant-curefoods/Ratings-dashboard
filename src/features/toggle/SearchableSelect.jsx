import React, { useState, useRef, useEffect } from "react";
import { C, FONT } from "../../theme";

export default function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  allowCustom = false,
  width = "100%" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearch("");
  };

  const handleCustomAdd = () => {
    if (search.trim()) {
      onChange(search.trim());
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width, fontFamily: FONT }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: `1.5px solid ${C.border}`,
          backgroundColor: "#fff",
          color: value ? C.text : C.muted,
          fontSize: 13,
          fontWeight: value ? 600 : 400,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          outline: "none"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value || placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d={isOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          marginTop: 6,
          backgroundColor: "#fff",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(19,38,100,0.15)",
          border: `1px solid ${C.border}`,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          maxHeight: 280
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
            <input
              type="text"
              placeholder="Search or type new..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && allowCustom && search.trim()) {
                  e.preventDefault();
                  handleCustomAdd();
                }
              }}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 12,
                outline: "none",
                fontFamily: FONT,
                boxSizing: "border-box"
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: 4 }}>
            {filteredOptions.length === 0 && !allowCustom ? (
              <div style={{ padding: "10px", fontSize: 11, color: C.muted, textAlign: "center" }}>No options found</div>
            ) : (
              <>
                {filteredOptions.map(opt => (
                  <div key={opt} 
                    onClick={() => handleSelect(opt)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: C.text,
                      borderRadius: 6,
                      fontWeight: value === opt ? 700 : 400,
                      backgroundColor: value === opt ? "rgba(19,38,100,0.06)" : "transparent"
                    }}
                    onMouseEnter={e => { if (value !== opt) e.currentTarget.style.backgroundColor = "rgba(19,38,100,0.04)" }}
                    onMouseLeave={e => { if (value !== opt) e.currentTarget.style.backgroundColor = "transparent" }}
                  >
                    {opt}
                  </div>
                ))}
                {allowCustom && search.trim() && !filteredOptions.find(o => o.toLowerCase() === search.toLowerCase()) && (
                  <div 
                    onClick={handleCustomAdd}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: C.primary,
                      borderRadius: 6,
                      fontWeight: 700,
                      borderTop: `1px solid ${C.border}`
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(19,38,100,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    + Add "{search.trim()}"
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
