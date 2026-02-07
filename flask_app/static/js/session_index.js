(function() {
    var container = document.getElementById('session-lists-list');
    var loading = document.getElementById('session-lists-loading');
    var emptyEl = document.getElementById('session-lists-empty');

    function render() {
        loading.hidden = true;
        fetch('/auth/me', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.user) {
                    return fetch('/api/session-lists', { credentials: 'same-origin' })
                        .then(function(r) { return r.json(); })
                        .then(function(api) { return (api.session_lists || []).map(function(l) { return { id: String(l.id), name: l.name, isGuest: false }; }); });
                }
                var guest = window.getGuestLists ? window.getGuestLists() : [];
                return guest.map(function(l) { return { id: l.id, name: l.name, isGuest: true }; });
            })
            .then(function(lists) {
                container.innerHTML = '';
                container.hidden = lists.length === 0;
                emptyEl.hidden = lists.length > 0;
                lists.forEach(function(l) {
                    var href = l.isGuest ? ('/session/guest/' + l.id.replace(/^guest-/, '')) : ('/session/' + l.id);
                    var a = document.createElement('a');
                    a.href = href;
                    a.className = 'session-list-card';
                    a.innerHTML = '<span class="session-list-card-name">' + escapeHtml(l.name) + '</span>' + (l.isGuest ? '<span class="session-list-card-badge">Temporary</span>' : '');
                    container.appendChild(a);
                });
            })
            .catch(function() {
                loading.hidden = true;
                container.hidden = true;
                emptyEl.hidden = false;
                emptyEl.innerHTML = '<p>Could not load lists.</p>';
            });
    }

    function escapeHtml(s) {
        if (!s) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    render();
})();
