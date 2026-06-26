# db_pool.py
import sqlite3
import os
import threading
from queue import Queue, Empty

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "google_map_data.db")

class SQLiteConnectionPool:
    def __init__(self, db_path, max_connections=5, timeout=10):
        self.db_path = db_path
        self.max_connections = max_connections
        self.timeout = timeout
        self._pool = Queue(maxsize=max_connections)
        self._allocated = 0
        self._lock = threading.Lock()

    def _create_connection(self):
        conn = sqlite3.connect(
            self.db_path, 
            timeout=self.timeout,
            check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        
        # Optimize SQLite performance with pragmas
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")
            conn.execute("PRAGMA cache_size = -2000;") # 2MB cache
            conn.execute("PRAGMA temp_store = MEMORY;")
            conn.execute("PRAGMA foreign_keys = ON;")
        except Exception as e:
            print(f"[DB_POOL] Error setting pragmas: {e}")
            
        return conn

    def get_connection(self):
        # Try getting from pool
        try:
            return self._pool.get(block=False)
        except Empty:
            pass

        with self._lock:
            if self._allocated < self.max_connections:
                conn = self._create_connection()
                self._allocated += 1
                return conn
                
        # If pool is full, block and wait
        try:
            return self._pool.get(block=True, timeout=self.timeout)
        except Empty:
            raise RuntimeError("Database connection pool exhausted")

    def release_connection(self, conn):
        if conn is None:
            return
        try:
            self._pool.put(conn, block=False)
        except:
            # If pool is somehow full, close the connection
            try:
                conn.close()
            except:
                pass
            with self._lock:
                self._allocated -= 1

    def close_all(self):
        with self._lock:
            while not self._pool.empty():
                try:
                    conn = self._pool.get(block=False)
                    conn.close()
                except:
                    pass
            self._allocated = 0

# Global pool instance
pool = SQLiteConnectionPool(DB_PATH, max_connections=10)

def get_db():
    """Generator for FastAPI Dependency Injection or direct context manager usage."""
    conn = pool.get_connection()
    try:
        yield conn
    finally:
        pool.release_connection(conn)

class db_context:
    """Context manager for thread-safe SQLite queries."""
    def __enter__(self):
        self.conn = pool.get_connection()
        return self.conn
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            try:
                self.conn.rollback()
            except:
                pass
        pool.release_connection(self.conn)
