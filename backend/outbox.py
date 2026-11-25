"""Durable device-side SQLite outbox; never an API database fallback.

One consumer at a time. A crashed consumer can safely resend: UUIDs and payloads
are persisted before networking and server ingestion is idempotent.
"""

import json
import sqlite3
import time
from pathlib import Path

import httpx


class Outbox:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS packets (
            ordinal INTEGER PRIMARY KEY, path TEXT NOT NULL, id TEXT NOT NULL UNIQUE,
            payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
            next_attempt REAL NOT NULL DEFAULT 0, last_error TEXT)""")
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        self.db.commit()

    def close(self):
        self.db.close()

    def build(self, metadata, packets):
        # Entire run is written atomically; never partially regenerate after restart.
        encoded = json.dumps(metadata, sort_keys=True)
        with self.db:
            old = self.db.execute(
                "SELECT value FROM metadata WHERE key='run'"
            ).fetchone()
            if old:
                if old["value"] != encoded:
                    raise ValueError(
                        "Outbox belongs to a different run; use a different file"
                    )
                return False
            self.db.execute("INSERT INTO metadata VALUES ('run', ?)", (encoded,))
            for path, body in packets:
                if path not in (
                    "/api/v1/measurements",
                    "/api/v1/telemetry",
                    "/api/v1/events",
                ):
                    raise ValueError("Unsupported outbox route")
                self.db.execute(
                    "INSERT INTO packets(path,id,payload) VALUES (?,?,?)",
                    (path, body["id"], json.dumps(body, sort_keys=True)),
                )
        return True

    def counts(self):
        return {
            r["state"]: r["n"]
            for r in self.db.execute(
                "SELECT state,count(*) AS n FROM packets GROUP BY state"
            )
        }

    def drain(self, client, *, now=None, limit=100):
        now = time.time() if now is None else now
        rows = self.db.execute(
            "SELECT * FROM packets WHERE state='pending' AND next_attempt<=? ORDER BY ordinal LIMIT ?",
            (now, limit),
        ).fetchall()
        sent = 0
        for row in rows:
            # Do not log response bodies or headers (may contain credentials/data).
            try:
                response = client.post(row["path"], json=json.loads(row["payload"]))
                code = response.status_code
                if code in (200, 201):
                    received = response.json()
                    if received.get("id") != row["id"]:
                        raise ValueError("Response did not acknowledge this packet ID")
                    state, error = "sent", None
                    sent += 1
                elif code in (401, 403):
                    # Credentials can be fixed; preserve pending work, stop noisy retries.
                    raise PermissionError(
                        f"Ingest authorization failed ({code}); packet preserved"
                    )
                elif code == 429 or code >= 500:
                    state, error = "pending", f"HTTP {code}"
                else:
                    state, error = "blocked", f"HTTP {code}; manual inspection required"
            except (httpx.TransportError, ValueError) as exc:
                state, error = "pending", type(exc).__name__
            with self.db:
                self.db.execute(
                    "UPDATE packets SET state=?,attempts=attempts+1,next_attempt=?,last_error=? WHERE ordinal=?",
                    (
                        state,
                        now + min(300, 2 ** min(row["attempts"] + 1, 8)),
                        error,
                        row["ordinal"],
                    ),
                )
            if state == "pending":
                # Avoid hammering an unavailable server for every queued packet.
                break
        return sent
