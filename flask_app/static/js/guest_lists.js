/** Guest session lists in sessionStorage (erased when tab/window closes). */
window.DND_GUEST_LISTS_KEY = 'dnd_guest_lists';

function getGuestLists() {
    try {
        var raw = sessionStorage.getItem(window.DND_GUEST_LISTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function setGuestLists(lists) {
    sessionStorage.setItem(window.DND_GUEST_LISTS_KEY, JSON.stringify(lists));
}

function getGuestListById(id) {
    var lists = getGuestLists();
    return lists.find(function(l) { return l.id === id; }) || null;
}

function createGuestList(name) {
    var lists = getGuestLists();
    var id = 'guest-' + Date.now();
    var list = { id: id, name: name, sounds: [] };
    lists.push(list);
    setGuestLists(lists);
    return list;
}

function updateGuestList(id, data) {
    var lists = getGuestLists();
    var idx = lists.findIndex(function(l) { return l.id === id; });
    if (idx === -1) return null;
    if (data.name !== undefined) lists[idx].name = data.name;
    if (data.sounds !== undefined) lists[idx].sounds = data.sounds;
    setGuestLists(lists);
    return lists[idx];
}

/**
 * Add a sound (or a specific variant) to a guest list.
 * @param {string} listId
 * @param {object} sound - sound object with id, name, etc.
 * @param {object} [variant] - optional { id, url, label } for a specific variant; omit to add the whole sound
 */
function addSoundToGuestList(listId, sound, variant) {
    var list = getGuestListById(listId);
    if (!list) return false;
    var variantId = variant && variant.id != null ? variant.id : null;
    var variantUrl = variant && variant.url ? variant.url : null;
    var variantLabel = variant && variant.label ? variant.label : null;
    var entry = {
        id: sound.id,
        name: sound.name,
        category_name: sound.category_name || '',
        file_path: sound.file_path || '',
        url: sound.url || ('/static/audio/' + (sound.file_path || '')),
        sound_variant_id: variantId,
        variant_url: variantUrl,
        variant_label: variantLabel
    };
    if (list.sounds.some(function(s) { return s.id === sound.id && (s.sound_variant_id == null ? variantId == null : s.sound_variant_id === variantId); })) return true;
    list.sounds.push(entry);
    updateGuestList(listId, { sounds: list.sounds });
    return true;
}

function removeSoundFromGuestList(listId, soundId, variantId) {
    var list = getGuestListById(listId);
    if (!list) return false;
    list.sounds = list.sounds.filter(function(s) {
        if (s.id !== soundId) return true;
        if (variantId === undefined || variantId === null) return s.sound_variant_id == null;
        return s.sound_variant_id !== variantId;
    });
    updateGuestList(listId, { sounds: list.sounds });
    return true;
}

function deleteGuestList(id) {
    var lists = getGuestLists().filter(function(l) { return l.id !== id; });
    setGuestLists(lists);
}

window.getGuestLists = getGuestLists;
window.getGuestListById = getGuestListById;
window.createGuestList = createGuestList;
window.updateGuestList = updateGuestList;
window.addSoundToGuestList = addSoundToGuestList;
window.deleteGuestList = deleteGuestList;
