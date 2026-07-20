# assistant_manager.py — Database-driven conversational engine (LLM removed)
#
# All responses, follow-up chips, and summaries are generated purely from
# database field values and deterministic rule-based logic.

import json
import re
import random
from mysql_pool import mysql_ctx

# ---------------------------------------------------------------------------
# In-memory caches (loaded from DB on startup)
# ---------------------------------------------------------------------------
CITIES_CACHE = []
CATEGORIES_CACHE = []
AREAS_CACHE = []


def load_local_caches():
    """Load city, category, and area caches from the remote MySQL database."""
    global CITIES_CACHE, CATEGORIES_CACHE, AREAS_CACHE

    # Solid default fallbacks in case DB query fails
    CITIES_CACHE = [
        "mumbai", "surat", "chennai", "bangalore", "kolkata", "jaipur",
        "vijayawada", "hyderabad", "ludhiana", "udaipur", "madurai", "pune",
        "ahmedabad", "delhi", "noida", "gurgaon", "kochi", "indore",
    ]
    CATEGORIES_CACHE = [
        "restaurant", "hotel", "doctor", "garment shops", "jewellery shops",
        "school", "hospital", "cellphone showroom", "bakery", "cafe", "gym",
        "salon", "spa", "pharmacy", "clinic", "dentist", "grocery",
        "bank", "electronics", "furniture", "coaching", "fitness",
    ]
    AREAS_CACHE = []

    try:
        with mysql_ctx() as conn:
            cur = conn.cursor()
            cur.execute("SELECT DISTINCT LOWER(city) FROM master_table WHERE city IS NOT NULL AND city != '' LIMIT 200")
            db_cities = [r[0] for r in cur.fetchall() if r[0]]
            for c in db_cities:
                if c not in CITIES_CACHE:
                    CITIES_CACHE.append(c)

            cur.execute("SELECT DISTINCT LOWER(business_category) FROM master_table WHERE business_category IS NOT NULL AND business_category != '' LIMIT 200")
            db_cats = [r[0] for r in cur.fetchall() if r[0]]
            for cat in db_cats:
                if cat not in CATEGORIES_CACHE:
                    CATEGORIES_CACHE.append(cat)

            cur.execute("SELECT DISTINCT LOWER(area) FROM master_table WHERE area IS NOT NULL AND area != '' LIMIT 300")
            db_areas = [r[0] for r in cur.fetchall() if r[0]]
            for a in db_areas:
                if a not in AREAS_CACHE:
                    AREAS_CACHE.append(a)
    except Exception as e:
        print(f"[CACHE ERROR] Failed to load caches in assistant_manager: {e}")


# Run cache loading on import
load_local_caches()


# ---------------------------------------------------------------------------
# Greeting detection
# ---------------------------------------------------------------------------
GREETING_PATTERNS = [
    r"\bhi\b", r"\bhello\b", r"\bhey\b", r"\bgood morning\b",
    r"\bgood afternoon\b", r"\bgood evening\b", r"\bnamaste\b", r"\bnamaskar\b",
]


def is_greeting(query: str) -> bool:
    q = query.lower().strip()
    for pattern in GREETING_PATTERNS:
        if re.search(pattern, q):
            if len(q.split()) <= 3:
                return True
    return False


def get_greeting_response(language: str = "en") -> str:
    responses_map = {
        "en": [
            "Hi 👋 I'm your Local Directory Assistant! What would you like to explore today?",
            "Hello! 😊 I can help you find businesses and products near you.",
            "Hey there! 👋 Ready to explore local listings or discover great products?",
        ],
        "hi": [
            "नमस्ते! 👋 मैं आपका लोकल डायरेक्टरी असिस्टेंट हूँ! आज क्या खोजना है?",
        ],
        "gu": [
            "નમસ્તે! 👋 હું તમારો સ્થાનિક ડિરેક્ટરી સહાયક છું! આજે શું શોધવું છે?",
        ],
    }
    lang = language.lower() if language else "en"
    options = responses_map.get(lang, responses_map["en"])
    return random.choice(options)


# ---------------------------------------------------------------------------
# Conversation history cleaner (for display in context)
# ---------------------------------------------------------------------------
def clean_history_message(role: str, content: str) -> str:
    if role != "assistant":
        return content
    content_str = str(content).strip()
    if not (content_str.startswith("{") or content_str.startswith("[")):
        return content
    try:
        data = json.loads(content_str)
        if isinstance(data, dict):
            msg_type = data.get("type", "text")
            if msg_type == "database":
                bizs = data.get("data", []) or data.get("content", [])
                intro = data.get("intro", "")
                names = [b.get("business_name", b.get("name", "Unknown")) for b in bizs]
                return f"{intro}\n[Shown businesses: {', '.join(names)}]"
            elif msg_type == "suggestions":
                intro = data.get("intro", "")
                suggs = [s.get("title", s.get("action", "")) for s in data.get("content", [])]
                return f"{intro}\n[Suggestions: {', '.join(suggs)}]"
            else:
                return data.get("content", data.get("data", str(content)))
    except Exception:
        pass
    return content


# ---------------------------------------------------------------------------
# Rule-based NLU parser
# ---------------------------------------------------------------------------
# Extended typo / synonym map
TYPO_MAP = {
    "attm": "atm", "atms": "atm", "banks": "bank",
    "resturant": "restaurant", "resturat": "restaurant", "resyurantr": "restaurant",
    "resturats": "restaurant", "restaurents": "restaurant",
    "hospitall": "hospital", "hospita": "hospital",
    "gyms": "gym", "gymm": "gym",
    "stores": "shop", "shops": "shop", "store": "shop",
    "cafes": "cafe", "caffe": "cafe", "kaffe": "cafe",
    "mainanagr": "maninagar", "maninagr": "maninagar",
    "saloon": "salon", "salone": "salon",
    "pharmcy": "pharmacy", "pharmaci": "pharmacy",
    "dentis": "dentist", "dentiest": "dentist",
    "docter": "doctor", "dokter": "doctor",
    "fitnes": "fitness", "fitnss": "fitness",
    "schooll": "school", "skool": "school",
    "bakerry": "bakery", "bakary": "bakery",
}

# Category synonyms → normalized category
SYNONYM_MAP = {
    "food": "restaurant",
    "dining": "restaurant",
    "eat": "restaurant",
    "eatery": "restaurant",
    "dine": "restaurant",
    "dhaba": "restaurant",
    "biryani": "restaurant",
    "pizza": "restaurant",
    "burger": "restaurant",
    "coffee": "cafe",
    "tea": "cafe",
    "chai": "cafe",
    "fitness": "gym",
    "workout": "gym",
    "exercise": "gym",
    "yoga": "gym",
    "aerobics": "gym",
    "medical": "hospital",
    "health": "hospital",
    "emergency": "hospital",
    "surgery": "hospital",
    "medicine": "pharmacy",
    "chemist": "pharmacy",
    "drug": "pharmacy",
    "beauty": "salon",
    "hair": "salon",
    "parlour": "salon",
    "parlor": "salon",
    "makeup": "salon",
    "grooming": "salon",
    "stay": "hotel",
    "lodge": "hotel",
    "hostel": "hotel",
    "pg": "hotel",
    "guesthouse": "hotel",
    "accommodation": "hotel",
    "coaching": "school",
    "tuition": "school",
    "tutor": "school",
    "institute": "school",
    "garment": "clothing",
    "cloth": "clothing",
    "apparel": "clothing",
    "fashion": "clothing",
    "advocate": "lawyer",
    "solicitor": "lawyer",
    "legal": "lawyer",
}

BUSINESS_KEYWORDS = [
    "restaurant", "hotel", "hospital", "gym", "salon", "school", "cafe", "shop",
    "doctor", "clinic", "food", "dining", "spa", "boutique", "fitness", "dentist",
    "bakery", "service", "lawyer", "advocate", "mechanic", "plumber", "bank",
    "pharmacy", "chemist", "jewellery", "grocery", "supermarket", "coaching",
    "institute", "college", "atm", "electronics", "furniture", "hardware",
    "clothing", "garment",
]

PRODUCT_KEYWORDS = [
    "fruits", "fruit", "vegetables", "vegetable", "milk", "bread", "eggs", "groceries", "grocery",
    "rice", "wheat", "flour", "oil", "sugar", "salt", "spices", "tea", "coffee", "beverage", "beverages",
    "juice", "water", "soft drink", "soft drinks", "soda", "chips", "snacks", "snack", "chocolate", "chocolates",
    "biscuit", "biscuits", "cookie", "cookies", "shampoo", "soap", "toothpaste", "detergent", "cleaner",
    "perfume", "deodorant", "cosmetics", "makeup", "skin care", "hair care", "shoes", "shoe", "clothing",
    "shirt", "tshirt", "t-shirt", "jeans", "pants", "dress", "saree", "watch", "watches", "phone", "phones",
    "mobile", "mobiles", "laptop", "laptops", "computer", "computers", "tablet", "tablets", "headphone",
    "headphones", "earbuds", "speaker", "speakers", "camera", "cameras", "television", "tv", "appliances",
    "refrigerator", "fridge", "microwave", "oven", "washing machine", "ac", "air conditioner", "fan", "cooler",
    "iron", "geyser", "heater", "vacuum", "books", "book", "toy", "toys", "game", "games", "bag", "bags",
    "luggage", "wallet", "wallets", "sunglasses", "eyewear", "jewelry", "jewellery", "gold", "silver", "diamond",
    "ring", "necklace", "earrings", "bangles", "gift", "gifts", "flower", "flowers", "cake", "cakes", "sweets",
    "sweet", "ice cream", "pizza", "burger", "sandwich", "pasta", "noodle", "noodles", "sauce", "ketchup",
    "cheese", "butter", "paneer", "curd", "yogurt", "cream", "ghee", "honey", "jam", "spread", "cereal",
    "oats", "muesli", "cornflakes", "soap", "conditioner", "lotion", "oil", "face wash", "body wash", "hand wash",
    "sanitizer", "mask", "medicine", "medicines", "tablet", "tablets", "capsule", "capsules", "syrup", "ointment"
]

# ---------------------------------------------------------------------------
# Marketplace entity map — keyword → normalized marketplace_name in product_master
# ---------------------------------------------------------------------------
MARKETPLACE_MAP = {
    # Blinkit
    "blinkit": "Blinkit", "blink it": "Blinkit", "grofers": "Blinkit",
    # Zepto
    "zepto": "Zepto",
    # BigBasket
    "bigbasket": "BigBasket", "big basket": "BigBasket", "bb": "BigBasket",
    # Amazon
    "amazon": "Amazon", "amazon india": "Amazon",
    # Flipkart
    "flipkart": "Flipkart", "flip kart": "Flipkart",
    # JioMart
    "jiomart": "JioMart", "jio mart": "JioMart", "jio": "JioMart",
    # DMart
    "dmart": "DMart", "d-mart": "DMart", "d mart": "DMart",
    # IndiaMART
    "indiamart": "IndiaMART", "india mart": "IndiaMART", "indiamart.com": "IndiaMART",
    # Instamart (Swiggy)
    "instamart": "Instamart", "swiggy instamart": "Instamart",
}

# ---------------------------------------------------------------------------
# Listing source entity map — keyword → normalized source name in listing tables
# ---------------------------------------------------------------------------
LISTING_SOURCE_MAP = {
    "justdial": "justdial", "just dial": "justdial", "jd": "justdial",
    "google maps": "google_map", "google map": "google_map", "gmaps": "google_map",
    "heyplaces": "heyplaces", "hey places": "heyplaces",
    "magicpin": "magicpin", "magic pin": "magicpin",
    "nearbuy": "nearbuy", "near buy": "nearbuy",
    "asklaila": "asklaila", "ask laila": "asklaila",
    "yellow pages": "yellow_pages", "yellowpages": "yellow_pages",
    "freelisting": "freelisting", "free listing": "freelisting",
    "businesses": "businesses", "business": "businesses",
    "google maps master": "g_map_master_table", "google map master": "g_map_map_master_table", "g map master": "g_map_master_table", "g_map_master_table": "g_map_master_table",
}


def _apply_typos(q: str) -> str:
    words = q.split()
    corrected = []
    for w in words:
        clean_w = w.strip(".,?!;()\"'")
        if clean_w in TYPO_MAP:
            corrected.append(TYPO_MAP[clean_w])
        elif clean_w in SYNONYM_MAP:
            corrected.append(SYNONYM_MAP[clean_w])
        else:
            corrected.append(w)
    return " ".join(corrected)


def parse_query_nlu(user_query: str, language: str = "en", history: list = None) -> dict:
    """
    Deterministic, local rule-based intent and entity extractor.
    Replaces all LLM dependency for query understanding.
    """
    q_lower = user_query.lower().strip()
    q_lower = _apply_typos(q_lower)

    # 1. Greeting
    if is_greeting(user_query):
        return {
            "intents": ["Greeting"],
            "confidence": 1.0,
            "entities": {},
            "need_clarification": False,
            "clarification_message": None,
        }

    # 2. Help / Info
    help_words = ["help", "info", "what can you do", "commands", "menu", "how to use"]
    general_words = ["who are you", "what is your name", "creator", "honeybee", "digital"]
    if any(w in q_lower for w in help_words):
        return {"intents": ["Help"], "confidence": 1.0, "entities": {}}
    if any(w in q_lower for w in general_words):
        return {"intents": ["General AI Question"], "confidence": 1.0, "entities": {}}

    # 3. Comparison intent
    if "compare" in q_lower or " vs " in q_lower or " versus " in q_lower:
        return {"intents": ["Comparison"], "confidence": 1.0, "entities": {}}

    # 4. Product search intent — must match specific product-related contexts
    #    Avoid false positives: "buying property", "items on the menu", "cost of living"
    PRODUCT_STRONG_SIGNALS = [
        "product", "products",
        "buy online", "order online", "purchase",
        "price of ", "cost of ", "how much does",
        "on amazon", "on flipkart", "on blinkit", "on zepto",
        "on bigbasket", "on jiomart", "on dmart",
        "marketplace", "e-commerce", "ecommerce",
        "add to cart", "checkout",
    ]
    is_product = any(w in q_lower for w in PRODUCT_STRONG_SIGNALS)

    # Check against PRODUCT_KEYWORDS list to improve detection
    if not is_product:
        for p_kw in PRODUCT_KEYWORDS:
            if re.search(rf"\b{p_kw}\b", q_lower):
                is_product = True
                break

    # If it contains physical store-related indicators, demote product search
    BUSINESS_STRONG_SIGNALS = [
        " store", " shop", " market", " show room", " showroom", " center", " centre", " hospital", " clinic",
        " school", " college", " hotel", " restaurant", " cafe", " spa", " salon", " gym", " service",
        " dealer", " distributor", " manufacturer", " supplier", " listing", " business", " company", " office",
        " near me", " nearby", " in ", " at ", "address", "phone number", "reviews", "ratings"
    ]
    if is_product:
        if any(w in q_lower for w in BUSINESS_STRONG_SIGNALS):
            is_product = False

    # 5. Marketplace extraction (e.g. "Blinkit products", "buy on Amazon")
    marketplace = None
    for kw, norm in MARKETPLACE_MAP.items():
        if kw in q_lower:
            marketplace = norm
            # Marketplace mention = strong product signal
            is_product = True
            break

    # 6. Listing source extraction (e.g. "restaurants on JustDial")
    listing_source = None
    for kw, norm in LISTING_SOURCE_MAP.items():
        if kw in q_lower:
            listing_source = norm
            # Listing source mention = business search, not product
            is_product = False
            break

    # 7. Extract City — longest match wins
    city = None
    if "india" in q_lower:
        city = "india"
    else:
        for c in sorted(CITIES_CACHE, key=len, reverse=True):
            if c and len(c) >= 3 and c.lower() in q_lower:
                city = c
                break

    # 8. Extract Category — cache first, then keyword fallback
    category = None
    for cat in sorted(CATEGORIES_CACHE, key=len, reverse=True):
        if cat and len(cat) >= 3 and cat.lower() in q_lower:
            category = cat
            break
    if not category:
        for k in BUSINESS_KEYWORDS:
            if k in q_lower:
                category = k.capitalize()
                break

    # 9. Extract Area — skip if same as city
    area = None
    for a in sorted(AREAS_CACHE, key=len, reverse=True):
        if not a or len(a.strip()) < 3:
            continue
        if a.lower() in CITIES_CACHE:
            continue
        if a.lower().replace(" ", "") in q_lower.replace(" ", ""):
            area = a
            break

    # 10. Extract filters
    filters = {
        "open_now": any(w in q_lower for w in ["open now", "open today", "working hour", "timing", "open 24"]),
        "veg": any(w in q_lower for w in ["veg", "vegetarian", "pure veg"]),
        "parking": any(w in q_lower for w in ["parking", "valet"]),
        "wheelchair": any(w in q_lower for w in ["wheelchair", "accessible"]),
        "family": any(w in q_lower for w in ["family", "kids", "children"]),
        "24x7": any(w in q_lower for w in ["24x7", "24 hours", "24/7", "all night", "all day"]),
        "wifi": any(w in q_lower for w in ["wifi", "wi-fi", "internet"]),
        "ac": any(w in q_lower for w in [" ac ", "air conditioned", "air-conditioned"]),
        "delivery": any(w in q_lower for w in ["delivery", "deliver", "home delivery"]),
        "takeaway": any(w in q_lower for w in ["takeaway", "take away", "take out", "parcel"]),
    }

    # 11. Extract ranking intent
    ranking = None
    if any(w in q_lower for w in ["best", "top", "highest rated", "top rated", "star rating"]):
        ranking = "highest_rated"
    elif any(w in q_lower for w in ["most reviewed", "most popular", "popular", "trending"]):
        ranking = "most_reviewed"
    elif any(w in q_lower for w in ["new", "recently opened", "newly opened", "latest"]):
        ranking = "newest"
    elif any(w in q_lower for w in ["cheap", "budget", "affordable", "low cost", "inexpensive"]):
        ranking = "budget"
        filters["budget"] = True
    elif any(w in q_lower for w in ["luxury", "expensive", "premium", "5 star", "fine dine", "deluxe"]):
        ranking = "luxury"
        filters["luxury"] = True

    intent = "Product Search" if is_product else "Business Search"

    return {
        "intents": [intent],
        "confidence": 0.9,
        "entities": {
            "category": category,
            "product": None,
            "location": {"city": city, "area": area},
            "ranking": ranking,
            "filters": filters,
            "marketplace": marketplace,
            "listing_source": listing_source,
        },
        "need_clarification": False,
        "clarification_message": None,
    }


def classify_intent(user_query: str) -> str:
    nlu = parse_query_nlu(user_query)
    intents = nlu.get("intents", ["Unknown"])
    return intents[0] if intents else "Unknown"


def get_guidance(intent: str, query: str, language: str = "en") -> str:
    guidance_map = {
        "en": "I need a bit more details. Could you please provide your registered business credentials or specify a field to update?",
        "hi": "मुझे थोड़ी और जानकारी चाहिए। कृपया अपना व्यवसाय विवरण प्रदान करें।",
        "gu": "મને થોડી વધુ વિગતોની જરૂર છે. કૃપા કરીને તમારા વ્યવસાયની વિગતો આપો.",
    }
    lang = language.lower() if language else "en"
    return guidance_map.get(lang, guidance_map["en"])


def summarize_history(history: list, language: str = "en") -> str:
        return ""

def get_assistant_response(query: str, context: str, language: str = "en", history: list = None) -> str:
    return "I am a local search directory assistant. How can I help you find businesses?"


# ---------------------------------------------------------------------------
# Follow-up chip generator (database-driven, fully dynamic)
# ---------------------------------------------------------------------------
def _get_cities_with_category(category: str) -> list:
    """Query actual cities that have listings for this category (READ-ONLY)."""
    if not category:
        return []
    try:
        with mysql_ctx() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT DISTINCT city FROM master_table "
                "WHERE LOWER(business_category) LIKE %s AND city IS NOT NULL AND city != '' "
                "ORDER BY city LIMIT 5",
                (f"%{category.lower()}%",)
            )
            return [r[0] for r in cur.fetchall() if r[0]]
    except Exception as e:
        print(f"[CITIES FOR CAT ERROR] {e}")
        return []


def _get_related_categories(category: str) -> list:
    """Find categories in DB that are conceptually related to the searched one (READ-ONLY)."""
    if not category:
        return []
    cat_lower = category.lower()

    # Predefined relation groups
    relation_groups = {
        "restaurant": ["cafe", "bakery", "hotel", "food court", "dhaba"],
        "cafe": ["restaurant", "bakery", "coffee shop", "tea house"],
        "hotel": ["resort", "lodge", "hostel", "pg", "guesthouse"],
        "gym": ["yoga", "fitness", "spa", "wellness", "aerobics"],
        "salon": ["spa", "beauty parlour", "wellness", "grooming"],
        "hospital": ["clinic", "doctor", "nursing home", "pharmacy", "dentist"],
        "clinic": ["hospital", "doctor", "pharmacy", "dentist", "nursing home"],
        "school": ["college", "coaching", "institute", "tuition", "university"],
        "pharmacy": ["chemist", "medical", "clinic", "hospital"],
        "bank": ["atm", "finance", "insurance"],
        "shop": ["store", "mall", "supermarket", "market", "outlet"],
        "lawyer": ["advocate", "legal", "solicitor", "law firm"],
    }

    for key, related in relation_groups.items():
        if key in cat_lower or cat_lower in key:
            return related[:4]

    return []


def generate_conversational_summary_and_chips(
    query: str,
    results: list,
    language: str = "en",
    history: list = None,
    marketplace: str = None,
) -> dict:
    """
    Generate a conversational summary + smart follow-up chips
    entirely from database result fields. No LLM required.
    Handles both business results and product results.
    """
    default_suggs = [
        "🏢 Explore Listings", "🛍️ Explore Products",
        "📂 Browse Categories", "📍 Explore Locations",
    ]

    if not results:
        return {
            "summary": (
                "I couldn't find any direct matches in our database. "
                "Would you like to search in another city or try a different category?"
            ),
            "suggestions": default_suggs,
        }

    count = len(results)
    first = results[0]

    # Detect whether these are product results or business results
    is_product = "product_name" in first or ("brand" in first and "business_category" not in first)

    if is_product:
        # ── Product summary ────────────────────────────────────────────────────
        name = first.get("product_name") or first.get("business_name") or "a product"
        brand = first.get("brand") or ""
        price_val = first.get("price")
        price_str = f"₹{price_val:,.0f}" if price_val else "Price N/A"
        rating = float(first.get("stars") or first.get("ratings") or 0)
        reviews = int(first.get("reviews") or first.get("reviews_count") or 0)
        category = (first.get("category_name") or "product").lower()
        result_marketplace = marketplace or first.get("marketplace_name") or ""

        summary = f"I found **{count} product(s)**"
        if result_marketplace:
            summary += f" on **{result_marketplace}**"
        summary += " matching your search.\n\n"
        summary += f"🏆 **Top Pick:** **{name}**"
        if brand:
            summary += f" by *{brand}*"
        if price_val:
            summary += f" — 💰 {price_str}"
        if rating > 0:
            summary += f" | ⭐ {rating}"
        if reviews > 0:
            summary += f" ({reviews} reviews)"
        summary += "\n\nHere are some ways to refine your search:"

        # Context-aware product chips
        suggs = [
            f"⭐ Top Rated {category.capitalize()}",
            f"💰 Budget {category.capitalize()} Options",
            f"🏆 Best Seller {category.capitalize()}",
        ]

        # If no marketplace filter, show marketplace-specific suggestions
        if not result_marketplace:
            suggs += [
                "🛒 Amazon Products",
                "🟡 Blinkit Products",
                "🟢 BigBasket Products",
                "🔵 Flipkart Products",
            ]
        else:
            # Within a marketplace, suggest cross-platform comparison
            suggs += [
                f"🆚 Compare with Amazon",
                f"🆚 Compare with Flipkart",
                "🛍️ Browse All Marketplaces",
            ]

        suggs += ["🛍️ Browse Product Categories", "🔄 Start New Search"]

    else:
        # ── Business summary ───────────────────────────────────────────────────
        name = first.get("business_name") or first.get("name") or "a verified listing"
        rating = first.get("ratings") or first.get("stars") or 0
        reviews = first.get("reviews_count") or first.get("reviews") or 0
        phone = first.get("phone_number") or first.get("primary_phone") or "N/A"
        city = (first.get("city") or "this city").title()
        category = (first.get("business_category") or "business").lower()
        source = first.get("source", "")

        if count == 1:
            summary = (
                f"I found **1 '{category}' listing** in **{city}** matching your search.\n\n"
                f"🏆 **{name}**"
            )
        else:
            summary = (
                f"I found **{count} '{category}' listings** in **{city}** matching your search.\n\n"
                f"🏆 **Top Pick:** **{name}**"
            )

        if source:
            summary += f" *(via {source})*"

        try:
            if rating and float(rating) > 0:
                summary += f" — ⭐ {float(rating):.1f}"
        except (ValueError, TypeError):
            pass
        try:
            if reviews and int(reviews) > 0:
                summary += f" ({int(reviews)} reviews)"
        except (ValueError, TypeError):
            pass
        if phone and phone != "N/A":
            summary += f" | 📞 {phone}"

        summary += "\n\nHere are some ways to refine your search:"

        # ── Dynamic chips from result data ─────────────────────────────────────
        suggs = []
        has_ratings = any(float(r.get("ratings") or r.get("stars") or 0) > 0 for r in results)
        if has_ratings:
            suggs.append(f"⭐ Top Rated {category.capitalize()}s")

        has_reviews = any(int(r.get("reviews_count") or r.get("reviews") or 0) > 0 for r in results)
        if has_reviews:
            suggs.append(f"💬 Most Reviewed {category.capitalize()}s")

        cat_lower = category.lower()
        if any(w in cat_lower for w in ["restaurant", "cafe", "food", "bakery", "dhaba", "dine"]):
            suggs += ["🥗 Pure Veg Only", "⏰ Open Now", "👨‍👩‍👧 Family Friendly", "💰 Budget Dining"]
            if "cafe" in cat_lower:
                suggs.append("📶 Cafes with Wi-Fi")
        elif any(w in cat_lower for w in ["hotel", "resort", "lodge", "hostel", "stay"]):
            suggs += ["💰 Budget Hotels", "🏨 Luxury Hotels", "🅿️ With Parking", "🌐 Free Wi-Fi Hotels"]
        elif any(w in cat_lower for w in ["gym", "fitness", "yoga", "aerobics"]):
            suggs += ["⏰ Open Now", "🌙 24x7 Gyms", "🏆 Highest Rated", "👩 Women's Only Gyms"]
        elif any(w in cat_lower for w in ["hospital", "clinic", "doctor", "medical"]):
            suggs += ["🚨 Emergency Services", "⭐ Top Rated Hospitals", "⏰ Open Now", "🩺 Multi-Speciality"]
        elif any(w in cat_lower for w in ["salon", "spa", "beauty", "parlour"]):
            suggs += ["⭐ Top Rated Salons", "💰 Budget Salons", "⏰ Open Now", "👰 Bridal Salons"]
        elif any(w in cat_lower for w in ["school", "college", "coaching", "institute"]):
            suggs += ["⭐ Top Rated Schools", "🏫 CBSE Schools", "🏫 ICSE Schools", "📚 Coaching Centers"]
        elif any(w in cat_lower for w in ["bank", "atm", "finance"]):
            suggs += ["🏧 ATMs Nearby", "🏦 Public Sector Banks", "🏦 Private Banks", "⏰ Open Now"]
        elif any(w in cat_lower for w in ["pharmacy", "chemist", "medical store"]):
            suggs += ["⏰ Open 24 Hours", "⭐ Top Rated", "🚨 Emergency Pharmacy"]
        else:
            suggs += ["⏰ Open Now", "💰 Budget Friendly", "⭐ Top Rated", "📍 Change Area"]

        related = _get_related_categories(category)
        if related:
            suggs.append(f"🔍 Explore {related[0].capitalize()}s")

        suggs += ["📂 Browse Other Categories", "🏙️ Change City"]

    # Deduplicate and limit
    seen = set()
    unique_suggs = []
    for s in suggs:
        key = s.lower()
        if key not in seen:
            seen.add(key)
            unique_suggs.append(s)

    return {
        "summary": summary,
        "suggestions": unique_suggs[:8],
    }


def generate_no_results_response(
    query: str,
    category: str,
    city: str,
    language: str = "en",
    history: list = None
) -> dict:
    """
    Intelligently suggests alternative cities from the REAL database
    when a search returns 0 results. Never returns hardcoded city names.
    """
    cat_term = category if category else "businesses"
    city_term = city.title() if city and city.strip() else "any city"

    summary = (
        f"I couldn't find any **'{cat_term}'** listings in **{city_term}** in our database.\n\n"
    )

    # Query real DB for cities that actually have this category
    real_cities = _get_cities_with_category(category)
    suggs = []

    if real_cities:
        summary += f"💡 However, we do have **'{cat_term}'** listings in these cities:\n"
        for c in real_cities:
            summary += f"  • **{c.title()}**\n"
            suggs.append(f"{cat_term.capitalize()}s in {c.title()}")

        summary += "\nWould you like to search in one of these cities, or try a different category?"
    else:
        # Fallback: suggest removing city filter
        summary += (
            "💡 Try broadening your search — remove the city filter, "
            "or search for a related category.\n\n"
            "Would you like to explore other categories or browse all cities?"
        )
        suggs = [
            f"All {cat_term.capitalize()}s (Any City)",
            "📂 Browse Categories",
            "🏙️ Browse Cities",
        ]

    # Add related category suggestions
    related = _get_related_categories(category)
    if related:
        for r in related[:2]:
            suggs.append(f"{r.capitalize()}s in {city_term}")

    suggs += ["📂 Browse Categories", "🔄 Start New Search"]

    # Deduplicate
    seen = set()
    unique_suggs = []
    for s in suggs:
        key = s.lower()
        if key not in seen:
            seen.add(key)
            unique_suggs.append(s)

    return {
        "summary": summary,
        "suggestions": unique_suggs[:8],
    }


# ---------------------------------------------------------------------------
# General AI / conversational response (fully rule-based)
# ---------------------------------------------------------------------------
def get_ai_conversational_response(
    query: str,
    language: str = "en",
    history: list = None
) -> dict:
    """FAQ and chit-chat responder using rule-based templates. No LLM required."""
    q = query.lower().strip()

    welcome_messages = {
        "en": "What would you like to explore today?",
        "hi": "आज आप क्या खोजना चाहेंगे?",
        "gu": "આજે તમે શું અન્વેષણ કરવા માંગો છો?",
        "te": "ఈరోజు మీరు ఏమి అన్వేషించాలనుకుంటున్నారు?",
    }
    welcome_text = welcome_messages.get(language, welcome_messages["en"])

    main_buttons = [
        {"title": "🏢 Business Listings", "action": "query_rewrite", "query": "explore business listings"},
        {"title": "🛍️ Products", "action": "query_rewrite", "query": "explore products"},
    ]

    # 1. Greeting or empty
    if is_greeting(query) or not q:
        return {
            "response": f"Hello! 👋 I'm your Local Directory Assistant.\n\n{welcome_text}",
            "suggestions": main_buttons,
        }

    # 2. Help
    if any(w in q for w in ["help", "info", "commands", "menu", "how to use", "what can"]):
        response = (
            "Here's how I can help you:\n\n"
            "1. **🏢 Business Listings** — Search for cafes, gyms, hospitals, restaurants and more in any city.\n"
            "2. **🛍️ Products** — Browse trending product catalogs.\n"
            "3. **Smart Filters** — Filter by ratings, 'Open Now', vegetarian, parking, and more.\n"
            "4. **Manage Listing** — Business owners can view and update their profile.\n\n"
            "What would you like to start with?"
        )
        return {
            "response": response,
            "suggestions": main_buttons,
        }

    # 3. About / identity
    if any(w in q for w in ["who are you", "your name", "creator", "about you", "what are you"]):
        response = (
            "I'm the **HoneyBee Digital Business Directory Assistant** 🐝\n\n"
            "I run completely on your local database — no external AI required. "
            "I provide fast, accurate business and product recommendations from our "
            "verified local directory.\n\n"
            "How can I help you today?"
        )
        return {
            "response": response,
            "suggestions": main_buttons,
        }

    # 4. Thank you
    if any(w in q for w in ["thank", "thanks", "thank you", "ty"]):
        return {
            "response": "You're welcome! 😊 Is there anything else I can help you find?",
            "suggestions": main_buttons,
        }

    # 5. Default — guide user
    response = (
        "I'm here to help you find local businesses, products, and services near you! 🔍\n\n"
        "Would you like to explore business listings or browse our product catalog?"
    )
    return {
        "response": response,
        "suggestions": main_buttons,
    }
