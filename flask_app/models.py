"""D&D SFX App - Database models."""
from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from flask_app import db


class User(UserMixin, db.Model):
    """User account for saving session lists."""
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)

    session_lists = db.relationship('SessionList', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


class PendingEmailChange(db.Model):
    """Pending email change: verification code sent to new address."""
    __tablename__ = 'pending_email_changes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    new_email = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('pending_email_changes', cascade='all, delete-orphan'))


class Category(db.Model):
    """Sound effect category (e.g. Combat, Magic, Ambience)."""
    __tablename__ = 'categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)
    slug = db.Column(db.String(80), unique=True, nullable=True)
    description = db.Column(db.Text)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sounds = db.relationship('Sound', backref='category', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'sort_order': self.sort_order,
            'sound_count': self.sounds.count(),
        }


class SoundVariant(db.Model):
    """Optional multiple audio files for one sound (user picks one when playing)."""
    __tablename__ = 'sound_variants'

    id = db.Column(db.Integer, primary_key=True)
    sound_id = db.Column(db.Integer, db.ForeignKey('sounds.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    label = db.Column(db.String(80), nullable=True)  # e.g. "Version 1", "Heavy"
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'file_path': self.file_path,
            'url': f'/static/audio/{self.file_path}' if self.file_path else None,
            'label': self.label,
        }


class Sound(db.Model):
    """A single sound effect. Audio stored in static/audio or served by path. May have multiple variants."""
    __tablename__ = 'sounds'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)  # default/single file under static/audio
    duration_seconds = db.Column(db.Float, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    variants = db.relationship(
        'SoundVariant',
        backref='sound',
        lazy='joined',
        order_by='SoundVariant.sort_order',
        cascade='all, delete-orphan',
    )

    def to_dict(self):
        variant_list = sorted(self.variants, key=lambda v: (v.sort_order, v.id))
        variants_dict = [v.to_dict() for v in variant_list]
        return {
            'id': self.id,
            'name': self.name,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'file_path': self.file_path,
            'url': f'/static/audio/{self.file_path}' if self.file_path else None,
            'duration_seconds': self.duration_seconds,
            'is_active': self.is_active,
            'variants': variants_dict,
        }


class SessionList(db.Model):
    """User's saved session sound list (playlist of sounds for a game session)."""
    __tablename__ = 'session_lists'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sounds = db.relationship(
        'SessionListSound',
        backref='session_list',
        lazy='dynamic',
        order_by='SessionListSound.sort_order',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'sounds': [s.to_dict() for s in self.sounds.all()],
        }


class SessionListSound(db.Model):
    """Junction: sound (or a specific variant) in a session list with order."""
    __tablename__ = 'session_list_sounds'

    id = db.Column(db.Integer, primary_key=True)
    session_list_id = db.Column(db.Integer, db.ForeignKey('session_lists.id'), nullable=False)
    sound_id = db.Column(db.Integer, db.ForeignKey('sounds.id'), nullable=False)
    sound_variant_id = db.Column(db.Integer, db.ForeignKey('sound_variants.id'), nullable=True)
    sort_order = db.Column(db.Integer, default=0)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    sound = db.relationship('Sound', backref='session_list_entries')
    sound_variant = db.relationship('SoundVariant', backref='session_list_entries', foreign_keys=[sound_variant_id])

    __table_args__ = (db.UniqueConstraint('session_list_id', 'sound_id', 'sound_variant_id', name='uq_session_list_sound_variant'),)

    def to_dict(self):
        sound_dict = self.sound.to_dict() if self.sound else None
        variant_url = None
        variant_label = None
        if self.sound_variant_id and self.sound_variant:
            variant_url = '/static/audio/' + self.sound_variant.file_path if self.sound_variant.file_path else None
            variant_label = self.sound_variant.label
        return {
            'id': self.id,
            'session_list_id': self.session_list_id,
            'sound_id': self.sound_id,
            'sound_variant_id': self.sound_variant_id,
            'sort_order': self.sort_order,
            'sound': sound_dict,
            'variant_url': variant_url,
            'variant_label': variant_label,
        }
