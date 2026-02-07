#!/usr/bin/env python3
"""Run the D&D SFX App development server."""
import os
import sys

_project_root = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_project_root, '.env')
if os.path.isfile(_env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path, override=True)
    except (PermissionError, OSError) as e:
        print(f"Warning: Could not load .env: {e}")

os.environ.setdefault('FLASK_SKIP_DOTENV', '1')

from flask_app import app

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("D&D SFX App - Development Server")
    print("  http://localhost:5000")
    print("  http://0.0.0.0:5000 (network)")
    print("Press CTRL+C to stop")
    print("=" * 60 + "\n")
    try:
        app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
    except OSError as e:
        if 'Address already in use' in str(e):
            print("Port 5000 is in use. Try: lsof -ti:5000 | xargs kill -9")
        sys.exit(1)
