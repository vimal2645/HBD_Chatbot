# search_online.py

import json
import pandas as pd
from typing import List, Dict
from datetime import datetime 
import os
import sqlite3

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
        SELECT id
        FROM google_maps_listings
        WHERE LOWER(name) = ?
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
        SELECT website, phone_number, reviews_count, reviews_average,
               city, state, area, subcategory
        FROM google_maps_listings
        WHERE id = ?
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
        UPDATE google_maps_listings
        SET website = ?,
            phone_number = ?,
            reviews_count = ?,
            reviews_average = ?,
            city = ?,
            state = ?,
            area = ?,
            subcategory = ?
        WHERE id = ?
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
        INSERT INTO google_maps_listings (
            name,
            address,
            website,
            phone_number,
            reviews_count,
            reviews_average,
            category,
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

#def save_results_to_sqlite(results):
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
                updated += 1
            else:
                insert_new_business(
                    cursor,
                    record
                )
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
def search_online_and_save(query: str) -> List[Dict]:
    if not query or not query.strip():
        raise ValueError("Search query cannot be empty")

    prompt = f"""
Return a STRICT JSON array of local businesses for: "{query}"

Each object must contain ONLY these fields:
name, address, website, phone_number, reviews_count, reviews_average, category, city, state, area

Rules:
- Be extremely concise.
- Output ONLY valid, strict JSON.
- No markdown formatting.
- Absolutely NO conversational text or explanations.
"""

    message = call_llm(
        messages=[{"role": "user", "content": prompt}],
        model=MODEL
    )

    content = message.get("content", "").strip()
    
    # Sanitize content: remove markdown code block markers if present
    if content.startswith("```"):
        # Remove first line if it starts with ``` (and potentially ```json)
        lines = content.splitlines()
        if len(lines) > 2:
            # Join all lines except the first and last
            content = "\n".join(lines[1:-1]).strip()
        else:
            # Handle single line ```content```
            content = content.replace("```json", "").replace("```", "").strip()

    try:
        raw_results = json.loads(content)
    except json.JSONDecodeError:
        print(f"DEBUG: Failed to parse JSON. Content was: {content[:100]}...")
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
