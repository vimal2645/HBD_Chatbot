import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "google_map_data.db")

def migrate():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(g_map_master_table);")
    columns = [col[1] for col in cur.fetchall()]
    
    new_columns = {
        "image_url": "TEXT",
        "google_maps_link": "TEXT",
        "latitude": "REAL",
        "longitude": "REAL",
        "opening_hours": "TEXT",
        "business_description": "TEXT",
        "source": "TEXT DEFAULT 'database'",
        "confidence_score": "REAL DEFAULT 1.0",
        "verified_status": "TEXT DEFAULT 'unverified'",
        "updated_timestamp": "TEXT"
    }
    
    for col_name, col_type in new_columns.items():
        if col_name not in columns:
            print(f"Adding column '{col_name}' ({col_type}) to 'g_map_master_table'...")
            cur.execute(f"ALTER TABLE g_map_master_table ADD COLUMN {col_name} {col_type};")
        else:
            print(f"Column '{col_name}' already exists in 'g_map_master_table'.")
            
    conn.commit()
    conn.close()
    print("Enrichment columns verified successfully.")

if __name__ == "__main__":
    migrate()
