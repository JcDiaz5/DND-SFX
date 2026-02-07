"""D&D SFX App - Main page routes."""
from flask import Blueprint, render_template
from flask_login import login_required

main_bp = Blueprint('main_bp', __name__)


@main_bp.route('/')
def index():
    return render_template('index.html')


@main_bp.route('/browse')
def browse():
    return render_template('browse.html')


@main_bp.route('/session')
def session_index():
    """Show all session lists (saved for users, sessionStorage for guests) + Create new."""
    return render_template('session_index.html')


@main_bp.route('/session/new')
def session_new():
    """Create new list form (creates in DB if logged in, else sessionStorage)."""
    return render_template('session_new.html')


@main_bp.route('/session/<int:list_id>')
def session_list(list_id):
    """View a saved list (logged-in user only)."""
    return render_template('session.html', list_id=list_id, is_guest=False)


@main_bp.route('/session/guest/<guest_id>')
def session_guest_list(guest_id):
    """View a guest list (loaded from sessionStorage in JS)."""
    return render_template('session.html', list_id='guest-' + guest_id, is_guest=True)


@main_bp.route('/profile')
@login_required
def profile_page():
    return render_template('profile.html')


@main_bp.route('/login')
def login_page():
    return render_template('login.html')


@main_bp.route('/register')
def register_page():
    return render_template('register.html')
