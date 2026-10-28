// The panel's sign-in and step-up prompt.
//
// Every API route needs a principal now. Behind Home Assistant Ingress the
// Supervisor is that principal and this never shows; on the TLS port the first
// 401 opens it, and a 403 `step_up_required` (patchers, raw commands, proxy
// settings, capture downloads) asks for the password again. One prompt at a
// time: a page load fires a dozen requests, and every one of them that gets a
// 401 waits on the same answer.
//
// Built with createElement/textContent only — nothing here is parsed as markup.

let pending = null;

function field(labelText, type, autocomplete) {
  const label = document.createElement('label');
  label.className = 'field-label mut';
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.autocomplete = autocomplete;
  label.appendChild(input);
  return { label, input };
}

async function post(base, path, body) {
  try {
    const r = await fetch(base + 'api/auth/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const err = data && data.error;
    return { ok: r.ok, code: err && err.code, message: (err && err.message) || 'HTTP ' + r.status };
  } catch (e) {
    return { ok: false, code: 'network', message: String((e && e.message) || e) };
  }
}

function open(base, kind) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const box = document.createElement('form');
    box.className = 'modal-box';
    const title = document.createElement('h3');
    const note = document.createElement('p');
    note.className = 'sub';
    const error = document.createElement('p');
    error.className = 'sub bad';
    const pw = field('Admin password', 'password', 'current-password');
    const token = field('Setup token (printed in the add-on log)', 'text', 'off');
    const pw2 = field('Repeat the new password', 'password', 'new-password');
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const ok = document.createElement('button');
    ok.className = 'act';
    ok.type = 'submit';
    const cancel = document.createElement('button');
    cancel.className = 'ghost act';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    actions.append(ok, cancel);

    let mode = kind;
    const render = () => {
      box.replaceChildren(title, note, error);
      if (mode === 'setup') {
        title.textContent = 'Set the admin password';
        note.textContent = 'No admin password exists yet. Use the one-time setup token from the log.';
        pw.input.autocomplete = 'new-password';
        box.append(token.label, pw.label, pw2.label);
      } else {
        title.textContent = mode === 'step-up' ? 'Confirm it is you' : 'Sign in';
        note.textContent =
          mode === 'step-up'
            ? 'This action can change what runs on your devices. Re-enter the admin password.'
            : 'Enter the admin password.';
        box.append(pw.label);
      }
      ok.textContent = mode === 'setup' ? 'Create' : 'Continue';
      box.append(actions);
    };
    const close = result => {
      modal.remove();
      resolve(result);
    };
    cancel.addEventListener('click', () => close(false));
    box.addEventListener('submit', async ev => {
      ev.preventDefault();
      error.textContent = '';
      let res;
      if (mode === 'setup') {
        if (pw.input.value !== pw2.input.value) {
          error.textContent = 'The two passwords differ.';
          return;
        }
        res = await post(base, 'setup', { setup_token: token.input.value, password: pw.input.value });
      } else {
        res = await post(base, mode === 'step-up' ? 'step-up' : 'login', { password: pw.input.value });
      }
      if (res.ok) return close(true);
      if (res.code === 'setup_required') {
        mode = 'setup';
        render();
        return;
      }
      error.textContent = res.message;
    });
    render();
    modal.appendChild(box);
    document.body.appendChild(modal);
    pw.input.focus();
  });
}

// Resolves true once the user signed in (or stepped up), false if they cancelled.
function credentialPrompt(base, kind) {
  if (!pending) pending = open(base, kind).finally(() => (pending = null));
  return pending;
}

export { credentialPrompt };
