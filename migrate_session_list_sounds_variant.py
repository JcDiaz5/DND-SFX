#!/usr/bin/env python3
"""
One-off migration: add sound_variant_id to session_list_sounds and change
unique constraint from (session_list_id, sound_id) to (session_list_id, sound_id, sound_variant_id).

Run once: python migrate_session_list_sounds_variant.py

SQLite: recreates the table because SQLite cannot drop a unique constraint.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask_app import app, db

def migrate():
    with app.app_context():
        if db.engine.dialect.name != 'sqlite':
            # For PostgreSQL/MySQL we could use ALTER to add column and a new unique index
            db.session.execute(db.text(
                "ALTER TABLE session_list_sounds ADD COLUMN sound_variant_id INTEGER REFERENCES sound_variants(id)"
            ))
            try:
                db.session.execute(db.text("ALTER TABLE session_list_sounds DROP CONSTRAINT uq_session_list_sound"))
            except Exception:
                pass
            db.session.commit()
            return

        # SQLite: check if column already exists
        r = db.session.execute(db.text("PRAGMA table_info(session_list_sounds)"))
        cols = [row[1] for row in r]
        if 'sound_variant_id' in cols:
            print("Column sound_variant_id already exists.")
            return

        db.session.execute(db.text("""
            CREATE TABLE session_list_sounds_new (
                id INTEGER NOT NULL PRIMARY KEY,
                session_list_id INTEGER NOT NULL REFERENCES session_lists(id),
                sound_id INTEGER NOT NULL REFERENCES sounds(id),
                sound_variant_id INTEGER REFERENCES sound_variants(id),
                sort_order INTEGER DEFAULT 0,
                added_at DATETIME,
                UNIQUE(session_list_id, sound_id, sound_variant_id)
            )
        """))
        db.session.execute(db.text("""
            INSERT INTO session_list_sounds_new (id, session_list_id, sound_id, sound_variant_id, sort_order, added_at)
            SELECT id, session_list_id, sound_id, NULL, sort_order, added_at FROM session_list_sounds
        """))
        db.session.execute(db.text("DROP TABLE session_list_sounds"))
        db.session.execute(db.text("ALTER TABLE session_list_sounds_new RENAME TO session_list_sounds"))
        db.session.commit()
        print("Migration done: session_list_sounds now has sound_variant_id and new unique constraint.")

if __name__ == '__main__':
    migrate()
