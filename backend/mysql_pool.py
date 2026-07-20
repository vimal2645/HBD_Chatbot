# mysql_pool.py — Thread-safe MySQL connection pool for READ-ONLY access
# to the company's remote MySQL database (genuineh_dashboard).
#
# Usage:
#   from mysql_pool import mysql_ctx
#   with mysql_ctx() as conn:
#       cur = conn.cursor(dictionary=True)
#       cur.execute("SELECT * FROM master_table LIMIT 10")
#       rows = cur.fetchall()

import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv()

# ── Configuration from .env ──────────────────────────────────────────
MYSQL_HOST = os.getenv("MYSQL_HOST")
MYSQL_PORT = os.getenv("MYSQL_PORT")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE")
MYSQL_USER = os.getenv("MYSQL_USER")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")

# Basic coercion with safe fallbacks (do not crash if env is missing)
try:
    MYSQL_PORT = int(MYSQL_PORT) if MYSQL_PORT is not None else 3306
except Exception:
    MYSQL_PORT = 3306


_pool = None


def _get_pool():
    """Lazy-initialise the MySQL connection pool (singleton)."""
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="hbd_mysql_pool",
            pool_size=5,
            pool_reset_session=True,
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            charset="utf8mb4",
            collation="utf8mb4_general_ci",
            connect_timeout=15,
            autocommit=True,          # read-only — no transactions needed
        )
    return _pool


class PooledConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn
        self._cursors = []

    def cursor(self, *args, **kwargs):
        cur = self._conn.cursor(*args, **kwargs)
        self._cursors.append(cur)
        return cur

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close_all_cursors(self):
        for cur in self._cursors:
            try:
                # Consume any unread results to prevent pool connection issues
                try:
                    while cur.nextset():
                        pass
                except Exception:
                    pass
                cur.close()
            except Exception:
                pass
        self._cursors.clear()


class mysql_ctx:
    """Context manager for thread-safe MySQL queries (read-only).

    Returns a connection wrapper that tracks and auto-closes cursors.
    Usage:
        with mysql_ctx() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT ...")
    """

    def __enter__(self):
        conn = _get_pool().get_connection()
        self.wrapper = PooledConnectionWrapper(conn)
        return self.wrapper

    def __exit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self, 'wrapper'):
            self.wrapper.close_all_cursors()
            try:
                if self.wrapper._conn and self.wrapper._conn.is_connected():
                    self.wrapper._conn.consume_results()
            except Exception:
                pass
            try:
                if self.wrapper._conn:
                    self.wrapper._conn.close()
            except Exception:
                pass

def get_mysql_connection():
    """Return an active MySQL connection for future use.

    Note: Caller is responsible for closing the connection.
    """
    return _get_pool().get_connection()


def test_mysql_connection():
    """Attempt to connect to MySQL on startup and verify with SELECT 1;.

    Must not crash the backend.
    """
    try:
        # Make sure we can connect and run a lightweight query.
        with mysql_ctx() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1;")
            cur.fetchall()


        # Database name (best-effort; should match MYSQL_DATABASE)
        db_name = MYSQL_DATABASE
        try:
            with mysql_ctx() as ctx_conn:
                ctx_cur = ctx_conn.cursor()
                ctx_cur.execute("SELECT DATABASE();")
                row = ctx_cur.fetchone()
                if row:
                    db_name = row[0]
        except Exception:
            pass

        print("=" * 50)
        print("HoneyBee Digital Backend Started")
        if db_name:
            print(f"Successfully connected to MySQL database: {db_name}")
        else:
            # Fallback to required example DB name when env is missing.
            print("Successfully connected to MySQL database: genuineh")
        print(f"Host: {MYSQL_HOST}:{MYSQL_PORT}")
        print("=" * 50)
        return True
    except Exception as e:
        print("=" * 50)
        print("HoneyBee Digital Backend Started")
        print("Failed to connect to MySQL database")
        print(f"Reason: {e}")
        print("=" * 50)
        return False
