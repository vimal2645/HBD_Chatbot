"""Quick schema inspector for master_table and product_master"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from mysql_pool import mysql_ctx

with mysql_ctx() as conn:
    cur = conn.cursor(dictionary=True)

    # master_table
    cur.execute('DESCRIBE master_table')
    cols = cur.fetchall()
    print('=== master_table columns ===')
    for c in cols:
        print('  Field:', c['Field'], '| Type:', c['Type'], '| Key:', c['Key'])

    cur.execute('SELECT COUNT(*) as cnt FROM master_table')
    print('Total rows:', cur.fetchone()['cnt'])

    cur.execute('SELECT * FROM master_table LIMIT 1')
    row = cur.fetchone()
    if row:
        print('Sample row keys:', list(row.keys()))
        print('city:', row.get('city'))
        print('business_category:', row.get('business_category'))
        print('ratings:', row.get('ratings'))

    print()
    # product_master
    cur.execute('DESCRIBE product_master')
    cols2 = cur.fetchall()
    print('=== product_master columns ===')
    for c in cols2:
        print('  Field:', c['Field'], '| Type:', c['Type'])

    cur.execute('SELECT COUNT(*) as cnt FROM product_master')
    print('Total rows:', cur.fetchone()['cnt'])

    cur.execute('SELECT * FROM product_master LIMIT 1')
    row2 = cur.fetchone()
    if row2:
        print('Sample row keys:', list(row2.keys()))
