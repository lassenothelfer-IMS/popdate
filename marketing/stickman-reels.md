# Stickman Reels for Popdate (research + scripts, updated 2026-11-03)

Short stickman animations are one of the biggest formats on Reels right now. This file covers what the viral ones do, how we can make videos at the same quality, and scripts for Popdate. Same rules as `views-research.md`: no show footage, never "official" or "the Pop the Balloon app", and the goal is waitlist signups.

All numbers below come from Instagram itself (watched in a logged-in browser on 2026-11-03).

## The five styles that go viral

| Style | Example | Best result | Look | Length |
| --- | --- | --- | --- | --- |
| **Silent metaphor** | @thequietfixx, @pathlightvisuals, @silent.stickman | 1.4M likes | Black silhouette stickmen, white eyes, moody grey-blue cliffs, one warm light. No dialogue, only small labels. Trending instrumental music. | 12 to 25 s |
| **Comparison / progression** | @stickmaxx, @neuronvisuals | 3M views (stickmaxx), 1M likes (neuron) | Clean 3D, white stickmen, glowing floor tiles, split screen, a counter ("WEEK 1 >>", "5 MINUTES"). Ends by rewinding to the start. | about 16 s |
| **Chalk line on black** | @project.vglyb, @stepbychalk | 3M likes | Scratchy white lines on pure black, hand-drawn feel, sad trending song. | about 25 s |
| **Era / POV gag** | @pixelsticksstudio, @jevon_animations | 9M likes, 4M likes | Colourful cartoon stickmen with big round heads, a big label ("1760", "2026"). Instagram marks the 9M one as AI-generated. | about 20 s |
| **Voiced skit** | @sticktalesanimations, @stickzico | 3M likes, 25K comments | Colourful cartoon, voice-over dialogue, big word-by-word subtitles. Mostly couple and marriage jokes. | 60 to 90 s |

**What the hits share**

1. **The first frame already shows the conflict.** A crowd against one guy, a couple standing at a gap, two lifters side by side. No intro, no fade-in.
2. **One idea, one twist at the end.** The bricks become a tower, the gap becomes a canyon, the guy who added weight every week gets crushed.
3. **Almost no words, so they travel worldwide.** Comments under @thequietfixx are in Hindi, Arabic and English. That's great for reach but bad for a waitlist that needs people where we launch. Our captions and the one label should name the place we launch in.
4. **The music does the emotion.** A trending track (The Weeknd's "Timeless" instrumental, Eminem's "Mockingbird"), with silence right before the big moment.
5. **They loop.** @stickmaxx literally rewinds back to "WEEK 1 <<", and @thequietfixx ends dark, so the video starts over without a seam.
6. **Relationship topics start debates.** The 3M couple video (she jumps to "New Life", he doesn't follow) has a top comment "Why the women leading?" with 16K likes and 223 replies. Debates mean comments, and dating is a natural debate topic.
7. **A brand-new account can blow up.** @stickmaxx posted its first Reel on Oct 21, 2026 and had 34K followers and 3M views 2 weeks later, with 5 posts.
8. **Ideas get copied all the time.** "They laughed until he reached the top" (bricks, @thequietfixx, 1.4M likes) is the same story as "They threw spears to stop you. You used them to climb" (@pathlightvisuals, 422K likes). Borrowing a story shape is normal. Copying someone's art or re-uploading their video is not.
9. **Many are AI-made, and the label doesn't seem to hurt.** The 9M Reel carries Instagram's "AI-generated" label. Several accounts (@neuronvisuals, @pathlightvisuals) sell courses on how they make them through "comment X and I'll send it" funnels, which also inflate their comment counts.

### @thequietfixx up close

Their 1.4M-like Reel ("They laughed until he reached the top", 12.7 s):

- 0 to 2 s: a crowd of silhouettes on the left cliff throws bricks across a gap at a lone stickman on the right cliff. High above him floats a **red balloon with a gold trophy** hanging from it.
- 2 to 5 s: he catches the bricks and stacks them.
- 5 to 7 s: the tower grows. Each layer is labelled WORK, LEARN, BUILD, GROW, SUCCESS. He reaches the balloon and the trophy.
- 9 to 12.7 s: the crowd celebrates for a second, then lightning hits them. Fade to dark, loop.

The top comment, "At least thank them for the bricks", shows people like adding their own punchline.

Their most successful video already uses a red balloon as the symbol of the goal. That's our logo. Viewers of this genre already read "red balloon = the prize".

## Our look

Black and white is fine. Two options that fit us:

- **A: Silhouette (thequietfixx-like).** Black stickmen with white eyes, a moody dark background, one light source. Recommended for script 1, because it makes a crowd against one guy easy to read.
- **B: White chalk on black (project.vglyb-like).** Cheapest to make and very readable on phones. Good for emotional, couple-type stories.

Red on the balloons is optional, not a rule. It does help: a red balloon on a black and white video jumps off the screen, and it's our logo. Don't copy anyone's character design: give ours one detail that's only ours, for example a little balloon-knot shaped tuft of hair, or a small watermark in the same spot every time.

## How we make it at the same quality

There are three ways. I'd pick the third.

### 1. All AI (what most of these accounts do)

1. Design the character once (one image of the stickman from the front, side and back) in an image model.
2. Make a still for every shot, using that design as a reference.
3. Turn each still into a 3 to 5 s clip with an image-to-video model. Kling 3.0 and Seedance 2.5 currently rank best for keeping a character the same across clips. Veo 3.1 takes up to 3 reference images. None of them was tested on stickmen, so run a short test first.
4. Put it together in CapCut: cuts on the beat, labels, sound effects.

- **Good:** cinematic lighting, cheap per video, fast.
- **Bad:** AI is unreliable with exactly what our scripts need. Exactly 5 balloons, popping in a set order, readable text on a card. Characters drift between clips. Credits cost money. Instagram may add the AI label.

### 2. All code (what @stickmaxx looks like)

We already have this pipeline: `endcard/` draws any moment with `window.renderAt(t)` in a browser and turns the frames into an MP4 with ffmpeg (`render-video.mjs`). The same setup can draw stickman scenes in 2D (SVG/Canvas) or 3D (three.js).

- **Good:** pixel-exact control (5 balloons, the pop order, the round labels, a perfect loop), the same character every time, no cost per video, and Claude can write and change it.
- **Bad:** the lighting and atmosphere take work to make it look cinematic rather than like a "web animation".

### 3. Hybrid (recommended)

- **Background:** painted dark backgrounds, made once with an image model or by hand (cliff, fog, sky), in 2 to 3 layers so they can move against each other.
- **Characters:** animated in code on top, with a simple skeleton (head, torso, two-part arms and legs) so poses can be keyframed.
- **Finish in code:** rim light, fog, film grain (`endcard/grain.png` already exists), vignette, and motion blur by blending a few in-between frames.
- **Sound:** our own pop sound from `sound.mjs`. Add the trending song in Instagram's editor when posting, not in the file: that's the licensed way to use it, and the song then shows up on the Reel.

**Quality checklist** (what separates the 1M videos from the 1K ones):

- Silhouettes you can read at phone size: 2 to 6 characters, big shapes, no thin details.
- One light source, a rim light on the characters, fog between foreground and background.
- Nothing is ever frozen: idle breathing, balloon strings swaying, a slow camera push-in.
- Real animation timing: a small move the opposite way before every big move, ease in and out, a little overshoot, squash and stretch on the pop.
- Cuts on the music's beat. Silence for half a second before the climax.
- First frame = conflict. Last frame flows back into the first.
- Text only as small labels in capital letters, 3 to 5 words.

## Script 1: The quiet one (lead video)

**Style A, silhouette. About 15 s, 1080 x 1920, 30 fps.** Our version of the 1.4M "they laughed" story shape, told with our game.

**Set:** two cliffs with a gap, like their hit. Left cliff: 5 stickmen in a row, each holding a balloon on a string. Right cliff: the popper, a stickwoman holding a pin. A soft light behind her.

| Time | Picture | Sound |
| --- | --- | --- |
| 0.0 to 1.5 s | First frame: four big stickmen pose (one flexes, one wears sunglasses, one spins car keys, one leans back). The fifth is small, at the end of the row, holding his balloon with both hands. They're already looking at him and smirking. Small label top right: "ROUND 1". | Track starts on the beat. |
| 1.5 to 3.5 s | She holds up a card: "WHAT WOULD YOU COOK ME?" | |
| 3.5 to 6.0 s | Four bubbles pop up at once: "u 😏", "reservations", "my mom's lasagna", "lol". The quiet one's bubble starts small and keeps unrolling down like a scroll. The four point at him and shake with laughter. | |
| 6.0 to 7.5 s | The pin stretches across the gap. POP. The first flexer's balloon bursts mid-laugh. He freezes and his shoulders drop. The other three keep laughing. | Pop on the beat. |
| 7.5 to 10.0 s | "ROUND 2", POP. "ROUND 3", POP. Faster each time. | Pops on the beats. |
| 10.0 to 12.0 s | "ROUND 4". Last flexer and the quiet one. The pin hovers between them. | Music cuts out. Half a second of silence. |
| 12.0 to 12.5 s | POP: the flexer. | The biggest pop, music back in. |
| 12.5 to 15.0 s | The quiet one's balloon rises out of his hands and floats across the gap. She catches the string. Label: "MATCH". Small "popdate" watermark bottom centre. | |
| Loop | Hard cut back to the first frame. The four laughing at him now reads as ironic. | |

**Caption:** "They laughed until he was the last balloon 🎈 Would you have kept him? Waitlist in bio"

**Variants to test:** a gender-flipped version (5 women, a man popping), and the same video with the trending song swapped.

**Built:** `stickman/` renders this script in code (route 3 without the AI backgrounds, which are drawn in code too). See `stickman/README.md`. The finished version differs slightly from the shot list above: the popper stands on a high ledge in front of the moon, and his balloon lifts him up to her instead of floating across a gap.

## More scripts

Shorter descriptions. Each names its style from the table above.

### 2. Situationship (style B, chalk)

A stickman keeps blowing up a balloon with a hole in it, labelled "HE'LL CHANGE". It goes flat, he blows again, out of breath. A friend quietly hands him a pin. Silence. POP, and he breathes out. Behind him a door opens onto a room with 5 balloons.
**Caption:** "Sometimes the kindest thing is to pop it. Send this to the friend still blowing air into a situationship 🎈"

### 3. A pop vs a ghost (style C, comparison)

Split screen. Left, "OTHER APPS": he texts, she slowly turns transparent and vanishes, a counter reads "DAY 1 >> DAY 21", he's still checking his phone. Right, "POPDATE": his balloon pops, he shrugs, taps "PLAY" and walks into the next room. Ends with a rewind to day 1.
**Caption:** "A pop hurts for 1 second. A ghost hurts for 3 weeks. Which would you rather get?"

### 4. Swiping vs one room (style C, @stickmaxx format)

Split screen with a counter: "WEEK 1 >> WEEK 52". Left, "SWIPING": the stickman's thumb gets more tired, a stack of "hey" bubbles grows, the matches counter stays at 0 to 2. Right, "1 ROOM, 20 MIN": 4 rounds, the last balloon floats to him at week 1, and the rest of the year he's on dates. Rewind to "WEEK 1 <<".
**Caption:** "Same year. Different strategy."

### 5. Who do you pop first? (style A)

5 stickmen with labels: "6FT (HE'S 5'9)", "BIO: 'JUST ASK'", "GYM MIRROR", "ANSWERS 'LOL'", "WRITES YOU A POEM". The pin moves slowly from balloon to balloon, and each guy tenses up. Cut to black right before the pop.
**Women's version:** "REPLIES IN 3 DAYS", "ONLY GROUP PICS", "'NOT LIKE OTHER GIRLS'", "ASKS A REAL QUESTION", "LOVES HER DOG MORE THAN YOU".
**Caption:** "You're the popper. Who goes first? 1 to 5 👇"

### 6. "hey" (style B, made for women)

"hey", "wyd" and "u up" bubbles rain down on a stickwoman until only her eyes show above the pile. She climbs out into a room where she's the popper. She holds up a question card. One guy answers "hey". Instant pop. She smiles.
**Caption:** "Here they have to answer the question. Send this to your friend with 400 'hey's"

### 7. Popped in round 1, still watching in round 4 (style D, cartoon)

She pops him in round 1 for his fish photo. The rest of the game plays in fast-forward while he sits in the corner on a chair labelled "WATCH MODE" with popcorn, cheering at every pop. At the match he claps slowly, then taps "PLAY" again.
**Caption:** "Popped for the fish pic. Stayed for the drama 🍿 What photo gets you popped instantly?"

### 8. Dating in 1826 vs 2026 (style D, the 9M format)

Big label "1826": one dance at a ball, she drops a handkerchief, he bows. "2016": he swipes until his thumb smokes. "2026": 5 balloons, 4 pops, a match, and a clock shows "20 MIN".
**Caption:** "Some things got better 🎈"

### 9. 5 walk in, 1 walks out with a match (style A, made for men)

A door with a "6/6" sign. Five men walk in like it's an arena. Quick rounds follow: question card, typing, photo flip, pop. The losers leave through a side door, waving. The last one walks out the front door next to the popper.
**Caption:** "4 rounds. 1 balloon left. Think you'd make it?"

### 10. Hold my balloon (style A)

His friend fixes his collar, ties the balloon to his wrist and pushes him through the door. Through the window: pop, pop, pop, and the friend flinches each time. The door opens and he walks out with the popper. The friend loses it.
**Caption:** "Everyone needs this friend 🎈 Tag yours"

### 11. The queue (style C, pre-launch)

A dark waiting room, "FINDING YOUR LOBBY 1/6", and chairs fill up to 5/6. Everyone stares at the door. Silence. A sixth balloon floats in, cut to "Be the 6th. Waitlist in bio".

## Posting

- **Start small:** script 1 first, then 4 and 5, then one chalk video (2 or 6), to see which style our audience likes.
- **Rhythm:** 1 a day. When one takes off, post it again a week later with a new caption, like @thequietfixx does.
- **Trial Reels** (see `views-research.md`): test new ideas on non-followers first.
- **Captions:** 1 line plus a question or "send this to...". Name the launch city or country somewhere, so the waitlist gets the right people.
- **Hashtags:** 3 to 5 plain ones: `#dating #relatable #animation #stickman #situationship`.
- **Recurring characters:** the same popper and the same quiet guy in every video, so people follow for them.
- **Measure:** sends and comments per reach first, likes second, after 24 to 72 hours.

## Sources

Instagram, watched 2026-11-03:
- [@thequietfixx](https://www.instagram.com/thequietfixx/) ("They laughed until he reached the top", [1.4M](https://www.instagram.com/thequietfixx/reel/DepCNK_s74x/))
- [@stickmaxx](https://www.instagram.com/stickmaxx/reels/) ([Week 1 >> Week 13](https://www.instagram.com/stickmaxx/reel/DexzYFpR7IW/))
- [@project.vglyb "Old life / New life", 3M](https://www.instagram.com/p/Dcq9bbDMNxf/)
- [@pixelsticksstudio "1760 vs 2026", 9M](https://www.instagram.com/p/Db4eaYWBlXH/)
- [@sticktalesanimations "Man will always be a man", 3M](https://www.instagram.com/p/DdXnjHRtPxL/)
- [@neuronvisuals, 1M](https://www.instagram.com/p/DeZjO87xrHl/)
- [@pathlightvisuals, 422K](https://www.instagram.com/p/DetnQCdu8ng/)
- [@silent.stickman bridge, 196K](https://www.instagram.com/p/De_fPgOuMTS/)

Tools and workflow:
- [Kling: best image-to-video 2026](https://kling.ai/blog/best-image-to-video-ai)
- [Kavel: consistent characters 2026](https://www.kavel.ai/blog/best-ai-video-generators-consistent-characters-2026)
- [Paintbrush: consistent characters](https://www.paintbrush.gg/blog/best-ai-video-generator-consistent-characters)
- [OpenArt: AI video generators tested](https://openart.ai/blog/best-ai-video-generators/)
- [SozAI: stickman AI workflow](https://sozai.app/transcript/free-stickman-animation-with-ai/)
