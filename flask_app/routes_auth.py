"""D&D SFX App - Authentication routes (login, register, profile)."""
import re
import random
import string
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user

from flask_app import db
from flask_app.models import User, PendingEmailChange
from flask_app.mail_utils import send_email

auth_bp = Blueprint('auth_bp', __name__)


def validate_email(email):
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email) is not None


def validate_password(password):
    if len(password) < 8:
        return False, 'Password must be at least 8 characters'
    if not re.search(r'[A-Z]', password):
        return False, 'Password must contain at least one uppercase letter'
    if not re.search(r'[a-z]', password):
        return False, 'Password must contain at least one lowercase letter'
    if not re.search(r'\d', password):
        return False, 'Password must contain at least one number'
    return True, 'OK'


@auth_bp.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
    email = (data.get('email') or '').strip().lower()
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    password = (data.get('password') or '').strip()
    if not all([email, first_name, last_name, password]):
        return jsonify({'error': 'Email, first name, last name, and password are required'}), 400
    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400
    is_valid, msg = validate_password(password)
    if not is_valid:
        return jsonify({'error': msg}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 400
    username = (data.get('username') or '').strip() or None
    if username and User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 400
    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        username=username,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user, remember=data.get('remember', False))
    return jsonify({'message': 'Registration successful', 'user': user.to_dict()}), 201


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
    login_id = (data.get('email') or data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    if not login_id or not password:
        return jsonify({'error': 'Email/username and password are required'}), 400
    user = User.query.filter(
        (User.email == login_id) | (User.username == login_id)
    ).first()
    if not user:
        return jsonify({'error': 'No account found with that email or username'}), 401
    if not user.check_password(password):
        return jsonify({'error': 'Invalid password'}), 401
    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 401
    user.last_login = datetime.utcnow()
    db.session.commit()
    login_user(user, remember=data.get('remember', False))
    return jsonify({'message': 'Login successful', 'user': user.to_dict()}), 200


@auth_bp.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/auth/me', methods=['GET'])
def me():
    if not current_user.is_authenticated:
        return jsonify({'user': None}), 200
    return jsonify({'user': current_user.to_dict()}), 200


@auth_bp.route('/auth/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({'user': current_user.to_dict()}), 200


@auth_bp.route('/auth/profile', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
    if 'first_name' in data and data['first_name']:
        current_user.first_name = data['first_name'].strip()
    if 'last_name' in data and data['last_name']:
        current_user.last_name = data['last_name'].strip()
    if 'email' in data:
        email = data['email'].strip().lower()
        if email != current_user.email:
            return jsonify({'error': 'Email cannot be changed here. Use "Request email change" and then enter the verification code sent to your new address.'}), 400
    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': current_user.to_dict()}), 200


def _make_verification_code():
    return ''.join(random.choices(string.digits, k=6))


CODE_EXPIRY_MINUTES = 15


@auth_bp.route('/auth/profile/request-email-change', methods=['POST'])
@login_required
def request_email_change():
    """Send a verification code to the new email. Email is only updated after confirm-email-change."""
    data = request.get_json()
    if not data or not data.get('new_email'):
        return jsonify({'error': 'new_email is required'}), 400
    new_email = data['new_email'].strip().lower()
    if not validate_email(new_email):
        return jsonify({'error': 'Invalid email format'}), 400
    if new_email == current_user.email:
        return jsonify({'error': 'New email is the same as your current email'}), 400
    if User.query.filter_by(email=new_email).first():
        return jsonify({'error': 'Email already in use'}), 400
    PendingEmailChange.query.filter_by(user_id=current_user.id).delete()
    code = _make_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=CODE_EXPIRY_MINUTES)
    pending = PendingEmailChange(
        user_id=current_user.id,
        new_email=new_email,
        code=code,
        expires_at=expires_at,
    )
    db.session.add(pending)
    db.session.commit()

    mail_configured = current_app.config.get('MAIL_SERVER')

    if mail_configured:
        subject = 'Verify your new email – D&D SFX'
        body = (
            'You requested to change your email to this address.\n\n'
            'Your verification code is: %s\n\n'
            'Enter this code on your profile page to complete the change. '
            'The code expires in %d minutes.\n\n'
            'If you did not request this change, you can ignore this email.'
        ) % (code, CODE_EXPIRY_MINUTES)
        if not send_email(new_email, subject, body):
            db.session.delete(pending)
            db.session.commit()
            return jsonify({'error': 'Failed to send verification email. Try again later.'}), 503
        return jsonify({
            'message': 'Verification code sent to ' + new_email,
            'expires_minutes': CODE_EXPIRY_MINUTES,
        }), 200
    # No mail server configured: return the code in the response so the user can still test (e.g. local dev)
    return jsonify({
        'message': 'Verification code generated (email not configured). Use the code below.',
        'expires_minutes': CODE_EXPIRY_MINUTES,
        'dev_code': code,
    }), 200


@auth_bp.route('/auth/profile/confirm-email-change', methods=['POST'])
@login_required
def confirm_email_change():
    """Apply the email change using the verification code."""
    data = request.get_json()
    if not data or not data.get('code'):
        return jsonify({'error': 'code is required'}), 400
    code = (data.get('code') or '').strip()
    pending = PendingEmailChange.query.filter_by(
        user_id=current_user.id,
    ).order_by(PendingEmailChange.created_at.desc()).first()
    if not pending:
        return jsonify({'error': 'No pending email change. Request a new code first.'}), 400
    if pending.expires_at < datetime.utcnow():
        db.session.delete(pending)
        db.session.commit()
        return jsonify({'error': 'Verification code has expired. Request a new code.'}), 400
    if pending.code != code:
        return jsonify({'error': 'Invalid verification code'}), 400
    current_user.email = pending.new_email
    db.session.delete(pending)
    db.session.commit()
    return jsonify({'message': 'Email updated', 'user': current_user.to_dict()}), 200


@auth_bp.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json()
    if not data or not data.get('current_password') or not data.get('new_password'):
        return jsonify({'error': 'Current and new password required'}), 400
    if not current_user.check_password(data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 400
    is_valid, msg = validate_password(data['new_password'])
    if not is_valid:
        return jsonify({'error': msg}), 400
    current_user.set_password(data['new_password'])
    db.session.commit()
    return jsonify({'message': 'Password changed'}), 200
