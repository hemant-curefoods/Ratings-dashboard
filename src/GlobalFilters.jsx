import { useEffect, useMemo, useRef, useState } from "react";
import { C, FONT, pillButton } from "./theme";

const popoverStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  zIndex: 1000,
  backgroundColor: "#ffffff",
  border: `2px solid ${C.primary}`,
  borderRadius: 12,
  padding: 12,
  minWidth: 230,
  boxShadow: "0 8px 26px rgba(19,38,100,0.16)",
  fontFamily: FONT,
};

const linkStyle = {
  background: "none",
  border: "none",
  color: C.primary,
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
  fontFamily: FONT,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: C.text,
  fontFamily: FONT,
  outline: "none",
};

export function CheckboxFilterPopover({ label, options, selected, onChange, searchable }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = useMemo(
    () => (query ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query],
  );

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button style={pillButton(selected.length > 0)} onClick={() => setOpen((o) => !o)}>
        {selected.length > 0 ? `${label} (${selected.length})` : `${label}: All`}
      </button>
      {open && (
        <div style={popoverStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.primary, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {label}
            </span>
            <span style={{ display: "flex", gap: 10 }}>
              <button style={linkStyle} onClick={() => onChange([...options])}>
                All
              </button>
              <button style={linkStyle} onClick={() => onChange([])}>
                None
              </button>
            </span>
          </div>
          {searchable && (
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder={`Search ${label.toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div style={{ maxHeight: 210, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {visible.length === 0 && (
              <div style={{ fontSize: 12, color: C.muted, padding: "6px 2px" }}>No options available</div>
            )}
            {visible.map((opt) => (
              <label
                key={opt}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text, padding: "4px 2px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  style={{ accentColor: C.primary, width: 14, height: 14 }}
                />
                {opt}
              </label>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "7px 0",
              borderRadius: 8,
              border: "none",
              backgroundColor: C.primary,
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function RangePopover({ label, active, fields, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => fields.map((f) => f.value));
  const ref = useRef(null);

  useEffect(() => setDraft(fields.map((f) => f.value)), [fields.map((f) => f.value).join("|")]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button style={pillButton(active)} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div style={popoverStyle}>
          {fields.map((f, i) => (
            <div key={f.label} style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>
                {f.label}
              </div>
              <input
                type={f.type}
                style={inputStyle}
                value={draft[i] || ""}
                onChange={(e) => setDraft(draft.map((d, di) => (di === i ? e.target.value : d)))}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
              style={{ ...pillButton(true), borderRadius: 8, flex: 1 }}
            >
              Apply
            </button>
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              style={{ ...pillButton(false), borderRadius: 8, flex: 1 }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GlobalFilters({ filters, masterData, onChange, onClearAll }) {
  const opts = useMemo(() => {
    const match = (row, skip) =>
      (skip === "brand" || !filters.brands.length || filters.brands.includes(row.brand)) &&
      (skip === "city" || !filters.cities.length || filters.cities.includes(row.city)) &&
      (skip === "zone" || !filters.zones.length || filters.zones.includes(row.zone)) &&
      (skip === "area" || !filters.areas.length || filters.areas.includes(row.area));
    const uniq = (key) => [...new Set(masterData.filter((r) => match(r, key)).map((r) => r[key]))].sort();
    return { brands: uniq("brand"), cities: uniq("city"), zones: uniq("zone"), areas: uniq("area") };
  }, [masterData, filters]);

  const anyActive =
    filters.brands.length ||
    filters.cities.length ||
    filters.zones.length ||
    filters.areas.length ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.timeFrom ||
    filters.timeTo;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <CheckboxFilterPopover
        label="Brands"
        options={opts.brands}
        selected={filters.brands}
        onChange={(v) => onChange({ brands: v })}
      />
      <CheckboxFilterPopover
        label="Cities"
        options={opts.cities}
        selected={filters.cities}
        onChange={(v) => onChange({ cities: v })}
        searchable
      />
      <CheckboxFilterPopover
        label="Zones"
        options={opts.zones}
        selected={filters.zones}
        onChange={(v) => onChange({ zones: v })}
      />
      <CheckboxFilterPopover
        label="Areas"
        options={opts.areas}
        selected={filters.areas}
        onChange={(v) => onChange({ areas: v })}
        searchable
      />
      <RangePopover
        label={filters.dateFrom || filters.dateTo ? `Date: ${filters.dateFrom || "…"} → ${filters.dateTo || "…"}` : "Date Range"}
        active={Boolean(filters.dateFrom || filters.dateTo)}
        fields={[
          { label: "From Date", type: "date", value: filters.dateFrom },
          { label: "To Date", type: "date", value: filters.dateTo },
        ]}
        onApply={([dateFrom, dateTo]) => onChange({ dateFrom, dateTo })}
        onClear={() => onChange({ dateFrom: "", dateTo: "" })}
      />
      <RangePopover
        label={filters.timeFrom || filters.timeTo ? `Time: ${filters.timeFrom || "…"} → ${filters.timeTo || "…"}` : "Time Range"}
        active={Boolean(filters.timeFrom || filters.timeTo)}
        fields={[
          { label: "From Time", type: "time", value: filters.timeFrom },
          { label: "To Time", type: "time", value: filters.timeTo },
        ]}
        onApply={([timeFrom, timeTo]) => onChange({ timeFrom, timeTo })}
        onClear={() => onChange({ timeFrom: "", timeTo: "" })}
      />
      {Boolean(anyActive) && (
        <button
          onClick={onClearAll}
          style={{ ...linkStyle, fontSize: 12, textDecoration: "underline", marginLeft: 2 }}
        >
          Clear All
        </button>
      )}
    </div>
  );
}
