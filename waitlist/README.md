# Popdate waitlist

A one-page signup for the launch. It asks for two things, email and phone (iPhone or Android), and also saves the visitor's language and where they came from (`?ref=tiktok`) in the `waitlist` table of the Convex backend (`mobile/convex/waitlist.ts`). The table can only be read from the Convex dashboard or the CLI.

## See the list

From `mobile/`:

```bash
npm run waitlist:stats
npm run waitlist:export
```

`waitlist:stats` prints totals by status, phone and source. `waitlist:export` writes `waitlist.csv`, which is git-ignored because it holds emails. Add `-- --prod` to either one for production.

## Try it locally

1. In `mobile/`: `npx convex dev`, then once: `npx convex env set WAITLIST_ORIGINS http://localhost:5500` and `npx convex env set WAITLIST_SITE_URL http://localhost:5500`
2. In the repo root: `node waitlist/dev-server.mjs` and open http://localhost:5500

Without Resend keys, signups are saved as `pending` and no email goes out.

## Go live

1. **Convex production.** The backend is on a local, anonymous deployment. Run `npx convex login`, then `npx convex deploy` in `mobile/`. Note the `https://<name>.convex.site` URL.
2. **Point the page at it.** Put that URL in `config.js`.
3. **Fill in `privacy.html` and `imprint.html`**: every `[bracket]`, and remove the red draft lines. Have someone check the privacy text.
4. **Email.** Create a [Resend](https://resend.com) account, verify your domain, then:
   ```bash
   npx convex env set --prod RESEND_API_KEY re_...
   npx convex env set --prod WAITLIST_FROM "Popdate <hello@yourdomain>"
   ```
5. **Deploy this folder to Vercel** (root directory `waitlist/`, no build step). `vercel.json` adds clean URLs and strict security headers.
6. **Allow the live site:**
   ```bash
   npx convex env set --prod WAITLIST_ORIGINS https://yourdomain
   npx convex env set --prod WAITLIST_SITE_URL https://yourdomain
   ```
7. Put the link in your bio with a source, e.g. `https://yourdomain/?ref=tiktok` and `?ref=instagram`, so the stats show which platform works.

## How it stays safe

- Only the origins in `WAITLIST_ORIGINS` can post; the list itself has no public read.
- Server-side validation of every field, a 4 KB body limit, a honeypot field and a minimum fill time against bots, and rate limits (5 tries per visitor per 10 minutes, 120 signups a minute overall).
- The page answers the same whether an email is new or already listed, so nobody can check who signed up.
- Double opt-in: confirm and leave links carry a random token in the `#fragment`, act only on a tap, and only its SHA-256 is stored.
- Unconfirmed signups are deleted after 30 days (`crons.ts`). The CSV export defuses spreadsheet formulas.
