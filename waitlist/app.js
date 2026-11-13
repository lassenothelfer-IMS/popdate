(() => {
  const form = document.getElementById('join');
  const errorLine = document.getElementById('error');
  const done = document.getElementById('done');
  const button = form.querySelector('button');
  const openedAt = Date.now();

  const language = navigator.language.slice(0, 2).toLowerCase();
  const params = new URLSearchParams(location.search);
  const source = (params.get('ref') ?? params.get('utm_source') ?? '').toLowerCase().slice(0, 32);

  const MESSAGES = {
    email: 'Enter a valid email address.',
    phone: 'Choose your phone.',
  };

  function missing(data) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return 'email';
    return data.phone ? null : 'phone';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const data = {
      email: String(fields.get('email') ?? '').trim(),
      phone: fields.get('phone'),
      website: fields.get('website') ?? '',
      language: ['en', 'de', 'fr', 'it'].includes(language) ? language : undefined,
      source: source || undefined,
      elapsedMs: Date.now() - openedAt,
    };

    const problem = missing(data);
    if (problem) {
      errorLine.textContent = MESSAGES[problem];
      form.querySelector(`[name="${problem}"]`)?.focus();
      return;
    }

    errorLine.textContent = '';
    button.disabled = true;
    button.textContent = 'Joining…';
    try {
      const response = await fetch(`${window.POPDATE_API}/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Something went wrong. Try again.');
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (error) {
      errorLine.textContent = error instanceof TypeError ? 'No connection. Try again.' : error.message;
      button.disabled = false;
      button.textContent = 'Join the waitlist';
    }
  });
})();
