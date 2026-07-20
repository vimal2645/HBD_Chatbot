# business_by_phone.py - Updated to use MySQL master_table (read-only)

import re
from mysql_pool import mysql_ctx

BIZ_TABLE = "chatbot_add_business"

def normalize_phone(phone: str) -> str:
    p = re.sub(r'\D', '', phone)
    if p.startswith('91') and len(p) == 12:
        p = p[2:]
    elif p.startswith('0') and len(p) == 11:
        p = p[1:]
    return p

def row_to_dict(row_dict):
    """Convert MySQL master_table row to standard business dict"""
    return {
        "global_business_id": row_dict.get("id") or row_dict.get("global_business_id"),
        "id": row_dict.get("id") or row_dict.get("global_business_id"),
        "business_name": row_dict.get("business_name"),
        "name": row_dict.get("business_name"),
        "address": row_dict.get("address"),
        "phone_number": row_dict.get("phone_number") or row_dict.get("primary_phone"),
        "primary_phone": row_dict.get("primary_phone"),
        "ratings": row_dict.get("ratings") or row_dict.get("stars") or 0,
        "reviews_average": row_dict.get("ratings") or row_dict.get("stars") or 0,
        "reviews_count": 0,
        "business_category": row_dict.get("business_category"),
        "category": row_dict.get("business_category"),
        "subcategory": row_dict.get("business_subcategory"),
        "business_subcategory": row_dict.get("business_subcategory"),
        "website_url": row_dict.get("website_url"),
        "website": row_dict.get("website_url"),
        "area": row_dict.get("area"),
        "city": row_dict.get("city"),
        "state": row_dict.get("state"),
        "owner_id": row_dict.get("owner_id"),
        "email": row_dict.get("email"),
        "description": row_dict.get("description"),
        "imgUrl": row_dict.get("imgUrl"),
        "gmaps_link": row_dict.get("gmaps_link"),
        "working_hour": row_dict.get("working_hour"),
        "latitude": row_dict.get("latitude"),
        "longitude": row_dict.get("longitude"),
    }

def get_businesses_by_phone(phone: str):
    search_phone = normalize_phone(phone)
    if len(search_phone) != 10:
        raise ValueError("Invalid phone number")

    with mysql_ctx() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
        f"""
        SELECT * FROM {BIZ_TABLE}
        WHERE REPLACE(primary_phone, ' ', '') LIKE %s
        ORDER BY global_business_id DESC
        """,
        (f"%{search_phone}%",)
        )
        rows = cursor.fetchall()
        if rows:
            return [row_to_dict(r) for r in rows]
    raise ValueError("Phone number not registered")

def get_businesses_by_email(email: str):
    email = email.strip().lower()
    if not email or "@" not in email:
        raise ValueError("Invalid email address")

    with mysql_ctx() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""
            SELECT * FROM {BIZ_TABLE}
            WHERE LOWER(email) = %s
            ORDER BY global_business_id DESC
            """,
            (email,)
        )
        rows = cursor.fetchall()
        converted = [row_to_dict(r) for r in rows]
        if rows:
            return converted

        raise ValueError("Email not registered")
