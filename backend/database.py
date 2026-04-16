import os
import sqlite3
from dataclasses import dataclass
from typing import Any, Optional, Protocol, Sequence

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

def _get_database_url() -> Optional[str]:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")

def _is_postgres_url(url: str) -> bool:
    return url.startswith("postgres://") or url.startswith("postgresql://")

def _translate_sqlite_to_postgres_query(query: str) -> str:
    q = query
    # SQLite convenience -> Postgres equivalent
    if "INSERT OR IGNORE INTO" in q.upper():
        q = q.replace("INSERT OR IGNORE INTO", "INSERT INTO")
        q = q.rstrip().rstrip(";")
        q = f"{q} ON CONFLICT DO NOTHING"
    return q.replace("?", "%s")


class CursorLike(Protocol):
    def execute(self, query: str, params: Sequence[Any] | None = None): ...
    def fetchone(self): ...
    def fetchall(self): ...
    def close(self): ...


@dataclass
class CompatCursor:
    _cursor: CursorLike
    _translate_query: bool

    def execute(self, query: str, params: Sequence[Any] | None = None):
        if self._translate_query:
            query = _translate_sqlite_to_postgres_query(query)
        if params is None:
            self._cursor.execute(query)
        else:
            self._cursor.execute(query, params)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def close(self):
        try:
            self._cursor.close()
        except Exception:
            pass

    @property
    def lastrowid(self) -> Optional[int]:
        return getattr(self._cursor, "lastrowid", None)


@dataclass
class CompatConnection:
    _conn: Any
    _is_postgres: bool

    def cursor(self) -> CompatCursor:
        return CompatCursor(self._conn.cursor(), self._is_postgres)

    def execute(self, query: str, params: Sequence[Any] | None = None) -> CompatCursor:
        if self._is_postgres:
            cur = self._conn.cursor()
            wrapped = CompatCursor(cur, True)
            return wrapped.execute(query, params)
        cur = self._conn.execute(query, params or ())
        return CompatCursor(cur, False)

    def commit(self):
        return self._conn.commit()

    def close(self):
        return self._conn.close()


def get_db_connection() -> CompatConnection:
    database_url = _get_database_url()
    if database_url and _is_postgres_url(database_url):
        try:
            import psycopg
            from psycopg.rows import dict_row
        except Exception as e:
            raise RuntimeError(
                "Postgres configured via DATABASE_URL/SUPABASE_DB_URL, but psycopg is not installed."
            ) from e

        conn = psycopg.connect(database_url, row_factory=dict_row)
        return CompatConnection(conn, True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return CompatConnection(conn, False)

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    if not conn._is_postgres:
        # Enable Foreign Keys (SQLite only)
        c.execute("PRAGMA foreign_keys = ON;")

        c.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                filename TEXT,
                type TEXT,
                author TEXT,
                avatar TEXT,
                timestamp TEXT,
                peer_id TEXT,
                size INTEGER,
                is_pinned INTEGER DEFAULT 0,
                content TEXT,
                visibility TEXT,
                original_cid TEXT,
                tag TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_name ON posts(name);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_description ON posts(description);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_peer_id ON posts(peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_peer_ts ON posts(peer_id, timestamp);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                peer_id TEXT PRIMARY KEY,
                username TEXT,
                handle TEXT,
                avatar TEXT,
                banner TEXT,
                bio TEXT,
                location TEXT,
                did TEXT,
                secret_key TEXT,
                dag_root TEXT,
                uuid7 TEXT
            );
        """)
        # ── Migrations MUST run before indexes that reference new columns ──────
        # (CREATE TABLE IF NOT EXISTS is a no-op on existing tables, so columns
        #  added after initial deploy need ALTER TABLE.)
        for col, coltype in [("secret_key", "TEXT"), ("dag_root", "TEXT"), ("uuid7", "TEXT")]:
            try:
                c.execute(f"ALTER TABLE users ADD COLUMN {col} {coltype}")
            except Exception:
                pass  # column already exists — fine

        # Now safe to create indexes on columns guaranteed to exist
        c.execute("CREATE INDEX IF NOT EXISTS idx_users_uuid7 ON users(uuid7);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                from_uuid7 TEXT,
                to_uuid7 TEXT,
                synced_at TEXT,
                PRIMARY KEY (from_uuid7, to_uuid7)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_uuid7);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_uuid7);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_cid TEXT,
                user_peer_id TEXT,
                type TEXT,
                timestamp TEXT,
                FOREIGN KEY(post_cid) REFERENCES posts(id)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_post ON interactions(post_cid);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_user_post ON interactions(user_peer_id, post_cid);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_cid TEXT,
                user_peer_id TEXT,
                username TEXT,
                text TEXT,
                timestamp TEXT,
                FOREIGN KEY(post_cid) REFERENCES posts(id)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_cid);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_peer_id TEXT,
                receiver_peer_id TEXT,
                text TEXT,
                timestamp TEXT,
                cid TEXT,
                is_read INTEGER DEFAULT 0,
                filename TEXT,
                mime_type TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_peer_id, receiver_peer_id, timestamp);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS guardians (
                user_peer_id TEXT,
                guardian_peer_id TEXT,
                PRIMARY KEY (user_peer_id, guardian_peer_id)
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS recovery_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                old_peer_id TEXT,
                new_peer_id TEXT,
                timestamp TEXT,
                status TEXT DEFAULT 'pending'
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS recovery_approvals (
                request_id INTEGER,
                guardian_peer_id TEXT,
                PRIMARY KEY (request_id, guardian_peer_id)
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS following (
                user_peer_id TEXT,
                following_peer_id TEXT,
                relationship_type TEXT DEFAULT 'following',
                timestamp TEXT,
                library_cid TEXT,
                vouched_cid TEXT,
                last_synced TEXT,
                username TEXT,
                PRIMARY KEY (user_peer_id, following_peer_id)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_following_user ON following(user_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_following_target ON following(following_peer_id);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_peer_id TEXT,
                type TEXT,
                title TEXT,
                message TEXT,
                link TEXT,
                timestamp TEXT,
                is_read INTEGER DEFAULT 0
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS discovered_peers (
                peer_id TEXT PRIMARY KEY,
                username TEXT,
                avatar TEXT,
                dag_root TEXT,
                last_seen TEXT,
                discovery_type TEXT
            );
        """)

        # Lightweight SQLite migrations for older DBs (messages + following)
        for col, coltype in [("filename", "TEXT"), ("mime_type", "TEXT")]:
            try:
                c.execute(f"ALTER TABLE messages ADD COLUMN {col} {coltype}")
            except Exception:
                pass
        for col in ["library_cid", "vouched_cid", "last_synced", "username"]:
            try:
                c.execute(f"ALTER TABLE following ADD COLUMN {col} TEXT")
            except Exception:
                pass
        # users column migrations already handled above (before CREATE INDEX)
    else:
        # Postgres/Supabase schema (kept close to SQLite types for compatibility)
        c.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                filename TEXT,
                type TEXT,
                author TEXT,
                avatar TEXT,
                timestamp TEXT,
                peer_id TEXT,
                size BIGINT,
                is_pinned SMALLINT DEFAULT 0,
                content TEXT,
                visibility TEXT,
                original_cid TEXT,
                tag TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_name ON posts(name);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_description ON posts(description);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_peer_id ON posts(peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_timestamp ON posts(timestamp);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_posts_peer_ts ON posts(peer_id, timestamp);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                peer_id TEXT PRIMARY KEY,
                username TEXT,
                handle TEXT,
                avatar TEXT,
                banner TEXT,
                bio TEXT,
                location TEXT,
                did TEXT,
                secret_key TEXT,
                dag_root TEXT,
                uuid7 TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_users_uuid7 ON users(uuid7);")
        try:
            c.execute("ALTER TABLE users ADD COLUMN uuid7 TEXT")
        except Exception:
            pass

        c.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                from_uuid7 TEXT,
                to_uuid7 TEXT,
                synced_at TEXT,
                PRIMARY KEY (from_uuid7, to_uuid7)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_uuid7);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_uuid7);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS interactions (
                id BIGSERIAL PRIMARY KEY,
                post_cid TEXT REFERENCES posts(id) ON DELETE CASCADE,
                user_peer_id TEXT,
                type TEXT,
                timestamp TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_post ON interactions(post_cid);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_interactions_user_post ON interactions(user_peer_id, post_cid);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id BIGSERIAL PRIMARY KEY,
                post_cid TEXT REFERENCES posts(id) ON DELETE CASCADE,
                user_peer_id TEXT,
                username TEXT,
                text TEXT,
                timestamp TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_cid);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id BIGSERIAL PRIMARY KEY,
                sender_peer_id TEXT,
                receiver_peer_id TEXT,
                text TEXT,
                timestamp TEXT,
                cid TEXT,
                is_read SMALLINT DEFAULT 0,
                filename TEXT,
                mime_type TEXT
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_peer_id, receiver_peer_id, timestamp);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS guardians (
                user_peer_id TEXT,
                guardian_peer_id TEXT,
                PRIMARY KEY (user_peer_id, guardian_peer_id)
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS recovery_requests (
                id BIGSERIAL PRIMARY KEY,
                old_peer_id TEXT,
                new_peer_id TEXT,
                timestamp TEXT,
                status TEXT DEFAULT 'pending'
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS recovery_approvals (
                request_id BIGINT,
                guardian_peer_id TEXT,
                PRIMARY KEY (request_id, guardian_peer_id)
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS following (
                user_peer_id TEXT,
                following_peer_id TEXT,
                relationship_type TEXT DEFAULT 'following',
                timestamp TEXT,
                library_cid TEXT,
                vouched_cid TEXT,
                last_synced TEXT,
                username TEXT,
                PRIMARY KEY (user_peer_id, following_peer_id)
            );
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_following_user ON following(user_peer_id);")
        c.execute("CREATE INDEX IF NOT EXISTS idx_following_target ON following(following_peer_id);")

        c.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGSERIAL PRIMARY KEY,
                user_peer_id TEXT,
                type TEXT,
                title TEXT,
                message TEXT,
                link TEXT,
                timestamp TEXT,
                is_read SMALLINT DEFAULT 0
            );
        """)

        c.execute("""
            CREATE TABLE IF NOT EXISTS discovered_peers (
                peer_id TEXT PRIMARY KEY,
                username TEXT,
                avatar TEXT,
                dag_root TEXT,
                last_seen TEXT,
                discovery_type TEXT
            );
        """)

    conn.commit()
    conn.close()
    location = _get_database_url() if conn._is_postgres else DB_PATH
    print(f"✅ Database initialized at {location}")

if __name__ == "__main__":
    init_db()
