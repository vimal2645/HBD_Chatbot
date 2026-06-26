import sqlite3
import csv
import os

DB_PATH = 'google_map_data.db'
CSV_PATH = 'g_map_master_table_sample.csv'

# Read all CSV data
rows = []
with open(CSV_PATH, 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

print(f'Total CSV rows: {len(rows)}')

# Create DB and load CSV into it
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# Create the main table matching CSV columns
cur.execute('''
CREATE TABLE IF NOT EXISTS g_map_master_table (
    global_business_id INTEGER PRIMARY KEY AUTOINCREMENT,
    csv_id TEXT,
    business_name TEXT,
    address TEXT,
    website_url TEXT,
    phone_number TEXT,
    reviews_count INTEGER DEFAULT 0,
    ratings REAL DEFAULT 0.0,
    business_category TEXT,
    subcategory TEXT,
    city TEXT,
    state TEXT,
    area TEXT,
    created_at TEXT,
    email TEXT,
    owner_id INTEGER
)
''')

# Create indexes for sub-second query performance
cur.execute('CREATE INDEX IF NOT EXISTS idx_gmap_category ON g_map_master_table (business_category)')
cur.execute('CREATE INDEX IF NOT EXISTS idx_gmap_city_category ON g_map_master_table (city, business_category)')
cur.execute('CREATE INDEX IF NOT EXISTS idx_gmap_area ON g_map_master_table (area)')
cur.execute('CREATE INDEX IF NOT EXISTS idx_gmap_ratings ON g_map_master_table (ratings)')

# Create products table
cur.execute('''
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,
    name TEXT NOT NULL,
    price REAL,
    description TEXT,
    category TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
)
''')

# Create deals table
cur.execute('''
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,
    title TEXT NOT NULL,
    discount_pct INTEGER,
    expiry_date TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
)
''')

# Create chat tables
cur.execute('''
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT DEFAULT 'New Chat',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    is_pinned INTEGER DEFAULT 0
)
''')

cur.execute('''
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
)
''')

# Create update history table
cur.execute('''
CREATE TABLE IF NOT EXISTS update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
)
''')

# Insert CSV data if table is empty
cur.execute("SELECT COUNT(*) FROM g_map_master_table")
count = cur.fetchone()[0]

if count == 0:
    for row in rows:
        cur.execute('''
            INSERT INTO g_map_master_table 
            (csv_id, business_name, address, website_url, phone_number, reviews_count, ratings, 
             business_category, subcategory, city, state, area, created_at, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            row.get('id', ''),
            row.get('name', ''),
            row.get('address', ''),
            row.get('website', ''),
            row.get('phone_number', ''),
            int(row.get('reviews_count', 0) or 0),
            float(row.get('reviews_avg', 0) or 0),
            row.get('category', ''),
            row.get('subcategory', ''),
            row.get('city', ''),
            row.get('state', ''),
            row.get('area', ''),
            row.get('created_at', ''),
            row.get('email', '')
        ))
    conn.commit()
    print(f'Inserted {len(rows)} rows into g_map_master_table')
else:
    print(f'Table already has {count} rows - skipping CSV import')

# Verify
cur.execute("SELECT COUNT(*) FROM g_map_master_table")
total = cur.fetchone()[0]
print(f'Total in DB: {total}')

cur.execute("SELECT business_category, COUNT(*) as cnt FROM g_map_master_table GROUP BY business_category ORDER BY cnt DESC LIMIT 15")
print('\nTop categories:')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]}')

cur.execute("SELECT city, COUNT(*) as cnt FROM g_map_master_table GROUP BY city ORDER BY cnt DESC LIMIT 10")
print('\nTop cities:')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]}')

cur.execute("SELECT state, COUNT(*) as cnt FROM g_map_master_table GROUP BY state ORDER BY cnt DESC LIMIT 10")
print('\nTop states:')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]}')

cur.execute("SELECT ROUND(ratings, 0) as r, COUNT(*) as cnt FROM g_map_master_table GROUP BY ROUND(ratings,0) ORDER BY r")
print('\nRatings distribution:')
for row in cur.fetchall():
    print(f'  {row[0]} stars: {row[1]}')

cur.execute("SELECT * FROM g_map_master_table LIMIT 2")
rows_sample = cur.fetchall()
if rows_sample:
    print('\nSample row column names:', [d[0] for d in cur.description])

conn.close()
print('\nDB setup complete!')
