(function() {
    var profileForm = document.getElementById('profile-form');
    var passwordForm = document.getElementById('password-form');
    var listsEl = document.getElementById('profile-session-lists');
    var noListsEl = document.getElementById('profile-no-lists');
    var currentEmail = '';

    var emailVerifyModal = document.getElementById('email-verify-modal');
    var emailVerifyMessage = document.getElementById('email-verify-message');
    var emailVerifyCodeInput = document.getElementById('email-verify-code');
    var emailVerifyError = document.getElementById('email-verify-error');
    var pendingNewEmail = null;
    var pendingFirstName = '';
    var pendingLastName = '';

    function closeEmailVerifyModal() {
        if (emailVerifyModal) {
            emailVerifyModal.hidden = true;
            emailVerifyModal.setAttribute('aria-hidden', 'true');
        }
        pendingNewEmail = null;
        if (emailVerifyCodeInput) emailVerifyCodeInput.value = '';
        if (emailVerifyError) { emailVerifyError.hidden = true; emailVerifyError.textContent = ''; }
    }

    function openEmailVerifyModal(newEmail) {
        pendingNewEmail = newEmail;
        pendingFirstName = document.getElementById('first_name').value.trim();
        pendingLastName = document.getElementById('last_name').value.trim();
        if (emailVerifyMessage) {
            emailVerifyMessage.textContent = 'We\'ve sent a verification code to the email address on your account. Enter it below.';
        }
        if (emailVerifyError) { emailVerifyError.hidden = true; emailVerifyError.textContent = ''; }
        if (emailVerifyCodeInput) { emailVerifyCodeInput.value = ''; emailVerifyCodeInput.focus(); }
        if (emailVerifyModal) {
            emailVerifyModal.hidden = false;
            emailVerifyModal.setAttribute('aria-hidden', 'false');
        }
    }

    fetch('/auth/me', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data.user) {
                window.location.href = '/login?next=' + encodeURIComponent('/profile');
                return;
            }
            currentEmail = (data.user.email || '').toLowerCase();
            document.getElementById('first_name').value = data.user.first_name || '';
            document.getElementById('last_name').value = data.user.last_name || '';
            document.getElementById('email').value = data.user.email || '';
            loadSessionLists();
        });

    profileForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var err = document.getElementById('profile-error');
        var ok = document.getElementById('profile-success');
        err.hidden = true;
        ok.hidden = true;
        var first = document.getElementById('first_name').value.trim();
        var last = document.getElementById('last_name').value.trim();
        var email = document.getElementById('email').value.trim().toLowerCase();

        if (email !== currentEmail) {
            fetch('/auth/profile/request-email-change', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ new_email: email })
            })
            .then(function(r) {
                return r.text().then(function(text) {
                    var data = null;
                    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
                    return { ok: r.ok, data: data };
                });
            })
            .then(function(_) {
                if (_.ok) {
                    if (emailVerifyModal) {
                        openEmailVerifyModal(email);
                    } else {
                        ok.textContent = 'Verification code sent to the email on your account. Enter it in the verification window.';
                        ok.hidden = false;
                    }
                } else {
                    err.textContent = _.data.error || 'Could not send verification code.';
                    err.hidden = false;
                }
            })
            .catch(function() {
                err.textContent = 'Request failed. Check your connection and try again.';
                err.hidden = false;
            });
            return;
        }

        fetch('/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ first_name: first, last_name: last, email: currentEmail })
        })
        .then(function(r) {
            return r.text().then(function(text) {
                var d = {};
                try { d = text ? JSON.parse(text) : {}; } catch (e) {}
                return { ok: r.ok, data: d };
            });
        })
        .then(function(_) {
            if (_.ok) { ok.textContent = 'Profile updated.'; ok.hidden = false; }
            else { err.textContent = _.data.error || 'Update failed'; err.hidden = false; }
        })
        .catch(function() {
            err.textContent = 'Request failed. Try again.';
            err.hidden = false;
        });
    });

    document.getElementById('email-verify-cancel').addEventListener('click', function() {
        document.getElementById('email').value = currentEmail;
        closeEmailVerifyModal();
    });

    function submitEmailVerify() {
        var code = (emailVerifyCodeInput && emailVerifyCodeInput.value) ? emailVerifyCodeInput.value.trim() : '';
        if (!code) {
            emailVerifyError.textContent = 'Enter the verification code.';
            emailVerifyError.hidden = false;
            return;
        }
        emailVerifyError.hidden = true;
        fetch('/auth/profile/confirm-email-change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ code: code })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(_) {
            if (_.ok) {
                currentEmail = _.data.user && _.data.user.email ? _.data.user.email : currentEmail;
                document.getElementById('email').value = currentEmail;
                closeEmailVerifyModal();
                fetch('/auth/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        first_name: pendingFirstName,
                        last_name: pendingLastName,
                        email: currentEmail
                    })
                })
                .then(function(r2) { return r2.json().then(function(d2) { return { ok: r2.ok, data: d2 }; }); })
                .then(function(__) {
                    var okEl = document.getElementById('profile-success');
                    var errEl = document.getElementById('profile-error');
                    if (__.ok) {
                        okEl.textContent = 'Email updated and profile saved.';
                        okEl.hidden = false;
                        errEl.hidden = true;
                    } else {
                        okEl.textContent = 'Email updated.';
                        okEl.hidden = false;
                        errEl.hidden = true;
                    }
                });
            } else {
                emailVerifyError.textContent = _.data.error || 'Invalid or expired code.';
                emailVerifyError.hidden = false;
            }
        });
    }

    document.getElementById('email-verify-submit').addEventListener('click', submitEmailVerify);
    if (emailVerifyCodeInput) {
        emailVerifyCodeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); submitEmailVerify(); }
        });
    }

    passwordForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var err = document.getElementById('password-error');
        var ok = document.getElementById('password-success');
        err.hidden = true;
        ok.hidden = true;
        fetch('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                current_password: document.getElementById('current_password').value,
                new_password: document.getElementById('new_password').value
            })
        })
        .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
        .then(function(_) {
            if (_.ok) {
                ok.textContent = 'Password changed.';
                ok.hidden = false;
                document.getElementById('current_password').value = '';
                document.getElementById('new_password').value = '';
            } else {
                err.textContent = _.data.error || 'Change failed';
                err.hidden = false;
            }
        });
    });

    function loadSessionLists() {
        fetch('/api/session-lists', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var lists = data.session_lists || [];
                listsEl.innerHTML = '';
                if (lists.length === 0) {
                    noListsEl.hidden = false;
                    return;
                }
                noListsEl.hidden = true;
                lists.forEach(function(lst) {
                    var a = document.createElement('a');
                    a.href = '/session/' + lst.id;
                    a.textContent = lst.name || 'Unnamed list';
                    listsEl.appendChild(a);
                });
            });
    }
})();
