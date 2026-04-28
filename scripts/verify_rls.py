"""One-shot verifier: prints RLS status + policies on public.notes.

Reads SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD from environment.
Never prints credentials.
"""
import os
import sys

import psycopg2

ref = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
pwd = os.environ.get("SUPABASE_DB_PASSWORD", "")
if not ref or not pwd:
    print("missing env vars", file=sys.stderr)
    sys.exit(2)

conn = psycopg2.connect(
    host=f"db.{ref}.supabase.co",
    port=5432,
    user="postgres",
    password=pwd,
    dbname="postgres",
    sslmode="require",
    connect_timeout=15,
)
cur = conn.cursor()

cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notes'::regclass;")
rls_enabled = cur.fetchone()[0]
print(f"RLS enabled on public.notes: {rls_enabled}")

cur.execute(
    """
    SELECT policyname, cmd, permissive, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notes'
    ORDER BY policyname;
    """
)
rows = cur.fetchall()
print(f"\nPolicies on public.notes ({len(rows)}):")
print(f"{'name':40} {'cmd':8} {'perm':6} roles -> qual / with_check")
print("-" * 100)
for name, cmd, permissive, roles, qual, with_check in rows:
    perm = "PERM" if permissive else "REST"
    print(f"{name:40} {cmd:8} {perm:6} {roles} -> qual={qual!s:30} check={with_check!s}")

cur.close()
conn.close()
