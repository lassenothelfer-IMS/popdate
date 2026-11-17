// The confirm and leave pages. The token comes in the link's #fragment, which browsers never
// send to a server. It only acts on a tap, so mail scanners that open links can't confirm or delete.
(() => {
  const action = document.body.dataset.action; // "confirm" or "leave"
  const token = location.hash.slice(1);
  history.replaceState(null, '', location.pathname); // Keep the token out of the address bar and history.

  const button = document.getElementById('go');
  const status = document.getElementById('status');
  const after = document.getElementById('after');

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    button.hidden = true;
    status.textContent = 'This link is not complete. Open it again from the email.';
    return;
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '';
    try {
      const response = await fetch(`${window.POPDATE_API}/waitlist/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Something went wrong. Try again.');
      button.hidden = true;
      after.hidden = false;
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'No connection. Try again.' : error.message;
      button.disabled = false;
    }
  });
})();
