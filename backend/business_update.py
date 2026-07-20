# business_update.py - Updated to use correct g_map_master_table

from mysql_pool import mysql_ctx
import os
import csv

BIZ_TABLE = "chatbot_add_business"

# Map old field names to new column names
FIELD_MAP = {
    "name": "business_name",
    "category": "business_category",
    "website": "website_url",
    "phone_number": "phone_number",
    "address": "address",
    "area": "area",
    "city": "city",
    "state": "state",
    "subcategory": "subcategory",
    # Direct g_map_master_table names also accepted
    "business_name": "business_name",
    "business_category": "business_category",
    "website_url": "website_url",
}

ALLOWED_FIELDS = list(FIELD_MAP.keys())

def update_business(business_id: int, updates: dict):
    # Map and filter fields
    mapped_updates = {}
    for k, v in updates.items():
        if k in FIELD_MAP:
            mapped_updates[FIELD_MAP[k]] = v
    
    if not mapped_updates:
        return False

    fields = [f"{col} = %s" for col in mapped_updates.keys()]
    values = list(mapped_updates.values())
    values.append(business_id)

    query = f"""
        UPDATE {BIZ_TABLE}
        SET {', '.join(fields)}
        WHERE global_business_id = %s
    """

    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_map_data.db")
    CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "g_map_master_table_sample.csv")
    
    with mysql_ctx() as conn:
        cursor = conn.cursor()
        cursor.execute(query, values)
        conn.commit()
        # Also log the update in update_history
        for field, value in mapped_updates.items():
            try:
                cursor.execute("SELECT " + field + f" FROM {BIZ_TABLE} WHERE global_business_id = %s", (business_id,))
                old_row = cursor.fetchone()
                old_val = old_row[0] if old_row else ""
            except:
                old_val = ""
            try:
                cursor.execute(
                    "INSERT INTO update_history (business_id, field_name, old_value, new_value) VALUES (%s, %s, %s, %s)",
                    (business_id, field, str(old_val), str(value))
                )
                print("Rows updated:", cursor.rowcount)
            except Exception as e:
                print(f"History log error: {e}")
    
        conn.commit()

    # Sync to CSV
    try:
        rows = []
        if os.path.exists(CSV_PATH):
            with open(CSV_PATH, 'r', encoding='utf-8', newline='') as f:
                reader = list(csv.reader(f))
                if not reader:
                    return True
                header = reader[0]
                rows.append(header)
                col_map = {col: i for i, col in enumerate(header)}
                
                for row in reader[1:]:
                    if not row:
                        continue
                    if str(row[0]) == str(business_id):
                        for orig_key, new_col in FIELD_MAP.items():
                            if orig_key in updates and orig_key in col_map:
                                row[col_map[orig_key]] = updates[orig_key]
                    rows.append(row)
            
            with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerows(rows)
    except Exception as e:
        print(f"CSV Update Sync Error: {e}")

    return True
