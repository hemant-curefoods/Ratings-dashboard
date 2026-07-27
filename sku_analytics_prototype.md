# Complete Insight Summary & Data Prototype Blueprint

This document details the complete data inventory and structure of the ratings dashboard, grouping all current views and newly planned insights into five core categories. All values are represented in precise raw numbers, percentages, and tables (no visual charts) for operational clarity.

---

## 1. TIME (Time & Volume Analytics)

### 1.1 Weekend vs Weekday Ratings (Current & Enhanced)
Compares rating averages and volumes between workdays (Mon-Fri) and weekends (Sat-Sun).
* **Formula:** `sum(rating) / count` grouped by weekday/weekend.
* **Output Example:**
  | Day Category | Rating Average | Total Orders | Feedback Count | Negative reviews (<3★) |
  | :--- | :--- | :--- | :--- | :--- |
  | Weekday (Mon-Fri) | 4.35★ | 18,500 | 1,850 | 120 |
  | Weekend (Sat-Sun) | 3.88★ | 12,200 | 2,440 | 380 |

### 1.2 Hourly Daypart Split
Aggregates performance by standard operation slots.
* **Output Example:**
  | Daypart | Hours | Rating Average | Total Orders | Feedback Count |
  | :--- | :--- | :--- | :--- | :--- |
  | Breakfast / Morning | 06:00 - 12:00 | 4.42★ | 3,200 | 220 |
  | Lunch / Afternoon | 12:00 - 16:00 | 4.28★ | 9,800 | 780 |
  | Snacks / Evening | 16:00 - 19:00 | 4.30★ | 5,100 | 410 |
  | Dinner / Night | 19:00 - 06:00 | 3.75★ | 12,600 | 2,880 |

### 1.3 Peak Hours (Negative review volume)
Heatmap counts of ratings $\le 2$★ by hour of day.
* **Output Example:**
  | Hour | Count of $\le 2$★ Ratings | Percentage of Total Complaints | Status / Warning |
  | :--- | :--- | :--- | :--- |
  | 20:00 - 21:00 | 148 | 24.6% | 🔴 CRITICAL PEAK |
  | 21:00 - 22:00 | 112 | 18.6% | 🔴 CRITICAL PEAK |
  | 13:00 - 14:00 | 85 | 14.1% | 🟡 WARNING |
  | Other Hours | 255 | 42.7% | 🟢 Normal |

### 1.4 Monthly & Weekly Trends
Month-over-Month (MoM) and Week-over-Week (WoW) averages.
* **Output Example:**
  | Month | Rating Average | Order Volume | MoM Change |
  | :--- | :--- | :--- | :--- |
  | April 2026 | 4.12★ | 28,400 | - |
  | May 2026 | 4.25★ | 30,500 | +0.13★ (+3.1%) |
  | June 2026 | 4.08★ | 29,100 | -0.17★ (-4.0%) |

---

## 2. LOCATION LEVEL RATINGS

### 2.1 Zone Level Performance (Current Matrix Cards & Summary)
* **Output Example (Zone Summary Table):**
  | Zone | Rating Average | Active Outlets | Orders Count | Feedback Count |
  | :--- | :--- | :--- | :--- | :--- |
  | South | 4.45★ | 482 | 12,400 | 1,240 |
  | West | 4.10★ | 315 | 8,900 | 1,320 |
  | North | 3.92★ | 224 | 6,500 | 1,180 |
  | East | 3.80★ | 110 | 2,800 | 580 |

* **Output Example (Zone × Brand Matrix Cards):**
  * 📍 **South Zone** (Average: 4.45★)
    * `[Olio - The Wood Fired Pizzeria: 4.52★]` `[EatFit: 4.38★]` `[Krispy Kreme: 4.60★]`
  * 📍 **East Zone** (Average: 3.80★)
    * `[Olio - The Wood Fired Pizzeria: 3.90★]` `[Home Plate X Ghar ka Khana: 3.65★]`

### 2.2 City Level Performance (Current Matrix Cards & Summary)
* **Output Example (City Summary Table):**
  | City | Zone | Rating Average | Active Outlets | Orders Count |
  | :--- | :--- | :--- | :--- | :--- |
  | Chennai | South | 4.55★ | 142 | 4,200 |
  | Bangalore | South | 4.40★ | 280 | 7,100 |
  | Mumbai | West | 4.12★ | 195 | 5,400 |
  | Delhi | North | 3.85★ | 150 | 4,100 |

### 2.3 Area (Kitchen) Level Performance (Current Matrix Cards & Summary)
* **Output Example (Area Summary Table):**
  | Area | City | Rating Average | Outlets Count | Orders Count |
  | :--- | :--- | :--- | :--- | :--- |
  | Indiranagar | Bangalore | 4.62★ | 8 | 980 |
  | Jayanagar | Bangalore | 4.50★ | 12 | 1,140 |
  | Powai | Mumbai | 3.98★ | 10 | 850 |
  | Karol Bagh | Delhi | 3.20★ | 6 | 420 |

### 2.4 Outlet Level Ratings vs Kitchen Average
Compares individual outlet IDs against the kitchen's average for that specific brand to isolate local operator failure.
* **Output Example:**
  | Outlet ID | Brand | Kitchen / Area | Outlet Rating | Kitchen Avg | Rating Gap | Status |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | 942603 | HRX Rolls and Wraps | Jalahalli-Peenya | 3.80★ | 4.62★ | -0.82★ | ⚠️ Outlier Store |
  | 1122635 | Great Indian Khichdi | Bellandur | 4.75★ | 4.68★ | +0.07★ | 🟢 Normal |

---

## 3. SKUs (Product Performance)

### 3.1 SKU Leaderboard (Top & Bottom Items)
Lists products ranked by average rating (Min 20 reviews).
* **Output Example (Hero SKUs):**
  | Rank | Item Name | Brand | Rating | Total Reviews |
  | :--- | :--- | :--- | :--- | :--- |
  | 1 | Classic Paneer Tikka Wrap | HRX Rolls and Wraps | 4.72★ | 240 |
  | 2 | Homestyle Dal Khichdi | Great Indian Khichdi | 4.68★ | 350 |
  | 3 | Double Chocolate Fudge Cookie | Ovenfresh Cakes and Desserts| 4.65★ | 120 |

* **Output Example (Kill List Candidates):**
  | Rank | Item Name | Brand | Rating | Total Reviews | Primary Keyword |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | 1 | Spicy Chicken Wings | PHAT - Chicken & Burgers | 2.10★ | 55 | Salty |
  | 2 | Loaded Veggie Pizza | Olio - The Wood Fired Pizzeria | 2.45★ | 80 | Soggy |
  | 3 | Paneer Butter Masala Meal | EatFit | 2.80★ | 140 | Portions |

### 3.2 High Volume, Low Rating (Danger SKUs)
* **Output Example:**
  | Item Name | Brand | Order Volume | Rating | Issue Category |
  | :--- | :--- | :--- | :--- | :--- |
  | Paneer Butter Masala Meal | EatFit | 140 | 2.80★ | Portion accuracy |
  | Chocolate Glazed Doughnut | Krispy Kreme | 110 | 3.10★ | Stale quality |

### 3.3 Item Consistency (Rating Variance)
Calculates standard deviation of SKU ratings. Lower standard deviation = high consistency.
* **Output Example:**
  | Item Name | Brand | Rating Avg | Std Dev (Variance) | Quality Consistency |
  | :--- | :--- | :--- | :--- | :--- |
  | Classic Paneer Tikka Wrap | HRX Rolls and Wraps | 4.72★ | 0.32 | 🟢 Extremely Consistent |
  | Spicy Chicken Wings | PHAT - Chicken & Burgers | 2.10★ | 1.48 | 🔴 Highly Inconsistent |

---

## 4. PERFORMANCE & DIAGNOSTICS (AI & Quality)

### 4.1 Brand Level Ratings (Current Website Dashboard Overview)
* **Output Example (Brand Rating Card Summary):**
  | Brand | Average Rating | Active Outlets | Total Orders | Feedback Reviews |
  | :--- | :--- | :--- | :--- | :--- |
  | Olio - The Wood Fired Pizzeria| 4.42★ | 310 | 12,500 | 1,450 |
  | EatFit | 4.38★ | 480 | 15,200 | 1,820 |
  | Krispy Kreme | 4.30★ | 90 | 3,100 | 280 |
  | Home Plate X Ghar ka Khana | 4.25★ | 150 | 5,400 | 720 |
  | HRX Rolls and Wraps | 4.20★ | 240 | 8,900 | 1,100 |

### 4.2 Category Ratings (Current Website Grouping)
* **Output Example:**
  | Product Category | Brands Included | Rating Average | Total Reviews |
  | :--- | :--- | :--- | :--- |
  | Dessert | Cakes/Doughnuts | 4.35★ | 1,820 |
  | Pizza | Olio, Crusto's, POMP | 4.28★ | 2,440 |
  | Burger | PHAT | 4.10★ | 580 |
  | Indian | Eatfit, Khichdi, Rolls | 4.22★ | 4,200 |

### 4.3 Rating Distribution (Current Website Distribution)
Counts of star ratings across selected reviews.
* **Output Example:**
  * `5★`: 18,400 (60.9%)
  * `4★`: 6,200 (20.5%)
  * `3★`: 2,100 (6.9%)
  * `2★`: 1,800 (5.9%)
  * `1★`: 1,700 (5.6%)
  * **Total:** 30,200 reviews

### 4.4 Department Blame Split (AI Classified)
Uses Groq API to analyze low rating comments and determine fault.
* **Output Example:**
  | Fault Department | Count of Reviews | Percentage | Responsibility Owner |
  | :--- | :--- | :--- | :--- |
  | **Kitchen Fault** (raw food, burnt, salty, cold) | 520 | 41.6% | Culinary Ops |
  | **Packaging Fault** (leaked gravy, crushed box) | 310 | 24.8% | Packing Team |
  | **Delivery Fault** (spilled contents, 1.5h late) | 280 | 22.4% | Aggregator (Swiggy) |
  | **Assembly Error** (missing dip, wrong item sent) | 140 | 11.2% | Kitchen Assembly |

---

## 5. ITEM-WISE (SKU Breakdowns)

### 5.1 Item Rating by Area / City / Zone
Allows filtering a single item to see where it performs worst.
* **Item selected:** `Loaded Veggie Pizza` (Olio)
  * Zone performance:
    | Zone | Rating | Total Reviews | Status |
    | :--- | :--- | :--- | :--- |
    | South | 4.10★ | 45 | 🟢 Normal |
    | West | 3.85★ | 22 | 🟡 Warning |
    | North | 2.15★ | 13 | 🔴 CRITICAL (Baking issue) |

### 5.2 Item Day-of-Week Rating Pattern
Helps trace if items degrade on busy weekend shifts.
* **Item selected:** `Classic Paneer Tikka Wrap`
  * Mon-Fri average: 4.80★ (210 reviews)
  * Sat-Sun average: 3.42★ (30 reviews) - *Shows quality drop during peak weekend dinner rushes.*

### 5.3 Item vs Company Average Gap
* **Output Example:**
  | Item Name | Item Rating | Company Average | Rating Gap | Action Status |
  | :--- | :--- | :--- | :--- | :--- |
  | Classic Paneer Tikka Wrap | 4.72★ | 4.22★ | +0.50★ | 🟢 Asset SKU |
  | Spicy Chicken Wings | 2.10★ | 4.22★ | -2.12★ | 🔴 Priority Re-train |
