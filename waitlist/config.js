// Where the waitlist posts: the Convex deployment's HTTP actions URL (ends in .convex.site).
// Not a secret: the backend only accepts posts from the origins in WAITLIST_ORIGINS.
// Local `npx convex dev` uses http://127.0.0.1:3211; set the production URL before deploying.
window.POPDATE_API = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:3211'
  : 'https://wary-parrot-14.convex.site';
