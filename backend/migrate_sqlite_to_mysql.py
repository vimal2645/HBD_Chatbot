import sqlite3
import mysql.connector

# ----------------------------
# SQLite Connection
# ----------------------------
sqlite_conn = sqlite3.connect("google_map_data.db")
sqlite_cur = sqlite_conn.cursor()

# ----------------------------
# MySQL Connection
# ----------------------------
mysql_conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="MySql@2026",      # <-- Change this
    database="hbd_chatbot"
)

mysql_cur = mysql_conn.cursor()

tables = [
    "g_map_master_table",
    "products",
    "deals",
    "chat_sessions",
    "chat_messages",
    "update_history"
]

for table in tables:
    print(f"\nMigrating {table}...")

    sqlite_cur.execute(f"SELECT * FROM {table}")
    rows = sqlite_cur.fetchall()

    if not rows:
        print("No rows found.")
        continue

    placeholders = ", ".join(["%s"] * len(rows[0]))
    query = f"INSERT INTO {table} VALUES ({placeholders})"

    mysql_cur.executemany(query, rows)
    mysql_conn.commit()

    print(f"{len(rows)} rows inserted.")

sqlite_conn.close()
mysql_conn.close()

print("\nMigration Completed Successfully!")