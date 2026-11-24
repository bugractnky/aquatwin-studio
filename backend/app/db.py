import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def connect():
    url = os.environ.get('DATABASE_URL')
    if not url or not url.startswith(('postgresql://', 'postgres://')):
        raise RuntimeError('DATABASE_URL must point to PostgreSQL')
    return psycopg.connect(url, row_factory=dict_row, connect_timeout=5)


def migrate():
    with connect() as conn:
        # Serialize concurrent API startups before checking migration versions.
        conn.execute('SELECT pg_advisory_xact_lock(491492)')
        conn.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY)')
        for path in sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql')):
            if not conn.execute('SELECT 1 FROM schema_migrations WHERE version=%s', (path.name,)).fetchone():
                conn.execute(path.read_text())
                conn.execute('INSERT INTO schema_migrations VALUES (%s)', (path.name,))
