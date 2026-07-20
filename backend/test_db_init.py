from mysql_pool import mysql_ctx
from db_init import initialize_database

TABLES = [
    "chatbot_add_business",
    "chatbot_products",
    "chatbot_deals"
]

# ---------- Check existing tables ----------
with mysql_ctx() as conn:
    cur = conn.cursor()

    cur.execute("SHOW TABLES")
    existing = {row[0] for row in cur.fetchall()}

    print("\n===== BEFORE =====")
    for table in TABLES:
        if table in existing:
            print(f"✅ {table}")
        else:
            print(f"❌ {table}")
    print("==================\n")

# ---------- Drop ONE table ----------
table_to_drop = "chatbot_deals"

with mysql_ctx() as conn:
    cur = conn.cursor()
    cur.execute(f"DROP TABLE IF EXISTS {table_to_drop}")
    conn.commit()

print(f"\n🗑 Dropped {table_to_drop}\n")

# ---------- Run initializer ----------
initialize_database()

# ---------- Check again ----------
with mysql_ctx() as conn:
    cur = conn.cursor()

    cur.execute("SHOW TABLES")
    existing = {row[0] for row in cur.fetchall()}

    print("\n===== AFTER =====")
    for table in TABLES:
        if table in existing:
            print(f"✅ {table}")
        else:
            print(f"❌ {table}")
    print("=================\n")