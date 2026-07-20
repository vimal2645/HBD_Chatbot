from mysql_pool import mysql_ctx


def initialize_database():
    queries = [

        """
        CREATE TABLE IF NOT EXISTS chatbot_add_business (
            global_business_id INT NOT NULL AUTO_INCREMENT,
            business_name VARCHAR(255) DEFAULT NULL,
            address TEXT,
            website_url VARCHAR(500) DEFAULT NULL,
            phone_number VARCHAR(20) DEFAULT NULL,
            reviews_count INT DEFAULT 0,
            ratings DECIMAL(3,2) DEFAULT 0.00,
            business_category VARCHAR(255) DEFAULT NULL,
            subcategory VARCHAR(255) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            state VARCHAR(100) DEFAULT NULL,
            area VARCHAR(255) DEFAULT NULL,
            created_at DATETIME DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            owner_id INT DEFAULT NULL,
            PRIMARY KEY (global_business_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        """,

        """
        CREATE TABLE IF NOT EXISTS chatbot_products (
            global_product_id INT NOT NULL AUTO_INCREMENT,
            business_id INT NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) DEFAULT NULL,
            description TEXT,
            category VARCHAR(255) DEFAULT NULL,
            image_url TEXT,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (global_product_id),
            KEY idx_business (business_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        """,

        """
        CREATE TABLE IF NOT EXISTS chatbot_deals (
            global_deal_id INT NOT NULL AUTO_INCREMENT,
            business_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            discount_pct INT DEFAULT NULL,
            expiry_date DATE DEFAULT NULL,
            description TEXT,
            created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (global_deal_id),
            KEY idx_business (business_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        """
    ]

    try:
        with mysql_ctx() as conn:
            cur = conn.cursor()

            for i, query in enumerate(queries, start=1):
                cur.execute(query)
                print(f"✔ Checked table {i}")

            conn.commit()

        print("✅ Database initialized successfully.")

    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    initialize_database()
