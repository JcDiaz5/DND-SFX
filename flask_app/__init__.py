"""D&D SFX App - Flask application and config."""
import os
from datetime import timedelta
from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

_basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
_env_path = os.path.join(_basedir, '.env')
try:
    load_dotenv(_env_path, override=True)
except (OSError, IOError, PermissionError):
    pass

db = SQLAlchemy()
app = Flask(__name__, static_folder='static', template_folder='templates')

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dnd-sfx-dev-secret-change-in-production')
instance_path = os.path.join(_basedir, 'instance')
os.makedirs(instance_path, exist_ok=True)
db_path = os.path.join(instance_path, 'dnd_sfx.db')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', f'sqlite:///{db_path}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False
# Email (for verification codes); if not set, verification code is returned in the API response for local/testing use
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', '')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '587'))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'true').lower() in ('1', 'true', 'yes')
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', app.config.get('MAIL_USERNAME', 'noreply@example.com'))

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'main_bp.login_page'
login_manager.login_message = 'Please log in to save and manage your session lists.'


@login_manager.unauthorized_handler
def unauthorized():
    """Return 401 JSON for API requests instead of redirecting to login (so fetch doesn't get HTML)."""
    from flask import request, jsonify
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Authentication required'}), 401
    from flask import redirect, url_for
    return redirect(url_for(login_manager.login_view))


@login_manager.user_loader
def load_user(user_id):
    from flask_app.models import User
    return User.query.get(int(user_id))


from flask_app.routes import main_bp
from flask_app.routes_auth import auth_bp
from flask_app.routes_api import api_bp
app.register_blueprint(main_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(api_bp, url_prefix='/api')
