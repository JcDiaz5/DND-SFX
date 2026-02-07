#!/usr/bin/env python3
"""
Sync sound files from flask_app/static/audio/ into the database.

Run: python sync_sounds.py

Two patterns supported:

1) Single file = one sound
   flask_app/static/audio/<category>/Some Sound.mp3
   → One sound "Some Sound" with that file.

2) Folder of files = one sound with multiple variants (popover when clicked)
   flask_app/static/audio/<category>/FolderName/
     file1.mp3
     file2.mp3
   → One sound "Folder Name" with multiple variants; user picks one in the app.

Examples:
  ambience/Zombie Attack.mp3              → one sound "Zombie Attack"
  ambience/FemaleSpectralBreath/a.mp3    → sound "Female Spectral Breath"
  ambience/FemaleSpectralBreath/b.mp3      with two variants (a, b)
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask_app import app, db
from flask_app.models import Category, Sound, SoundVariant

AUDIO_DIR = os.path.join(os.path.dirname(__file__), 'flask_app', 'static', 'audio')
ALLOWED_EXT = ('.mp3', '.ogg', '.wav', '.m4a')


def slug_to_name(slug):
    if not slug:
        return 'Uncategorized'
    return slug.replace('-', ' ').replace('_', ' ').title()


def filename_to_name(filename):
    base = os.path.splitext(filename)[0]
    return base.replace('-', ' ').replace('_', ' ').title()


def norm_slug(s):
    s = s.lower().replace(' ', '-').replace('_', '-')
    return re.sub(r'[^a-z0-9\-]', '', s) or 'uncategorized'


def sync():
    if not os.path.isdir(AUDIO_DIR):
        print('Audio directory not found:', AUDIO_DIR)
        return

    with app.app_context():
        # Create any missing tables (e.g. sound_variants if DB was created before variants were added)
        db.create_all()

        uncat = Category.query.filter_by(slug='uncategorized').first()
        if not uncat:
            uncat = Category(name='Uncategorized', slug='uncategorized', sort_order=999)
            db.session.add(uncat)
            db.session.flush()
            print('Created category: Uncategorized')

        added = 0
        updated = 0
        seen_paths = set()

        # Top-level entries under audio/
        try:
            top_names = os.listdir(AUDIO_DIR)
        except OSError:
            top_names = []

        for name in sorted(top_names):
            path = os.path.join(AUDIO_DIR, name)
            if name.startswith('.'):
                continue
            if os.path.isfile(path):
                if not name.lower().endswith(ALLOWED_EXT):
                    continue
                rel_path = name.replace('\\', '/')
                seen_paths.add(rel_path)
                cat = Category.query.filter_by(slug='uncategorized').first()
                if not cat:
                    cat = uncat
                existing = Sound.query.filter_by(file_path=rel_path).first()
                if existing:
                    if existing.category_id != cat.id:
                        existing.category_id = cat.id
                        updated += 1
                    continue
                s = Sound(name=filename_to_name(name), category_id=cat.id, file_path=rel_path, is_active=True)
                db.session.add(s)
                added += 1
                print('  +', rel_path, '->', s.name)
                continue

            if not os.path.isdir(path):
                continue

            category_slug = norm_slug(name)
            cat = Category.query.filter_by(slug=category_slug).first()
            if not cat:
                cat = Category(name=slug_to_name(name), slug=category_slug, sort_order=Category.query.count())
                db.session.add(cat)
                db.session.flush()
                print('Created category:', cat.name)

            # List contents of category folder (files and subdirs)
            try:
                entries = os.listdir(path)
            except OSError:
                entries = []

            for entry in sorted(entries):
                entry_path = os.path.join(path, entry)
                rel_entry = os.path.join(name, entry).replace('\\', '/')

                if os.path.isfile(entry_path):
                    if not entry.lower().endswith(ALLOWED_EXT):
                        continue
                    seen_paths.add(rel_entry)
                    existing = Sound.query.filter_by(file_path=rel_entry).first()
                    if existing:
                        if existing.category_id != cat.id:
                            existing.category_id = cat.id
                            updated += 1
                        continue
                    s = Sound(
                        name=filename_to_name(os.path.splitext(entry)[0]),
                        category_id=cat.id,
                        file_path=rel_entry,
                        is_active=True,
                    )
                    db.session.add(s)
                    added += 1
                    print('  +', rel_entry, '->', s.name)
                    continue

                if os.path.isdir(entry_path):
                    # Folder = one sound with multiple variants
                    try:
                        subfiles = [f for f in os.listdir(entry_path) if f.lower().endswith(ALLOWED_EXT)]
                    except OSError:
                        subfiles = []
                    subfiles.sort()
                    if not subfiles:
                        continue
                    sound_name = slug_to_name(entry.replace('-', ' ').replace('_', ' '))
                    first_path = os.path.join(name, entry, subfiles[0]).replace('\\', '/')
                    for f in subfiles:
                        seen_paths.add(os.path.join(name, entry, f).replace('\\', '/'))

                    existing = Sound.query.filter_by(category_id=cat.id, name=sound_name).first()
                    if existing:
                        # Update variants to match folder contents
                        for v in list(existing.variants):
                            db.session.delete(v)
                        existing.file_path = first_path
                        for i, f in enumerate(subfiles):
                            vpath = os.path.join(name, entry, f).replace('\\', '/')
                            label = filename_to_name(os.path.splitext(f)[0])
                            db.session.add(SoundVariant(sound_id=existing.id, file_path=vpath, label=label, sort_order=i))
                        updated += 1
                        print('  ~', rel_entry + '/', '->', existing.name, '(%d variants)' % len(subfiles))
                    else:
                        s = Sound(name=sound_name, category_id=cat.id, file_path=first_path, is_active=True)
                        db.session.add(s)
                        db.session.flush()
                        for i, f in enumerate(subfiles):
                            vpath = os.path.join(name, entry, f).replace('\\', '/')
                            label = filename_to_name(os.path.splitext(f)[0])
                            db.session.add(SoundVariant(sound_id=s.id, file_path=vpath, label=label, sort_order=i))
                        added += 1
                        print('  +', rel_entry + '/', '->', s.name, '(%d variants)' % len(subfiles))

        # Deactivate sounds whose files are missing
        for s in Sound.query.filter_by(is_active=True).all():
            paths_to_check = [s.file_path]
            for v in s.variants:
                paths_to_check.append(v.file_path)
            any_seen = any(p in seen_paths for p in paths_to_check)
            any_exists = any(os.path.isfile(os.path.join(AUDIO_DIR, p)) for p in paths_to_check)
            if not any_seen and not any_exists:
                s.is_active = False
                print('  (deactivated, missing:', s.file_path, ')')

        db.session.commit()
        print('Done. Added:', added, 'Updated:', updated)


if __name__ == '__main__':
    sync()
