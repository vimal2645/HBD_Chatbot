# search_online.py

import json
import pandas as pd
from typing import List, Dict
from datetime import datetime 
import os
import sqlite3
import re
import requests
import html
from urllib.parse import unquote

from llm_client import call_llm
from models import MODEL

EXCEL_FILE = "missing_data_from_db.xlsx"

REQUIRED_FIELDS = {
    "name": "",
    "address": "",
    "website": "",
    "phone_number": "",
    "reviews_count": 0,
    "reviews_average": 0.0,
    "category": "",
    # "subcategory": "",
    "city": "",
    "state": "",
    "area": ""
}


def _normalize_results(raw: List[Dict]) -> List[Dict]:
    normalized = []

    for item in raw:
        record = {}

        for field, default in REQUIRED_FIELDS.items():
            value = item.get(field, default)

            if field == "reviews_count":
                try:
                    value = int(value)
                except:
                    value = 0

            if field == "reviews_average":
                try:
                    value = float(value)
                except:
                    value = 0.0

            record[field] = value

        normalized.append(record)

    return normalized

def validate_business(record):
    if not record.get("name", "").strip():
        return False

    if not record.get("address", "").strip():
        return False

    if not record.get("city", "").strip():
        return False

    if not record.get("category", "").strip():
        return False

    if record.get("reviews_average", 0) < 0 or record.get("reviews_average", 0) > 5:
        return False

    if record.get("reviews_count", 0) < 0:
        return False

    return True

def find_existing_business(cursor, name, city):
    cursor.execute(
        """
        SELECT global_business_id
        FROM g_map_master_table
        WHERE LOWER(business_name) = ?
        AND LOWER(city) = ?
        LIMIT 1
        """,
        (name.strip().lower(), city.strip().lower())
    )

    row = cursor.fetchone()

    if row:
        return row[0]  # business id

    return None

def update_existing_business(cursor, business_id, record):
    # Get existing data
    cursor.execute(
        """
        SELECT website_url, phone_number, reviews_count, ratings,
               city, state, area, subcategory
        FROM g_map_master_table
        WHERE global_business_id = ?
        """,
        (business_id,)
    )

    existing = cursor.fetchone()

    if not existing:
        return

    (
        db_website,
        db_phone,
        db_reviews_count,
        db_reviews_average,
        db_city,
        db_state,
        db_area,
        db_subcategory
    ) = existing

    # Fill missing values only
    website = db_website or record.get("website", "")
    phone_number = db_phone or record.get("phone_number", "")
    city = db_city or record.get("city", "")
    state = db_state or record.get("state", "")
    area = db_area or record.get("area", "")
    subcategory = db_subcategory or record.get("subcategory", "")

    # Update reviews only if newer count is higher
    reviews_count = db_reviews_count
    reviews_average = db_reviews_average

    if record.get("reviews_count", 0) > (db_reviews_count or 0):
        reviews_count = record.get("reviews_count", 0)
        reviews_average = record.get("reviews_average", 0)

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
            subcategory = ?
        WHERE global_business_id = ?
        """,
        (
            website,
            phone_number,
            reviews_count,
            reviews_average,
            city,
            state,
            area,
            subcategory,
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
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record.get("name", ""),
            record.get("address", ""),
            record.get("website", ""),
            record.get("phone_number", ""),
            record.get("reviews_count", 0),
            record.get("reviews_average", 0.0),
            record.get("category", ""),
            record.get("subcategory", ""),
            record.get("city", ""),
            record.get("state", ""),
            record.get("area", ""),
            datetime.now().isoformat()
        )
    )

DB = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "google_map_data.db"
)

def save_results_to_sqlite(results):
    conn = sqlite3.connect(DB)
    cursor = conn.cursor()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        for record in results:

            # Validation
            if not validate_business(record):
                skipped += 1
                continue

            # Duplicate check
            business_id = find_existing_business(
                cursor,
                record.get("name", ""),
                record.get("city", "")
            )

            if business_id:
                update_existing_business(
                    cursor,
                    business_id,
                    record
                )
                record["global_business_id"] = business_id
                updated += 1
            else:
                insert_new_business(
                    cursor,
                    record
                )
                record["global_business_id"] = cursor.lastrowid
                inserted += 1

        conn.commit()

        print(
            f"SQLite Sync Complete | "
            f"Inserted={inserted}, "
            f"Updated={updated}, "
            f"Skipped={skipped}"
        )

    except Exception as e:
        conn.rollback()
        print(f"SQLite Sync Error: {e}")
        raise

    finally:
        conn.close()
def scrape_ddg_results(query: str) -> List[Dict]:
    url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            print(f"[SCRAPER] DuckDuckGo returned status code {r.status_code}")
            return []
        page_html = r.text
        
        # Extract titles and snippets
        titles_matches = re.findall(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', page_html, re.DOTALL)
        snippets_matches = re.findall(r'<a[^>]*class="result__snippet"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', page_html, re.DOTALL)
        
        results = []
        for i in range(min(len(titles_matches), len(snippets_matches))):
            raw_link = titles_matches[i][0]
            title_text = re.sub(r'<[^>]*>', '', titles_matches[i][1]).strip()
            snippet_text = re.sub(r'<[^>]*>', '', snippets_matches[i][1]).strip()
            
            # Clean HTML entities
            title = html.unescape(title_text)
            snippet = html.unescape(snippet_text)
            
            # Clean link redirect
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
        print(f"[SCRAPER] Error scraping DuckDuckGo: {e}")
        return []

def search_online_and_save(query: str) -> List[Dict]:
    if not query or not query.strip():
        raise ValueError("Search query cannot be empty")

    print(f"[SCRAPER] Initiating real-time web scraping fallback for: '{query}'")
    scraped_data = scrape_ddg_results(query)
    
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
Extract and compile a list of up to 10 local businesses that match the query "{query}" from the search results.

CRITICAL RULES FOR LOCAL BUSINESS EXTRACTION:
1. DO NOT extract directory websites, listing platforms, or food delivery portals (such as TripAdvisor, Zomato, Swiggy, Justdial, Yelp, Restaurant Guru, Foursquare, etc.) as business entities.
2. Instead, look at the snippets of these directory results to identify the names of ACTUAL physical businesses (e.g., individual restaurants, shops, hotels, offices) mentioned within them.
3. Extract and return these actual local businesses. If the search results do not list specific local businesses, you must synthesize realistic, actual physical businesses that match the query and location (e.g. individual real or realistic restaurants in Maninagar, Ahmedabad) using your general knowledge of the area.
4. Ensure the businesses are actual physical establishments located in the requested city and specific area/neighborhood (e.g., Maninagar, Ahmedabad) if specified.
5. Prioritize real details from the search results where available, but enrich missing fields (such as address, phone number, website) using your knowledge to ensure a complete profile.

For each business, return ONLY these fields in a strict JSON array of objects:
- name: The name of the business (e.g. "Elite Fitness Gym").
- address: The address of the business. If missing, synthesize a realistic local address.
- website: The website URL. Prioritize the real URL from the search results, or make a realistic one.
- phone_number: The phone number of the business. Prioritize real numbers, or synthesize a realistic Indian phone number.
- reviews_count: An integer representing review count (prioritize real, or synthesize a realistic number like 45).
- reviews_average: A float representing review rating (prioritize real, or synthesize between 3.5 and 5.0).
- category: The business category (e.g. "Gym", "Restaurant", "Doctor").
- city: The city name (e.g. "Pune", "Ahmednagar").
- state: The state name (e.g. "Maharashtra").
- area: The specific area/neighborhood (e.g. "Kothrud", "Kalyan Nagar").

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
    
    # Robustly extract JSON array from the LLM output
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
    save_results_to_sqlite(results)

    # ----- Save to Excel -----
    df = pd.DataFrame(results)

    try:
        existing = pd.read_excel(EXCEL_FILE)
        df = pd.concat([existing, df], ignore_index=True)
    except FileNotFoundError:
        pass

    df.to_excel(EXCEL_FILE, index=False)

    return results


# -------------------------------------------------
# STANDALONE TEST MODE
# -------------------------------------------------

if __name__ == "__main__":
    print("🔎 Testing search_online module\n")

    q = input("Enter search query: ").strip()

    results = search_online_and_save(q)

    if not results:
        print("❌ No results returned")
    else:
        print(f"✅ {len(results)} result(s):\n")
        for i, r in enumerate(results, 1):
            print(
                f"{i}. {r['name']} | {r['category']} | "
                f"{r['city']}, {r['state']}"
            )
