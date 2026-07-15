"""
create_mysql_tables.py
Run once to create all chatbot-specific tables in MySQL (replacing SQLite).
"""
import os
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv("MYSQL_HOST"),
    port=int(os.getenv("MYSQL_PORT", 3306)),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
    charset="utf8mb4",
    collation="utf8mb4_general_ci",
    autocommit=True,
)
cur = conn.cursor()

DDL_STATEMENTS = [
    # ── Chat sessions ─────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_chat_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255),
        title VARCHAR(255) DEFAULT 'New Chat',
        is_pinned TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ccs_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── Chat messages ─────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role VARCHAR(20) NOT NULL,
        content LONGTEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ccm_session_id (session_id),
        CONSTRAINT fk_ccm_session FOREIGN KEY (session_id)
            REFERENCES chatbot_chat_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── Bookmarks ─────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_bookmarks (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        business_id BIGINT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cb_user_biz (user_id, business_id),
        INDEX idx_cb_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── Reviews ───────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_reviews (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        rating TINYINT NOT NULL,
        comment TEXT,
        merchant_reply TEXT,
        helpful_votes INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cr_user_biz (user_id, business_id),
        INDEX idx_cr_business_id (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── Business photos ───────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_business_photos (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        business_id BIGINT NOT NULL,
        photo_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cbp_business_id (business_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── Audit logs ────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT,
        action VARCHAR(100),
        entity VARCHAR(100),
        entity_id BIGINT,
        ip_address VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cal_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,

    # ── App users (chatbot-specific auth) ─────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chatbot_users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NULL,
        phone VARCHAR(30) NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'owner',
        google_id VARCHAR(255) NULL,
        name VARCHAR(255) NULL,
        profile_picture TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cu_email (email),
        UNIQUE KEY uq_cu_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """,
]

import re
for stmt in DDL_STATEMENTS:
    table_name = "unknown"
    try:
        m = re.search(r"CREATE TABLE IF NOT EXISTS (\w+)", stmt)
        if m:
            table_name = m.group(1)
        cur.execute(stmt.strip())
        print(f"  [OK] {table_name}")
    except Exception as e:
        print(f"  [FAIL] {table_name}: {e}")

cur.close()
conn.close()
print("\nMySQL table creation complete.")
