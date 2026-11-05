# Stickman Reels

Code-animated stickman videos for Instagram Reels and TikTok, in the style researched in `../stickman-reels.md`. Each scene is a canvas drawn by `window.renderAt(t)`, rendered frame by frame in headless Chromium and encoded with ffmpeg, the same way as `../endcard/`. The balloon, fonts and film grain come from the end card.

## The quiet one (script 1)

22.5 s, 1080 x 1920, 30 fps. Four show-offs answer the popper's question one after another, right to left. The quiet guy's bubble keeps growing while he types and they heckle him. His answer appears, she pops them one by one, and his balloon lifts him up to her.

- `out/quiet-one.mp4`: with our own music bed (96 BPM, the full beat drops in when his answer appears, every pop on a beat, silence before the last pop)
- `out/quiet-one-sfx-only.mp4`: sound effects only. Use this one when you add a trending song in Instagram's editor, and turn the original audio down to about 30%.

Caption: "They laughed until he was the last balloon 🎈 Would you have kept him? Waitlist in bio"

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
