from db import get_connection

conn = get_connection()
cur = conn.cursor(dictionary=True)

cur.execute("SELECT * FROM g_map_master_table LIMIT 5")

rows = cur.fetchall()

print(rows)

cur.close()
conn.close()