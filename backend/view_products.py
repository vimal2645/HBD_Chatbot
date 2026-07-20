from mysql_pool import mysql_ctx

def show_products():
    with mysql_ctx() as conn:
        cur = conn.cursor()

        # Table structure
        cur.execute("DESCRIBE chatbot_products")
        columns = cur.fetchall()

        print("\n--- TABLE STRUCTURE: chatbot_products ---")
        for c in columns:
            print(c)

        # Latest products
        cur.execute("""
            SELECT *
            FROM chatbot_products
            ORDER BY global_product_id DESC
            LIMIT 5
        """)

        rows = cur.fetchall()

        print("\n--- LATEST PRODUCTS ---")

        if not rows:
            print("(No products added yet)")
        else:
            for r in rows:
                print(r)

if __name__ == "__main__":
    show_products()