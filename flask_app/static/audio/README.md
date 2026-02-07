# Sound files directory

Put your **.mp3**, **.ogg**, **.wav**, or **.m4a** files inside the category folders, then run from the project root:

```bash
python sync_sounds.py
```

## Two ways to add sounds

**1) Single file = one sound**  
Put a file directly in the category folder. One file → one sound button.

**2) Folder of files = one sound with multiple variants**  
Put a **folder** inside the category folder and put all the audio files for that sound inside it. In the app, that sound will show a **popover** when clicked so the user can pick which variant to play.

## Directory layout

```
flask_app/static/audio/
├── README.md
├── combat/
│   ├── sword-slash.mp3
│   └── shield-block.mp3
├── ambience/
│   ├── Zombie Attack.mp3              ← one sound
│   ├── FemaleSpectralBreath/         ← one sound, multiple variants (popover)
│   │   ├── take1.mp3
│   │   └── take2.mp3
│   └── TearingAndSqueezingFlesh/     ← one sound, multiple variants
│       ├── version-a.mp3
│       └── version-b.mp3
├── magic/
└── ...
```

- **Category folder** (e.g. `ambience/`) = category in the app. New top-level folders become new categories.
- **File in category** (e.g. `ambience/Zombie Attack.mp3`) = one sound; filename becomes the display name.
- **Subfolder in category** (e.g. `ambience/FemaleSpectralBreath/`) = one sound; folder name becomes the display name; each file inside = one variant (user picks in a popover when they click the sound).

Files in the root of `audio/` (no category folder) go into **Uncategorized**.
