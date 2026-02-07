(function() {
    var grid = document.getElementById('sound-grid');
    var categoryFilter = document.getElementById('category-filter');
    var searchInput = document.getElementById('search-sounds');
    var browseEmpty = document.getElementById('browse-empty');
    var addModal = document.getElementById('add-to-list-modal');
    var addSelect = document.getElementById('add-to-list-select');
    var addCancel = document.getElementById('add-to-list-cancel');
    var addConfirm = document.getElementById('add-to-list-confirm');

    var categories = [];
    var sounds = [];
    var sessionLists = [];
    var currentSoundToAdd = null;
    var currentVariantToAdd = null;
    var currentAudio = null;
    var currentSoundId = null;
    var currentVariantId = null;
    var addToListId = (function() {
        var params = new URLSearchParams(window.location.search);
        return params.get('addToList') || '';
    })();

    var sidebarEl = document.getElementById('browse-list-sidebar');
    var sidebarTitle = document.getElementById('browse-sidebar-title');
    var sidebarList = document.getElementById('browse-sidebar-list');
    var sidebarEmpty = document.getElementById('browse-sidebar-empty');
    var sidebarBack = document.getElementById('browse-sidebar-back');
    var layoutEl = document.getElementById('browse-layout');
    var variantPopoverOutsideListener = null;
    var variantPopoverScrollListener = null;

    function fetchCategories() {
        return fetch('/api/categories', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                categories = data.categories || [];
                categoryFilter.innerHTML = '<option value="">All categories</option>';
                categories.forEach(function(c) {
                    var opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    categoryFilter.appendChild(opt);
                });
            });
    }

    function fetchSounds() {
        var params = new URLSearchParams();
        if (categoryFilter.value) params.set('category_id', categoryFilter.value);
        if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
        return fetch('/api/sounds?' + params.toString(), { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                sounds = data.sounds || [];
                renderSounds();
            });
    }

    function renderSounds() {
        grid.innerHTML = '';
        browseEmpty.hidden = sounds.length > 0;
        sounds.forEach(function(s) {
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'sound-card';
            card.setAttribute('data-sound-id', s.id);
            var showAddBtn = addToListId || window.__user || (window.getGuestLists && window.getGuestLists().length > 0);
            var icon = hasMultipleVariants(s) ? '🔊 <span class="sound-icon-plus">▼</span>' : '🔊';
            card.innerHTML =
                '<span class="sound-icon" aria-hidden="true">' + icon + '</span>' +
                '<span class="sound-name">' + escapeHtml(s.name) + '</span>' +
                '<span class="sound-category">' + escapeHtml(s.category_name || '') + '</span>' +
                (showAddBtn ? '<button type="button" class="add-to-list" aria-label="Add to list" data-sound-id="' + s.id + '">+</button>' : '') +
                '<span class="sound-play-pause" aria-hidden="true"><button type="button" class="sound-play-pause-btn" data-action="pause" aria-label="Pause" title="Pause"></button></span>';
            card.addEventListener('click', function(e) {
                if (e.target.classList.contains('add-to-list') || e.target.closest('.sound-play-pause-btn')) return;
                if (hasMultipleVariants(s)) showVariantPopover(s, card);
                else playSound(s);
            });
            var addBtn = card.querySelector('.add-to-list');
            if (addBtn) {
                addBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (addToListId) addSoundToList(s, addToListId);
                    else openAddModal(s);
                });
            }
            var playPauseBtn = card.querySelector('.sound-play-pause-btn');
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (currentAudio && currentSoundId === s.id) {
                        if (card.classList.contains('paused')) {
                            currentAudio.play().catch(function() {});
                        } else {
                            currentAudio.pause();
                        }
                    }
                });
            }
            grid.appendChild(card);
        });
    }

    function escapeHtml(s) {
        if (!s) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function hasMultipleVariants(sound) {
        return sound.variants && sound.variants.length > 1;
    }

    function showVariantPopover(sound, triggerEl) {
        var popover = document.getElementById('sound-variant-popover');
        var inner = document.getElementById('sound-variant-popover-inner');
        if (!popover || !inner) return;
        /* Remove any existing outside/scroll listeners from a previous open so we never have two (e.g. user opened for sound A then clicked sound B). */
        if (variantPopoverOutsideListener) {
            document.removeEventListener('click', variantPopoverOutsideListener);
            variantPopoverOutsideListener = null;
        }
        if (variantPopoverScrollListener) {
            window.removeEventListener('scroll', variantPopoverScrollListener);
            variantPopoverScrollListener = null;
        }
        if (popover) {
            popover.hidden = true;
            popover.setAttribute('aria-hidden', 'true');
        }
        inner.innerHTML = '';
        var showAddBtn = addToListId || window.__user || (window.getGuestLists && window.getGuestLists().length > 0);
        sound.variants.forEach(function(v, i) {
            var row = document.createElement('div');
            row.className = 'sound-variant-popover-row';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sound-variant-popover-btn';
            btn.textContent = v.label || ('Option ' + (i + 1));
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                playSound(sound, v.url);
                closeVariantPopover();
            });
            row.appendChild(btn);
            if (showAddBtn) {
                var addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'sound-variant-popover-add';
                addBtn.setAttribute('aria-label', 'Add to list');
                addBtn.textContent = '+';
                addBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var variant = { id: v.id, url: v.url, label: v.label || ('Option ' + (i + 1)) };
                    if (addToListId) addSoundToList(sound, addToListId, variant);
                    else openAddModal(sound, variant);
                    closeVariantPopover();
                });
                row.appendChild(addBtn);
            }
            inner.appendChild(row);
        });
        var rect = triggerEl.getBoundingClientRect();
        popover.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + 'px';
        popover.style.top = (rect.bottom + 6) + 'px';
        if (rect.bottom + 200 > window.innerHeight) popover.style.top = (rect.top - 6) + 'px';
        popover.hidden = false;
        popover.setAttribute('aria-hidden', 'false');
        function closeOnClickOutside(e) {
            if (popover.contains(e.target) || triggerEl.contains(e.target)) return;
            closeVariantPopover();
        }
        variantPopoverOutsideListener = closeOnClickOutside;
        setTimeout(function() { document.addEventListener('click', closeOnClickOutside); }, 0);

        function closeOnScroll() {
            closeVariantPopover();
        }
        variantPopoverScrollListener = closeOnScroll;
        window.addEventListener('scroll', closeOnScroll, { passive: true });
    }

    function closeVariantPopover() {
        var popover = document.getElementById('sound-variant-popover');
        if (popover) {
            popover.hidden = true;
            popover.setAttribute('aria-hidden', 'true');
        }
        if (variantPopoverOutsideListener) {
            document.removeEventListener('click', variantPopoverOutsideListener);
            variantPopoverOutsideListener = null;
        }
        if (variantPopoverScrollListener) {
            window.removeEventListener('scroll', variantPopoverScrollListener);
            variantPopoverScrollListener = null;
        }
    }

    function updatePlayPauseUI(soundId, state, variantId) {
        var variantKey = (variantId == null || variantId === '') ? '' : String(variantId);
        var cardSel = '.sound-card[data-sound-id="' + soundId + '"]';
        var sideSel = '.browse-sidebar-item[data-sound-id="' + soundId + '"][data-variant-id="' + variantKey + '"]';
        var containers = document.querySelectorAll(cardSel + ', ' + sideSel);
        containers.forEach(function(el) {
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
        document.querySelectorAll('.sound-card.playing, .browse-sidebar-item.playing').forEach(function(el) {
            el.classList.remove('playing', 'paused');
        });
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

    function addSoundToList(sound, listId, variant) {
        if (String(listId).indexOf('guest-') === 0) {
            if (window.addSoundToGuestList && window.addSoundToGuestList(listId, sound, variant)) {
                showAddFeedback('Added to list');
                refreshListSidebar();
            }
            return;
        }
        var body = { sound_id: sound.id };
        if (variant && variant.id != null) body.sound_variant_id = variant.id;
        fetch('/api/session-lists/' + listId + '/sounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        })
        .then(function(r) {
            if (r.status === 401) {
                window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname + '?addToList=' + listId);
                return;
            }
            if (r.ok) {
                showAddFeedback('Added to list');
                refreshListSidebar();
            } else r.json().then(function(d) { window.appAlert(d.error || 'Failed to add'); });
        });
    }

    function refreshListSidebar() {
        if (!addToListId || !sidebarEl) return;
        loadListSidebar();
    }

    function loadListSidebar() {
        if (!addToListId || !layoutEl || !sidebarEl) return;
        layoutEl.classList.add('has-sidebar');
        sidebarEl.hidden = false;
        var isGuest = String(addToListId).indexOf('guest-') === 0;
        var backPath = isGuest ? ('/session/guest/' + addToListId.replace(/^guest-/, '')) : ('/session/' + addToListId);
        if (sidebarBack) sidebarBack.href = backPath;
        if (isGuest) {
                    var list = window.getGuestListById && window.getGuestListById(addToListId);
            if (sidebarTitle) sidebarTitle.textContent = list ? list.name : 'List';
            if (!sidebarList) return;
            sidebarList.innerHTML = '';
            if (list && list.sounds && list.sounds.length > 0) {
                list.sounds.forEach(function(s) {
                    var variantId = s.sound_variant_id != null ? s.sound_variant_id : '';
                    var playUrl = s.variant_url || s.url || ('/static/audio/' + (s.file_path || ''));
                    var item = document.createElement('div');
                    item.className = 'browse-sidebar-item';
                    item.setAttribute('role', 'button');
                    item.setAttribute('tabindex', '0');
                    item.setAttribute('data-sound-id', s.id);
                    item.setAttribute('data-variant-id', String(variantId));
                    var displayName = s.variant_label ? (s.name + ' – ' + s.variant_label) : s.name;
                    var sideIcon = (s.variant_url || s.sound_variant_id != null) ? '🔊' : (hasMultipleVariants(s) ? '🔊 <span class="sound-icon-plus">▼</span>' : '🔊');
                    item.innerHTML =
                        '<span class="browse-sidebar-item-icon" aria-hidden="true">' + sideIcon + '</span>' +
                        '<span class="browse-sidebar-item-name">' + escapeHtml(displayName) + '</span>' +
                        '<span class="browse-sidebar-item-cat">' + escapeHtml(s.category_name || '') + '</span>' +
                        '<span class="sound-play-pause" aria-hidden="true"><button type="button" class="sound-play-pause-btn" data-action="pause" aria-label="Pause" title="Pause"></button></span>';
                    function handleItemAction(e) {
                        if (e.target.closest('.sound-play-pause-btn')) return;
                        if (s.variant_url || s.sound_variant_id != null) {
                            playSound(s, playUrl, s.sound_variant_id);
                        } else if (hasMultipleVariants(s)) {
                            showVariantPopover(s, item);
                        } else {
                            playSound(s);
                        }
                    }
                    item.addEventListener('click', function(e) { handleItemAction(e); });
                    item.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemAction(e); }
                    });
                    var ppBtn = item.querySelector('.sound-play-pause-btn');
                    if (ppBtn) {
                        ppBtn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var same = currentSoundId === s.id && (currentVariantId == null ? variantId === '' || variantId == null : currentVariantId === s.sound_variant_id);
                            if (currentAudio && same) {
                                if (item.classList.contains('paused')) currentAudio.play().catch(function() {});
                                else currentAudio.pause();
                            }
                        });
                    }
                    sidebarList.appendChild(item);
                });
            }
            return;
        }
        fetch('/api/session-lists/' + addToListId, { credentials: 'same-origin' })
            .then(function(r) {
                if (!r.ok) return null;
                return r.json();
            })
            .then(function(list) {
                if (sidebarTitle) sidebarTitle.textContent = list ? list.name : 'List';
                if (!sidebarList) return;
                sidebarList.innerHTML = '';
                if (list && list.sounds && list.sounds.length > 0) {
                    list.sounds.forEach(function(entry) {
                        var s = entry.sound || entry;
                        var variantId = entry.sound_variant_id != null ? entry.sound_variant_id : '';
                        var playUrl = entry.variant_url || (s && s.url) || (s && ('/static/audio/' + (s.file_path || '')));
                        var item = document.createElement('div');
                        item.className = 'browse-sidebar-item';
                        item.setAttribute('role', 'button');
                        item.setAttribute('tabindex', '0');
                        item.setAttribute('data-sound-id', s.id);
                        item.setAttribute('data-variant-id', String(variantId));
                        var displayName = entry.variant_label ? (s.name + ' – ' + entry.variant_label) : s.name;
                        var sideIcon = (entry.variant_url || entry.sound_variant_id != null) ? '🔊' : (hasMultipleVariants(s) ? '🔊 <span class="sound-icon-plus">▼</span>' : '🔊');
                        item.innerHTML =
                            '<span class="browse-sidebar-item-icon" aria-hidden="true">' + sideIcon + '</span>' +
                            '<span class="browse-sidebar-item-name">' + escapeHtml(displayName) + '</span>' +
                            '<span class="browse-sidebar-item-cat">' + escapeHtml(s.category_name || '') + '</span>' +
                            '<span class="sound-play-pause" aria-hidden="true"><button type="button" class="sound-play-pause-btn" data-action="pause" aria-label="Pause" title="Pause"></button></span>';
                        function handleItemAction(e) {
                            if (e.target.closest('.sound-play-pause-btn')) return;
                            if (entry.variant_url || entry.sound_variant_id != null) {
                                playSound(s, playUrl, entry.sound_variant_id);
                            } else if (hasMultipleVariants(s)) {
                                showVariantPopover(s, item);
                            } else {
                                playSound(s);
                            }
                        }
                        item.addEventListener('click', function(e) { handleItemAction(e); });
                        item.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemAction(e); }
                        });
                        var ppBtn = item.querySelector('.sound-play-pause-btn');
                        if (ppBtn) {
                            ppBtn.addEventListener('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                var same = currentSoundId === s.id && (currentVariantId == null ? (entry.sound_variant_id == null) : currentVariantId === entry.sound_variant_id);
                                if (currentAudio && same) {
                                    if (item.classList.contains('paused')) currentAudio.play().catch(function() {});
                                    else currentAudio.pause();
                                }
                            });
                        }
                        sidebarList.appendChild(item);
                    });
                }
            });
    }

    function showAddFeedback(msg) {
        var toast = document.createElement('div');
        toast.className = 'add-toast';
        toast.textContent = msg;
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
        setTimeout(function() {
            toast.classList.add('add-toast-show');
        }, 10);
        setTimeout(function() {
            toast.classList.remove('add-toast-show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 1500);
    }

    function openAddModal(sound, variant) {
        currentSoundToAdd = sound;
        currentVariantToAdd = variant || null;
        addModal.hidden = false;
        addModal.setAttribute('aria-hidden', 'false');
        addSelect.innerHTML = '';
        if (window.__user) {
            fetch('/api/session-lists', { credentials: 'same-origin' })
                .then(function(r) {
                    if (!r.ok) { addModal.hidden = true; return; }
                    return r.json();
                })
                .then(function(data) {
                    if (!data) return;
                    sessionLists = data.session_lists || [];
                    sessionLists.forEach(function(lst) {
                        var opt = document.createElement('option');
                        opt.value = lst.id;
                        opt.textContent = lst.name;
                        addSelect.appendChild(opt);
                    });
                    if (sessionLists.length === 0) {
                        addSelect.innerHTML = '<option value="">Create a list first from Session List page</option>';
                    }
                });
        } else {
            var guestLists = window.getGuestLists ? window.getGuestLists() : [];
            sessionLists = guestLists.map(function(l) { return { id: l.id, name: l.name }; });
            guestLists.forEach(function(lst) {
                var opt = document.createElement('option');
                opt.value = lst.id;
                opt.textContent = lst.name;
                addSelect.appendChild(opt);
            });
            if (guestLists.length === 0) {
                addSelect.innerHTML = '<option value="">Create a list first (Session lists → Create new list)</option>';
            }
        }
    }

    addCancel.addEventListener('click', function() {
        addModal.hidden = true;
        addModal.setAttribute('aria-hidden', 'true');
        currentSoundToAdd = null;
        currentVariantToAdd = null;
    });
    addConfirm.addEventListener('click', function() {
        var listId = addSelect.value;
        if (!listId || !currentSoundToAdd) { addModal.hidden = true; return; }
        if (String(listId).indexOf('guest-') === 0) {
            if (window.addSoundToGuestList && window.addSoundToGuestList(listId, currentSoundToAdd, currentVariantToAdd)) {
                showAddFeedback('Added to list');
            }
            addModal.hidden = true;
            addModal.setAttribute('aria-hidden', 'true');
            currentSoundToAdd = null;
            currentVariantToAdd = null;
            return;
        }
        var body = { sound_id: currentSoundToAdd.id };
        if (currentVariantToAdd && currentVariantToAdd.id != null) body.sound_variant_id = currentVariantToAdd.id;
        fetch('/api/session-lists/' + listId + '/sounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        })
        .then(function(r) {
            if (r.ok) {
                addModal.hidden = true;
                addModal.setAttribute('aria-hidden', 'true');
                currentSoundToAdd = null;
                currentVariantToAdd = null;
                showAddFeedback('Added to list');
            } else r.json().then(function(d) { window.appAlert(d.error || 'Failed to add'); });
        });
    });

    categoryFilter.addEventListener('change', fetchSounds);
    searchInput.addEventListener('input', debounce(fetchSounds, 300));

    function debounce(fn, ms) {
        var t;
        return function() {
            clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }

    fetch('/auth/me', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) { window.__user = data.user; })
        .then(fetchCategories)
        .then(fetchSounds)
        .then(function() {
            if (addToListId) loadListSidebar();
        });
})();
