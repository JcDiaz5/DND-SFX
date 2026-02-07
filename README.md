# D&D SFX App

A responsive web app for playing sound effects during tabletop (D&D) sessions. Users can browse sounds by category, search by name, and build **session lists**—saved playlists of one-tap sound buttons. Accounts let you save and manage multiple session lists across devices.

## Features

- **Categories** – Sounds organized by category (Combat, Magic, Ambience, Creatures, UI & Misc).
- **Filter & search** – Filter by category dropdown and search by sound name.
- **Session lists** – Create named lists and add sounds from the browser; play from the list view (rectangle buttons, two columns on mobile).
- **User accounts** – Register, log in, and save session lists to your profile. View and open saved lists from the profile page.
- **Responsive** – Layout adapts to desktop and mobile (two-column rectangle containers on small screens).
- **Audio** – Sound files are stored in the project (`static/audio/`) for low latency and offline-friendly use.

## Setup

1. **Create virtualenv and install dependencies**

   ```bash
   cd "D&D SFX App"
   pipenv install
   pipenv shell
   ```

2. **Initialize the database and seed data**

   ```bash
   python init_db.py
   ```

   This creates SQLite DB in `instance/dnd_sfx.db`, adds categories, and seeds placeholder sound entries.

3. **Add sound files (optional)**

   Place `.mp3` or `.ogg` files under:

   ```
   flask_app/static/audio/<category-slug>/<sound-slug>.mp3
   ```

   For example, for a sound "Sword Slash" in Combat:

   ```
   flask_app/static/audio/combat/sword-slash.mp3
   ```

   The seed data uses paths like `combat/sword-slash.mp3`. If a file is missing, the play button will still run but the browser may show an error (you can add real files later).

4. **Run the app**

   ```bash
   python run.py
   ```

   Open [http://localhost:5000](http://localhost:5000). On the same network, use your machine’s IP and port 5000 for mobile.

## Usage

- **Home** – Intro and links to Browse Sounds and Session List.
- **Browse Sounds** – Category filter, search bar, and a grid of sound cards. Click a card to play; when logged in, use the “+” to add the sound to a session list.
- **Session List** – From “Session List” you can create a new list (name required; login required to save). Open an existing list from Profile or by URL `/session/<id>`. Play sounds from the list; rename or delete the list when logged in.
- **Profile** – Log in to see account info, edit name/email, change password, and see links to your saved session lists.
- **Log in / Sign up** – From the header or `/login` and `/register`. After login, “next” redirect is supported (e.g. `/login?next=/session/new`).

## Tech stack

- **Backend:** Flask, Flask-Login, Flask-SQLAlchemy, SQLite.
- **Frontend:** Vanilla JS, CSS with CSS variables; responsive grid and D&D-themed styling (Cinzel + Crimson Pro, dark background, gold accent).
- **Audio:** Local files under `static/audio/`; playback via HTML5 `Audio` in the browser.

## Project layout

```
D&D SFX App/
├── flask_app/
│   ├── __init__.py      # App factory, db, login, blueprints
│   ├── models.py        # User, Category, Sound, SessionList, SessionListSound
│   ├── routes.py        # Main pages (index, browse, session, profile, login, register)
│   ├── routes_auth.py   # Auth API (register, login, logout, profile, change-password)
│   ├── routes_api.py    # API: categories, sounds, session-lists CRUD
│   ├── static/
│   │   ├── css/main.css
│   │   ├── js/browse.js, session.js, profile.js
│   │   └── audio/       # Sound files (add .mp3/.ogg here)
│   └── templates/      # base, index, browse, session, profile, login, register
├── instance/            # Created at run; contains dnd_sfx.db
├── init_db.py           # Create tables and seed categories + sample sounds
├── run.py               # Development server (port 5000)
├── Pipfile
├── sync_sounds.py       # Scan static/audio and sync new files into the DB
└── README.md
```

## Expanding the sound library

**Recommended: folder-based + sync script**

1. **Put files in folders by category** under `flask_app/static/audio/`:
   - One folder per category, e.g. `combat/`, `magic/`, `ambience/`.
   - Add `.mp3`, `.ogg`, `.wav`, or `.m4a` files (e.g. `combat/sword-slash.mp3`).

2. **Run the sync script** so the app knows about new files:
   ```bash
   python sync_sounds.py
   ```
   - New files are added as `Sound` rows; the script uses the **folder name** as the category (creating the category if needed) and the **filename** (without extension) as the display name (e.g. `sword-slash.mp3` → "Sword Slash").
   - You can run it whenever you add or remove files.

3. **Optional:** Add new categories by adding a new folder (e.g. `spells/`) and putting files in it; the next sync will create the category and the sounds.

**If you outgrow local files**

- For a very large library or multiple servers, you can later add an optional `url` field to the `Sound` model and point some sounds at a CDN or object storage (e.g. S3/R2). The app can be updated to use `sound.url` when set, and `/static/audio/` when not. Until then, keeping everything under `static/audio/` and using `sync_sounds.py` is the simplest way to keep expanding.

## Configuration

- **`.env`** (optional): `SECRET_KEY`, `DATABASE_URL` (defaults to SQLite in `instance/dnd_sfx.db`).
- Default secret is for development only; set a strong `SECRET_KEY` in production.

## Why local audio files?

Sounds are stored in the project (not streamed from external URLs) so that:

- Playback has minimal latency (no network delay).
- Sessions work better on spotty Wi‑Fi or offline.
- You keep full control over the files and can add or replace them under `static/audio/` and optionally update the DB (e.g. via a small script or admin) to match.

You can later add an option to reference external URLs in the `Sound` model if you want both local and streamed sources.
