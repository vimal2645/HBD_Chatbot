import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'google_map_data.db')

def create_table():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    cur.execute('''
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    ''')
    
    # Check if we need to add an index for quick lookups
    cur.execute('CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id)')
    
    conn.commit()
    conn.close()
    print("Successfully created reviews table.")

if __name__ == "__main__":
    create_table()
