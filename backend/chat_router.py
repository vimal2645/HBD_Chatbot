import json
import re
import anyio
from typing import Optional
from fastapi import HTTPException

from pydantic import BaseModel
from mysql_pool import mysql_ctx
from assistant_manager import (
    parse_query_nlu,
    generate_conversational_summary_and_chips,
    get_ai_conversational_response,
    generate_no_results_response,
    is_greeting,
    CITIES_CACHE, CATEGORIES_CACHE, AREAS_CACHE
)

BIZ_TABLE = "chatbot_add_business"  # MySQL remote table
PRODUCT_TABLE = "chatbot_products"
DEAL_TABLE = "chatbot_deals"

def _get_last_search_metadata_internal(session_id: str) -> dict:
    from api import _get_last_search_metadata
    return _get_last_search_metadata(session_id)

def _save_chat_message_internal(session_id, role, content):
    from api import _save_chat_message
    _save_chat_message(session_id, role, content)

def _get_recent_history_internal(session_id, limit=10):
    from api import _get_recent_history
    return _get_recent_history(session_id, limit)

def _update_session_title_internal(session_id: str, first_message: str):
    from api import _update_session_title
    _update_session_title(session_id, first_message)

def get_current_user_id_internal(session):
    from api import get_current_user_id
    return get_current_user_id(session=session)

def check_prompt_injection_internal(query: str) -> bool:
    from api import check_prompt_injection
    return check_prompt_injection(query)

from api import (
    map_business_fields,
    map_product_fields,
    query_local_businesses,
    count_local_businesses,
    query_all_listing_sources,
    search_cache,
    rewrite_query_with_context
)



def clean_query_term(term: str, marketplace: str = None, listing_source: str = None) -> str:
    if not term:
        return ""
    t = term.lower()
    
    # 1. Words to remove: prepositions, common actions, and search keywords
    words_to_remove = {
        "on", "in", "at", "from", "for", "with", "buy", "show", "search", "find", 
        "order", "online", "listings", "listing", "products", "product", "items", "item", "any", "all"
    }
    
    # 2. Add marketplace variations to remove list
    if marketplace:
        words_to_remove.add(marketplace.lower())
        if marketplace.lower() == "blinkit":
            words_to_remove.update(["blink", "it", "grofers"])
        elif marketplace.lower() == "bigbasket":
            words_to_remove.update(["big", "basket", "bb"])
        elif marketplace.lower() == "jiomart":
            words_to_remove.update(["jio", "mart"])
        elif marketplace.lower() == "dmart":
            words_to_remove.update(["d", "mart"])
        elif marketplace.lower() == "indiamart":
            words_to_remove.update(["india", "mart"])
            
    # 3. Add listing source variations to remove list
    if listing_source:
        words_to_remove.add(listing_source.lower())
        if listing_source.lower() == "google_map":
            words_to_remove.update(["google", "map", "maps", "gmaps"])
        elif listing_source.lower() == "yellow_pages":
            words_to_remove.update(["yellow", "pages", "yellowpages"])
        elif listing_source.lower() == "justdial":
            words_to_remove.update(["just", "dial", "jd"])
            
    # Remove punctuation
    import string
    for char in string.punctuation:
        t = t.replace(char, " ")
        
    parts = t.split()
    clean_parts = [p for p in parts if p not in words_to_remove]
    return " ".join(clean_parts).strip()


def get_intelligent_followup_question(category: str, city: str, is_product: bool, results: list, marketplace: str = None) -> str:
    cat = (category or "business").lower()
    city_str = f" in {city.title()}" if city else ""
    mkt_str = f" on {marketplace}" if marketplace else ""
    
    if not results:
        if is_product:
            return "Would you like to search for another product, browse popular categories, or try a different marketplace?"
        else:
            return f"Would you like to search for {cat} in another city or try a different category?"
            
    # We have results
    if is_product:
        top_item = results[0].get("product_name", "this product")
        if len(top_item) > 30:
            top_item = top_item[:27] + "..."
        if mkt_str:
            return f"Would you like to see reviews for **{top_item}**, check for other brands, or compare prices across other marketplaces?"
        else:
            return f"Would you like to compare **{top_item}** with similar items, filter by budget, or search on a specific marketplace like Amazon or Blinkit?"
    else:
        top_item = results[0].get("business_name", "this business")
        if len(top_item) > 30:
            top_item = top_item[:27] + "..."
        return f"Would you like to see contact details for **{top_item}**, view more high-rated {cat}s{city_str}, or check which ones are open right now?"


def _build_context_chips(category: str, city: str, flow_state: str = "EXPLORING_BIZ") -> list:
    """
    Build context-aware follow-up chips that embed city and category into the
    query text. This ensures chip clicks carry full search context to the next turn.
    """
    chips = []
    cat = (category or "businesses").strip()
    city_str = (city or "").strip().title()
    city_suffix = f" in {city_str}" if city_str else ""

    cat_lower = cat.lower()

    if flow_state == "EXPLORING_BIZ":
        # Always offer ranking refinements with city+cat embedded
        chips.append(f"⭐ Top Rated {cat.capitalize()}s{city_suffix}")
        chips.append(f"💬 Most Reviewed {cat.capitalize()}s{city_suffix}")

        if any(w in cat_lower for w in ["restaurant", "cafe", "food", "bakery", "dhaba", "dine"]):
            chips += [
                f"🥗 Pure Veg Restaurants{city_suffix}",
                f"⏰ Restaurants Open Now{city_suffix}",
                f"👨‍👩‍👧 Family Friendly Restaurants{city_suffix}",
            ]
            if "cafe" in cat_lower:
                chips.append(f"📶 Cafes with Wi-Fi{city_suffix}")
        elif any(w in cat_lower for w in ["hotel", "resort", "lodge", "hostel", "stay"]):
            chips += [
                f"💰 Budget Hotels{city_suffix}",
                f"🏨 Luxury Hotels{city_suffix}",
                f"🅿️ Hotels with Parking{city_suffix}",
            ]
        elif any(w in cat_lower for w in ["gym", "fitness", "yoga", "aerobics"]):
            chips += [
                f"⏰ Open Now Gyms{city_suffix}",
                f"🌙 24x7 Gyms{city_suffix}",
            ]
        elif any(w in cat_lower for w in ["hospital", "clinic", "doctor", "medical"]):
            chips += [
                f"🚨 Emergency Hospitals{city_suffix}",
                f"⭐ Top Hospitals{city_suffix}",
            ]
        elif any(w in cat_lower for w in ["salon", "spa", "beauty", "parlour"]):
            chips += [
                f"⭐ Top Salons{city_suffix}",
                f"💰 Budget Salons{city_suffix}",
            ]
        elif any(w in cat_lower for w in ["school", "college", "coaching", "institute"]):
            chips += [
                f"⭐ Top Schools{city_suffix}",
                f"🏫 CBSE Schools{city_suffix}",
            ]
        else:
            chips += [
                f"⏰ Open Now {cat.capitalize()}s{city_suffix}",
                f"💰 Budget {cat.capitalize()}s{city_suffix}",
            ]
    elif flow_state == "EXPLORING_PROD":
        chips += [
            f"⭐ Highest Rated {cat.capitalize()}",
            f"💰 Budget {cat.capitalize()} Options",
            f"🏆 Best Seller {cat.capitalize()}",
        ]

    chips += [
        "📂 Browse Other Categories",
        "🏙️ Change City",
        "🔄 Start New Search",
    ]

    # Deduplicate
    seen = set()
    unique = []
    for c in chips:
        k = c.lower()
        if k not in seen:
            seen.add(k)
            unique.append(c)

    return unique[:8]


async def handle_chat_query(req, session_phone: Optional[str], session_email: Optional[str], lang: str):
    q_lower = req.query.lower().strip()
    chat_session_id = req.session_id

    # 1. Prompt Injection Check
    if check_prompt_injection_internal(req.query):
        resp = {"type": "faq", "data": "Safety check failed. Please submit a valid query."}
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # Save User Message
    if chat_session_id:
        _save_chat_message_internal(chat_session_id, "user", req.query)
        _update_session_title_internal(chat_session_id, req.query)
        chat_history = _get_recent_history_internal(chat_session_id, limit=10)
    else:
        chat_history = []

    # 2. Retrieve Flow State from last saved metadata
    last_meta = (_get_last_search_metadata_internal(chat_session_id) or {}) if chat_session_id else {}
    flow_state = last_meta.get("flow_state", "START") if last_meta else "START"

    # Reset commands — ONLY explicit reset commands restart from START
    # Greetings ('hi', 'hello') are handled conversationally mid-conversation
    reset_keywords = [
        "start new search", "reset chat", "home", "menu",
        "explore products", "browse products", "shop products",
        "explore business", "business listing", "explore listings", "browse listings",
        "browse categories", "all categories", "show categories",
        "browse locations", "explore locations", "change city", "all cities",
        "browse cities", "browse city"
    ]
    is_explicit_reset = any(k in q_lower for k in reset_keywords)
    is_greeting_at_start = flow_state == "START" and is_greeting(req.query)

    if is_explicit_reset:
        flow_state = "START"
        last_meta = {}  # Clear previous context
    elif is_greeting_at_start:
        flow_state = "START"  # Only reset if already at START

    # Blinkit Flow Trigger
    if q_lower in ["blinkit", "blinkit products"]:
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT category, COUNT(*) as cnt FROM blinkit WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY cnt DESC LIMIT 15"
            )
            categories = [row["category"] for row in cur.fetchall() if row["category"]]
        
        cat_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in categories]
        cat_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "flow_step",
            "data": "🟡 **Blinkit Categories** — Select a category to explore:",
            "suggestions": cat_chips,
            "search_metadata": {"flow_state": "AWAITING_BLINKIT_CATEGORY"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # BigBasket Flow Trigger
    if q_lower in ["bigbasket", "bigbasket products"]:
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT main_category, COUNT(*) as cnt FROM bigbasket WHERE main_category IS NOT NULL AND main_category != '' GROUP BY main_category ORDER BY cnt DESC LIMIT 15"
            )
            categories = [row["main_category"] for row in cur.fetchall() if row["main_category"]]
        
        cat_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in categories]
        cat_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "flow_step",
            "data": "🟢 **BigBasket Categories** — Select a category to explore:",
            "suggestions": cat_chips,
            "search_metadata": {"flow_state": "AWAITING_BIGBASKET_CATEGORY"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # Flipkart Flow Trigger
    if q_lower in ["flipkart", "flipkart products"]:
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT main_category, COUNT(*) as cnt FROM flipkart_products_new WHERE main_category IS NOT NULL AND main_category != '' GROUP BY main_category ORDER BY cnt DESC LIMIT 15"
            )
            categories = [row["main_category"] for row in cur.fetchall() if row["main_category"]]
        
        cat_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in categories]
        cat_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "flow_step",
            "data": "🔵 **Flipkart Categories** — Select a category to explore:",
            "suggestions": cat_chips,
            "search_metadata": {"flow_state": "AWAITING_FLIPKART_MAIN_CATEGORY"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # Amazon Flow Trigger
    if q_lower in ["amazon", "amazon products"]:
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT categoryName, COUNT(*) as cnt FROM amazon_products WHERE categoryName IS NOT NULL AND categoryName != '' GROUP BY categoryName ORDER BY cnt DESC LIMIT 15"
            )
            categories = [row["categoryName"] for row in cur.fetchall() if row["categoryName"]]
        
        cat_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in categories]
        cat_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "flow_step",
            "data": "🧡 **Amazon Categories** — Select a category to explore:",
            "suggestions": cat_chips,
            "search_metadata": {"flow_state": "AWAITING_AMAZON_CATEGORY"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp



    # -------------------------------------------------------------------------
    # STATE: START (Entry Point) — show greeting or route branch
    # -------------------------------------------------------------------------
    if flow_state == "START" or "start new search" in q_lower:
        # Business Listings branch — handle all forms of 'explore listings'
        if any(x in q_lower for x in [
            "business listing", "listings", "explore business", "explore listing",
            "browse listing", "all listings", "show listings", "list businesses"
        ]):
            with mysql_ctx() as conn:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT city_name FROM Top_cities_rank ORDER BY city_rank ASC, business_count DESC LIMIT 12")
                top_cities = [row["city_name"] for row in cur.fetchall() if row["city_name"]]
            if not top_cities:
                # Fallback to master_table
                with mysql_ctx() as conn:
                    cur = conn.cursor()
                    cur.execute("SELECT DISTINCT city FROM master_table WHERE city IS NOT NULL AND city != '' LIMIT 12")
                    top_cities = [row[0].title() for row in cur.fetchall() if row[0]]

            city_chips = [{"title": c, "action": "query_rewrite", "query": f"businesses in {c}"} for c in top_cities]
            city_chips.append({"title": "🌍 Search All Cities", "action": "query_rewrite", "query": "Any City businesses"})

            resp = {
                "type": "flow_step",
                "data": "🏢 Great! **Which city** would you like to search in? Select below or type a city name.",
                "suggestions": city_chips,
                "search_metadata": {"flow_state": "AWAITING_CITY_FOR_BIZ"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp
        
        # Products branch — handle all forms of 'explore products'
        elif any(x in q_lower for x in [
            "explore products", "browse products", "shop products", "buy products",
            "products", "shop online", "buy online", "marketplace", "search products"
        ]):
            with mysql_ctx() as conn:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT DISTINCT category_name FROM product_master WHERE category_name IS NOT NULL AND category_name != '' LIMIT 14")
                prod_cats = [row["category_name"] for row in cur.fetchall() if row["category_name"]]

            prod_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in prod_cats[:12]]
            # Add marketplace chips
            prod_chips += [
                {"title": "🛍️ Amazon", "action": "query_rewrite", "query": "Amazon products"},
                {"title": "🟡 Blinkit", "action": "query_rewrite", "query": "Blinkit"},
                {"title": "🟢 BigBasket", "action": "query_rewrite", "query": "BigBasket products"},
                {"title": "🔵 Flipkart", "action": "query_rewrite", "query": "Flipkart products"},
            ]

            resp = {
                "type": "flow_step",
                "data": "🛍️ **What product are you looking for?** Choose a category, marketplace or type a product name:",
                "suggestions": prod_chips,
                "search_metadata": {"flow_state": "AWAITING_QUERY_FOR_PROD"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

        # Browse Categories branch
        elif any(x in q_lower for x in ["browse categor", "browse all categor", "show categor", "all categor"]):
            with mysql_ctx() as conn:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT category_name FROM Top_categories_rank ORDER BY category_rank ASC LIMIT 16")
                top_cats = [row["category_name"] for row in cur.fetchall() if row["category_name"]]
            cat_chips = [{"title": c, "action": "query_rewrite", "query": f"best {c}s near me"} for c in top_cats]
            resp = {
                "type": "flow_step",
                "data": "📂 **Browse by Category** — Select what you're looking for:",
                "suggestions": cat_chips,
                "search_metadata": {"flow_state": "AWAITING_QUERY_FOR_BIZ"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

        # Browse Locations branch
        elif any(x in q_lower for x in ["browse location", "explore location", "all cities", "show cities", "all city", "change city", "browse cities", "browse city"]):
            with mysql_ctx() as conn:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT city_name FROM Top_cities_rank ORDER BY city_rank ASC LIMIT 16")
                top_cities = [row["city_name"] for row in cur.fetchall() if row["city_name"]]
            city_chips = [{"title": c, "action": "query_rewrite", "query": f"businesses in {c}"} for c in top_cities]
            resp = {
                "type": "flow_step",
                "data": "📍 **Browse by City** — Select your location:",
                "suggestions": city_chips,
                "search_metadata": {"flow_state": "AWAITING_CITY_FOR_BIZ"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

        else:
            # Greeting or unrecognized → welcome screen
            if not q_lower or is_greeting(req.query) or "start new search" in q_lower or "reset chat" in q_lower or "reset" in q_lower:
                resp = {
                    "type": "faq",
                    "data": "Welcome to Honeybee Digital AI.",
                    "suggestions": [
                        {"title": "🏢 Explore Listings", "action": "query_rewrite", "query": "Explore Listings"},
                        {"title": "🏷️ Best Deals", "action": "query_rewrite", "query": "Best Deals"},
                        {"title": "📦 Browse Products", "action": "query_rewrite", "query": "Browse Products"},
                        {"title": "📂 Browse Categories", "action": "query_rewrite", "query": "Browse Categories"},
                        {"title": "📍 Browse Location", "action": "query_rewrite", "query": "Browse Locations"},
                        {"title": "⭐ Top Rated Business", "action": "query_rewrite", "query": "Top Rated Businesses"},
                        {"title": "🔥 Trending Products", "action": "query_rewrite", "query": "Trending Products"},
                        {"title": "🆕 Recently Added", "action": "query_rewrite", "query": "Recently Added"},
                        {"title": "❓ Help", "action": "query_rewrite", "query": "Help"}
                    ],
                    "search_metadata": {"flow_state": "START"}
                }
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            # Otherwise fall through to NLU for direct query

    # -------------------------------------------------------------------------
    # STATE: AWAITING_BIGBASKET_CATEGORY — user is selecting a bigbasket category
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_BIGBASKET_CATEGORY":
        category_name = req.query.strip()
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT subcategory, COUNT(*) as cnt FROM bigbasket WHERE LOWER(main_category) = LOWER(%s) AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY cnt DESC LIMIT 15",
                (category_name,)
            )
            subcategories = [row["subcategory"] for row in cur.fetchall() if row["subcategory"]]
            
        sub_chips = [{"title": s, "action": "query_rewrite", "query": s} for s in subcategories]
        sub_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})
        
        resp = {
            "type": "flow_step",
            "data": f"📂 **{category_name}** — Choose a subcategory to view products:",
            "suggestions": sub_chips,
            "search_metadata": {
                "flow_state": "AWAITING_BIGBASKET_SUBCATEGORY",
                "bigbasket_category": category_name
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_BIGBASKET_SUBCATEGORY — user is selecting a bigbasket subcategory
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_BIGBASKET_SUBCATEGORY":
        # Check if user clicked Next
        q_lower = req.query.lower().strip()
        next_triggers = ["next", "more", "show more", "next results", "show next", "show next results"]
        is_next = any(t in q_lower for t in next_triggers)

        if is_next and last_meta:
            subcategory_name = last_meta.get("bigbasket_subcategory")
            category_name = last_meta.get("bigbasket_category")
            current_offset = last_meta.get("offset", 0) + last_meta.get("limit", 15)
        else:
            subcategory_name = req.query.strip()
            category_name = last_meta.get("bigbasket_category")
            current_offset = 0

        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT sku_id, product_name, product_url, rating, review, mrp, selling_price, main_category, subcategory FROM bigbasket WHERE LOWER(main_category) = LOWER(%s) AND LOWER(subcategory) = LOWER(%s) AND product_name IS NOT NULL LIMIT %s OFFSET %s",
                (category_name, subcategory_name, 16, current_offset)
            )
            products = cur.fetchall()
            
        has_next_page = len(products) > 15
        products = products[:15]

        formatted_products = []
        for p in products:
            sku_id = p.get("sku_id")
            product_url = p.get("product_url")
            image_url = None
            if product_url and sku_id:
                try:
                    parts = product_url.split(f"/pd/{sku_id}/")
                    if len(parts) > 1:
                        slug_part = parts[1].split("/")[0].split("?")[0]
                        image_url = f"https://www.bigbasket.com/media/uploads/p/s/{sku_id}_1-{slug_part}.jpg"
                except Exception:
                    pass
            if not image_url and sku_id:
                image_url = f"https://www.bigbasket.com/media/uploads/p/s/{sku_id}_1.jpg"

            price = float(p.get("selling_price") or 0.0)
            mrp = float(p.get("mrp") or 0.0)
            discount = max(0.0, mrp - price)
            
            formatted_products.append({
                "product_name": p.get("product_name"),
                "brand": "Generic Brand",
                "category": p.get("main_category"),
                "sub_category": p.get("subcategory"),
                "price": price,
                "mrp": mrp,
                "discount": discount,
                "quantity": "N/A",
                "availability": True,
                "image_url": image_url,
                "product_url": product_url,
                "marketplace_name": "BigBasket"
            })
            
        suggestions = []
        if has_next_page:
            suggestions.append({"title": "Next ⏭️", "action": "query_rewrite", "query": "Show Next Results"})
        suggestions.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "database_products",
            "intro": f"🛍️ Here are the products under the subcategory **{subcategory_name}**:",
            "data": formatted_products,
            "suggestions": suggestions,
            "search_metadata": {
                "flow_state": "AWAITING_BIGBASKET_SUBCATEGORY",
                "bigbasket_category": category_name,
                "bigbasket_subcategory": subcategory_name,
                "offset": current_offset,
                "limit": 15
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp


    # -------------------------------------------------------------------------
    # STATE: AWAITING_BLINKIT_CATEGORY — user is selecting a blinkit category
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_BLINKIT_CATEGORY":
        category_name = req.query.strip()
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT sub_category, COUNT(*) as cnt FROM blinkit WHERE LOWER(category) = LOWER(%s) AND sub_category IS NOT NULL GROUP BY sub_category ORDER BY cnt DESC LIMIT 15",
                (category_name,)
            )
            subcategories = [row["sub_category"] for row in cur.fetchall() if row["sub_category"]]
            
        sub_chips = [{"title": s, "action": "query_rewrite", "query": s} for s in subcategories]
        sub_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})
        
        resp = {
            "type": "flow_step",
            "data": f"📂 **{category_name}** — Choose a subcategory to view products:",
            "suggestions": sub_chips,
            "search_metadata": {
                "flow_state": "AWAITING_BLINKIT_SUBCATEGORY",
                "blinkit_category": category_name
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_BLINKIT_SUBCATEGORY — user is selecting a blinkit subcategory
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_BLINKIT_SUBCATEGORY":
        # Check if user clicked Next
        q_lower = req.query.lower().strip()
        next_triggers = ["next", "more", "show more", "next results", "show next", "show next results"]
        is_next = any(t in q_lower for t in next_triggers)

        if is_next and last_meta:
            subcategory_name = last_meta.get("blinkit_subcategory")
            category_name = last_meta.get("blinkit_category")
            current_offset = last_meta.get("offset", 0) + last_meta.get("limit", 15)
        else:
            subcategory_name = req.query.strip()
            category_name = last_meta.get("blinkit_category")
            current_offset = 0

        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT product_name, price, mrp, discount, quantity, brand, availability, image_url, product_url, category, sub_category FROM blinkit WHERE LOWER(category) = LOWER(%s) AND LOWER(sub_category) = LOWER(%s) AND product_name IS NOT NULL LIMIT %s OFFSET %s",
                (category_name, subcategory_name, 16, current_offset)
            )
            products = cur.fetchall()
            
        has_next_page = len(products) > 15
        products = products[:15]

        formatted_products = []
        for p in products:
            price = float(p.get("price") or 0.0)
            mrp = float(p.get("mrp") or 0.0)
            discount = float(p.get("discount") or 0.0)
            formatted_products.append({
                "product_name": p.get("product_name"),
                "brand": p.get("brand") or "Generic Brand",
                "category": p.get("category"),
                "sub_category": p.get("sub_category"),
                "price": price,
                "mrp": mrp,
                "discount": discount,
                "quantity": p.get("quantity") or "N/A",
                "availability": bool(p.get("availability")),
                "image_url": p.get("image_url"),
                "product_url": p.get("product_url"),
                "marketplace_name": "Blinkit"
            })
            
        suggestions = []
        if has_next_page:
            suggestions.append({"title": "Next ⏭️", "action": "query_rewrite", "query": "Show Next Results"})
        suggestions.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "database_products",
            "intro": f"🛍️ Here are the products under the subcategory **{subcategory_name}**:",
            "data": formatted_products,
            "suggestions": suggestions,
            "search_metadata": {
                "flow_state": "AWAITING_BLINKIT_SUBCATEGORY",
                "blinkit_category": category_name,
                "blinkit_subcategory": subcategory_name,
                "offset": current_offset,
                "limit": 15
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp


    # -------------------------------------------------------------------------
    # STATE: AWAITING_BLINKIT_PRODUCT — user is selecting a blinkit product
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_BLINKIT_PRODUCT":
        product_name = req.query.strip()
        category_name = last_meta.get("blinkit_category")
        subcategory_name = last_meta.get("blinkit_subcategory")
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT product_name, price, mrp, discount, quantity, brand, availability FROM blinkit WHERE LOWER(category) = LOWER(%s) AND LOWER(sub_category) = LOWER(%s) AND LOWER(product_name) = LOWER(%s) LIMIT 1",
                (category_name, subcategory_name, product_name)
            )
            prod_details = cur.fetchone()
            
        if prod_details:
            price = prod_details.get("price", 0.0)
            mrp = prod_details.get("mrp", 0.0)
            discount = prod_details.get("discount", 0.0)
            quantity = prod_details.get("quantity", "N/A")
            brand = prod_details.get("brand", "N/A")
            avail = "Yes" if prod_details.get("availability") else "No"
            
            detail_msg = (
                f"📋 **Product Details:**\n\n"
                f"**Name:** {product_name}\n"
                f"**Brand:** {brand}\n"
                f"**Price:** ₹{price} (MRP: ₹{mrp}, Discount: ₹{discount})\n"
                f"**Quantity:** {quantity}\n"
                f"**Available:** {avail}"
            )
        else:
            detail_msg = f"❌ Sorry, we couldn't find details for **{product_name}**."
            
        resp = {
            "type": "faq",
            "data": detail_msg,
            "suggestions": [
                {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"}
            ],
            "search_metadata": {"flow_state": "START"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_FLIPKART_MAIN_CATEGORY — user is selecting a flipkart main category
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_FLIPKART_MAIN_CATEGORY":
        main_category = req.query.strip()
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT subcategory, COUNT(*) as cnt FROM flipkart_products_new WHERE LOWER(main_category) = LOWER(%s) AND subcategory IS NOT NULL GROUP BY subcategory ORDER BY cnt DESC LIMIT 15",
                (main_category,)
            )
            subcategories = [row["subcategory"] for row in cur.fetchall() if row["subcategory"]]
            
        sub_chips = [{"title": s, "action": "query_rewrite", "query": s} for s in subcategories]
        sub_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})
        
        resp = {
            "type": "flow_step",
            "data": f"📂 **{main_category}** — Choose a subcategory to explore:",
            "suggestions": sub_chips,
            "search_metadata": {
                "flow_state": "AWAITING_FLIPKART_SUBCATEGORY",
                "flipkart_main_category": main_category
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_FLIPKART_SUBCATEGORY — user is selecting a flipkart subcategory
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_FLIPKART_SUBCATEGORY":
        subcategory = req.query.strip()
        main_category = last_meta.get("flipkart_main_category")
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT leaf_category, COUNT(*) as cnt FROM flipkart_products_new WHERE LOWER(main_category) = LOWER(%s) AND LOWER(subcategory) = LOWER(%s) AND leaf_category IS NOT NULL GROUP BY leaf_category ORDER BY cnt DESC LIMIT 15",
                (main_category, subcategory)
            )
            leaf_categories = [row["leaf_category"] for row in cur.fetchall() if row["leaf_category"]]
            
        leaf_chips = [{"title": l, "action": "query_rewrite", "query": l} for l in leaf_categories]
        leaf_chips.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})
        
        resp = {
            "type": "flow_step",
            "data": f"📂 **{subcategory}** — Choose a leaf category to view products:",
            "suggestions": leaf_chips,
            "search_metadata": {
                "flow_state": "AWAITING_FLIPKART_LEAF_CATEGORY",
                "flipkart_main_category": main_category,
                "flipkart_subcategory": subcategory
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_FLIPKART_LEAF_CATEGORY — user is selecting a flipkart leaf category
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_FLIPKART_LEAF_CATEGORY":
        # Check if user clicked Next
        q_lower = req.query.lower().strip()
        next_triggers = ["next", "more", "show more", "next results", "show next", "show next results"]
        is_next = any(t in q_lower for t in next_triggers)

        if is_next and last_meta:
            leaf_category = last_meta.get("flipkart_leaf_category")
            subcategory = last_meta.get("flipkart_subcategory")
            main_category = last_meta.get("flipkart_main_category")
            current_offset = last_meta.get("offset", 0) + last_meta.get("limit", 15)
        else:
            leaf_category = req.query.strip()
            main_category = last_meta.get("flipkart_main_category")
            subcategory = last_meta.get("flipkart_subcategory")
            current_offset = 0

        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT product_id, product_name, product_url, rating, reviews, mrp, price, discount, image_url, brand, spec_bullets FROM flipkart_products_new WHERE LOWER(main_category) = LOWER(%s) AND LOWER(subcategory) = LOWER(%s) AND LOWER(leaf_category) = LOWER(%s) AND product_name IS NOT NULL LIMIT %s OFFSET %s",
                (main_category, subcategory, leaf_category, 16, current_offset)
            )
            products = cur.fetchall()
            
        has_next_page = len(products) > 15
        products = products[:15]

        formatted_products = []
        for p in products:
            price = float(p.get("price") or 0.0)
            mrp = float(p.get("mrp") or 0.0) if p.get("mrp") else None
            
            discount_val = 0.0
            if mrp and mrp > price:
                discount_val = mrp - price
            
            formatted_products.append({
                "product_name": p.get("product_name"),
                "brand": p.get("brand") or "Generic Brand",
                "category": p.get("main_category") or "",
                "sub_category": p.get("subcategory") or "",
                "price": price,
                "mrp": mrp or price,
                "discount": discount_val,
                "quantity": "N/A",
                "availability": True,
                "image_url": p.get("image_url"),
                "product_url": p.get("product_url"),
                "marketplace_name": "Flipkart",
                "description": p.get("spec_bullets") or ""
            })
            
        suggestions = []
        if has_next_page:
            suggestions.append({"title": "Next ⏭️", "action": "query_rewrite", "query": "Show Next Results"})
        suggestions.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "database_products",
            "intro": f"🛍️ Here are the products under the leaf category **{leaf_category}**:",
            "data": formatted_products,
            "suggestions": suggestions,
            "search_metadata": {
                "flow_state": "AWAITING_FLIPKART_LEAF_CATEGORY",
                "flipkart_main_category": main_category,
                "flipkart_subcategory": subcategory,
                "flipkart_leaf_category": leaf_category,
                "offset": current_offset,
                "limit": 15
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp


    # -------------------------------------------------------------------------
    # STATE: AWAITING_AMAZON_CATEGORY — user is selecting an amazon category
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_AMAZON_CATEGORY":
        # Check if user clicked Next
        q_lower = req.query.lower().strip()
        next_triggers = ["next", "more", "show more", "next results", "show next", "show next results"]
        is_next = any(t in q_lower for t in next_triggers)

        if is_next and last_meta:
            category_name = last_meta.get("amazon_category")
            current_offset = last_meta.get("offset", 0) + last_meta.get("limit", 15)
        else:
            category_name = req.query.strip()
            current_offset = 0

        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT id, asin, title, imgUrl, productUrl, stars, reviews, price, listPrice, categoryName, isBestSeller FROM amazon_products WHERE LOWER(categoryName) = LOWER(%s) AND title IS NOT NULL LIMIT %s OFFSET %s",
                (category_name, 16, current_offset)
            )
            products = cur.fetchall()
            
        has_next_page = len(products) > 15
        products = products[:15]

        formatted_products = []
        for p in products:
            price = float(p.get("price") or 0.0)
            list_price = float(p.get("listPrice") or 0.0) if p.get("listPrice") else None
            
            discount_val = 0.0
            if list_price and list_price > price:
                discount_val = list_price - price
            
            reviews_count = int(p.get("reviews") or 0)
            stars_rating = float(p.get("stars") or 0.0)
            
            formatted_products.append({
                "product_name": p.get("title") or "Product",
                "brand": "Generic Brand",
                "category": p.get("categoryName") or "",
                "sub_category": "",
                "price": price,
                "mrp": list_price or price,
                "discount": discount_val,
                "quantity": "N/A",
                "availability": True,
                "image_url": p.get("imgUrl"),
                "product_url": p.get("productUrl"),
                "marketplace_name": "Amazon",
                "asin": p.get("asin"),
                "rating": stars_rating,
                "reviews": reviews_count
            })
            
        suggestions = []
        if has_next_page:
            suggestions.append({"title": "Next ⏭️", "action": "query_rewrite", "query": "Show Next Results"})
        suggestions.append({"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"})

        resp = {
            "type": "database_products",
            "intro": f"🛍️ Here are the products under the category **{category_name}**:",
            "data": formatted_products,
            "suggestions": suggestions,
            "search_metadata": {
                "flow_state": "AWAITING_AMAZON_CATEGORY",
                "amazon_category": category_name,
                "offset": current_offset,
                "limit": 15
            }
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp




    # -------------------------------------------------------------------------
    # STATE: AWAITING_CITY_FOR_BIZ — user is selecting/typing a city
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_CITY_FOR_BIZ":
        # Try to match typed city against known cities; fall back to raw input
        typed_city = q_lower.strip()
        resolved_city = None
        if "any" in typed_city or "all" in typed_city or "everywhere" in typed_city:
            resolved_city = None  # Search all cities
        else:
            for c in sorted(CITIES_CACHE, key=len, reverse=True):
                if c and len(c) >= 3 and c.lower() in typed_city:
                    resolved_city = c.title()
                    break
            if not resolved_city:
                resolved_city = typed_city.title()

        # Now ask what category they want
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT category_name FROM Top_categories_rank ORDER BY category_rank ASC, business_count DESC LIMIT 14")
            cats = [row["category_name"] for row in cur.fetchall() if row["category_name"]]

        city_display = f"**{resolved_city}**" if resolved_city else "**all cities**"
        cat_chips = [{"title": c, "action": "query_rewrite", "query": f"best {c}s in {resolved_city}" if resolved_city else f"best {c}s"} for c in cats]

        resp = {
            "type": "flow_step",
            "data": f"✅ Got it — searching in {city_display}!\n\n🔍 **What are you looking for?** Select a category or type your query:",
            "suggestions": cat_chips,
            "search_metadata": {"flow_state": "AWAITING_QUERY_FOR_BIZ", "city": resolved_city}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_CITY_FOR_PROD — legacy path (now merged into START)
    # -------------------------------------------------------------------------
    if flow_state == "AWAITING_CITY_FOR_PROD":
        city_name = q_lower.strip() if "any" not in q_lower and "skip" not in q_lower else None

        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT DISTINCT category_name FROM product_master WHERE category_name IS NOT NULL LIMIT 12")
            prod_cats = [row["category_name"] for row in cur.fetchall() if row["category_name"]]
        prod_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in prod_cats]

        display_city = f" in **{city_name.title()}**" if city_name else " everywhere"
        resp = {
            "type": "flow_step",
            "data": f"✅ Searching{display_city}. What product do you want to find? (e.g. 'Smartphones', 'Running Shoes')",
            "suggestions": prod_chips,
            "search_metadata": {"flow_state": "AWAITING_QUERY_FOR_PROD", "city": city_name}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    # -------------------------------------------------------------------------
    # GLOBAL NLU — parse query intent and entities
    # -------------------------------------------------------------------------
    nlu = await anyio.to_thread.run_sync(parse_query_nlu, req.query, lang, chat_history)
    intents = nlu.get("intents", ["Unknown"])
    primary_intent = intents[0] if intents else "Unknown"
    entities = nlu.get("entities", {})

    # -------------------------------------------------------------------------
    # MY BUSINESS AUTH GATE
    # -------------------------------------------------------------------------
    is_my_biz_query = any(x in q_lower for x in [
        "show my business", "show business", "my business",
        "update my business", "update business",
        "manage product", "manage products",
        "manage deal", "manage deals"
    ])
    if is_my_biz_query:
        if not session_phone and not session_email:
            resp = {"type": "faq", "data": "Please login with your mobile number or email to manage your business profile. Click 'Login' at the top!"}
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

        from business_by_phone import get_businesses_by_phone, get_businesses_by_email
        try:
            raw_matches = get_businesses_by_phone(session_phone) if session_phone else get_businesses_by_email(session_email)
            if not raw_matches:
                resp = {"type": "faq", "data": "I couldn't find a business registered with your credentials."}
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
                
            mapped = map_business_fields(raw_matches)
            biz_row = raw_matches[0]

            if "manage product" in q_lower or "show product" in q_lower:
                with mysql_ctx() as conn:
                    cur = conn.cursor(dictionary=True)
                    print("REQ BUSINESS ID:", req.business_id)
                    selected_business_id = req.business_id
                    if not selected_business_id:
                        raise HTTPException(400, "No business selected.")
                        
                    cur.execute( f"SELECT * FROM {PRODUCT_TABLE} WHERE business_id = %s", (selected_business_id,))
                        
                    items = cur.fetchall()
                    for item in items:
                        if item.get("price") is not None:
                            item["price"] = float(item["price"])
                        if item.get("created_at"):
                            item["created_at"] = item["created_at"].isoformat()
                    print("Products found:", items)
                if not items:
                    resp = {"type": "faq", "data": "You haven't added any products yet. Click 'Add Product' to start!"}
                else:
                    resp = {"type": "manage_products", "content": items, "intro": "Here are your products:"}
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            
            elif "manage deal" in q_lower or "show deal" in q_lower:
                with mysql_ctx() as conn:
                    cur = conn.cursor(dictionary=True)
                    selected_business_id = req.business_id
                    if not selected_business_id:
                        raise HTTPException(400, "No business selected.")
                        
                    cur.execute( f"SELECT * FROM {DEAL_TABLE} WHERE business_id = %s", (selected_business_id,))
                        
                    items = cur.fetchall()
                    for item in items:
                        if item.get("expiry_date"):
                            item["expiry_date"] = item["expiry_date"].isoformat()
                        if item.get("created_at"):
                            item["created_at"] = item["created_at"].isoformat()
                if not items:
                    resp = {"type": "faq", "data": "You haven't added any deals yet. Click 'Add Deal' to start!"}
                else:
                    resp = {"type": "manage_deals", "content": items, "intro": "Here are your active deals:"}
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            
            elif "show my business" in q_lower:
                mapped = map_business_fields(raw_matches)
                fields = [
                    ("name", "Business Name"), ("category", "Category"),
                    ("phone_number", "Phone"), ("address", "Address"),
                    ("area", "Area"), ("city", "City"),
                    ("state", "State"), ("website", "Website")
                ]
                suggs = []
                for fk, fn in fields:
                    val = biz_row.get(fk)
                    is_miss = not val or str(val).strip().lower() in ["none", "", "null", "not available"]
                    suggs.append({
                        "field": fk,
                        "title": f"Update {fn}",
                        "reason": f"{fn} is missing — add it now!" if is_miss else f"Current: {val}",
                        "action": f"Update {fn}",
                        "is_missing": is_miss
                    })
                suggs.sort(key=lambda x: not x["is_missing"])
                resp = {
                    "type": "database",
                    "data": mapped,
                    "intro": f"The businesses registered with your account:"
                }
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            
            elif "update my business" in q_lower:
                mapped = map_business_fields(raw_matches)
                fields = [
                    ("name", "Business Name"), ("category", "Category"),
                    ("phone_number", "Phone"), ("address", "Address"),
                    ("area", "Area"), ("city", "City"),
                    ("state", "State"), ("website", "Website")
                ]
                suggs = []
                for fk, fn in fields:
                    val = biz_row.get(fk)
                    is_miss = not val or str(val).strip().lower() in ["none", "", "null", "not available"]
                    suggs.append({
                        "field": fk,
                        "title": f"Update {fn}",
                        "reason": f"{fn} is missing — add it now!" if is_miss else f"Current: {val}",
                        "action": f"Update {fn}",
                        "is_missing": is_miss
                    })
                suggs.sort(key=lambda x: not x["is_missing"])
                resp = {
                    "type": "database",
                    "data": mapped,
                    "intro": f"These are the businesses registered with your account. Click update to update the business."
                }
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            
            else:
                mapped = map_business_fields([biz_row])[0]
                suggs = [{"title": "Update Profile", "action": "query_rewrite", "query": "update my business"}]
                resp = {
                    "type": "database",
                    "data": [mapped],
                    "intro": "Here is the business registered with your account:",
                    "prompt": "Tap any field below to update your profile:",
                    "suggestions": suggs
                }
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
        except Exception:
            return {"type": "faq", "data": "I had trouble finding your business. Please ensure you are logged in."}

    # -------------------------------------------------------------------------
    # COMPARISON intent
    # -------------------------------------------------------------------------
    if primary_intent == "Comparison" or "compare" in q_lower:
        biz_names = re.split(r'\band\b|\bvs\b|,', q_lower.replace("compare", ""))
        biz_names = [n.strip() for n in biz_names if n.strip()]

        matched_listings = []
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            for name in biz_names[:3]:
                if not name:
                    continue
                cur.execute("SELECT * FROM master_table WHERE LOWER(business_name) LIKE %s LIMIT 1", (f"%{name}%",))
                row = cur.fetchone()
                if row:
                    matched_listings.append(row)

        if len(matched_listings) >= 2:
            mapped = map_business_fields(matched_listings)
            b1, b2 = mapped[0], mapped[1]
            r1 = float(b1.get("ratings") or 0)
            r2 = float(b2.get("ratings") or 0)
            rc1 = int(b1.get("reviews_count") or 0)
            rc2 = int(b2.get("reviews_count") or 0)
            winner = b1.get("business_name") if r1 >= r2 else b2.get("business_name")
            intro_ai = (
                f"Here's a side-by-side comparison of **{b1.get('business_name')}** "
                f"(⭐ {r1}, {rc1} reviews) vs **{b2.get('business_name')}** "
                f"(⭐ {r2}, {rc2} reviews). "
                f"**{winner}** leads on rating!"
            )
            resp = {
                "type": "database",
                "data": mapped,
                "intro": intro_ai,
                "prompt": "Here is the side-by-side comparison.",
                "suggestions": [
                    {"title": f"Show {mapped[0]['business_name']} Reviews ⭐", "action": "query_rewrite", "query": f"reviews of {mapped[0]['business_name']}"},
                    {"title": f"Show {mapped[1]['business_name']} Reviews ⭐", "action": "query_rewrite", "query": f"reviews of {mapped[1]['business_name']}"}
                ]
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp
        else:
            resp = {
                "type": "faq",
                "data": "I couldn't find a side-by-side comparison for those businesses. Please make sure the business names are spelled correctly and they exist in our directory.",
                "suggestions": [
                    {"title": "🏢 Explore Listings", "action": "query_rewrite", "query": "explore business listings"},
                    {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"}
                ],
                "search_metadata": {"flow_state": "START"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

    cmd_map = {
        "add product": "start_add_product",
        "add deal": "start_add_deal",
        "add business": "add_new_business",
        "new business": "add_new_business",
        "reset chat": "reset_chat",
        "login": "login_trigger"
    }
    if q_lower in cmd_map:
        return {"type": "command", "command": cmd_map[q_lower]}

    is_next = any(w in q_lower for w in ["next", "more", "next results", "show more", "show next"])
    is_prev = any(w in q_lower for w in ["prev", "previous"])

    # -------------------------------------------------------------------------
    # Entity extraction — merge NLU with last session context
    # -------------------------------------------------------------------------
    merged_meta = rewrite_query_with_context(req.query, last_meta) if last_meta else None
    
    if merged_meta:
        city = merged_meta.get("city")
        category = merged_meta.get("category")
        area = merged_meta.get("area")
        marketplace = merged_meta.get("marketplace")
        listing_source = merged_meta.get("listing_source")
        current_offset = merged_meta.get("offset", 0)
        current_limit = merged_meta.get("limit", 10)
        resolved_ranking = merged_meta.get("ranking")
        flow_state = merged_meta.get("flow_state", flow_state)
        
        filters = entities.get("filters", {})
        if merged_meta.get("open_only"):
            filters["open_now"] = True
        if merged_meta.get("veg"):
            filters["veg"] = True
        if merged_meta.get("min_rating"):
            filters["min_rating"] = merged_meta.get("min_rating")
    else:
        city = entities.get("location", {}).get("city")
        category = entities.get("category")
        area = entities.get("location", {}).get("area")
        marketplace = entities.get("marketplace")
        listing_source = entities.get("listing_source")
        current_offset = 0
        current_limit = entities.get("limit") or 10
        
        ranking_map = {
            "Budget Search": "budget",
            "Luxury Search": "luxury",
            "Highest Rated": "highest_rated",
            "Most Reviewed": "most_reviewed",
            "Recently Added": "newest",
            "Trending": "trending"
        }
        resolved_ranking = entities.get("ranking") or ranking_map.get(nlu.get("intents", [""])[0])
        filters = entities.get("filters", {})

    # Detect intent — Product Search and marketplace take priority over business search
    # This prevents "Smartphones in Mumbai" from routing to business search
    if primary_intent == "Product Search" or marketplace:
        flow_state = "EXPLORING_PROD"
    elif listing_source:
        # Source-specific listing search (e.g. "restaurants on JustDial")
        flow_state = "EXPLORING_MULTISOURCE_BIZ"
    elif primary_intent == "Business Search" or (category and city):
        flow_state = "EXPLORING_BIZ"

    # -------------------------------------------------------------------------
    # STATE: AWAITING_QUERY_FOR_BIZ or EXPLORING_BIZ — business search
    # -------------------------------------------------------------------------
    if flow_state in ["AWAITING_QUERY_FOR_BIZ", "EXPLORING_BIZ"]:
        # Enrich city from query if not yet set
        if not city:
            for c in sorted(CITIES_CACHE, key=len, reverse=True):
                if c and len(c) >= 3 and c.lower() in q_lower:
                    city = c
                    break

        # Enrich category from query if not yet set
        if not category and not is_next and not is_prev:
            for cat in sorted(CATEGORIES_CACHE, key=len, reverse=True):
                if cat and len(cat) >= 3 and cat.lower() in q_lower:
                    category = cat
                    break
            if not category:
                # Use the raw query part before "in <city>" as category
                parts = q_lower.split(" in ")
                raw_cat = parts[0].strip()
                # Strip common prefixes
                for prefix in ["best ", "top ", "find ", "show ", "search "]:
                    raw_cat = raw_cat.replace(prefix, "")
                if raw_cat and len(raw_cat) >= 3:
                    category = raw_cat.strip()

        results = query_local_businesses(
            category=category,
            city=city,
            area=area,
            min_rating=filters.get("min_rating"),
            open_only=filters.get("open_now", False),
            filters=filters,
            ranking_intent=resolved_ranking,
            offset=current_offset,
            limit=current_limit
        )

        # ── Multi-source fallback: if master_table returns 0, search all listing tables ──
        if not results:
            print(f"[CHAT] master_table returned 0 results for city={city}, category={category} — trying all listing sources")
            fallback = query_all_listing_sources(
                category=category,
                city=city,
                area=area,
                limit=current_limit,
                offset=current_offset,
                ranking_intent=resolved_ranking,
            )
            if fallback:
                results = fallback
                print(f"[CHAT] Multi-source fallback found {len(results)} results")

        if results or current_offset > 0:
            mapped_results = map_business_fields(results)
            total_count = count_local_businesses(category, city, area=area, filters=filters)
            # If count from master_table is 0 but we got fallback results, use len(results) as count
            if total_count == 0 and results:
                total_count = len(results)

            summary_data = await anyio.to_thread.run_sync(
                generate_conversational_summary_and_chips,
                req.query,
                mapped_results,
                lang,
                chat_history
            )

            # Build context-aware chips that include city+category in query text
            context_chips = _build_context_chips(category, city, "EXPLORING_BIZ")
            suggestions = [{"title": s, "action": "query_rewrite", "query": s} for s in context_chips]

            if total_count > current_offset + current_limit:
                suggestions.insert(0, {"title": "Next 10 Results ⏭️", "action": "next_option", "query": "Show Next 10 Results"})
            if current_offset > 0:
                suggestions.append({"title": "Previous Results ⏮️", "action": "prev_option", "query": "Previous Results"})

            resp = {
                "type": "database",
                "data": mapped_results,
                "intro": summary_data.get("summary", ""),
                "prompt": "Use the options below to filter or explore more:",
                "suggestions": suggestions,
                "search_metadata": {
                    "flow_state": "EXPLORING_BIZ",
                    "category": category,
                    "city": city,
                    "area": area,
                    "offset": current_offset,
                    "limit": current_limit
                }
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp
        else:
            # No results — query alternative cities from DB and suggest them
            no_results_data = await anyio.to_thread.run_sync(
                generate_no_results_response,
                req.query, category, city, lang, chat_history
            )
            suggestions = [{"title": s, "action": "query_rewrite", "query": s} for s in no_results_data.get("suggestions", [])]
            resp = {
                "type": "faq",
                "data": no_results_data.get("summary", ""),
                "suggestions": suggestions,
                "search_metadata": {
                    "flow_state": "EXPLORING_BIZ",
                    "city": city,
                    "category": category
                }
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp


    # -------------------------------------------------------------------------
    # STATE: EXPLORING_MULTISOURCE_BIZ — source-specific listing search
    # (e.g. "restaurants on JustDial in Ahmedabad", "hotels on MagicPin")
    # -------------------------------------------------------------------------
    if flow_state == "EXPLORING_MULTISOURCE_BIZ":
        results = query_all_listing_sources(
            category=category,
            city=city,
            area=area,
            source_filter=listing_source,
            limit=current_limit,
            offset=current_offset,
            ranking_intent=resolved_ranking,
        )

        if results or current_offset > 0:
            source_label = results[0]["source"] if results else (listing_source or "all sources")
            summary_data = await anyio.to_thread.run_sync(
                generate_conversational_summary_and_chips,
                req.query, results, lang, chat_history
            )
            context_chips = _build_context_chips(category, city, "EXPLORING_BIZ")
            suggestions = [{"title": s, "action": "query_rewrite", "query": s} for s in context_chips]
            if len(results) == current_limit:
                suggestions.insert(0, {"title": "Next 10 Results ⏭️", "action": "next_option", "query": "Show Next 10 Results"})
            if current_offset > 0:
                suggestions.append({"title": "Previous Results ⏮️", "action": "prev_option", "query": "Previous Results"})

            resp = {
                "type": "database",
                "data": results,
                "intro": summary_data.get("summary", ""),
                "prompt": f"Results from {source_label}. Use the filters below:",
                "suggestions": suggestions,
                "search_metadata": {
                    "flow_state": "EXPLORING_MULTISOURCE_BIZ",
                    "category": category,
                    "city": city,
                    "area": area,
                    "listing_source": listing_source,
                    "offset": current_offset,
                    "limit": current_limit,
                }
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp
        else:
            resp = {
                "type": "faq",
                "data": (
                    f"No listings found on **{listing_source or 'this source'}** for **{category or 'businesses'}**"
                    + (f" in **{city}**" if city else "") + "."
                    " Try searching all sources or a different category."
                ),
                "suggestions": [
                    {"title": "🏢 Explore All Listings", "action": "query_rewrite", "query": f"{category or 'businesses'} in {city or 'India'}"},
                    {"title": "📂 Browse Categories", "action": "query_rewrite", "query": "browse categories"},
                    {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"},
                ],
                "search_metadata": {"flow_state": "START"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

    # -------------------------------------------------------------------------
    # STATE: AWAITING_QUERY_FOR_PROD or EXPLORING_PROD — product search
    # -------------------------------------------------------------------------
    if flow_state in ["AWAITING_QUERY_FOR_PROD", "EXPLORING_PROD"]:
        product_category = entities.get("category")
        product_name = entities.get("product")
        if not product_name and not product_category and not is_next and not is_prev:
            product_name = q_lower.strip()
            # Strip common filler words
            for prefix in ["show me ", "find ", "search ", "i want ", "buy "]:
                if product_name.startswith(prefix):
                    product_name = product_name[len(prefix):].strip()

        with mysql_ctx() as conn:
            cur = conn.cursor()
            query_str = "SELECT * FROM product_master WHERE 1=1"
            params = []

            # Marketplace filter (e.g. 'Blinkit products', 'Amazon earphones')
            if marketplace:
                query_str += " AND LOWER(marketplace_name) = LOWER(%s)"
                params.append(marketplace)

            # Product name / brand match (no city filter — product_master has no city column)
            raw_term = product_name or product_category or q_lower
            search_term = clean_query_term(raw_term, marketplace=marketplace)
            search_term = search_term if search_term and search_term.lower() not in ("any product", "", "all") else None
            
            if search_term:
                query_str += " AND (LOWER(product_name) LIKE %s OR LOWER(brand) LIKE %s OR LOWER(category_name) LIKE %s)"
                params.extend([f"%{search_term.lower()}%", f"%{search_term.lower()}%", f"%{search_term.lower()}%"])

            # Only show available products
            query_str += " AND (availability IS NULL OR LOWER(availability) NOT IN ('out of stock', 'unavailable'))"

            if resolved_ranking == "highest_rated":
                query_str += " ORDER BY stars DESC, reviews DESC"
            elif resolved_ranking == "budget":
                query_str += " ORDER BY price ASC"
            elif resolved_ranking == "most_reviewed":
                query_str += " ORDER BY reviews DESC"
            else:
                query_str += " ORDER BY is_best_seller DESC, stars DESC, reviews DESC"

            query_str += f" LIMIT {current_limit} OFFSET {current_offset}"

            cur.execute(query_str, tuple(params))
            columns = [col[0] for col in cur.description]
            prod_results = [dict(zip(columns, row)) for row in cur.fetchall()]

        if prod_results:
            # Map to unified product schema
            formatted_products = []
            for p in prod_results:
                price_val = p.get("price")
                list_price_val = p.get("list_price")
                formatted_products.append({
                    "product_name": p.get("product_name") or "Product",
                    "brand": p.get("brand") or p.get("manufacturer") or "",
                    "price": float(price_val) if price_val else None,
                    "list_price": float(list_price_val) if list_price_val else None,
                    "stars": float(p.get("stars") or 0),
                    "reviews": int(p.get("reviews") or 0),
                    "category_name": p.get("category_name") or "",
                    "image_url": p.get("img_url") or "",
                    "product_url": p.get("product_url") or "",
                    "description": (p.get("description") or "")[:200],
                    "is_best_seller": bool(p.get("is_best_seller")),
                    "marketplace_name": p.get("marketplace_name") or "",
                })

            summary_data = await anyio.to_thread.run_sync(
                generate_conversational_summary_and_chips,
                req.query, formatted_products, lang, chat_history
            )

            context_chips = _build_context_chips(product_name or product_category or "products", city, "EXPLORING_PROD")
            suggestions = [{"title": s, "action": "query_rewrite", "query": s} for s in context_chips]
            # Add marketplace-specific chips if browsing without filter
            if not marketplace:
                suggestions += [
                    {"title": "🛍️ Amazon Products", "action": "query_rewrite", "query": f"Amazon {product_name or product_category or 'products'}"},
                    {"title": "🟡 Blinkit Products", "action": "query_rewrite", "query": f"Blinkit {product_name or product_category or 'products'}"},
                ]

            if len(formatted_products) == current_limit:
                suggestions.insert(0, {"title": "Next 10 Results ⏭️", "action": "next_option", "query": "Show Next 10 Results"})
            if current_offset > 0:
                suggestions.append({"title": "Previous Results ⏮️", "action": "prev_option", "query": "Previous Results"})

            resp = {
                "type": "database_products",
                "data": formatted_products,
                "intro": summary_data.get("summary", ""),
                "prompt": "Here are the top products I found. How would you like to refine this?",
                "suggestions": suggestions,
                "search_metadata": {
                    "flow_state": "EXPLORING_PROD",
                    "product_name": product_name,
                    "category": product_category,
                    "marketplace": marketplace,
                    "city": city,
                    "offset": current_offset,
                    "limit": current_limit
                }
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp
        else:
            resp = {
                "type": "faq",
                "data": (
                    f"I couldn't find any products matching **'{product_name or product_category or q_lower}'**. "
                    "Try a broader search term or pick a category below."
                ),
                "suggestions": [
                    {"title": "🛍️ Browse Product Categories", "action": "query_rewrite", "query": "explore products"},
                    {"title": "⭐ Top Rated Products", "action": "query_rewrite", "query": "top rated products"},
                    {"title": "💰 Budget Products", "action": "query_rewrite", "query": "budget products"},
                    {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"}
                ],
                "search_metadata": {"flow_state": "EXPLORING_PROD", "city": city}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

    # -------------------------------------------------------------------------
    # FINAL FALLBACK — nudge user back to the welcome screen
    # -------------------------------------------------------------------------
    # Try FAQ/conversational handler first
    conv_resp = get_ai_conversational_response(req.query, lang, chat_history)
    if conv_resp and conv_resp.get("response"):
        resp = {
            "type": "faq",
            "data": conv_resp["response"],
            "suggestions": conv_resp.get("suggestions", [
                {"title": "🏢 Business Listings", "action": "query_rewrite", "query": "explore business listings"},
                {"title": "🛍️ Products", "action": "query_rewrite", "query": "explore products"},
                {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"}
            ]),
            "search_metadata": {"flow_state": "START"}
        }
        if chat_session_id:
            _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
        return resp

    resp = {
        "type": "faq",
        "data": "I'm not sure what you're looking for. Let's start fresh!",
        "suggestions": [
            {"title": "🏢 Business Listings", "action": "query_rewrite", "query": "explore business listings"},
            {"title": "🛍️ Products", "action": "query_rewrite", "query": "explore products"},
            {"title": "🔄 Start New Search", "action": "query_rewrite", "query": "start new search"}
        ],
        "search_metadata": {"flow_state": "START"}
    }
    if chat_session_id:
        _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
    return resp
