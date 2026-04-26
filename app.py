# =============================================================
# CUREFOODS — Rating Dashboard (Streamlit)
# Layout: top filter bar · collapsible file manager · tabbed sections
# =============================================================
import streamlit as st
import pandas as pd
import numpy as np
import io
from datetime import date

from config import (
    BRAND_MAP, CITY_ZONE, ZONES, BU_ORDER, BU_COLORS,
    rating_color, get_zone, get_brand_info,
)
from processing import (
    load_file, peek_file,
    combine, apply_filters, _empty_diag,
    kpi_summary, brand_ratings_compare,
    brand_city_matrix, zone_brand_matrix,
    brand_sentiment, low_rating_comments,
    sku_impact_insights, top_bottom_skus,
    REQUIRED_FIELDS, ALL_FIELDS, _auto_detect_columns,
)

FIELD_LABELS = {
    "brand":   "Brand",
    "city":    "City",
    "order":   "Order ID",
    "rating":  "Rating",
    "area":    "Area / Locality",
    "comment": "Review / Comment",
    "item":    "Item / Dish",
    "date":    "Date",
    "status":  "Order Status",
}


# --------------------------------------------------------------
st.set_page_config(
    page_title="Curefoods · Rating Dashboard",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="collapsed",
)


st.markdown("""
<style>
  /* Layout */
  .block-container { padding-top: 1.2rem; padding-bottom: 2rem; max-width: 1480px; }
  [data-testid="stSidebar"] { display: none; }
  /* Hide hamburger and footer for cleaner look */
  #MainMenu, footer, header { visibility: hidden; }

  /* === Top header card === */
  .cf-hero {
    background: linear-gradient(135deg,#4F46E5 0%, #7C3AED 50%, #DB2777 100%);
    color: white;
    border-radius: 16px;
    padding: 22px 28px;
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 8px 24px rgba(124,58,237,0.16);
  }
  .cf-hero-left { display: flex; align-items: center; gap: 16px; }
  .cf-hero h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; color: white; }
  .cf-hero-sub { font-size: 12px; opacity: 0.9; margin-top: 2px; }
  .cf-hero-icon {
    width: 48px; height: 48px; background: rgba(255,255,255,0.2);
    border-radius: 12px; display: flex; align-items: center; justify-content: center;
    font-size: 24px;
  }
  .cf-hero-stats {
    display: flex; gap: 18px;
  }
  .cf-hero-stat {
    text-align: right;
    border-left: 1px solid rgba(255,255,255,0.25);
    padding-left: 18px;
  }
  .cf-hero-stat .v { font-size: 18px; font-weight: 800; line-height: 1; }
  .cf-hero-stat .l { font-size: 10px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

  /* === Filter bar === */
  .cf-filter-bar {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }

  /* Compact multiselect chips */
  .stMultiSelect [data-baseweb="tag"] {
    background-color: #EEF2FF !important;
    border: 1px solid #C7D2FE !important;
    color: #4F46E5 !important;
    font-size: 11px !important;
    height: 22px !important;
    margin: 1px 2px !important;
  }
  .stMultiSelect [data-baseweb="tag"] span { color: #4F46E5 !important; }

  /* === KPI cards === */
  .cf-kpi-row { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .cf-kpi {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 14px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: all 0.2s;
  }
  .cf-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }
  .cf-kpi.overall { background: linear-gradient(135deg,#F0FDF4 0%, #FFFFFF 100%); border-color: #BBF7D0; }
  .cf-kpi .lbl { font-size: 10px; color: #6B7280; text-transform: uppercase;
    letter-spacing: 1.5px; font-weight: 700; margin-bottom: 6px; }
  .cf-kpi .val { font-size: 32px; font-weight: 900; line-height: 1; letter-spacing: -1px; }
  .cf-kpi .sub { font-size: 11px; color: #9CA3AF; margin-top: 6px; }
  .cf-kpi-bar { position: absolute; top: 0; left: 0; height: 3px; }

  /* === Section card === */
  .cf-section {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 14px;
    padding: 22px 24px;
    margin-bottom: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  }
  .cf-section h3 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #111827; }
  .cf-section .desc { color: #6B7280; font-size: 12px; margin-bottom: 16px; }

  /* === Tables === */
  .cf-pill { border-radius: 6px; text-align: center; padding: 6px 8px;
    font-weight: 700; font-size: 12px; display: inline-block; min-width: 48px; }
  .cf-pill-empty { background: #F3F4F6; color: #9CA3AF; }
  table.cf-tbl { border-collapse: collapse; width: 100%; font-size: 12px; }
  table.cf-tbl th { background: #F9FAFB; padding: 10px 10px; border-bottom: 2px solid #E5E7EB;
    color: #6B7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
    text-align: center; font-weight: 700; }
  table.cf-tbl th.left { text-align: left; }
  table.cf-tbl td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
  table.cf-tbl tr:hover td { background: #FAFAFA; }
  table.cf-tbl td.label { font-weight: 700; color: #111827; white-space: nowrap; }

  /* Sentiment bars */
  .cf-bar-bg { background: #FEE2E2; border-radius: 4px; height: 18px; overflow: hidden;
    display: inline-block; width: 140px; vertical-align: middle; }
  .cf-bar-bg.pos { background: #DCFCE7; }
  .cf-bar { height: 100%; border-radius: 4px; }
  .cf-bu-badge { border-radius: 4px; padding: 2px 7px; font-size: 10px;
    font-weight: 700; display: inline-block; }

  /* Tabs */
  .stTabs [data-baseweb="tab-list"] {
    gap: 6px;
    background: #F9FAFB;
    border-radius: 12px;
    padding: 6px;
    border: 1px solid #E5E7EB;
  }
  .stTabs [data-baseweb="tab"] {
    border-radius: 8px;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 13px;
    color: #6B7280;
    border: none;
  }
  .stTabs [aria-selected="true"] {
    background: white !important;
    color: #111827 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .stTabs [data-baseweb="tab-panel"] { padding-top: 16px; }

  /* File card in collapsed expander */
  .cf-file-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; background: #F9FAFB; border: 1px solid #E5E7EB;
    border-radius: 8px; margin-bottom: 6px; font-size: 12px;
  }
  .cf-source-badge {
    display: inline-block; padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; margin-right: 8px;
  }
  .cf-source-badge.zomato { background: #FEE2E2; color: #DC2626; }
  .cf-source-badge.swiggy { background: #FFEDD5; color: #F97316; }

  /* Status indicators */
  .cf-status-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 6px; vertical-align: middle;
  }
  .cf-status-dot.green { background: #10B981; }
  .cf-status-dot.red { background: #EF4444; }
  .cf-status-dot.yellow { background: #F59E0B; }

  /* Reset filter button */
  .stButton button {
    background: #F3F4F6; border: 1px solid #E5E7EB; color: #6B7280;
    border-radius: 8px; font-size: 12px; padding: 6px 14px;
    font-weight: 600; transition: all 0.15s;
  }
  .stButton button:hover { background: #E5E7EB; color: #111827; }
</style>
""", unsafe_allow_html=True)


# --------------------------------------------------------------
def fmt_cell(v):
    if v is None or (isinstance(v, float) and (np.isnan(v) or v == 0)):
        return "<span class='cf-pill cf-pill-empty'>—</span>"
    c = rating_color(v)
    return (f"<span class='cf-pill' style='background:{c['bg']};color:{c['text']};"
            f"border:1px solid {c['border']}'>{v:.2f}</span>")


# --------------------------------------------------------------
# Cached load
# --------------------------------------------------------------
@st.cache_data(show_spinner="Inspecting file…")
def _cached_peek(file_bytes, file_name):
    bio = io.BytesIO(file_bytes); bio.name = file_name
    return peek_file(bio)


@st.cache_data(show_spinner="Reading file…")
def _cached_load_one(file_bytes, file_name, label, sheet_override, column_overrides_tuple):
    if file_bytes is None:
        return None, None
    bio = io.BytesIO(file_bytes); bio.name = file_name
    co = dict(column_overrides_tuple) if column_overrides_tuple else None
    return load_file(bio, label, sheet_override=sheet_override, column_overrides=co)


def _render_per_file_mapper(file_obj, platform_label):
    file_bytes = file_obj.getvalue()
    peek = _cached_peek(file_bytes, file_obj.name)
    if peek.get("error"):
        st.error(f"Could not read {file_obj.name}: {peek['error']}")
        return None, None

    state_prefix = f"map_{platform_label}_{file_obj.name}"
    sheet_choice = peek.get("default_sheet")

    if peek["type"] == "xlsx" and len(peek["sheets"]) > 1:
        names = [s["name"] for s in peek["sheets"]]
        default_name = peek["default_sheet"] or names[0]
        default_idx = names.index(default_name) if default_name in names else 0
        labels = []
        for s in peek["sheets"]:
            tag = "  📊" if s["is_data"] else "  📋"
            labels.append(f"{s['name']}{tag} ({s['rows']:,} rows × {s['cols']} cols)")
        chosen_label = st.selectbox(
            "Sheet to use", options=labels, index=default_idx,
            key=f"{state_prefix}_sheet",
            help="📊 = data sheet · 📋 = reference sheet",
        )
        sheet_choice = names[labels.index(chosen_label)]

    sheet_columns = []
    for s in peek["sheets"]:
        if s["name"] == sheet_choice:
            sheet_columns = s["columns"]; break
    if not sheet_columns:
        return sheet_choice, None

    auto = _auto_detect_columns(sheet_columns)
    overrides = {}
    with st.expander("📋 Column mapping — override if auto-detection got it wrong", expanded=False):
        st.caption("Auto-detected fields are tagged ✅. Override by picking a different column.")
        opts = ["(none)"] + sheet_columns
        cols2 = st.columns(2)
        for idx, fld in enumerate(ALL_FIELDS):
            label = FIELD_LABELS.get(fld, fld)
            default_val = auto.get(fld)
            tag = " ✅" if default_val else (" ⚠️" if fld in REQUIRED_FIELDS else "")
            default_idx = opts.index(default_val) if default_val and default_val in opts else 0
            with cols2[idx % 2]:
                chosen = st.selectbox(label + tag, options=opts, index=default_idx,
                                      key=f"{state_prefix}_col_{fld}")
                if chosen != "(none)":
                    overrides[fld] = chosen
    return sheet_choice, overrides


def load_platform_files(file_objs, platform_label):
    if not file_objs:
        return None, []
    sheet_overrides = {}
    column_overrides = {}
    for f in file_objs:
        with st.container():
            st.markdown(f"<div class='cf-file-row'>"
                        f"<span><span class='cf-source-badge {platform_label.lower()}'>{platform_label}</span>"
                        f"<code>{f.name}</code></span>"
                        f"<span style='color:#9CA3AF;font-size:11px'>{f.size/1024/1024:.1f} MB</span>"
                        f"</div>", unsafe_allow_html=True)
            sheet, cols = _render_per_file_mapper(f, platform_label)
            sheet_overrides[f.name] = sheet
            column_overrides[f.name] = cols or {}

    parts, diags, seen_orders = [], [], set()
    for f in file_objs:
        try:
            cols_t = tuple(sorted(column_overrides[f.name].items())) if column_overrides[f.name] else None
            df, d = _cached_load_one(f.getvalue(), f.name, platform_label,
                                     sheet_overrides[f.name], cols_t)
            diags.append(d)
            if df is not None and not df.empty:
                mask = ~df["order_id"].isin(seen_orders)
                if mask.sum():
                    df = df[mask].copy()
                    seen_orders.update(df["order_id"].tolist())
                    parts.append(df)
        except Exception as e:
            d = _empty_diag(platform_label); d["file_name"] = f.name; d["error"] = str(e)
            diags.append(d)
    combined = pd.concat(parts, ignore_index=True) if parts else None
    return combined, diags


def render_file_rating_summary(df, diags):
    """Show compact per-file rating cards after processing."""
    if df is None or df.empty or not diags:
        return

    cards_html = ""
    for diag in diags:
        fname = diag.get("file_name")
        if not fname:
            continue
        err = diag.get("error")
        rows_final = diag.get("rows_final", 0)

        if err or rows_final == 0:
            cards_html += (
                f"<div style='background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;"
                f"padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px'>"
                f"<span style='font-size:18px'>❌</span>"
                f"<div><div style='font-weight:700;font-size:12px;color:#DC2626'>{fname}</div>"
                f"<div style='font-size:11px;color:#EF4444;margin-top:2px'>"
                f"{err[:80] if err else '0 rows loaded'}</div></div></div>"
            )
            continue

        file_df = df[df["source_file"] == fname] if "source_file" in df.columns else df
        if file_df.empty:
            continue

        avg_r = file_df["rating"].mean()
        count = len(file_df)
        dates = file_df["date"].dropna()
        if len(dates):
            d_min, d_max = dates.min(), dates.max()
            months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
            if d_min.month == d_max.month and d_min.year == d_max.year:
                date_str = f"{months[d_min.month-1]} {d_min.day}–{d_max.day}, {d_max.year}"
            else:
                date_str = f"{months[d_min.month-1]} {d_min.day} – {months[d_max.month-1]} {d_max.day}, {d_max.year}"
        else:
            date_str = "No dates"

        rc = rating_color(avg_r)
        cards_html += (
            f"<div style='background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;"
            f"padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:14px'>"
            f"<div style='background:{rc['bg']};color:{rc['text']};border:1px solid {rc['border']};"
            f"border-radius:8px;padding:6px 12px;font-size:18px;font-weight:900;white-space:nowrap'>"
            f"{avg_r:.2f}★</div>"
            f"<div style='flex:1;min-width:0'>"
            f"<div style='font-weight:700;font-size:12px;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>{fname}</div>"
            f"<div style='font-size:11px;color:#6B7280;margin-top:3px'>"
            f"<b style='color:#374151'>{count:,}</b> feedbacks · {date_str}</div>"
            f"</div>"
            f"<div style='text-align:right;white-space:nowrap'>"
            f"<div style='font-size:10px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px'>Avg Rating</div>"
            f"<div style='font-size:20px;font-weight:900;color:{rc['text']}'>{avg_r:.2f}</div>"
            f"</div></div>"
        )

    if cards_html:
        st.markdown(f"<div style='margin-top:12px'>{cards_html}</div>", unsafe_allow_html=True)


def render_diagnostics(diag):
    if not diag or not diag.get("file_name"):
        return
    rows_read = diag["rows_read"]
    rows_final = diag["rows_final"]
    err = diag.get("error")

    if err:
        dot = "red"; status = f"Failed: {err[:80]}"
    elif rows_final == 0:
        dot = "yellow"; status = "0 rows after filtering"
    else:
        keep_pct = (rows_final / rows_read * 100) if rows_read else 0
        dot = "green"
        status = f"<b>{rows_final:,}</b> rows kept ({keep_pct:.0f}% of {rows_read:,})"

    st.markdown(f"<div style='font-size:12px;margin-bottom:6px'><span class='cf-status-dot {dot}'></span>"
                f"<b>{diag['platform']}</b> · <code>{diag['file_name']}</code> — {status}</div>",
                unsafe_allow_html=True)

    with st.expander("Details", expanded=False):
        funnel = pd.DataFrame([
            {"Step": "1. Rows read",                       "Rows": diag["rows_read"]},
            {"Step": "2. After required cols + rating>0",  "Rows": diag["rows_after_required"]},
            {"Step": "3. After brand mapping",             "Rows": diag["rows_after_brand_map"]},
            {"Step": "4. After zone mapping",              "Rows": diag["rows_after_zone_map"]},
            {"Step": "5. After dedupe (final)",            "Rows": diag["rows_final"]},
        ])
        st.dataframe(funnel, hide_index=True, use_container_width=True)
        if diag["unmapped_brands"]:
            st.markdown("**🚫 Unmapped brand names** — add these to `BRAND_MAP`:")
            ub = pd.DataFrame(diag["unmapped_brands"], columns=["brand_name", "rows lost"])
            st.dataframe(ub, hide_index=True, use_container_width=True)
        if diag["unmapped_cities"]:
            st.markdown("**🚫 Unmapped city names** — add these to `CITY_ZONE`:")
            uc = pd.DataFrame(diag["unmapped_cities"], columns=["city", "rows lost"])
            st.dataframe(uc, hide_index=True, use_container_width=True)


# ==============================================================
# 1. FILE MANAGER (top of page, collapsible)
# ==============================================================
# Determine if we already have data so we can collapse the file panel
data_loaded = ("master_df" in st.session_state and st.session_state.master_df is not None
               and not st.session_state.master_df.empty)

zomato_df, zomato_diags = None, []
swiggy_df, swiggy_diags = None, []

with st.expander("📁  **Data sources** — upload Zomato & Swiggy files",
                 expanded=not data_loaded):

    z_tab, s_tab = st.tabs(["🔴  Zomato", "🟠  Swiggy"])

    with z_tab:
        st.markdown(
            "<div style='font-size:12px;color:#6B7280;margin-bottom:8px'>"
            "Upload one or more Zomato export files (xlsx, csv, zip). "
            "Duplicate order IDs across files are automatically de-duplicated.</div>",
            unsafe_allow_html=True,
        )
        z_files = st.file_uploader(
            "Upload Zomato files",
            type=["xlsx", "xlsm", "xls", "csv", "zip"],
            accept_multiple_files=True,
            key="z",
            label_visibility="collapsed",
        )
        if z_files:
            with st.expander("⚙️ Sheet & column mapping", expanded=False):
                zomato_df, zomato_diags = load_platform_files(z_files, "Zomato")
            if zomato_df is not None and not zomato_df.empty:
                render_file_rating_summary(zomato_df, zomato_diags)
            elif not zomato_df is None:
                render_file_rating_summary(None, zomato_diags)

    with s_tab:
        st.markdown(
            "<div style='font-size:12px;color:#6B7280;margin-bottom:8px'>"
            "Upload one or more Swiggy export files (xlsx, csv, zip). "
            "Duplicate order IDs across files are automatically de-duplicated.</div>",
            unsafe_allow_html=True,
        )
        s_files = st.file_uploader(
            "Upload Swiggy files",
            type=["xlsx", "xlsm", "xls", "csv", "zip"],
            accept_multiple_files=True,
            key="s",
            label_visibility="collapsed",
        )
        if s_files:
            with st.expander("⚙️ Sheet & column mapping", expanded=False):
                swiggy_df, swiggy_diags = load_platform_files(s_files, "Swiggy")
            if swiggy_df is not None and not swiggy_df.empty:
                render_file_rating_summary(swiggy_df, swiggy_diags)
            elif not swiggy_df is None:
                render_file_rating_summary(None, swiggy_diags)

master = combine(zomato_df, swiggy_df)
st.session_state.master_df = master


# ==============================================================
# Empty state
# ==============================================================
if master is None or master.empty:
    if not (z_files or s_files):
        st.info("👆 Upload Zomato and/or Swiggy ratings files to begin.")
    else:
        st.error("No usable rows in the uploaded file(s). Open the file mapping expander above to debug.")
    st.stop()


# ==============================================================
# 2. HERO + KPI ROW
# ==============================================================
def _date_label(df):
    dates = df["date"].dropna()
    if not len(dates):
        return "MTD"
    d_min, d_max = dates.min(), dates.max()
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    if d_min.month == d_max.month and d_min.year == d_max.year:
        return f"{months[d_min.month - 1]} {d_min.day}–{d_max.day}, {d_max.year}"
    return f"{months[d_min.month - 1]} {d_min.day} – {months[d_max.month - 1]} {d_max.day}, {d_max.year}"

date_label = _date_label(master)
zomato_count = len(zomato_df) if zomato_df is not None else 0
swiggy_count = len(swiggy_df) if swiggy_df is not None else 0

st.markdown(f"""
<div class='cf-hero'>
  <div class='cf-hero-left'>
    <div class='cf-hero-icon'>🍽️</div>
    <div>
      <h1>Curefoods Rating Dashboard</h1>
      <div class='cf-hero-sub'>Feedback Intelligence · {date_label}</div>
    </div>
  </div>
  <div class='cf-hero-stats'>
    <div class='cf-hero-stat'><div class='v'>{len(master):,}</div><div class='l'>Total feedbacks</div></div>
    <div class='cf-hero-stat'><div class='v'>{zomato_count:,}</div><div class='l'>Zomato</div></div>
    <div class='cf-hero-stat'><div class='v'>{swiggy_count:,}</div><div class='l'>Swiggy</div></div>
    <div class='cf-hero-stat'><div class='v'>{master["brand_short"].nunique()}</div><div class='l'>Brands</div></div>
  </div>
</div>
""", unsafe_allow_html=True)


# ==============================================================
# 3. FILTER BAR (horizontal, top of page)
# ==============================================================
st.markdown("<div class='cf-filter-bar'>", unsafe_allow_html=True)
fc1, fc2, fc3, fc4, fc5 = st.columns([3, 2, 3, 2, 1])

# Brand options sorted by BU then name
brand_bu_map = master.drop_duplicates("brand_short").set_index("brand_short")["bu"].to_dict()
all_brands = sorted(master["brand_short"].unique(),
                    key=lambda b: (BU_ORDER.get(brand_bu_map.get(b, "Other"), 9), b))
all_zones = [z for z in ZONES if z in master["zone"].unique()]
all_platforms = sorted(master["platform"].unique())

with fc1:
    sel_brands = st.multiselect("Brand", options=all_brands, default=all_brands,
                                 placeholder="All brands", label_visibility="visible")
with fc2:
    sel_zones = st.multiselect("Zone", options=all_zones, default=all_zones,
                                placeholder="All zones")
with fc3:
    dates = master["date"].dropna()
    if len(dates):
        d_min, d_max = dates.min().date(), dates.max().date()
        sel_dates = st.date_input("Date range", value=(d_min, d_max),
                                  min_value=d_min, max_value=d_max)
        if isinstance(sel_dates, date):
            sel_dates = (sel_dates, sel_dates)
    else:
        sel_dates = None
        st.caption("No dates in source data")
with fc4:
    sel_platforms = st.multiselect("Platform", options=all_platforms,
                                    default=all_platforms, placeholder="All")
with fc5:
    st.markdown("<div style='height:28px'></div>", unsafe_allow_html=True)
    if st.button("↺ Reset", use_container_width=True):
        for k in list(st.session_state.keys()):
            if k.startswith(("brand_", "zone_", "date_", "platform_")):
                del st.session_state[k]
        st.rerun()
st.markdown("</div>", unsafe_allow_html=True)


# Apply filters
df = apply_filters(master, brands=sel_brands or None, zones=sel_zones or None, date_range=sel_dates)
if sel_platforms:
    df = df[df["platform"].isin(sel_platforms)]

if df is None or df.empty:
    st.warning("No data matches these filters. Loosen them above.")
    st.stop()


# ==============================================================
# 4. KPI ROW
# ==============================================================
kpi = kpi_summary(df)
overall = kpi["overall"]
oc = rating_color(overall["avg"])

kpi_html = f"""
<div class='cf-kpi-row'>
  <div class='cf-kpi overall'>
    <div class='cf-kpi-bar' style='width:100%;background:{oc["text"]}'></div>
    <div class='lbl'>Overall Avg · {date_label}</div>
    <div class='val' style='color:{oc["text"]}'>{overall["avg"]:.2f}</div>
    <div class='sub'>{overall["count"]:,} feedbacks · filtered</div>
  </div>"""

for bu in ["Dessert", "Pizza", "Burger", "Indian"]:
    bu_data = kpi["by_bu"].get(bu, {"avg": 0, "count": 0})
    cc = rating_color(bu_data["avg"])
    bc = BU_COLORS.get(bu, "#6B7280")
    kpi_html += f"""
  <div class='cf-kpi'>
    <div class='cf-kpi-bar' style='width:100%;background:{bc}'></div>
    <div class='lbl' style='color:{bc}'>{bu}</div>
    <div class='val' style='color:{cc["text"]}'>{bu_data["avg"]:.2f}</div>
    <div class='sub'>{bu_data["count"]:,} feedbacks</div>
  </div>"""
kpi_html += "</div>"
st.markdown(kpi_html, unsafe_allow_html=True)


# ==============================================================
# 5. TABBED SECTIONS
# ==============================================================
tab_overview, tab_geo, tab_sentiment, tab_insights, tab_loadlog = st.tabs([
    "📊 Overview",
    "🗺️ Geography",
    "💬 Sentiment & Comments",
    "💡 SKU Insights",
    "🔬 Load Report",
])


# ─── OVERVIEW TAB ───
with tab_overview:
    st.markdown("<div class='cf-section'><h3>Brand Ratings</h3>"
                "<div class='desc'>Zomato vs Swiggy with gap (positive = stronger platform)</div>",
                unsafe_allow_html=True)

    br = brand_ratings_compare(df)
    if br.empty:
        st.info("No brand-level data after filters.")
    else:
        rows_html = ""
        for _, r in br.iterrows():
            z_html = fmt_cell(r["zomato"])
            s_html = fmt_cell(r["swiggy"])
            gap_html = "<span style='color:#9CA3AF'>—</span>"
            if r["gap_label"] not in (None, "—"):
                gl = r["gap_label"]
                gap_color = "#DC2626" if gl.startswith("Z") else "#F97316" if gl.startswith("S") else "#6B7280"
                gap_html = f"<span style='font-weight:700;color:{gap_color}'>{gl}</span>"
            rows_html += (
                f"<tr><td class='label'>{r['brand']}<div style='color:#6B7280;font-size:9px;font-weight:400'>"
                f"{r['bu']}</div></td>"
                f"<td style='text-align:center'>{z_html}<div style='font-size:9px;color:#9CA3AF;margin-top:2px'>{int(r['zomato_count']):,}</div></td>"
                f"<td style='text-align:center'>{s_html}<div style='font-size:9px;color:#9CA3AF;margin-top:2px'>{int(r['swiggy_count']):,}</div></td>"
                f"<td style='text-align:center'>{gap_html}</td></tr>"
            )
        st.markdown(f"<table class='cf-tbl'><tr><th class='left'>Brand</th>"
                    f"<th style='color:#DC2626'>Zomato</th><th style='color:#F97316'>Swiggy</th>"
                    f"<th>Gap</th></tr>{rows_html}</table>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)


# ─── GEOGRAPHY TAB ───
with tab_geo:
    sub_tabs = st.tabs(["🗺️ Zone × Brand", "🔴 Brand × City (Zomato)", "🟠 Brand × City (Swiggy)"])

    with sub_tabs[0]:
        st.markdown("<div class='cf-section'><h3>Zone × Brand Rating Matrix</h3>"
                    "<div class='desc'>Combined Zomato + Swiggy</div>", unsafe_allow_html=True)
        st.markdown(
            "<div style='font-size:11px;color:#6B7280;margin-bottom:10px'>"
            "<span style='background:#DCFCE7;color:#15803D;padding:2px 8px;border-radius:4px;font-weight:700;margin-right:6px'>■ ≥4.06</span>"
            "<span style='background:#FEF9C3;color:#A16207;padding:2px 8px;border-radius:4px;font-weight:700;margin-right:6px'>■ 4.00–4.05</span>"
            "<span style='background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:4px;font-weight:700'>■ ≤3.99</span></div>",
            unsafe_allow_html=True)

        zbm = zone_brand_matrix(df)
        if not zbm["brands"]:
            st.info("Not enough data.")
        else:
            brands = zbm["brands"]
            header = "<tr><th class='left'>Location</th>" + "".join(
                f"<th>{b}<div style='color:#9CA3AF;font-size:9px;font-weight:400'>"
                f"{master[master['brand_short']==b]['bu'].iloc[0] if (master['brand_short']==b).any() else ''}</div></th>"
                for b in brands
            ) + "<th>Total</th></tr>"
            body = ""
            for z in zbm["zones"]:
                zt = zbm["zone_totals"][z]
                if zt["count"] == 0:
                    continue
                cells = "".join(f"<td style='text-align:center'>{fmt_cell(zbm['matrix'][z].get(b))}</td>" for b in brands)
                body += (f"<tr><td class='label'>{z}<div style='color:#6B7280;font-size:9px;font-weight:400'>"
                         f"{zt['count']:,} fb</div></td>{cells}"
                         f"<td style='text-align:center'>{fmt_cell(zt['avg'])}</td></tr>")
            grand_cells = "".join(f"<td style='text-align:center'>{fmt_cell(zbm['brand_totals'][b]['avg'])}</td>" for b in brands)
            grand_cells += f"<td style='text-align:center'>{fmt_cell(zbm['grand'][0])}</td>"
            body += (f"<tr style='border-top:2px solid #E5E7EB'>"
                     f"<td class='label' style='background:#F3F4F6'>Grand Total"
                     f"<div style='color:#6B7280;font-size:9px;font-weight:400'>{zbm['grand'][1]:,} fb</div></td>"
                     f"{grand_cells}</tr>")
            st.markdown(f"<div style='overflow-x:auto'><table class='cf-tbl'>{header}{body}</table></div>",
                        unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    def render_brand_city_subtab(platform, color):
        st.markdown(f"<div class='cf-section'><h3 style='color:{color}'>Brand × City — {platform}</h3>"
                    f"<div class='desc'>Top 20 cities by feedback volume</div>", unsafe_allow_html=True)
        bcm = brand_city_matrix(df, platform)
        if not bcm["brands"]:
            st.info(f"No {platform} data after filters.")
            st.markdown("</div>", unsafe_allow_html=True)
            return
        cities = bcm["cities"][:20]
        brands = bcm["brands"]
        header = "<tr><th class='left'>Brand</th>" + "".join(f"<th>{city.upper()[:8]}</th>" for city in cities) + "</tr>"
        body = ""
        for brand in brands:
            cells = "".join(f"<td style='text-align:center'>{fmt_cell(bcm['matrix'].get(brand, {}).get(city))}</td>" for city in cities)
            body += f"<tr><td class='label'>{brand}</td>{cells}</tr>"
        st.markdown(f"<div style='overflow-x:auto'><table class='cf-tbl'>{header}{body}</table></div>",
                    unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    with sub_tabs[1]:
        render_brand_city_subtab("Zomato", "#DC2626")
    with sub_tabs[2]:
        render_brand_city_subtab("Swiggy", "#F97316")


# ─── SENTIMENT & COMMENTS TAB ───
with tab_sentiment:
    st.markdown("<div class='cf-section'><h3 style='color:#7C3AED'>Customer Sentiment by Brand</h3>"
                "<div class='desc'>1-3★ = Negative · 4-5★ = Positive · sorted by feedback volume</div>",
                unsafe_allow_html=True)
    sent = brand_sentiment(df)
    if not sent:
        st.info("Not enough data.")
    else:
        rows = ""
        for s in sent:
            ac = rating_color(s["avg"])
            neg_w = max(s["neg_pct"], 2); pos_w = max(s["pos_pct"], 2)
            rows += (
                f"<tr>"
                f"<td class='label'>{s['brand']}<div style='color:{s['color']};font-size:10px;font-weight:600'>{s['bu']}</div></td>"
                f"<td style='text-align:center;font-weight:800;font-size:14px'>{s['total']:,}</td>"
                f"<td style='text-align:center'><span class='cf-pill' style='background:{ac['bg']};"
                f"color:{ac['text']};border:1px solid {ac['border']}'>{s['avg']:.2f}</span></td>"
                f"<td><div class='cf-bar-bg'><div class='cf-bar' style='background:#F87171;width:{neg_w}%'></div></div>"
                f"<span style='margin-left:8px;font-weight:700;color:#DC2626'>{s['neg_pct']}%</span> "
                f"<span style='color:#9CA3AF;font-size:10px'>({s['negative']:,})</span></td>"
                f"<td><div class='cf-bar-bg pos'><div class='cf-bar' style='background:#4ADE80;width:{pos_w}%'></div></div>"
                f"<span style='margin-left:8px;font-weight:700;color:#15803D'>{s['pos_pct']}%</span> "
                f"<span style='color:#9CA3AF;font-size:10px'>({s['positive']:,})</span></td></tr>")
        st.markdown("<table class='cf-tbl' style='font-size:13px'>"
                    "<tr><th class='left'>Brand</th><th>Feedbacks</th><th>Avg Rating</th>"
                    "<th class='left'>Negative (1-3★)</th><th class='left'>Positive (4-5★)</th></tr>"
                    f"{rows}</table>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<div class='cf-section'><h3 style='color:#DC2626'>Customer Comments — 1★ 2★ 3★</h3>"
                "<div class='desc'>Grouped by brand · first 80 low-rating feedbacks</div>",
                unsafe_allow_html=True)
    comments = low_rating_comments(df, limit=80)
    total_low = ((df["rating"] <= 3) & (df["comment"].astype(str).str.len() > 0) & (df["comment"].astype(str) != "nan")).sum()
    if not comments:
        st.success("✅ No negative comments in the current filter range.")
    else:
        st.caption(f"{total_low:,} low-rating feedbacks total · showing first {len(comments)}")
        rows = ""; last_brand = None
        for cmt in comments:
            if cmt["brand_short"] != last_brand:
                count = sum(1 for x in comments if x["brand_short"] == cmt["brand_short"])
                rows += (f"<tr><td colspan='7' style='padding:10px 8px;background:#F9FAFB;border-bottom:1px solid #E5E7EB'>"
                         f"<span class='cf-bu-badge' style='background:{cmt['brand_color']}22;"
                         f"color:{cmt['brand_color']}'>{cmt['brand_short']}</span>"
                         f"<span style='color:#6B7280;font-size:11px;margin-left:8px'>"
                         f"{count} negative feedbacks</span></td></tr>")
                last_brand = cmt["brand_short"]
            r = int(cmt["rating"])
            sc = "#DC2626" if r == 1 else "#D97706" if r == 2 else "#CA8A04"
            sbg = "#FEE2E2" if r == 1 else "#FEF3C7" if r == 2 else "#FEF9C3"
            comment = (str(cmt["comment"]) or "").replace("<", "&lt;").replace(">", "&gt;")
            item = (str(cmt.get("item", "")) or "")[:60]
            date_str = cmt["date"].strftime("%Y-%m-%d") if pd.notna(cmt.get("date")) else ""
            rows += (f"<tr><td><span class='cf-pill' style='background:{sbg};color:{sc};"
                     f"border:1px solid {sc}33'>{r}★</span></td>"
                     f"<td><span class='cf-bu-badge' style='background:{cmt['brand_color']}22;"
                     f"color:{cmt['brand_color']}'>{cmt['brand_short']}</span></td>"
                     f"<td style='color:#6B7280;font-size:11px'>{cmt['zone']}</td>"
                     f"<td style='color:#6B7280;font-size:11px'>{cmt.get('area','')}, {cmt['city']}</td>"
                     f"<td style='color:#6B7280;font-size:11px;font-family:monospace'>{date_str}</td>"
                     f"<td style='color:#6B7280;font-size:11px;max-width:160px'>{item}</td>"
                     f"<td style='color:#111827;font-size:12px;line-height:1.5;max-width:400px'>{comment}</td></tr>")
        st.markdown("<table class='cf-tbl' style='font-size:12px'>"
                    "<tr><th>Rating</th><th>Brand</th><th>Zone</th><th class='left'>Location</th>"
                    "<th>Date</th><th class='left'>Item</th><th class='left'>Comment</th></tr>"
                    f"{rows}</table>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)


# ─── SKU INSIGHTS TAB ───
with tab_insights:
    st.markdown("<div class='cf-section'><h3 style='color:#7C3AED'>Rating Impact Insights</h3>"
                "<div class='desc'>Per (brand × city), what happens if you fix or promote the most influential SKU</div>",
                unsafe_allow_html=True)
    insights = sku_impact_insights(df)
    if not insights:
        st.info("No SKU-level impact insights — need more per-SKU feedback per city.")
    else:
        by_brand = {}
        for i in insights:
            by_brand.setdefault(i["brand"], []).append(i)
        for brand in sorted(by_brand.keys()):
            ins = by_brand[brand][:5]
            bu_series = master[master["brand_short"] == brand]["bu"]
            bu = bu_series.iloc[0] if len(bu_series) else "Other"
            bc = BU_COLORS.get(bu, "#6B7280")
            rows = ""
            for i in ins:
                imp_color = "#DC2626" if i["impact"] >= 0.2 else "#D97706" if i["impact"] >= 0.1 else "#6B7280"
                arrow = "🔧 Fix" if i["type"] == "fix_worst_sku" else "📢 Promote"
                badge = ""
                if i["threshold_note"] == "crosses-green":
                    badge = "<span style='background:#DCFCE7;color:#15803D;border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px'>↑ Crosses 4.06</span>"
                elif i["threshold_note"] == "crosses-yellow":
                    badge = "<span style='background:#FEF9C3;color:#A16207;border-radius:3px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px'>↑ Crosses 4.00</span>"
                sku_text = (i["sku"][:55] + "…") if len(i["sku"]) > 55 else i["sku"]
                rows += (f"<tr><td class='label'>{i['city']}<div style='color:#6B7280;font-size:9px;font-weight:400'>"
                         f"{i['city_count']} feedbacks</div></td>"
                         f"<td style='text-align:center'>{fmt_cell(i['current'])}</td>"
                         f"<td style='text-align:center;color:{imp_color};font-weight:800'>+{i['impact']:.2f}★</td>"
                         f"<td style='text-align:center'>{fmt_cell(i['after'])}{badge}</td>"
                         f"<td style='color:#6B7280;font-size:11px;max-width:340px'>"
                         f"<span style='font-weight:600;color:#111827'>{arrow}:</span> {sku_text}"
                         f"<div style='color:#9CA3AF;font-size:9px;margin-top:2px'>"
                         f"Currently {i['sku_avg']:.2f}★ · {i['sku_count']} feedbacks</div></td></tr>")
            st.markdown(f"<div style='background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;"
                        f"overflow:hidden;margin-bottom:14px'>"
                        f"<div style='padding:12px 16px;border-bottom:1px solid #E5E7EB'>"
                        f"<span style='font-weight:800;font-size:14px'>{brand}</span> "
                        f"<span class='cf-bu-badge' style='background:{bc}22;color:{bc};margin-left:8px'>{bu}</span></div>"
                        f"<table class='cf-tbl'>"
                        f"<tr><th class='left'>City</th><th>Current</th><th>Impact</th>"
                        f"<th>After Fix</th><th class='left'>Action Required</th></tr>"
                        f"{rows}</table></div>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)


# ─── LOAD REPORT TAB ───
with tab_loadlog:
    st.markdown("<div class='cf-section'><h3 style='color:#6366F1'>Per-file load report</h3>"
                "<div class='desc'>Status for every uploaded file. Open Details to see the row-by-row funnel and any unmapped brands / cities.</div>",
                unsafe_allow_html=True)
    all_diags = (zomato_diags or []) + (swiggy_diags or [])
    if not all_diags:
        st.info("No files loaded.")
    else:
        for d in all_diags:
            render_diagnostics(d)
    st.markdown("</div>", unsafe_allow_html=True)
