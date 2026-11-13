# Stickman Reels

Code-animated stickman videos for Instagram Reels and TikTok, in the style researched in `../stickman-reels.md`. Each scene is a canvas drawn by `window.renderAt(t)`, rendered frame by frame in headless Chromium and encoded with ffmpeg, the same way as `../endcard/`. The balloon, fonts and film grain come from the end card.

## The quiet one (script 1)

22.5 s, 1080 x 1920, 30 fps. Four show-offs answer the popper's question one after another, right to left. The quiet guy's bubble keeps growing while he types and they heckle him. His answer appears, she pops them one by one, and his balloon lifts him up to her.

- `out/quiet-one.mp4`: with our own music bed (96 BPM, the full beat drops in when his answer appears, every pop on a beat, silence before the last pop)
- `out/quiet-one-sfx-only.mp4`: sound effects only. Use this one when you add a trending song in Instagram's editor, and turn the original audio down to about 30%.

Caption: "They laughed until he was the last balloon 🎈 Would you have kept him? Waitlist in bio"

## Part 1 of the series "Last Balloon"

35.6 s. The same Reel with narrator captions (word by word, top left) and a cliffhanger after the match: the camera pushes in on Brick, the muscle guy, who turns to the camera and says "this isn't over". Then a hard cut, like a Stitch, to the real app on a phone: "so we made it a real app", four screens that tell the same story (ask, listen, pop, match), and "join the waitlist / link in bio". The scripts for all five parts are in `../stickman-series.md`.

The phone shows the design mockups from `design/screens/game-velvet/`; `node app-shots.mjs` shoots them again into `app/`. Swap in real screenshots from a phone once the app looks final (same names, 780 x 1688).

- `out/quiet-one-part1-voice.mp4`: the one to post. A narrator reads the captions, and the music dips under her.
- `out/quiet-one-part1.mp4`: music and captions, no voice (to record your own voice over it in Instagram or CapCut)
- `out/quiet-one-part1-sfx-only.mp4`: effects only, for a trending song

The narrator is Kokoro (`af_heart`), a free text-to-speech model that runs on this computer. It's Apache-2.0, so it's fine for ads. `node voice.mjs --samples` writes one test sentence in eight voices to `out/voice-samples/`. To switch, run `node voice.mjs --voice am_fenrir` (add `--speed 0.9` for slower), copy the printed lengths into `PART1.narration` in `quiet-one-timeline.js`, and render again:

```bash
npm run part1
```

## Making and changing it

```bash
npm install
npm run video
node render.mjs quiet-one --stills 0.2 4.9 9.6 14.8
```

- `quiet-one-timeline.js`: when everything happens. The scene and the sound both read it, so moving a pop moves its sound too.
- `quiet-one.html`: the scene (background, cast, balloons on simple string physics, bubbles, pins, camera).
- `stickman.js`: the rigged stickman (joint angles in, silhouette with face and props out). Reuse it for the other scripts.
- `sound.mjs`: every sound is synthesized, so there's nothing to license.
