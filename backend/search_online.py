# search_online.py

import json
import pandas as pd
from typing import List, Dict
from datetime import datetime 
import os
import re
import requests
import html
from urllib.parse import unquote
from abc import ABC, abstractmethod

from db_pool import db_context
from llm_client import call_llm
from models import MODEL

EXCEL_FILE = "missing_data_from_db.xlsx"

REQUIRED_FIELDS = {
    "business_name": "",
    "address": "",
    "website_url": "",
    "phone_number": "",
    "reviews_count": 0,
    "ratings": 0.0,
    "business_category": "",
    "subcategory": "",
    "city": "",
    "state": "",
    "area": "",
    "image_url": "",
    "google_maps_link": "",
    "latitude": None,
    "longitude": None,
    "opening_hours": "",
    "business_description": "",
    "source": "online",
    "confidence_score": 0.8,
    "verified_status": "unverified",
    "updated_timestamp": ""
}

def get_category_image(category: str) -> str:
    cat = str(category or "").lower()
    if "gym" in cat or "fitness" in cat or "workout" in cat or "yoga" in cat:
        return "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=60"
    elif "restaurant" in cat or "food" in cat or "dine" in cat or "dinner" in cat or "pizza" in cat or "veg" in cat or "bakery" in cat:
        return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop&q=60"
    elif "hotel" in cat or "stay" in cat or "resort" in cat or "inn" in cat or "hostel" in cat:
        return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=60"
    elif "hospital" in cat or "doctor" in cat or "clinic" in cat or "medical" in cat or "health" in cat or "dentist" in cat:
        return "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&auto=format&fit=crop&q=60"
    elif "cafe" in cat or "coffee" in cat or "tea" in cat:
        return "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=60"
    elif "beauty" in cat or "salon" in cat or "parlour" in cat or "spa" in cat or "hair" in cat or "makeup" in cat:
        return "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&auto=format&fit=crop&q=60"
    elif "school" in cat or "coaching" in cat or "institute" in cat or "education" in cat or "college" in cat:
        return "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=60"
    elif "shop" in cat or "store" in cat or "grocery" in cat or "market" in cat or "mall" in cat or "clothing" in cat or "retail" in cat:
        return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&auto=format&fit=crop&q=60"
    elif "car" in cat or "dealer" in cat or "automobile" in cat or "garage" in cat or "vehicle" in cat or "bike" in cat:
        return "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=60"
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60"

def get_standard_hours(category: str) -> str:
    cat = str(category or "").lower()
    if "restaurant" in cat or "food" in cat or "cafe" in cat:
        return "11:00 AM - 11:00 PM"
    elif "gym" in cat or "fitness" in cat:
        return "06:00 AM - 10:00 PM"
    elif "hospital" in cat:
        return "24 Hours"
    elif "doctor" in cat or "clinic" in cat or "dentist" in cat:
        return "09:00 AM - 07:00 PM"
    elif "school" in cat or "education" in cat:
        return "08:00 AM - 03:00 PM"
    return "09:00 AM - 08:00 PM"

def _normalize_results(raw: List[Dict]) -> List[Dict]:
    normalized = []
    for item in raw:
        record = {}
        for field, default in REQUIRED_FIELDS.items():
            # Handle field mapping from LLM naming to DB naming
            llm_mappings = {
                "business_name": ["name", "business_name"],
                "website_url": ["website", "website_url"],
                "ratings": ["reviews_average", "rating", "ratings"],
                "reviews_count": ["reviews_count", "review_count"],
                "business_category": ["category", "business_category"]
            }
            
            value = None
            if field in llm_mappings:
                for option in llm_mappings[field]:
                    if option in item:
                        value = item[option]
                        break
            
            if value is None:
                value = item.get(field, default)

            if field == "reviews_count":
                try:
                    value = int(value)
                except:
                    value = 0
            elif field == "ratings":
                try:
                    value = float(value)
                except:
                    value = 0.0
            elif field == "latitude" or field == "longitude":
                if value is not None:
                    try:
                        value = float(value)
                    except:
                        value = None

            record[field] = value

        # Enrich missing image url or standard hours
        if not record.get("image_url"):
            record["image_url"] = get_category_image(record.get("business_category"))
        if not record.get("opening_hours"):
            record["opening_hours"] = get_standard_hours(record.get("business_category"))
            
        record["source"] = "online"
        record["confidence_score"] = 0.8
        record["verified_status"] = "unverified"
        record["updated_timestamp"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        normalized.append(record)

    return normalized

def validate_business(record):
    if not record.get("business_name", "").strip():
        return False
    if not record.get("address", "").strip():
        return False
    if not record.get("city", "").strip():
        return False
    if not record.get("business_category", "").strip():
        return False
    if record.get("ratings", 0) < 0 or record.get("ratings", 0) > 5:
        return False
    if record.get("reviews_count", 0) < 0:
        return False
    return True

def find_existing_business(cursor, business_name, city):
    cursor.execute(
        """
        SELECT global_business_id
        FROM g_map_master_table
        WHERE LOWER(business_name) = ?
        AND LOWER(city) = ?
        LIMIT 1
        """,
        (business_name.strip().lower(), city.strip().lower())
    )
    row = cursor.fetchone()
    if row:
        return row["global_business_id"]
    return None

def update_existing_business(cursor, business_id, record):
    cursor.execute(
        """
        SELECT website_url, phone_number, reviews_count, ratings,
               city, state, area, subcategory, image_url, google_maps_link,
               latitude, longitude, opening_hours, business_description, source, confidence_score
        FROM g_map_master_table
        WHERE global_business_id = ?
        """,
        (business_id,)
    )
    existing = cursor.fetchone()
    if not existing:
        return

    website_url = existing["website_url"] or record.get("website_url", "")
    phone_number = existing["phone_number"] or record.get("phone_number", "")
    city = existing["city"] or record.get("city", "")
    state = existing["state"] or record.get("state", "")
    area = existing["area"] or record.get("area", "")
    subcategory = existing["subcategory"] or record.get("subcategory", "")
    image_url = existing["image_url"] or record.get("image_url", "")
    google_maps_link = existing["google_maps_link"] or record.get("google_maps_link", "")
    latitude = existing["latitude"] if existing["latitude"] is not None else record.get("latitude")
    longitude = existing["longitude"] if existing["longitude"] is not None else record.get("longitude")
    opening_hours = existing["opening_hours"] or record.get("opening_hours", "")
    business_description = existing["business_description"] or record.get("business_description", "")
    source = existing["source"] or record.get("source", "online")
    confidence_score = existing["confidence_score"] if existing["confidence_score"] is not None else record.get("confidence_score", 0.8)

    reviews_count = existing["reviews_count"]
    ratings = existing["ratings"]
    if record.get("reviews_count", 0) > (existing["reviews_count"] or 0):
        reviews_count = record.get("reviews_count", 0)
        ratings = record.get("ratings", 0.0)

    cursor.execute(
        """
        UPDATE g_map_master_table
        SET website_url = ?,
            phone_number = ?,
            reviews_count = ?,
            ratings = ?,
            city = ?,
            state = ?,
            area = ?,
            subcategory = ?,
            image_url = ?,
            google_maps_link = ?,
            latitude = ?,
            longitude = ?,
            opening_hours = ?,
            business_description = ?,
            source = ?,
            confidence_score = ?,
            updated_timestamp = ?
        WHERE global_business_id = ?
        """,
        (
            website_url,
            phone_number,
            reviews_count,
            ratings,
            city,
            state,
            area,
            subcategory,
            image_url,
            google_maps_link,
            latitude,
            longitude,
            opening_hours,
            business_description,
            source,
            confidence_score,
            datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            business_id
        )
    )

def insert_new_business(cursor, record):
    cursor.execute(
        """
        INSERT INTO g_map_master_table (
            business_name,
            address,
            website_url,
            phone_number,
            reviews_count,
            ratings,
            business_category,
            subcategory,
            city,
            state,
            area,
            image_url,
            google_maps_link,
            latitude,
            longitude,
            opening_hours,
            business_description,
            source,
            confidence_score,
            verified_status,
            created_at,
            updated_timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.get("business_name", ""),
            record.get("address", ""),
            record.get("website_url", ""),
            record.get("phone_number", ""),
            record.get("reviews_count", 0),
            record.get("ratings", 0.0),
            record.get("business_category", ""),
            record.get("subcategory", ""),
            record.get("city", ""),
            record.get("state", ""),
            record.get("area", ""),
            record.get("image_url", ""),
            record.get("google_maps_link", ""),
            record.get("latitude"),
            record.get("longitude"),
            record.get("opening_hours", ""),
            record.get("business_description", ""),
            record.get("source", "online"),
            record.get("confidence_score", 0.8),
            record.get("verified_status", "unverified"),
            datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        )
    )

def save_results_to_mysql(results):
    with db_context() as conn:
        cursor = conn.cursor()
        inserted = 0
        updated = 0
        skipped = 0
        try:
            for record in results:
                if not validate_business(record):
                    skipped += 1
                    continue
                business_id = find_existing_business(
                    cursor,
                    record.get("business_name", ""),
                    record.get("city", "")
                )
                if business_id:
                    update_existing_business(cursor, business_id, record)
                    record["global_business_id"] = business_id
                    updated += 1
                else:
                    insert_new_business(cursor, record)
                    record["global_business_id"] = cursor.lastrowid
                    inserted += 1
            conn.commit()
            print(f"SQLite Sync Complete | Inserted={inserted}, Updated={updated}, Skipped={skipped}")
        except Exception as e:
            conn.rollback()
            print(f"SQLite Sync Error: {e}")
            raise

# --- PROVIDER ARCHITECTURE ---

class SearchProvider(ABC):
    @abstractmethod
    def search(self, query: str) -> List[Dict]:
        pass

class DuckDuckGoProvider(SearchProvider):
    def search(self, query: str) -> List[Dict]:
        url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code != 200:
                print(f"[DuckDuckGoProvider] Returned status code {r.status_code}")
                return []
            page_html = r.text
            
            titles_matches = re.findall(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', page_html, re.DOTALL)
            snippets_matches = re.findall(r'<a[^>]*class="result__snippet"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', page_html, re.DOTALL)
            
            results = []
            for i in range(min(len(titles_matches), len(snippets_matches))):
                raw_link = titles_matches[i][0]
                title_text = re.sub(r'<[^>]*>', '', titles_matches[i][1]).strip()
                snippet_text = re.sub(r'<[^>]*>', '', snippets_matches[i][1]).strip()
                
                title = html.unescape(title_text)
                snippet = html.unescape(snippet_text)
                
                link = raw_link
                if "uddg=" in raw_link:
                    parts = raw_link.split("uddg=")
                    if len(parts) > 1:
                        link = unquote(parts[1].split("&")[0])
                if link.startswith("//"):
                    link = "https:" + link
                elif not link.startswith("http"):
                    link = "https://" + link
                    
                results.append({
                    "title": title,
                    "snippet": snippet,
                    "link": link
                })
            return results
        except Exception as e:
            print(f"[DuckDuckGoProvider] Error: {e}")
            return []

def search_online_provider_layer(query: str, provider_name: str = "duckduckgo") -> List[Dict]:
    providers = {
        "duckduckgo": DuckDuckGoProvider()
    }
    provider = providers.get(provider_name.lower(), DuckDuckGoProvider())
    return provider.search(query)

def search_online_and_save(query: str) -> List[Dict]:
    if not query or not query.strip():
        raise ValueError("Search query cannot be empty")

    print(f"[SCRAPER] Initiating real-time web scraping fallback for: '{query}'")
    scraped_data = search_online_provider_layer(query, "duckduckgo")
    
    if not scraped_data:
        print("[SCRAPER] Web scraping returned 0 results. Falling back to LLM knowledge synthesis.")
        scraped_context = "No search results found."
    else:
        print(f"[SCRAPER] Scraped {len(scraped_data)} web results. Structuring data...")
        formatted_results = []
        for idx, r in enumerate(scraped_data, 1):
            formatted_results.append(
                f"Result {idx}:\n"
                f"Title: {r['title']}\n"
                f"URL: {r['link']}\n"
                f"Snippet: {r['snippet']}\n"
            )
        scraped_context = "\n".join(formatted_results)

    prompt = f"""
You are an advanced data extraction and enrichment agent for local businesses.
We searched the web for: "{query}"

Below are the scraped search engine results:
{scraped_context}

Task:
Extract and compile a list of up to 5 local businesses that match the query "{query}" from the search results.

CRITICAL RULES FOR LOCAL BUSINESS EXTRACTION:
1. DO NOT extract directory websites, listing platforms, or food delivery portals (such as TripAdvisor, Zomato, Swiggy, Justdial, Yelp, Restaurant Guru, Foursquare, etc.) as business entities.
2. Instead, look at the snippets of these directory results to identify the names of ACTUAL physical businesses (e.g., individual restaurants, shops, hotels, offices) mentioned within them.
3. Extract and return these actual local businesses. If the search results do not list specific local businesses, you must synthesize realistic, actual physical businesses that match the query and location (e.g. individual real or realistic restaurants in Maninagar, Ahmedabad) using your general knowledge of the area.
4. Ensure the businesses are actual physical establishments located in the requested city and specific area/neighborhood (e.g., Maninagar, Ahmedabad) if specified.
5. Prioritize real details from the search results where available, but enrich missing fields (such as address, phone number, website, google_maps_link, latitude, longitude, opening_hours, business_description) using your knowledge to ensure a complete profile.

For each business, return ONLY these fields in a strict JSON array of objects:
- name: The name of the business (e.g. "Elite Fitness Gym").
- address: The address of the business. If missing, synthesize a realistic local address.
- website: The website URL. Prioritize the real URL from the search results, or make a realistic one.
- phone_number: The phone number of the business. Prioritize real numbers, or synthesize a realistic Indian phone number.
- reviews_count: An integer representing review count (prioritize real, or synthesize a realistic number like 45).
- reviews_average: A float representing review rating (prioritize real, or synthesize between 3.5 and 5.0).
- category: The business category (e.g. "Gym", "Restaurant", "Doctor", "Hospital", "Hotel").
- subcategory: A specific subcategory/type of that category (e.g. "CrossFit", "South Indian", "Emergency", "Cardiology", "Luxury").
- city: The city name (e.g. "Pune", "Ahmednagar").
- state: The state name (e.g. "Maharashtra").
- area: The specific area/neighborhood (e.g. "Kothrud", "Kalyan Nagar").
- google_maps_link: A realistic Google Maps link for the business address.
- latitude: A float representing the latitude coordinates (e.g. 18.5204).
- longitude: A float representing the longitude coordinates (e.g. 73.8567).
- opening_hours: Typical opening hours (e.g. "09:00 AM - 09:00 PM" or "24 Hours").
- business_description: A short 1-2 sentence description of the business.

Rules:
- Output ONLY valid, strict JSON.
- No markdown formatting.
- Absolutely NO conversational text or explanations.
"""

    message = call_llm(
        messages=[{"role": "user", "content": prompt}],
        model="google/gemini-2.5-flash",
        max_tokens=3000
    )

    content = message.get("content", "").strip()
    
    # Extract JSON array
    json_str = content
    start_idx = content.find('[')
    end_idx = content.rfind(']')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_str = content[start_idx:end_idx+1]
    
    try:
        raw_results = json.loads(json_str)
    except json.JSONDecodeError as jde:
        print(f"DEBUG: Failed to parse JSON. Content was: {content[:500]}...")
        print(f"DEBUG: JSON error: {jde}")
        raise RuntimeError("LLM returned invalid JSON")

    if not isinstance(raw_results, list) or not raw_results:
        return []

    results = _normalize_results(raw_results)
    save_results_to_mysql(results)

    # ----- Save to Excel -----
    df = pd.DataFrame(results)
    try:
        existing = pd.read_excel(EXCEL_FILE)
        df = pd.concat([existing, df], ignore_index=True)
    except FileNotFoundError:
        pass

    try:
        df.to_excel(EXCEL_FILE, index=False)
    except Exception as exc_err:
        print(f"Excel save failed: {exc_err}")

    return results

if __name__ == "__main__":
    print("🔎 Testing search_online module\n")
    q = input("Enter search query: ").strip()
    results = search_online_and_save(q)
    if not results:
        print("❌ No results returned")
    else:
        print(f"✅ {len(results)} result(s):\n")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['business_name']} | {r['business_category']} | {r['city']}, {r['state']}")
