# Popdate Stitch end card

A 6-second vertical (1080 x 1920) end card for TikTok Stitches: it opens on a pop, asks "Wanna play this online?", and lands on the Popdate logo. Show footage is never part of this video; TikTok's Stitch adds the clip in front of it.

- `out/popdate-stitch-endcard.mp4`: the video, H.264 + AAC, about -14 LUFS
- `out/logo/`: the logo as a dark and a light lockup (transparent PNG) and a 1024 px icon for profile pictures

## Posting it

1. Open a clip from the host's own account, [@arletteamuli](https://www.tiktok.com/@arletteamuli), in the TikTok app. Never stitch a fan repost.
2. Share → Stitch, and trim to the 5 seconds that end exactly on the pop.
3. Upload `popdate-stitch-endcard.mp4` as your part.

## Changing it

The animation is `index.html` (`window.renderAt(t)` draws any moment), the sound is synthesized in `sound.mjs`, and the logo is `logo.html`. Fonts are the app's own (Gloock, Hanken Grotesk, OFL licensed).

```bash
npm install
npm run video
npm run logo
node render-video.mjs --stills 0.1 1.4 5.5
```
