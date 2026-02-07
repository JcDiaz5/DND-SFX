#!/usr/bin/env python3
"""Initialize database and seed categories + sample sounds."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask_app import app, db
from flask_app.models import User, Category, Sound, SoundVariant


def slugify(name):
    s = name.lower().replace(' ', '-').replace("'", '').replace('&', '')
    return ''.join(c for c in s if c.isalnum() or c == '-').strip('-')


def init_database():
    with app.app_context():
        db.create_all()
        print('Database tables created.')

        # Seed categories
        categories_data = [
            ('Combat', 'Swords, impacts, hits, battle'),
            ('Magic', 'Spells, whooshes, enchantments'),
            ('Ambience', 'Tavern, forest, dungeon, weather'),
            ('Creatures', 'Dragons, monsters, animals'),
            ('UI & Misc', 'Clicks, notifications, fanfare'),
        ]
        for i, (name, desc) in enumerate(categories_data):
            cat = Category.query.filter_by(name=name).first()
            if not cat:
                cat = Category(name=name, description=desc, sort_order=i, slug=slugify(name))
                db.session.add(cat)
        db.session.commit()
        print('Categories seeded.')

        # Seed a few placeholder sounds (files can be added to static/audio later)
        audio_dir = os.path.join(os.path.dirname(__file__), 'flask_app', 'static', 'audio')
        os.makedirs(audio_dir, exist_ok=True)

        for cat in Category.query.all():
            if Sound.query.filter_by(category_id=cat.id).first():
                continue
            # Add 2–3 placeholder sounds per category; file_path can point to a real file later
            placeholders = {
                'Combat': ['Sword Slash', 'Shield Block', 'Arrow Hit'],
                'Magic': ['Fireball', 'Heal Spell', 'Teleport'],
                'Ambience': ['Tavern Murmur', 'Rain', 'Dungeon Echo'],
                'Creatures': ['Dragon Roar', 'Wolf Howl', 'Goblin Grunt'],
                'UI & Misc': ['Button Click', 'Level Up', 'Quest Complete'],
            }
            for j, name in enumerate(placeholders.get(cat.name, ['Sample Sound'])):
                path = f"{slugify(cat.name)}/{slugify(name)}.mp3"
                s = Sound(
                    name=name,
                    category_id=cat.id,
                    file_path=path,
                    is_active=True,
                )
                db.session.add(s)
        db.session.commit()
        print('Sample sounds seeded.')

        # Example: give "Sword Slash" two variants so the multi-audio popover can be tested
        sword = Sound.query.filter_by(name='Sword Slash').first()
        if sword and not SoundVariant.query.filter_by(sound_id=sword.id).first():
            v1 = SoundVariant(sound_id=sword.id, file_path=sword.file_path, label='Slash 1', sort_order=0)
            v2 = SoundVariant(sound_id=sword.id, file_path=sword.file_path, label='Slash 2', sort_order=1)
            db.session.add(v1)
            db.session.add(v2)
            db.session.commit()
            print('Added 2 variants for "Sword Slash" (multi-audio demo).')

        print('Done. Add real .mp3/.ogg files under flask_app/static/audio/<category>/<name>.mp3 if desired.')


if __name__ == '__main__':
    init_database()
