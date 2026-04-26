# =============================================================
# CUREFOODS Dashboard — Data processing
# Read raw xlsx/csv/zip → normalised dataframe.
# Supports multi-file uploads (combine N Zomato files into one).
# =============================================================
import io
import re
import zipfile
import pandas as pd
import numpy as np
from collections import defaultdict
from config import (
    BRAND_MAP, CITY_ZONE, ZONES, BU_ORDER, BU_COLORS,
    COLUMN_ALIASES, get_zone, get_brand_info,
)

REQUIRED_FIELDS = ["brand", "city", "order", "rating"]
OPTIONAL_FIELDS = ["area", "comment", "item", "date", "status"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

_SKIP_SHEETS = {"zone", "city zone", "city-zone", "mapping", "mappings", "brand mapping",
                "brand-mapping", "reference", "ref", "index", "summary", "config",
                "instructions", "readme", "lookup", "key", "legend"}


# ---------------------------------------------------------------
# File handling — also unwraps zips containing a single csv/xlsx
# ---------------------------------------------------------------
def _unwrap_if_zip(file_obj):
    """If file_obj is a .zip, extract the first csv/xlsx inside it
    and return a (BytesIO, name) for that inner file. Otherwise pass through."""
    name = getattr(file_obj, "name", "uploaded")
    if not name.lower().endswith(".zip"):
        return file_obj, name
    raw = file_obj.read() if hasattr(file_obj, "read") else file_obj
    if hasattr(file_obj, "seek"):
        file_obj.seek(0)
    bio_outer = io.BytesIO(raw)
    with zipfile.ZipFile(bio_outer) as zf:
        # Pick the largest CSV/XLSX inside
        candidates = [
            n for n in zf.namelist()
            if n.lower().endswith((".csv", ".xlsx", ".xls", ".xlsm")) and not n.startswith("__MACOSX")
        ]
        if not candidates:
            return file_obj, name
        candidates.sort(key=lambda n: zf.getinfo(n).file_size, reverse=True)
        inner = candidates[0]
        bio = io.BytesIO(zf.read(inner))
        bio.name = inner.split("/")[-1]
        return bio, bio.name


def peek_file(file_obj):
    """Inspect a file quickly to list sheets / columns. Used for the mapper UI."""
    file_obj, name = _unwrap_if_zip(file_obj)
    name_lower = name.lower()

    try:
        if name_lower.endswith(".csv"):
            df = pd.read_csv(file_obj, nrows=5, encoding_errors="ignore")
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            return {
                "type": "csv",
                "sheets": [{
                    "name": "(csv)", "rows": -1, "cols": len(df.columns),
                    "columns": [str(c) for c in df.columns], "is_data": True,
                }],
                "default_sheet": "(csv)",
            }
        if name_lower.endswith(".tsv"):
            df = pd.read_csv(file_obj, sep="\t", nrows=5, encoding_errors="ignore")
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            return {
                "type": "tsv",
                "sheets": [{
                    "name": "(tsv)", "rows": -1, "cols": len(df.columns),
                    "columns": [str(c) for c in df.columns], "is_data": True,
                }],
                "default_sheet": "(tsv)",
            }

        xls = pd.ExcelFile(file_obj)
        sheets = []
        for s in xls.sheet_names:
            try:
                head = pd.read_excel(xls, sheet_name=s, nrows=1)
                cols = [str(c) for c in head.columns]
                full = pd.read_excel(xls, sheet_name=s, usecols=[0])
                rows = len(full)
            except Exception:
                cols, rows = [], 0
            is_data = (
                len(cols) >= 4 and rows >= 5
                and s.lower().strip() not in _SKIP_SHEETS
            )
            sheets.append({"name": s, "rows": rows, "cols": len(cols),
                           "columns": cols, "is_data": is_data})

        def _score(s):
            base = s["rows"] * s["cols"] if s["is_data"] else -1
            n = s["name"].lower()
            if "rating" in n or "feedback" in n or "review" in n:
                base += 1_000_000
            return base
        ranked = sorted(sheets, key=_score, reverse=True)
        default_sheet = ranked[0]["name"] if ranked else (xls.sheet_names[0] if xls.sheet_names else None)

        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        return {"type": "xlsx", "sheets": sheets, "default_sheet": default_sheet}
    except Exception as e:
        return {"error": f"Could not inspect file: {e}"}


def _auto_detect_columns(df_columns):
    norm = {}
    for std_key, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            for col in df_columns:
                if str(col).strip().lower() == alias.lower():
                    norm[std_key] = col
                    break
            if std_key in norm:
                break
    return norm


# ---------------------------------------------------------------
# Custom date parser — handles Zomato format too
# ---------------------------------------------------------------
def _parse_dates(series):
    """Try a few formats. Zomato uses '12:33 PM, April 03 2026'.
    Swiggy / generic use ISO or 'YYYY-MM-DD HH:MM'.
    Returns a datetime Series.
    """
    if series is None or len(series) == 0:
        return pd.to_datetime(series, errors="coerce")
    s = series.astype(str).str.strip()

    # Zomato format: '12:33 PM, April 03 2026'  →  pandas can parse with explicit format
    out = pd.to_datetime(s, format="%I:%M %p, %B %d %Y", errors="coerce")
    if out.notna().sum() >= len(out) * 0.5:
        return out

    # Generic
    return pd.to_datetime(s, errors="coerce")


# ---------------------------------------------------------------
# Single-file loader
# ---------------------------------------------------------------
def load_file(file_obj, platform_label, sheet_override=None, column_overrides=None):
    """Read one xlsx/csv/zip into a normalised dataframe.

    Returns (df, diagnostics).
    """
    diag = _empty_diag(platform_label)

    if file_obj is None:
        return None, diag

    # unwrap zip if needed
    try:
        file_obj, name = _unwrap_if_zip(file_obj)
    except Exception as e:
        diag["error"] = f"Could not extract zip: {e}"
        return None, diag
    diag["file_name"] = name

    try:
        if name.lower().endswith((".xlsx", ".xlsm", ".xls")):
            xls = pd.ExcelFile(file_obj)
            if sheet_override and sheet_override in xls.sheet_names:
                chosen = sheet_override
            else:
                if hasattr(file_obj, "seek"):
                    file_obj.seek(0)
                p = peek_file(file_obj)
                if hasattr(file_obj, "seek"):
                    file_obj.seek(0)
                xls = pd.ExcelFile(file_obj)
                chosen = p.get("default_sheet") or xls.sheet_names[0]
            diag["sheet"] = chosen
            df = pd.read_excel(xls, sheet_name=chosen)
        elif name.lower().endswith(".csv"):
            df = pd.read_csv(file_obj, encoding_errors="ignore", low_memory=False)
        elif name.lower().endswith(".tsv"):
            df = pd.read_csv(file_obj, sep="\t", encoding_errors="ignore", low_memory=False)
        else:
            df = pd.read_excel(file_obj)
    except Exception as e:
        diag["error"] = f"Could not read {name}: {e}"
        return None, diag

    diag["rows_read"] = len(df)
    diag["raw_columns"] = [str(c) for c in df.columns]

    if df.empty:
        diag["error"] = "File is empty."
        return None, diag

    # Detect columns + apply overrides
    norm = _auto_detect_columns(df.columns)
    if column_overrides:
        for std_key, src_col in column_overrides.items():
            if src_col and src_col in df.columns:
                norm[std_key] = src_col

    diag["detected_columns"] = {k: str(v) for k, v in norm.items()}
    diag["missing_columns"] = [r for r in REQUIRED_FIELDS if r not in norm]
    if diag["missing_columns"]:
        diag["error"] = (
            f"Missing required columns: {', '.join(diag['missing_columns'])}. "
            f"File columns: {', '.join(diag['raw_columns'][:25])}"
        )
        return None, diag

    out = pd.DataFrame()
    out["brand_raw"] = df[norm["brand"]].astype(str).str.strip()
    out["city"]     = df[norm["city"]].astype(str).str.strip()
    out["area"]     = df[norm["area"]].astype(str).str.strip() if "area" in norm else ""
    out["order_id"] = df[norm["order"]].astype(str).str.strip()
    out["item"]     = df[norm["item"]].astype(str).str.strip().str.replace('^"|"$', "", regex=True) if "item" in norm else ""
    out["comment"]  = df[norm["comment"]].astype(str).str.strip().replace({"nan": "", "None": ""}) if "comment" in norm else ""

    out["rating"] = pd.to_numeric(df[norm["rating"]], errors="coerce").fillna(0).astype(float)

    if "date" in norm:
        out["date"] = _parse_dates(df[norm["date"]])
    else:
        out["date"] = pd.NaT

    # Drop cancelled / non-delivered orders if status column is present
    if "status" in norm:
        status_str = df[norm["status"]].astype(str).str.strip().str.lower()
        keep_mask = status_str.isin(["delivered", "complete", "completed", "success", ""])
        if keep_mask.sum() > 0:
            out = out[keep_mask.reset_index(drop=True)].reset_index(drop=True)

    # Required filter: brand, order_id, rating > 0
    out = out[(out["brand_raw"] != "") & (out["order_id"] != "") & (out["rating"] > 0) & (out["rating"] <= 5)].copy()
    diag["rows_after_required"] = len(out)

    # Brand mapping
    brand_info = out["brand_raw"].apply(get_brand_info)
    out["brand_short"] = brand_info.apply(lambda x: x["short"] if x else "")
    out["bu"]          = brand_info.apply(lambda x: x["bu"]    if x else "")
    out["brand_color"] = brand_info.apply(lambda x: x["color"] if x else "#6B7280")

    unmapped_mask = out["bu"] == "Other"
    if unmapped_mask.any():
        unmapped = out.loc[unmapped_mask, "brand_raw"].value_counts().head(15)
        diag["unmapped_brands"] = [(b, int(c)) for b, c in unmapped.items()]

    out = out[~unmapped_mask].copy()
    diag["rows_after_brand_map"] = len(out)

    # Zone mapping
    out["zone"] = out["city"].apply(get_zone)
    unknown_zones = out[out["zone"] == "Unknown"]
    if not unknown_zones.empty:
        uc = unknown_zones["city"].value_counts().head(15)
        diag["unmapped_cities"] = [(c, int(n)) for c, n in uc.items()]
    out = out[out["zone"] != "Unknown"].copy()
    diag["rows_after_zone_map"] = len(out)

    out["platform"] = platform_label
    out["source_file"] = name

    # Dedup: one row per (platform, order_id) — keep highest rating + longest comment
    out["_clen"] = out["comment"].str.len()
    out = (out.sort_values(by=["rating", "_clen"], ascending=[False, False])
              .drop_duplicates(subset=["platform", "order_id"], keep="first")
              .drop(columns=["_clen"])
              .reset_index(drop=True))
    diag["rows_final"] = len(out)

    if len(out) == 0 and not diag["error"]:
        diag["error"] = "0 rows survived after filtering. Check unmapped brands / cities below."

    return out, diag


def load_files_combined(file_objs, platform_label, sheet_overrides=None, column_overrides=None):
    """Load N files for the same platform, concat into one dataframe.

    sheet_overrides:   {file_name: sheet_name}    (optional, per-file)
    column_overrides:  {file_name: {field: col}}  (optional, per-file)

    Returns (combined_df_or_None, list_of_diagnostics).
    """
    sheet_overrides = sheet_overrides or {}
    column_overrides = column_overrides or {}
    parts = []
    diags = []
    seen_orders = set()

    for f in (file_objs or []):
        nm = getattr(f, "name", "uploaded")
        df, d = load_file(
            f, platform_label,
            sheet_override=sheet_overrides.get(nm),
            column_overrides=column_overrides.get(nm),
        )
        diags.append(d)
        if df is not None and not df.empty:
            # Guard: don't re-add order_ids we've already seen across other files
            mask = ~df["order_id"].isin(seen_orders)
            if mask.sum() > 0:
                df = df[mask].copy()
                seen_orders.update(df["order_id"].tolist())
                parts.append(df)

    if not parts:
        return None, diags
    combined = pd.concat(parts, ignore_index=True)
    return combined, diags


def _empty_diag(platform):
    return {
        "platform": platform,
        "file_name": None, "sheet": None,
        "rows_read": 0,
        "raw_columns": [],
        "detected_columns": {},
        "missing_columns": [],
        "rows_after_required": 0,
        "rows_after_brand_map": 0,
        "rows_after_zone_map": 0,
        "rows_final": 0,
        "unmapped_brands": [],
        "unmapped_cities": [],
        "error": None,
    }


def combine(zomato_df, swiggy_df):
    parts = []
    if zomato_df is not None and not zomato_df.empty:
        parts.append(zomato_df)
    if swiggy_df is not None and not swiggy_df.empty:
        parts.append(swiggy_df)
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, ignore_index=True)


# ---------------------------------------------------------------
# Filtering
# ---------------------------------------------------------------
def apply_filters(df, brands=None, zones=None, date_range=None):
    if df is None or df.empty:
        return df
    out = df
    if brands:
        out = out[out["brand_short"].isin(brands)]
    if zones:
        out = out[out["zone"].isin(zones)]
    if date_range and len(date_range) == 2:
        start, end = date_range
        out = out[(out["date"] >= pd.Timestamp(start)) & (out["date"] <= pd.Timestamp(end) + pd.Timedelta(days=1))]
    return out.reset_index(drop=True)


# ---------------------------------------------------------------
# Aggregations
# ---------------------------------------------------------------
def kpi_summary(df):
    if df is None or df.empty:
        return {"overall": {"avg": 0, "count": 0}, "by_bu": {}}
    overall = {"avg": float(df["rating"].mean()), "count": int(len(df))}
    by_bu = {}
    for bu, g in df.groupby("bu"):
        by_bu[bu] = {"avg": float(g["rating"].mean()), "count": int(len(g))}
    return {"overall": overall, "by_bu": by_bu}


def brand_ratings_compare(df):
    if df is None or df.empty:
        return pd.DataFrame()
    rows = []
    for brand, g in df.groupby("brand_short"):
        z = g[g["platform"] == "Zomato"]["rating"]
        s = g[g["platform"] == "Swiggy"]["rating"]
        bu = g["bu"].iloc[0]
        z_avg = float(z.mean()) if len(z) > 0 else None
        s_avg = float(s.mean()) if len(s) > 0 else None
        gap_label, gap_value = "—", None
        if z_avg is not None and s_avg is not None:
            diff = z_avg - s_avg
            gap_value = abs(diff)
            if abs(diff) < 0.005:
                gap_label = "0.00"
            elif diff > 0:
                gap_label = f"Z +{diff:.2f}"
            else:
                gap_label = f"S +{abs(diff):.2f}"
        rows.append({
            "brand": brand, "bu": bu,
            "zomato": z_avg, "swiggy": s_avg,
            "gap_label": gap_label, "gap_value": gap_value,
            "zomato_count": int(len(z)), "swiggy_count": int(len(s)),
        })
    out = pd.DataFrame(rows).sort_values(by=["bu", "brand"], key=lambda c: c.map(BU_ORDER) if c.name == "bu" else c)
    return out.reset_index(drop=True)


def brand_city_matrix(df, platform):
    if df is None or df.empty:
        return {"matrix": {}, "cities": [], "brands": []}
    sub = df[df["platform"] == platform]
    if sub.empty:
        return {"matrix": {}, "cities": [], "brands": []}
    matrix = defaultdict(dict)
    counts = defaultdict(dict)
    for (brand, city), g in sub.groupby(["brand_short", "city"]):
        if not city:
            continue
        matrix[brand][city] = float(g["rating"].mean())
        counts[brand][city] = int(len(g))
    city_totals = sub.groupby("city").size().to_dict()
    cities = sorted(city_totals.keys(), key=lambda c: (-city_totals[c], c))
    brands = sorted(matrix.keys(), key=lambda b: (BU_ORDER.get(_brand_bu(sub, b), 9), b))
    return {"matrix": matrix, "counts": counts, "cities": cities, "brands": brands}


def _brand_bu(df, brand):
    bu_series = df[df["brand_short"] == brand]["bu"]
    return bu_series.iloc[0] if len(bu_series) else "Other"


def zone_brand_matrix(df):
    if df is None or df.empty:
        return {"matrix": {}, "zones": [], "brands": [], "zone_totals": {}, "brand_totals": {}, "grand": (0, 0)}
    matrix = {z: {} for z in ZONES}
    counts = {z: {} for z in ZONES}
    for (zone, brand), g in df.groupby(["zone", "brand_short"]):
        if zone in matrix:
            matrix[zone][brand] = float(g["rating"].mean())
            counts[zone][brand] = int(len(g))
    brands = sorted(df["brand_short"].unique(), key=lambda b: (BU_ORDER.get(_brand_bu(df, b), 9), b))
    zone_totals = {}
    for z in ZONES:
        sub = df[df["zone"] == z]
        zone_totals[z] = {"avg": float(sub["rating"].mean()) if len(sub) else 0, "count": int(len(sub))}
    brand_totals = {}
    for b in brands:
        sub = df[df["brand_short"] == b]
        brand_totals[b] = {"avg": float(sub["rating"].mean()) if len(sub) else 0, "count": int(len(sub))}
    grand = (float(df["rating"].mean()) if len(df) else 0, int(len(df)))
    return {"matrix": matrix, "counts": counts, "zones": ZONES, "brands": brands,
            "zone_totals": zone_totals, "brand_totals": brand_totals, "grand": grand}


def brand_sentiment(df, min_feedbacks=3):
    if df is None or df.empty:
        return []
    out = []
    for brand, g in df.groupby("brand_short"):
        total = len(g)
        if total < min_feedbacks:
            continue
        neg = int((g["rating"] <= 3).sum())
        pos = int((g["rating"] >= 4).sum())
        bu = g["bu"].iloc[0]
        out.append({
            "brand": brand, "bu": bu, "color": BU_COLORS.get(bu, "#6B7280"),
            "total": total, "negative": neg, "positive": pos,
            "neg_pct": round(neg / total * 100) if total else 0,
            "pos_pct": round(pos / total * 100) if total else 0,
            "avg": float(g["rating"].mean()),
        })
    return sorted(out, key=lambda x: -x["total"])


def low_rating_comments(df, limit=80):
    if df is None or df.empty:
        return []
    sub = df[(df["rating"] <= 3) & (df["comment"].astype(str).str.len() > 0) & (df["comment"].astype(str) != "nan")].copy()
    if sub.empty:
        return []
    sub["bu_order"] = sub["bu"].map(BU_ORDER).fillna(9)
    sub = sub.sort_values(by=["bu_order", "brand_short", "rating", "date"], ascending=[True, True, True, False])
    return sub.head(limit).to_dict(orient="records")


def sku_impact_insights(df, min_city_fb=10, min_sku_fb=3, min_impact=0.05, top_n=40):
    if df is None or df.empty:
        return []
    insights = []
    for brand, gb in df.groupby("brand_short"):
        bt_count = int(len(gb))
        if bt_count == 0:
            continue
        for city, gc in gb.groupby("city"):
            cm_count = int(len(gc))
            if cm_count < min_city_fb:
                continue
            city_avg = float(gc["rating"].mean())
            city_sum = float(gc["rating"].sum())
            sku_stats = []
            for sku, gs in gb.groupby("item"):
                if not sku or len(gs) < min_sku_fb:
                    continue
                sku_stats.append({"name": sku, "avg": float(gs["rating"].mean()), "count": int(len(gs))})
            if len(sku_stats) < 2:
                continue
            sku_stats.sort(key=lambda x: x["avg"])
            worst = sku_stats[0]
            sku_weight = worst["count"] / bt_count
            est_worst_in_city = max(1, round(cm_count * sku_weight))
            new_count = cm_count - est_worst_in_city
            new_sum = city_sum - worst["avg"] * est_worst_in_city
            new_avg = new_sum / new_count if new_count > 0 else city_avg
            impact = new_avg - city_avg
            if impact >= min_impact:
                threshold_note = ""
                if city_avg < 4.06 and new_avg >= 4.06:
                    threshold_note = "crosses-green"
                elif city_avg < 4.00 and new_avg >= 4.00:
                    threshold_note = "crosses-yellow"
                insights.append({
                    "brand": brand, "city": city,
                    "current": round(city_avg, 2),
                    "after": round(new_avg, 2),
                    "impact": round(impact, 2),
                    "sku": worst["name"],
                    "sku_avg": round(worst["avg"], 2),
                    "sku_count": worst["count"],
                    "city_count": cm_count,
                    "threshold_note": threshold_note,
                    "type": "fix_worst_sku",
                })
            best = sku_stats[-1]
            if best["avg"] > city_avg + 0.3 and best["count"] >= 5:
                pw = best["count"] / bt_count
                est_best_in_city = max(1, round(cm_count * pw))
                new_c2 = cm_count + est_best_in_city
                new_s2 = city_sum + best["avg"] * est_best_in_city
                new_a2 = new_s2 / new_c2 if new_c2 > 0 else city_avg
                impact2 = new_a2 - city_avg
                if impact2 >= min_impact:
                    insights.append({
                        "brand": brand, "city": city,
                        "current": round(city_avg, 2),
                        "after": round(new_a2, 2),
                        "impact": round(impact2, 2),
                        "sku": best["name"],
                        "sku_avg": round(best["avg"], 2),
                        "sku_count": best["count"],
                        "city_count": cm_count,
                        "threshold_note": "",
                        "type": "promote_best_sku",
                    })
    priority = [i for i in insights if i["threshold_note"]]
    rest = [i for i in insights if not i["threshold_note"]]
    priority.sort(key=lambda x: -x["impact"])
    rest.sort(key=lambda x: -x["impact"])
    return (priority + rest)[:top_n]


def top_bottom_skus(df, top_min=20, bottom_min=10, n=5):
    if df is None or df.empty:
        return {}, {}
    top_skus, bot_skus = {}, {}
    for brand, gb in df.groupby("brand_short"):
        stats = []
        for sku, gs in gb.groupby("item"):
            if not sku:
                continue
            stats.append({"name": sku, "avg": float(gs["rating"].mean()), "count": int(len(gs))})
        top_skus[brand] = sorted([s for s in stats if s["count"] >= top_min], key=lambda x: -x["avg"])[:n]
        bot_skus[brand] = sorted([s for s in stats if s["count"] >= bottom_min], key=lambda x: x["avg"])[:n]
    return top_skus, bot_skus
