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
    """
    Previously used an LLM to synthesise business records from web scraping.
    LLM integration has been removed. All results come from master_table (MySQL).
    The /api/query endpoint handles fallback messaging when DB returns 0 results.
    """
    if not query or not query.strip():
        raise ValueError("Search query cannot be empty")

    print(f"[SEARCH_ONLINE] LLM removed — returning empty list. Query: '{query}'")
    return []


if __name__ == "__main__":
    print("🔎 Testing search_online module\n")
    q = input("Enter search query: ").strip()
    results = search_online_and_save(q)
    if not results:
        print("❌ No results returned (LLM removed — use the database directly)")
    else:
        print(f"✅ {len(results)} result(s):\n")
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['business_name']} | {r['business_category']} | {r['city']}, {r['state']}")

