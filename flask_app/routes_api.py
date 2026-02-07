"""D&D SFX App - API routes for categories, sounds, session lists."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from flask_app import db
from flask_app.models import Category, Sound, SoundVariant, SessionList, SessionListSound

api_bp = Blueprint('api_bp', __name__)


# ---- Categories ----
@api_bp.route('/categories', methods=['GET'])
def list_categories():
    cats = Category.query.filter_by(is_active=True).order_by(Category.sort_order, Category.name).all()
    return jsonify({'categories': [c.to_dict() for c in cats]}), 200


# ---- Sounds ----
@api_bp.route('/sounds', methods=['GET'])
def list_sounds():
    category_id = request.args.get('category_id', type=int)
    search = (request.args.get('q') or '').strip()
    q = Sound.query.filter_by(is_active=True).join(Category).filter(Category.is_active == True)
    if category_id:
        q = q.filter(Sound.category_id == category_id)
    if search:
        q = q.filter(Sound.name.ilike(f'%{search}%'))
    sounds = q.order_by(Sound.name).all()
    return jsonify({'sounds': [s.to_dict() for s in sounds]}), 200


@api_bp.route('/sounds/<int:sound_id>', methods=['GET'])
def get_sound(sound_id):
    s = Sound.query.filter_by(id=sound_id, is_active=True).first()
    if not s:
        return jsonify({'error': 'Sound not found'}), 404
    return jsonify(s.to_dict()), 200


# ---- Session lists (require login) ----
@api_bp.route('/session-lists', methods=['GET'])
@login_required
def list_session_lists():
    lists = SessionList.query.filter_by(user_id=current_user.id).order_by(SessionList.updated_at.desc()).all()
    return jsonify({'session_lists': [lst.to_dict() for lst in lists]}), 200


@api_bp.route('/session-lists', methods=['POST'])
@login_required
def create_session_list():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'List name is required'}), 400
    lst = SessionList(user_id=current_user.id, name=name)
    db.session.add(lst)
    db.session.commit()
    return jsonify(lst.to_dict()), 201


@api_bp.route('/session-lists/<int:list_id>', methods=['GET'])
@login_required
def get_session_list(list_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    return jsonify(lst.to_dict()), 200


@api_bp.route('/session-lists/<int:list_id>', methods=['PUT'])
@login_required
def update_session_list(list_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    data = request.get_json()
    if data.get('name'):
        lst.name = data['name'].strip()
    db.session.commit()
    return jsonify(lst.to_dict()), 200


@api_bp.route('/session-lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_session_list(list_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    db.session.delete(lst)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@api_bp.route('/session-lists/<int:list_id>/sounds', methods=['POST'])
@login_required
def add_sound_to_session_list(list_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    data = request.get_json() or {}
    sound_id = data.get('sound_id')
    if not sound_id:
        return jsonify({'error': 'sound_id required'}), 400
    if not Sound.query.get(sound_id):
        return jsonify({'error': 'Sound not found'}), 404
    sound_variant_id = data.get('sound_variant_id')
    if sound_variant_id is not None:
        v = SoundVariant.query.filter_by(id=sound_variant_id, sound_id=sound_id).first()
        if not v:
            return jsonify({'error': 'Variant not found for this sound'}), 400
    else:
        sound_variant_id = None
    existing = SessionListSound.query.filter_by(
        session_list_id=list_id, sound_id=sound_id, sound_variant_id=sound_variant_id
    ).first()
    if existing:
        return jsonify({'error': 'This sound (or variant) is already in the list'}), 400
    max_order = db.session.query(db.func.max(SessionListSound.sort_order)).filter_by(session_list_id=list_id).scalar() or 0
    entry = SessionListSound(
        session_list_id=list_id, sound_id=sound_id, sound_variant_id=sound_variant_id, sort_order=max_order + 1
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@api_bp.route('/session-lists/<int:list_id>/sounds/<int:sound_id>', methods=['DELETE'])
@login_required
def remove_sound_from_session_list(list_id, sound_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    sound_variant_id = request.args.get('variant_id', type=int)
    q = SessionListSound.query.filter_by(session_list_id=list_id, sound_id=sound_id)
    if sound_variant_id is not None:
        q = q.filter_by(sound_variant_id=sound_variant_id)
    else:
        q = q.filter_by(sound_variant_id=None)
    entry = q.first()
    if not entry:
        q_any = SessionListSound.query.filter_by(session_list_id=list_id, sound_id=sound_id)
        entry = q_any.first()
    if not entry:
        return jsonify({'error': 'Sound not in list'}), 404
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Removed'}), 200


@api_bp.route('/session-lists/<int:list_id>/sounds/reorder', methods=['PUT'])
@login_required
def reorder_session_list_sounds(list_id):
    lst = SessionList.query.filter_by(id=list_id, user_id=current_user.id).first()
    if not lst:
        return jsonify({'error': 'Session list not found'}), 404
    data = request.get_json()
    order = data.get('sound_ids')
    if not isinstance(order, list):
        return jsonify({'error': 'sound_ids array required'}), 400
    for i, sound_id in enumerate(order):
        entry = SessionListSound.query.filter_by(session_list_id=list_id, sound_id=sound_id).first()
        if entry:
            entry.sort_order = i
    db.session.commit()
    return jsonify(lst.to_dict()), 200
