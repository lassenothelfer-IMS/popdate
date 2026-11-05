(() => {
  const form = document.getElementById('join');
  const errorLine = document.getElementById('error');
  const done = document.getElementById('done');
  const button = form.querySelector('button');
  const openedAt = Date.now();

  // Countries in the visitor's language: the launch markets first, then everyone else A to Z.
  const FIRST = ['CH', 'DE', 'AT', 'IT', 'FR', 'GB', 'US'];
  const names = new Intl.DisplayNames([navigator.language, 'en'], { type: 'region' });
  const select = document.getElementById('country');
  const option = (code) => new Option(names.of(code) ?? code, code);
  select.append(new Option('Choose', ''));
  FIRST.forEach((code) => select.append(option(code)));
  const divider = new Option('──────────', '');
  divider.disabled = true;
  select.append(divider);
  window.POPDATE_COUNTRIES.filter((c) => !FIRST.includes(c))
    .map((code) => ({ code, name: names.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(({ code }) => select.append(option(code)));
  const guess = (navigator.language.split('-')[1] ?? '').toUpperCase();
  if (window.POPDATE_COUNTRIES.includes(guess)) select.value = guess;

  const language = navigator.language.slice(0, 2).toLowerCase();
  const params = new URLSearchParams(location.search);
  const source = (params.get('ref') ?? params.get('utm_source') ?? '').toLowerCase().slice(0, 32);

  const MESSAGES = {
    email: 'Enter a valid email address.',
    phone: 'Choose your phone.',
    gender: 'Choose who you are.',
    wantsToMeet: 'Choose who you want to meet.',
    country: 'Choose your country.',
    city: 'Enter your city.',
    adult: 'Popdate is 18+ only.',
    consent: 'Tick the box so we can email you at launch.',
  };

  function missing(data) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return 'email';
    return ['phone', 'gender', 'wantsToMeet', 'country', 'city'].find((k) => !data[k])
      ?? (!data.adult ? 'adult' : !data.consent ? 'consent' : null);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = new FormData(form);
    const data = {
      email: String(fields.get('email') ?? '').trim(),
      phone: fields.get('phone'),
      gender: fields.get('gender'),
      wantsToMeet: fields.get('wantsToMeet'),
      country: fields.get('country'),
      city: String(fields.get('city') ?? '').trim(),
      adult: fields.get('adult') === 'on',
      consent: fields.get('consent') === 'on',
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
