import sys

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed, trying pg8000...")
    try:
        import pg8000 as psycopg2
    except ImportError:
        print("No PostgreSQL driver found. Please run migration manually.")
        sys.exit(1)

conn = psycopg2.connect(
    host='localhost',
    port=5433,
    dbname='youit_cafe',
    user='youit_user',
    password='youit_pass_2024'
)
conn.autocommit = True
cur = conn.cursor()

# Check current columns
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("menu_items columns:", cols)

migration_sql = open("migration_inventory.sql").read()
# Run each statement
import re
statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
for stmt in statements:
    try:
        cur.execute(stmt)
        print(f"OK: {stmt[:60]}...")
    except Exception as e:
        print(f"SKIP/ERR: {e} | SQL: {stmt[:60]}")

# Verify
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' ORDER BY ordinal_position")
cols2 = [r[0] for r in cur.fetchall()]
print("\nmenu_items columns after migration:", cols2)

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
tables = [r[0] for r in cur.fetchall()]
print("All tables:", tables)

conn.close()
print("\nMigration complete!")
