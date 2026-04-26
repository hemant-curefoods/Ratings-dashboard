# =============================================================
# CUREFOODS Dashboard — Configuration
# Brand mappings, city → zone, color thresholds, smart matchers
# =============================================================
import re

# ---- Canonical brand mapping: full name → short code, BU, color ----
# Keys are the "official" brand names. The matcher below also handles
# variations (case, whitespace, taglines, dashes, leading spaces).
BRAND_MAP = {
    # Dessert
    "CakeZone":                                          {"short": "CZ",     "bu": "Dessert", "color": "#EC4899"},
    "The Dessert Heaven Pure Veg":                       {"short": "TDH",    "bu": "Dessert", "color": "#EC4899"},
    "The Dessert Heaven":                                {"short": "TDH",    "bu": "Dessert", "color": "#EC4899"},
    "Ovenfresh Cakes and Desserts":                      {"short": "OF",     "bu": "Dessert", "color": "#EC4899"},
    "Ovenfresh":                                         {"short": "OF",     "bu": "Dessert", "color": "#EC4899"},
    "Krispy Kreme":                                      {"short": "KK",     "bu": "Dessert", "color": "#EC4899"},
    "Papacream":                                         {"short": "Papa",   "bu": "Dessert", "color": "#EC4899"},
    "Made in Oven":                                      {"short": "MIO",    "bu": "Dessert", "color": "#EC4899"},
    "Ksheer Sagar":                                      {"short": "Ksheer", "bu": "Dessert", "color": "#EC4899"},

    # Pizza
    "Crusto's":                                          {"short": "Crusto", "bu": "Pizza",   "color": "#F97316"},
    "Olio":                                              {"short": "Olio",   "bu": "Pizza",   "color": "#F97316"},
    "99 Slice by Olio":                                  {"short": "99Slice","bu": "Pizza",   "color": "#F97316"},
    "Junos Pizza":                                       {"short": "Junos",  "bu": "Pizza",   "color": "#F97316"},
    "POMP":                                              {"short": "POMP",   "bu": "Pizza",   "color": "#F97316"},

    # Burger
    "Phat Burger":                                       {"short": "PHAT",   "bu": "Burger",  "color": "#EAB308"},
    "PHAT":                                              {"short": "PHAT",   "bu": "Burger",  "color": "#EAB308"},
    "HRX Rolls and Wraps":                               {"short": "HRX",    "bu": "Burger",  "color": "#EAB308"},
    "HRX Rolls & Wraps":                                 {"short": "HRX",    "bu": "Burger",  "color": "#EAB308"},
    "Rolls & Wraps by HRX":                              {"short": "HRX",    "bu": "Burger",  "color": "#EAB308"},
    "Rolls On Wheels":                                   {"short": "ROW",    "bu": "Burger",  "color": "#EAB308"},
    "Roz Shawarma":                                      {"short": "Roz",    "bu": "Burger",  "color": "#EAB308"},

    # Indian
    "EatFit":                                            {"short": "EF",     "bu": "Indian",  "color": "#10B981"},
    "Veg Meals by EatFit":                               {"short": "EF",     "bu": "Indian",  "color": "#10B981"},
    "HRX by EatFit":                                     {"short": "HRX-EF", "bu": "Indian",  "color": "#10B981"},
    "Great Indian Khichdi by EatFit":                    {"short": "GIK",    "bu": "Indian",  "color": "#10B981"},
    "Home Plate by EatFit":                              {"short": "HP",     "bu": "Indian",  "color": "#10B981"},
    "Ghar ka Khana by EatFit":                           {"short": "Ghar",   "bu": "Indian",  "color": "#10B981"},
    "Chaat Street":                                      {"short": "CS",     "bu": "Indian",  "color": "#10B981"},
    "Canteen Central":                                   {"short": "CC",     "bu": "Indian",  "color": "#10B981"},
    "Madras Curd Rice Company":                          {"short": "MCRC",   "bu": "Indian",  "color": "#10B981"},
    "Arambam":                                           {"short": "Arambam","bu": "Indian",  "color": "#10B981"},
    "Sharief Bhai":                                      {"short": "Sharief","bu": "Indian",  "color": "#10B981"},
    "Millet Express":                                    {"short": "Millet", "bu": "Indian",  "color": "#10B981"},
}


# ---- City → Zone ----
CITY_ZONE = {
    "Bangalore": "South", "Bengaluru": "South",
    "Mumbai": "West",
    "Hyderabad": "South",
    "Chennai": "South",
    "Chandigarh": "North",
    "Delhi": "North", "Delhi NCR": "North", "New Delhi": "North", "Delhi-NCR": "North",
    "Pune": "West",
    "Gurgaon": "North", "Gurugram": "North",
    "Surat": "West",
    "Nashik": "West",
    "Coimbatore": "South",
    "Vadodara": "West",
    "Vijayawada": "South",
    "Noida 1": "North", "Noida": "North", "Greater Noida": "North",
    "Jaipur": "North",
    "Kolkata": "East",
    "Guntur": "South",
    "Kakinada": "South",
    "Trichy": "South",
    "Guwahati": "East",
    "Ahmedabad": "West",
    "Mysore": "South", "Mysuru": "South",
    "Mangaluru": "South", "Mangalore": "South",
    "Kurnool": "South",
    "Vizag": "South", "Visakhapatnam": "South",
    "Dharwad": "South",
    "Anantapur": "South",
    "Lucknow": "North",
    "Nagpur": "West",
    "Nellore": "South",
    "Erode": "South",
    "Rajahmundry": "South",
    "Faridabad": "North",
    "Tirupati": "South",
    "Thrissur": "South",
    "Salem": "South",
    "Dehradun": "North",
    "Hubli": "South",
    "Aurangabad": "West",
    "Madurai": "South",
    "Tirupur": "South", "Tiruppur": "South",
    "Ludhiana": "North",
    "Warangal": "South",
    "Indore": "Central",
    "Udupi": "South",
    "Talwandi": "North",
    "Janta Nagar": "East",
    "Lalpur": "East",
    "Siliguri": "East",
    "Kota": "North",
    "Ranchi": "East",
    "Manipal": "South",
    "Bhopal": "Central",
    "Gwalior": "Central",
    "Amritsar": "North",
    "Patiala": "North",
    "Kochi": "South", "Cochin": "South",
    "Pondicherry": "South", "Puducherry": "South",
    "Tumakuru": "South", "Tumkur": "South",
    "Central Goa": "West", "Goa": "West", "North Goa": "West", "South Goa": "West", "Panaji": "West",
    "Vellore": "South",
    "Patna": "North",
    "Raipur": "West",
    "Ooty": "South",
    "Thiruvananthapuram": "South", "Trivandrum": "South",
    "Bhubaneswar": "East",
    "Kozhikode": "South", "Calicut": "South",
    "Cuttack": "East",
    "Hosur": "South",
    "Palakkad": "South",
    "Belgaum": "South", "Belagavi": "South",
}

ZONES = ["North", "South", "East", "West", "Central"]
BU_ORDER = {"Dessert": 1, "Pizza": 2, "Burger": 3, "Indian": 4}
BU_COLORS = {"Dessert": "#EC4899", "Pizza": "#F97316", "Burger": "#EAB308", "Indian": "#10B981"}


# ---- Column aliases (Zomato + Swiggy formats) ----
COLUMN_ALIASES = {
    "brand":   ["brand_name", "Brand Name", "brand", "Brand", "Restaurant Name", "Restaurant name",
                "restaurant_name", "Outlet Name", "outlet_name", "RES_NAME", "res_name"],
    "city":    ["city", "City", "city_name", "City Name"],
    "area":    ["area", "Area", "locality", "Locality", "sub_zone", "Sub Zone", "Subzone", "subzone"],
    "order":   ["order_id", "Order ID", "order", "Order_ID", "Order Id", "OrderID",
                "ORDER_ID", "RES_ID_ORDER_ID"],
    "rating":  ["restaurant_rating", "Rating", "rating", "Restaurant Rating", "stars", "Stars",
                "RATING", "review_rating"],
    "comment": ["comments", "Comments", "comment", "Comment", "review", "Review", "review_text",
                "REVIEW", "Review Text", "feedback", "Feedback"],
    "item":    ["item_name", "Item Name", "item", "Item", "dish_name", "Dish Name",
                "ITEM_NAME", "Items", "Items in order"],
    "date":    ["date", "Date", "order_date", "Order Date", "rated_on", "Rated On",
                "DATE", "review_date", "Review Date", "Created At", "created_at",
                "Order Placed At", "order_placed_at"],
    "status":  ["Order Status", "order_status", "status", "Status"],   # used to drop cancelled orders
}


# ============================================================
# Smart brand matcher
# ============================================================
def _fingerprint(s):
    """Aggressive normalisation for brand-name matching.

    Lowercases, removes apostrophes (so "Juno's" matches "Junos"), then
    replaces remaining non-alphanumerics with single spaces and collapses
    runs of whitespace. So 'Olio - The Wood Fired   Pizzeria' →
    'olio the wood fired pizzeria', and 'Juno's Pizza' → 'junos pizza'.
    """
    if not s:
        return ""
    s = str(s).lower()
    s = re.sub(r"['’`´]", "", s)            # drop apostrophes word-internally
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _strip_tagline(s):
    """Cut everything after the first separator that introduces a tagline.

    e.g. 'Krispy Kreme - Doughnuts & Coffee' → 'Krispy Kreme'
         'Arambam – Flavours of South' → 'Arambam'
         'Ksheer Sagar - Banarasi Sweets, Since 1968' → 'Ksheer Sagar'
    """
    if not s:
        return ""
    # split on hyphen, en-dash, em-dash, comma — but only when surrounded by spaces
    # so 'Crusto's' isn't split
    return re.split(r"\s+[-–—,]\s+", str(s).strip(), maxsplit=1)[0].strip()


# Pre-build fingerprint → brand-info lookup for fast O(1) matching
_FP_TO_BRAND = {}
for _name, _info in BRAND_MAP.items():
    _FP_TO_BRAND[_fingerprint(_name)] = _info


def get_brand_info(brand_name):
    """Map a raw brand name to {short, bu, color}.

    Tries (in order):
      1. Exact key match
      2. Fingerprint match (case/whitespace/punct insensitive)
      3. Fingerprint match after stripping tagline
      4. Substring fallback — fingerprinted brand starts with a known fingerprint
    Returns {short, bu='Other', color=grey} if no match — these get filtered out
    of the dashboard but listed in the diagnostics panel.
    """
    if not brand_name:
        return None
    raw = str(brand_name).strip()
    if not raw:
        return None

    # 1. Exact key
    if raw in BRAND_MAP:
        return BRAND_MAP[raw]

    # 2. Fingerprint
    fp = _fingerprint(raw)
    if fp in _FP_TO_BRAND:
        return _FP_TO_BRAND[fp]

    # 3. Tagline-stripped fingerprint
    short_fp = _fingerprint(_strip_tagline(raw))
    if short_fp in _FP_TO_BRAND:
        return _FP_TO_BRAND[short_fp]

    # 4. Starts-with — match longest known brand fingerprint that the input begins with
    candidates = sorted(
        (k for k in _FP_TO_BRAND if fp.startswith(k + " ") or fp == k),
        key=len, reverse=True
    )
    if candidates:
        return _FP_TO_BRAND[candidates[0]]

    # No match — preserve raw name (truncated) for diagnostics
    return {"short": raw[:18], "bu": "Other", "color": "#6B7280"}


# ============================================================
# City matcher
# ============================================================
_CITY_FP = {_fingerprint(c): z for c, z in CITY_ZONE.items()}


def get_zone(city):
    if not city:
        return "Unknown"
    raw = str(city).strip()
    if raw in CITY_ZONE:
        return CITY_ZONE[raw]
    fp = _fingerprint(raw)
    if fp in _CITY_FP:
        return _CITY_FP[fp]
    # last-resort substring
    for c_fp, z in _CITY_FP.items():
        if len(c_fp) >= 5 and (fp == c_fp or fp.startswith(c_fp + " ") or c_fp.startswith(fp + " ")):
            return z
    return "Unknown"


# ============================================================
# Rating cell colors
# ============================================================
def rating_color(value):
    if value is None or value == 0:
        return {"bg": "#F3F4F6", "text": "#9CA3AF", "border": "#E5E7EB"}
    try:
        v = float(value)
    except (TypeError, ValueError):
        return {"bg": "#F3F4F6", "text": "#9CA3AF", "border": "#E5E7EB"}
    if v >= 4.06:
        return {"bg": "#DCFCE7", "text": "#15803D", "border": "#BBF7D0"}
    if v >= 4.00:
        return {"bg": "#FEF9C3", "text": "#A16207", "border": "#FDE68A"}
    if v >= 3.80:
        return {"bg": "#FEF3C7", "text": "#92400E", "border": "#FDE68A"}
    if v >= 3.50:
        return {"bg": "#FEF9C3", "text": "#A16207", "border": "#FDE68A"}
    return {"bg": "#FEE2E2", "text": "#DC2626", "border": "#FECACA"}
