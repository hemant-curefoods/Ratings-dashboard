# Curefoods Rating Dashboard

Interactive web dashboard for the daily Zomato + Swiggy ratings feed.
Upload **any number** of Zomato files and Swiggy files (xlsx, csv, or zip) — the
dashboard combines them, dedupes by `(platform, order_id)`, and slices every
section by **brand**, **zone**, **date**, and **platform**.

## Sections

1. **KPIs** — overall avg + per-BU (Dessert / Pizza / Burger / Indian)
2. **Brand Ratings** — Zomato vs Swiggy with gap column
3. **Brand × City — Zomato**
4. **Brand × City — Swiggy**
5. **Zone × Brand Matrix** (combined)
6. **Customer Sentiment by Brand**
7. **Customer Comments** — first 80 1-3★ comments grouped by brand
8. **Rating Impact Insights** — fix worst SKU per (brand × city), see uplift

## Run it

```bash
pip install -r requirements.txt
streamlit run app.py
```

Opens at <http://localhost:8501>.

## Multi-file uploads

You can upload many files for either platform:
- `Zomato_Apr_part1.xlsx`, `Zomato_Apr_part2.xlsx`, `Zomato_Apr_brand3.csv`...
- `Swiggy_Apr.xlsx`, `Swiggy_May.xlsx`...

The loader concatenates them, then drops duplicates on `(platform, order_id)`
so order rows that appear in multiple files are counted once.

`.zip` files are auto-extracted (the largest CSV / XLSX inside is used).

## Smart matching

**Brand names** are matched via fingerprinting — case, whitespace, punctuation,
apostrophes, and trailing taglines are all ignored. So all of these collapse
to the same brand:

- `Olio - The Wood Fired Pizzeria`
- `Olio The Wood Fired Pizzeria`
- `Olio - The Wood Fired   Pizzeria` (extra spaces)
- ` Olio - The Wood Fired Pizzeria` (leading space)
- `Krispy Kreme - Doughnuts & Coffee` → `Krispy Kreme`
- `Juno's Pizza - Baking Fresh Since 1974` → `Junos Pizza`
- `Arambam – Flavours of South` (en-dash) → `Arambam`

## Custom date parser

Zomato's `12:33 PM, April 03 2026` format is auto-detected.
Swiggy's ISO `2026-04-15` works too.

## Diagnostics — what to do when a file shows 0 rows

The "Load report" panel shows a row-by-row funnel for every file:

```
1. Rows read from file
2. After required cols + rating > 0
3. After brand mapping
4. After zone mapping
5. After dedupe (final)
```

Common causes for rows getting dropped:

| Where rows vanish | Why                                           | Fix                                                                         |
|-------------------|-----------------------------------------------|-----------------------------------------------------------------------------|
| Step 2            | Required columns missing                      | Use the "Column mapping" expander to point each field at the right column   |
| Step 3            | Brand name not in `BRAND_MAP`                 | Add it to `BRAND_MAP` in `config.py`                                        |
| Step 4            | City name not in `CITY_ZONE`                  | Add it to `CITY_ZONE` in `config.py`                                        |

The mapper also lists every unmapped brand and city with their lost row counts.

## File format reference

| Field    | Accepted column names                                                                         |
|----------|-----------------------------------------------------------------------------------------------|
| brand    | `Restaurant name`, `brand_name`, `Brand Name`, `Outlet Name`, `RES_NAME`                      |
| city     | `city`, `City`                                                                                |
| area     | `Subzone`, `area`, `Area`, `Locality`, `sub_zone`                                             |
| order_id | `Order ID`, `order_id`, `OrderID`, `RES_ID_ORDER_ID`                                          |
| rating   | `Rating`, `restaurant_rating`, `stars`, `RATING`                                              |
| comment  | `Review`, `Comments`, `comment`, `feedback`                                                   |
| item     | `Items in order`, `Item Name`, `item_name`, `Dish Name`                                       |
| date     | `Order Placed At`, `date`, `Date`, `order_date`, `Order Date`, `rated_on`                     |
| status   | `Order Status`, `status` (used to drop cancelled / non-delivered orders)                      |

If your file uses a column not listed above, either add it to `COLUMN_ALIASES`
in `config.py` or pick it manually in the dashboard's "Column mapping" expander.

## Files

| File              | Purpose                                                                                    |
|-------------------|--------------------------------------------------------------------------------------------|
| `app.py`          | Streamlit UI — multi-file uploads, mapper, diagnostics, all 8 sections                     |
| `processing.py`   | Loaders, multi-file combiner, dedup, all aggregation functions                             |
| `config.py`       | Brand mappings, city → zone, color thresholds, smart fingerprint matchers                  |
| `requirements.txt`| Pinned deps                                                                                |

## Performance

Smoke-tested against a real 343,665-row Zomato MTD CSV (60 MB):
- Load + parse: **1.5 seconds**
- 41,917 rated rows kept (12% — typical for Zomato; most orders aren't rated)
- 21 brands matched, 0 unmapped cities
