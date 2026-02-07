(function() {
    var listIdEl = document.getElementById('session-list-id');
    var listId = listIdEl ? listIdEl.getAttribute('data-list-id') : '';
    var titleEl = document.getElementById('session-title');
    var actionsEl = document.getElementById('session-actions');
    var soundsContainer = document.getElementById('session-list-sounds');
    var emptyEl = document.getElementById('session-empty');
    var currentAudio = null;
    var currentSoundId = null;
    var currentVariantId = null;
    var isGuestList = listId && String(listId).indexOf('guest-') === 0;

    if (!listId || listId === 'None' || listId === '') {
        window.location.href = '/session';
        return;
    }

    if (isGuestList) loadGuestList(); else loadList();

    function showCreateForm() {
        titleEl.textContent = 'New session list';
        soundsContainer.style.display = 'none';
        emptyEl.hidden = true;
        var form = document.createElement('div');
        form.className = 'auth-page';
        form.style.maxWidth = '400px';
        form.innerHTML =
            '<h2 style="font-family:var(--font-display);color:var(--color-accent);margin-bottom:1rem;">Create a session list</h2>' +
            '<p style="color:var(--color-text-muted);margin-bottom:1rem;">Name your list, then add sounds from Browse.</p>' +
            '<div class="form-group">' +
            '<label for="new-list-name">List name</label>' +
            '<input type="text" id="new-list-name" placeholder="e.g. Tonight\'s session" required>' +
            '</div>' +
            '<p class="form-error" id="new-list-error" hidden></p>' +
            '<div class="form-actions"><button type="button" class="btn btn-primary" id="new-list-submit">Create</button></div>';
        actionsEl.parentElement.insertBefore(form, actionsEl.nextSibling);
        document.getElementById('new-list-submit').addEventListener('click', createList);
    }

    function createList() {
        var name = document.getElementById('new-list-name').value.trim();
        var err = document.getElementById('new-list-error');
        if (!name) { err.textContent = 'Enter a name'; err.hidden = false; return; }
        err.hidden = true;
        fetch('/api/session-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name: name })
        })
        .then(function(r) {
            if (r.status === 401) {
                window.location.href = '/login?next=' + encodeURIComponent('/session/new');
                return;
            }
            var ct = r.headers.get('Content-Type') || '';
            if (!ct.includes('application/json')) {
                window.location.href = '/login?next=' + encodeURIComponent('/session/new');
                return;
            }
            if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Failed'); });
            return r.json();
        })
        .then(function(list) {
            if (list && list.id) window.location.href = '/session/' + list.id;
        })
        .catch(function(e) {
            err.textContent = e.message || 'Create failed. Log in to save lists.';
            err.hidden = false;
        });
    }

    function loadGuestList() {
        var list = window.getGuestListById && window.getGuestListById(listId);
        if (!list) {
            emptyEl.innerHTML = '<p>List not found or it was cleared (guest lists last until the tab is closed).</p><a href="/session" class="btn btn-primary">Session lists</a>';
            emptyEl.hidden = false;
            soundsContainer.style.display = 'none';
            return;
        }
        titleEl.textContent = list.name || 'Session list';
        var addToListParam = encodeURIComponent(listId);
        actionsEl.innerHTML =
            '<a href="/browse?addToList=' + addToListParam + '" class="btn btn-ghost">Add sounds</a>' +
            '<button type="button" class="btn btn-ghost" id="rename-list-btn">Rename</button>' +
            '<button type="button" class="btn btn-ghost" id="delete-list-btn">Delete</button>';
        document.getElementById('rename-list-btn').addEventListener('click', function() {
            window.appPrompt({ title: 'New name', value: list.name }).then(function(newName) {
                if (newName !== null && newName.trim()) {
                    window.updateGuestList && window.updateGuestList(listId, { name: newName.trim() });
                    titleEl.textContent = newName.trim();
                }
            });
        });
        document.getElementById('delete-list-btn').addEventListener('click', function() {
            window.appConfirm({ title: 'Delete list', message: 'Delete this list?' }).then(function(ok) {
                if (ok) {
                    window.deleteGuestList && window.deleteGuestList(listId);
                    window.location.href = '/session';
                }
            });
        });
        var soundEntries = (list.sounds || []).map(function(s) { return { sound: s }; });
        renderSounds(soundEntries);
        emptyEl.hidden = soundEntries.length > 0;
        var emptyLink = document.getElementById('session-empty-add-link');
        if (emptyLink) emptyLink.href = '/browse?addToList=' + encodeURIComponent(listId);
        soundsContainer.style.display = soundEntries.length > 0 ? 'grid' : 'none';
    }

    function loadList() {
        fetch('/api/session-lists/' + listId, { credentials: 'same-origin' })
            .then(function(r) {
                if (r.status === 401) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return; }
                if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Not found'); });
                return r.json();
            })
            .then(function(list) {
                if (!list) return;
                titleEl.textContent = list.name || 'Session list';
                var addToListParam = encodeURIComponent(listId);
                actionsEl.innerHTML =
                    '<a href="/browse?addToList=' + addToListParam + '" class="btn btn-ghost">Add sounds</a>' +
                    '<button type="button" class="btn btn-ghost" id="rename-list-btn">Rename</button>' +
                    '<button type="button" class="btn btn-ghost" id="delete-list-btn">Delete</button>';
                document.getElementById('rename-list-btn').addEventListener('click', function() { renameList(list); });
                document.getElementById('delete-list-btn').addEventListener('click', function() { deleteList(); });
                renderSounds(list.sounds || []);
                emptyEl.hidden = (list.sounds && list.sounds.length > 0);
                var emptyLink = document.getElementById('session-empty-add-link');
                if (emptyLink) emptyLink.href = '/browse?addToList=' + encodeURIComponent(listId);
                if (!list.sounds || list.sounds.length === 0) {
                    soundsContainer.style.display = 'none';
                } else {
                    soundsContainer.style.display = 'grid';
                }
            })
            .catch(function(e) {
                if (e.message === 'Not found' || e.message === 'Session list not found') {
                    emptyEl.innerHTML = '<p>List not found or you don\'t have access.</p><a href="/session" class="btn btn-primary">Session lists</a>';
                    emptyEl.hidden = false;
                    soundsContainer.style.display = 'none';
                } else {
                    emptyEl.innerHTML = '<p>Log in to view your session lists.</p><a href="/login" class="btn btn-primary">Log in</a>';
                    emptyEl.hidden = false;
                    soundsContainer.style.display = 'none';
                }
            });
    }

    function updatePlayPauseUI(soundId, state, variantId) {
        var variantKey = (variantId == null || variantId === '') ? '' : String(variantId);
        var sel = '.sound-card[data-sound-id="' + soundId + '"][data-variant-id="' + variantKey + '"]';
        document.querySelectorAll(sel).forEach(function(el) {
            el.classList.remove('playing', 'paused');
            var btn = el.querySelector('.sound-play-pause-btn');
            if (!btn) return;
            if (state === 'playing') {
                el.classList.add('playing');
                btn.setAttribute('data-action', 'pause');
                btn.setAttribute('aria-label', 'Pause');
                btn.title = 'Pause';
            } else if (state === 'paused') {
                el.classList.add('playing', 'paused');
                btn.setAttribute('data-action', 'play');
                btn.setAttribute('aria-label', 'Play');
                btn.title = 'Play';
            }
        });
    }

    function clearAllPlayingState() {
        document.querySelectorAll('.sound-card.playing').forEach(function(el) {
            el.classList.remove('playing', 'paused');
        });
    }

    function renderSounds(sounds) {
        soundsContainer.innerHTML = '';
        sounds.forEach(function(entry) {
            var s = entry.sound || entry;
            var variantId = (entry.sound_variant_id != null ? entry.sound_variant_id : (s && s.sound_variant_id != null ? s.sound_variant_id : null));
            var variantIdStr = variantId != null ? String(variantId) : '';
            var playUrl = (entry.variant_url || (s && s.variant_url)) || (s && s.url) || (s && ('/static/audio/' + (s.file_path || '')));
            var variantLabel = entry.variant_label || (s && s.variant_label);
            var displayName = variantLabel ? (s.name + ' – ' + variantLabel) : (s.name || '');
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'sound-card';
            card.setAttribute('data-sound-id', s.id);
            card.setAttribute('data-variant-id', variantIdStr);
            var hasVariant = variantId != null;
            var icon = hasVariant ? '🔊' : (hasMultipleVariants(s) ? '🔊 <span class="sound-icon-plus">▼</span>' : '🔊');
            card.innerHTML =
                '<span class="sound-icon" aria-hidden="true">' + icon + '</span>' +
                '<span class="sound-name">' + (displayName || '').replace(/</g, '&lt;') + '</span>' +
                '<span class="sound-category">' + (s.category_name || '').replace(/</g, '&lt;') + '</span>' +
                '<span class="sound-play-pause" aria-hidden="true"><button type="button" class="sound-play-pause-btn" data-action="pause" aria-label="Pause" title="Pause"></button></span>';
            card.addEventListener('click', function(e) {
                if (e.target.closest('.sound-play-pause-btn')) return;
                if (variantId != null || playUrl !== (s.url || ('/static/audio/' + (s.file_path || '')))) {
                    playSound(s, playUrl, variantId);
                } else if (hasMultipleVariants(s)) {
                    showVariantPopover(s, card);
                } else {
                    playSound(s);
                }
            });
            var playPauseBtn = card.querySelector('.sound-play-pause-btn');
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var same = currentSoundId === s.id && (currentVariantId == null ? (variantId == null) : currentVariantId === variantId);
                    if (currentAudio && same) {
                        if (card.classList.contains('paused')) {
                            currentAudio.play().catch(function() {});
                        } else {
                            currentAudio.pause();
                        }
                    }
                });
            }
            soundsContainer.appendChild(card);
        });
    }

    function hasMultipleVariants(sound) {
        return sound.variants && sound.variants.length > 1;
    }

    function showVariantPopover(sound, triggerEl) {
        var popover = document.getElementById('sound-variant-popover');
        var inner = document.getElementById('sound-variant-popover-inner');
        if (!popover || !inner) return;
        /* Remove any existing outside/scroll listeners from a previous open so we never have two (e.g. user opened for sound A then clicked sound B). */
        if (window.__sessionVariantOutsideListener) {
            document.removeEventListener('click', window.__sessionVariantOutsideListener);
            window.__sessionVariantOutsideListener = null;
        }
        if (window.__sessionVariantScrollListener) {
            window.removeEventListener('scroll', window.__sessionVariantScrollListener);
            window.__sessionVariantScrollListener = null;
        }
        if (popover) {
            popover.hidden = true;
            popover.setAttribute('aria-hidden', 'true');
        }
        inner.innerHTML = '';
        sound.variants.forEach(function(v, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sound-variant-popover-btn';
            btn.textContent = v.label || ('Option ' + (i + 1));
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                playSound(sound, v.url);
                closeVariantPopover();
            });
            inner.appendChild(btn);
        });
        var rect = triggerEl.getBoundingClientRect();
        popover.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + 'px';
        popover.style.top = (rect.bottom + 6) + 'px';
        if (rect.bottom + 200 > window.innerHeight) popover.style.top = (rect.top - 6) + 'px';
        popover.hidden = false;
        popover.setAttribute('aria-hidden', 'false');
        var outsideListener = function(e) {
            if (popover.contains(e.target) || triggerEl.contains(e.target)) return;
            closeVariantPopover();
        };
        setTimeout(function() { document.addEventListener('click', outsideListener); }, 0);
        window.__sessionVariantOutsideListener = outsideListener;

        var scrollListener = function() {
            closeVariantPopover();
        };
        window.__sessionVariantScrollListener = scrollListener;
        window.addEventListener('scroll', scrollListener, { passive: true });
    }

    function closeVariantPopover() {
        var popover = document.getElementById('sound-variant-popover');
        if (popover) {
            popover.hidden = true;
            popover.setAttribute('aria-hidden', 'true');
        }
        if (window.__sessionVariantOutsideListener) {
            document.removeEventListener('click', window.__sessionVariantOutsideListener);
            window.__sessionVariantOutsideListener = null;
        }
        if (window.__sessionVariantScrollListener) {
            window.removeEventListener('scroll', window.__sessionVariantScrollListener);
            window.__sessionVariantScrollListener = null;
        }
    }

    function playSound(sound, sourceUrl, variantId) {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        clearAllPlayingState();
        var url = sourceUrl || sound.url || ('/static/audio/' + (sound.file_path || ''));
        var audio = new Audio(url);
        var vid = variantId == null ? null : variantId;
        audio.addEventListener('play', function() {
            currentSoundId = sound.id;
            currentVariantId = vid;
            updatePlayPauseUI(sound.id, 'playing', vid);
        });
        audio.addEventListener('pause', function() {
            if (currentSoundId === sound.id && (currentVariantId == null ? vid == null : currentVariantId === vid) && !audio.ended) {
                updatePlayPauseUI(sound.id, 'paused', vid);
            }
        });
        audio.addEventListener('ended', function() {
            if (currentSoundId === sound.id && (currentVariantId == null ? vid == null : currentVariantId === vid)) {
                clearAllPlayingState();
                currentSoundId = null;
                currentVariantId = null;
                currentAudio = null;
            }
        });
        audio.addEventListener('error', function() {
            if (currentSoundId === sound.id) {
                clearAllPlayingState();
                currentSoundId = null;
                currentVariantId = null;
                currentAudio = null;
            }
        });
        currentAudio = audio;
        currentSoundId = sound.id;
        currentVariantId = vid;
        updatePlayPauseUI(sound.id, 'playing', vid);
        audio.play().catch(function() {});
    }

    function renameList(list) {
        window.appPrompt({ title: 'New name', value: list.name }).then(function(newName) {
            if (newName === null || !newName.trim()) return;
            var name = newName.trim();
            fetch('/api/session-lists/' + listId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ name: name })
            })
            .then(function(r) { if (r.ok) titleEl.textContent = name; });
        });
    }

    function deleteList() {
        window.appConfirm({ title: 'Delete list', message: 'Delete this list?' }).then(function(ok) {
            if (!ok) return;
            fetch('/api/session-lists/' + listId, { method: 'DELETE', credentials: 'same-origin' })
                .then(function(r) { if (r.ok) window.location.href = '/session'; });
        });
    }
})();
