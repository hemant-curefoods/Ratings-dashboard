import React, { useState, useRef, useEffect } from "react";
import { C, FONT } from "../../theme";

export default function MultiSearchableSelect({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder, 
  width = 180 
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
  
  const isAllSelected = options.length > 0 && selectedValues.length === options.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const toggleOption = (opt) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(v => v !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  let label = placeholder;
  if (selectedValues.length === options.length && options.length > 0) {
    label = `All ${placeholder}s`;
  } else if (selectedValues.length === 1) {
    label = selectedValues[0];
  } else if (selectedValues.length > 1) {
    label = `${selectedValues.length} Selected`;
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width, fontFamily: FONT }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "7px 12px",
          borderRadius: 10,
          border: `1.5px solid ${C.primary}`,
          backgroundColor: "#fff",
          color: C.primary,
          fontSize: 12,
          fontWeight: 700,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          outline: "none"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
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
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            {!search && (
              <label style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 10px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                color: C.primary,
                borderBottom: `1px solid ${C.border}`,
                marginBottom: 4
              }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  style={{ marginRight: 8, accentColor: C.primary, cursor: "pointer" }}
                />
                {isAllSelected ? "Unselect All" : "Select All"}
              </label>
            )}
            
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "10px", fontSize: 11, color: C.muted, textAlign: "center" }}>No options found</div>
            ) : (
              filteredOptions.map(opt => (
                <label key={opt} style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: C.text,
                  borderRadius: 6
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(19,38,100,0.04)"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt)}
                    onChange={() => toggleOption(opt)}
                    style={{ marginRight: 8, accentColor: C.primary, cursor: "pointer" }}
                  />
                  {opt}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
