# text_to_sql.py — Rule-based SQL builder (LLM removed)
#
# Generates READ-ONLY SELECT SQL for the g_map_master_table using deterministic
# pattern matching. No external API calls — works entirely from the query text.

import re

# Synonym and typo correction map
TYPO_MAP = {
    "resturant": "restaurant", "restuarant": "restaurant", "restraunt": "restaurant",
    "restaurent": "restaurant", "restarant": "restaurant",
    "hospitall": "hospital", "hospita": "hospital",
    "cafee": "cafe", "kaffe": "cafe",
    "gymm": "gym", "gyms": "gym",
    "saloon": "salon", "salone": "salon",
    "hotell": "hotel", "hotal": "hotel",
    "pharmcy": "pharmacy", "pharmaci": "pharmacy",
    "bakerry": "bakery", "bakary": "bakery",
    "clinick": "clinic", "clenic": "clinic",
    "dentis": "dentist", "dentiest": "dentist",
    "docter": "doctor", "dokter": "doctor",
    "schooll": "school", "skool": "school",
    "fitnes": "fitness", "fitnss": "fitness",
    "jewellry": "jewellery", "juellery": "jewellery",
}

BUSINESS_KEYWORDS = [
    "restaurant", "hotel", "hospital", "gym", "salon", "school", "cafe", "shop",
    "doctor", "clinic", "food", "dining", "spa", "boutique", "fitness", "dentist",
    "bakery", "service", "lawyer", "advocate", "mechanic", "plumber", "bank",
    "pharmacy", "chemist", "jewellery", "grocery", "supermarket", "coaching",
    "institute", "college", "university", "petrol pump", "atm", "hardware",
    "electronics", "furniture", "software", "it", "travel", "agency",
]


def _normalize_query(query: str) -> str:
    q = query.lower().strip()
    words = q.split()
    corrected = []
    for w in words:
        clean = w.strip(".,?!;()\"'")
        corrected.append(TYPO_MAP.get(clean, w))
    return " ".join(corrected)


def generate_sql(query: str) -> str:
    """
    Rule-based SQL generator for local business search queries.
    Returns a valid READ-ONLY SELECT statement for g_map_master_table.
    """
    q = _normalize_query(query)

    # --- Extract category ---
    category = None
    for kw in sorted(BUSINESS_KEYWORDS, key=len, reverse=True):
        if kw in q:
            category = kw
            break

    # --- Extract city (simple heuristic: word after "in") ---
    city = None
    city_match = re.search(r'\bin\s+([a-z\s]+?)(?:\s+near|\s+with|\s+that|$)', q)
    if city_match:
        candidate = city_match.group(1).strip()
        if candidate and len(candidate) > 2:
            city = candidate

    # --- Extract minimum rating ---
    min_rating = 3.0
    rating_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:\+|plus|star|rating)', q)
    if rating_match:
        try:
            min_rating = float(rating_match.group(1))
        except ValueError:
            pass

    # --- Build WHERE conditions ---
    conditions = []
    params_comment = []

    if category:
        root = category[:6]  # use partial root for fuzzy matching
        conditions.append(
            f"(LOWER(business_name) LIKE '%{root}%' OR "
            f"LOWER(business_category) LIKE '%{root}%' OR "
            f"LOWER(subcategory) LIKE '%{root}%')"
        )
        params_comment.append(f"category~{category}")

    if city:
        conditions.append(f"LOWER(city) LIKE '%{city}%'")
        params_comment.append(f"city={city}")

    if min_rating > 0:
        conditions.append(f"ratings >= {min_rating}")
        params_comment.append(f"min_rating={min_rating}")

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    sql = (
        f"SELECT DISTINCT * FROM g_map_master_table "
        f"WHERE {where_clause} "
        f"ORDER BY (ratings * 0.75 + reviews_count * 0.002) DESC "
        f"LIMIT 10"
    )

    print(f"[TEXT_TO_SQL] Generated SQL for '{query}': {sql[:120]}...")
    return sql


if __name__ == "__main__":
    while True:
        q = input("Enter your business search query: ")
        print("\nGENERATED SQL:\n", generate_sql(q))