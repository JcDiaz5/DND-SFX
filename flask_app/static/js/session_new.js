(function() {
    var nameInput = document.getElementById('new-list-name');
    var errEl = document.getElementById('new-list-error');
    var submitBtn = document.getElementById('new-list-submit');

    function createList() {
        var name = (nameInput && nameInput.value) ? nameInput.value.trim() : '';
        if (!name) {
            errEl.textContent = 'Enter a list name';
            errEl.hidden = false;
            return;
        }
        errEl.hidden = true;
        submitBtn.disabled = true;

        fetch('/api/session-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name: name })
        })
        .then(function(r) {
            if (r.status === 401 || (r.status === 200 && !(r.headers.get('Content-Type') || '').includes('application/json'))) {
                return null;
            }
            if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Failed'); });
            return r.json();
        })
        .then(function(list) {
            if (list && list.id) {
                window.location.href = '/session/' + list.id;
                return;
            }
            if (window.createGuestList) {
                var guestList = window.createGuestList(name);
                window.location.href = '/session/guest/' + guestList.id.replace(/^guest-/, '');
                return;
            }
            errEl.textContent = 'Log in to save lists, or enable JavaScript for temporary lists.';
            errEl.hidden = false;
        })
        .catch(function(e) {
            errEl.textContent = e.message || 'Create failed.';
            errEl.hidden = false;
        })
        .then(function() { submitBtn.disabled = false; });
    }

    if (submitBtn) submitBtn.addEventListener('click', createList);
})();
