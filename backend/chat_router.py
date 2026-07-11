import json
import re
import anyio
import sqlite3
from typing import Optional
from fastapi import HTTPException

from pydantic import BaseModel
from mysql_pool import mysql_ctx
from db_pool import db_context
from assistant_manager import (
    parse_query_nlu,
    generate_conversational_summary_and_chips,
    get_ai_conversational_response,
    generate_no_results_response,
    is_greeting,
    CITIES_CACHE, CATEGORIES_CACHE, AREAS_CACHE
)
from db_pool import pool

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
    DATABASE_URL,
    search_cache
)


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

    # Reset commands always restart from START
    reset_keywords = ["start new search", "reset chat", "hi", "hello", "home", "menu", "explore products", "explore business", "explore business listings"]
    if q_lower in reset_keywords or "explore products" in q_lower or "explore business" in q_lower:
        flow_state = "START"
        last_meta = {}  # Clear previous context

    # -------------------------------------------------------------------------
    # STATE: START (Entry Point) — show greeting or route branch
    # -------------------------------------------------------------------------
    if flow_state == "START" or q_lower == "start new search":
        # Business Listings branch
        if any(x in q_lower for x in ["business listing", "listings", "explore business"]):
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
        
        # Products branch
        elif any(x in q_lower for x in ["products", "shop", "buy", "item"]):
            with mysql_ctx() as conn:
                cur = conn.cursor(dictionary=True)
                cur.execute("SELECT DISTINCT category_name FROM product_master WHERE category_name IS NOT NULL AND category_name != '' LIMIT 14")
                prod_cats = [row["category_name"] for row in cur.fetchall() if row["category_name"]]

            prod_chips = [{"title": c, "action": "query_rewrite", "query": c} for c in prod_cats[:12]]
            prod_chips.append({"title": "🔍 Search Any Product", "action": "query_rewrite", "query": "Any Product"})

            resp = {
                "type": "flow_step",
                "data": "🛍️ **What product are you looking for?** Choose a category or type a product name:",
                "suggestions": prod_chips,
                "search_metadata": {"flow_state": "AWAITING_QUERY_FOR_PROD"}
            }
            if chat_session_id:
                _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
            return resp

        else:
            # Greeting or unrecognized → welcome screen
            if not q_lower or is_greeting(req.query) or q_lower == "start new search":
                resp = {
                    "type": "explore_welcome",
                    "data": "Hi 👋 I'm your **Local Directory Assistant!** What would you like to explore today?",
                    "suggestions": [
                        {"title": "🏢 Business Listings", "action": "query_rewrite", "query": "explore business listings"},
                        {"title": "🛍️ Products", "action": "query_rewrite", "query": "explore products"}
                    ],
                    "search_metadata": {"flow_state": "START"}
                }
                if chat_session_id:
                    _save_chat_message_internal(chat_session_id, "assistant", json.dumps(resp))
                return resp
            # Otherwise fall through to NLU for direct query

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
                        
                    print("Querying:", PRODUCT_TABLE)
                    print("Business ID:", selected_business_id)
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

    # -------------------------------------------------------------------------
    # Entity extraction — merge NLU with last session context
    # -------------------------------------------------------------------------
    city = entities.get("location", {}).get("city") or last_meta.get("city")
    category = entities.get("category") or last_meta.get("category")
    area = entities.get("location", {}).get("area") or last_meta.get("area")

    current_limit = entities.get("limit") or 10
    current_offset = 0
    is_next = any(w in q_lower for w in ["next", "more", "next results", "show more", "show next"])
    is_prev = any(w in q_lower for w in ["prev", "previous"])

    if is_next and last_meta:
        current_offset = last_meta.get("offset", 0) + (last_meta.get("limit") or current_limit)
        current_limit = last_meta.get("limit") or current_limit
        city = last_meta.get("city") or city
        category = last_meta.get("category") or category
        area = last_meta.get("area") or area
        flow_state = last_meta.get("flow_state", flow_state)
    elif is_prev and last_meta:
        current_offset = max(0, last_meta.get("offset", 0) - (last_meta.get("limit") or current_limit))
        current_limit = last_meta.get("limit") or current_limit
        city = last_meta.get("city") or city
        category = last_meta.get("category") or category
        area = last_meta.get("area") or area
        flow_state = last_meta.get("flow_state", flow_state)

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

    # Detect business search intent
    if primary_intent == "Business Search" or (category and city):
        flow_state = "EXPLORING_BIZ"

    if primary_intent == "Product Search":
        flow_state = "EXPLORING_PROD"

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
            min_rating=None,
            open_only=filters.get("open_now", False),
            filters=filters,
            ranking_intent=resolved_ranking,
            offset=current_offset,
            limit=current_limit
        )

        if results or current_offset > 0:
            mapped_results = map_business_fields(results)
            total_count = count_local_businesses(category, city, area=area, filters=filters)

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

            # Product name / brand match (no city filter — product_master has no city column)
            if product_name and product_name.lower() not in ("any product", ""):
                query_str += " AND (LOWER(product_name) LIKE %s OR LOWER(brand) LIKE %s OR LOWER(category_name) LIKE %s)"
                params.extend([f"%{product_name.lower()}%", f"%{product_name.lower()}%", f"%{product_name.lower()}%"])

            if product_category:
                query_str += " AND LOWER(category_name) LIKE %s"
                params.append(f"%{product_category.lower()}%")

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
                })

            summary_data = await anyio.to_thread.run_sync(
                generate_conversational_summary_and_chips,
                req.query, formatted_products, lang, chat_history
            )

            context_chips = _build_context_chips(product_name or product_category or "products", city, "EXPLORING_PROD")
            suggestions = [{"title": s, "action": "query_rewrite", "query": s} for s in context_chips]

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
