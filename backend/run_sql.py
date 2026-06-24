# run_sql.py

import sqlite3
import os
from text_to_sql import generate_sql

def validate_sql(sql_query: str):
    sql_upper = sql_query.upper()

    unsafe_keywords = [
        "DELETE",
        "UPDATE",
        "DROP",
        "INSERT",
        "ALTER",
        "CREATE",
        "TRUNCATE",
        "PRAGMA",
        "ATTACH",
        "DETACH",
        "REPLACE"
    ]

    if not sql_upper.startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    for keyword in unsafe_keywords:
        if keyword in sql_upper:
            raise ValueError(f"Unsafe SQL detected: {keyword}")

    return True

def run_query(user_text: str):
    sql_query = generate_sql(user_text)
    print("Generated SQL Query:", sql_query)

    conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_map_data.db"))
    cursor = conn.cursor()
    validate_sql(sql_query)
    cursor.execute(sql_query)
    rows = cursor.fetchall()

    # Print results
    for row in rows:
        print(row)

    conn.close()

if __name__ == "__main__":
    user_input = input("Enter your query: ")
    run_query(user_input)