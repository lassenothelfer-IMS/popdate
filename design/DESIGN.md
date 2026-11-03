# Popdate design handoff

Read this file first. Then open `SCREENS.md` and the HTML in `screens/`. The HTML files are the source of truth for layout: every position, size, radius and color is in their inline styles. This file explains the system behind them so the app matches the screens exactly and stays consistent when you build screens that are not drawn here.

Rules for building:
1. When a screen exists in `screens/`, reproduce it pixel for pixel at 390 x 844 pt, then let it scale with the iPhone size (margins fixed at 20 pt, content stretches).
2. When a screen does not exist, build it from the tokens and components below and from the closest existing screen.
3. Never add anything not in this file: no gradients except the two named ones, no shadows except the named ones, no emoji, no icon-in-a-colored-square, no new colors.
4. Everything that moves is listed in section 7. Nothing else moves.

Package contents
- `DESIGN.md` this file
- `SCREENS.md` index of all 94 screens with their titles
- `screens/game-velvet/` 29 game, matches, profile and state screens, dark theme (primary theme)
- `screens/game-cream/` the same 29 in the light theme
- `screens/onboarding-cream/` 18 onboarding screens, light
- `screens/onboarding-velvet/` 18 onboarding screens, dark
- `brand/` wordmark balloon, app icon, five balloon SVGs

## 1. Concept

Popdate is a live game, not a feed. One chooser, five balloon holders, four questions, four pops, the last balloon is the match. The feeling is a small candlelit room: wine velvet, cream paper, one lamp. Quiet everywhere, one loud moment (the pop). Copy is short, specific, slightly dry. No marketing voice.

Theme names in the app: "Velvet" (dark, default) and "Cream" (light). Also "Match system".

## 2. Color tokens

### Velvet (dark)
| Token | Hex | Use |
|---|---|---|
| canvas | #1D070E | screen background base |
| canvas glow | radial-gradient(ellipse 100% 45% at 50% 62%, #4A1E21 0%, #2E0D14 45%, #1D070E 100%) | every full screen background. The only background gradient in the app |
| lamp | radial-gradient(ellipse 60% 40% at 50% 62%, rgba(255,138,110,.16), transparent 70%) | overlay on canvas, breathes (section 7) |
| surface1 | #2B0D14 | cards, list cells, chat bubbles (theirs), tab bar, sheets |
| surface2 | #3B141A | chips, secondary buttons, timer pill, input backgrounds inside cards |
| surface3 | #4A1E21 | pressed state of surface2, toggles track on |
| inactive | #562627 | inactive progress segments, toggle track off |
| accent soft | #52222A | error card background, selected question row in cream is #F5E1DC |
| text | #F6EAE6 | primary text, primary button fill |
| text secondary | #D3B5B5 | body secondary, labels, section headers |
| text tertiary | #A98A8D | hints, timestamps, placeholders. Never for information the user must read |
| on primary | #1D070E | text on cream buttons |
| coral | #F0695C | the Pop button, the Match button, the recording button, the unread dot. Max one coral fill per screen |
| coral text | #FF9A8C | links, Save, "Write your own", report links |
| success | #7FC9A0 | checks for "answered", online status. Never as a dot on its own |
| gold | #E9BE72 | balloon strings, Live Activity progress, the reconnecting dot (#E2B566) |
| hairline | rgba(255,255,255,0.08) | card borders, list separators |
| hairline strong | rgba(255,255,255,0.10) to 0.14 | interactive borders, input borders |
| ring | 0 0 0 2px #1D070E, 0 0 0 3.5px <balloon color> | "you" or "selected" balloon ring |

### Cream (light)
| Token | Hex |
|---|---|
| canvas | #F3E9DA (flat, no gradient, no lamp) |
| surface1 | #FFFDFA |
| surface2 | #E9DDC8 |
| surface3 | #DCCDB6 |
| inactive | #D6C9B3 |
| accent soft | #F5E1DC |
| text | #1C1917 |
| text secondary | #5F574F |
| text tertiary | #8C8378 |
| primary button | #1C1917 fill, #FFFDFA text |
| coral | #CF3A2F fill (Pop, Match). The Recording button in cream is ink #1C1917 with a #CF3A2F dot |
| coral text | #B5332A |
| success | #1F7A4C |
| gold string | #9A6A26 |
| hairline | rgba(28,25,23,0.08), strong 0.14 |
| ring | 0 0 0 2px #F3E9DA, 0 0 0 3.5px <balloon color> |

### Balloon palette (both themes, from the Evening salon brand)
| Name | Mid | Light stop | Dark stop and knot |
|---|---|---|---|
| blush | #E6A3A2 | #FCE0D8 | #7C3341 |
| gold | #E2B566 | #FFF3D6 | #6A4212 |
| coral | #DD6A60 | #FFC9B6 | #6E1A25 |
| garnet | #8E1430 | #E57A8E | #2E020B |
| crimson | #C21F35 | #FF9A92 | #4A030F |

Players get a balloon color on joining a room, in this order: gold, coral, blush, garnet, crimson. The user's own balloon is crimson whenever they are a holder. The brand balloon (wordmark, hero, pop) is crimson; the app icon pairs crimson and gold.

### Photo tint tiles (placeholders only, replace with real photos)
Velvet: #5A2F3F, #5A4320, #2F4458, #30452E, #4A2F45. Cream: #E8D6DF, #EFE3D0, #DDE4EA, #DFE6DB, #E8DEE6. Each tile has one blurred circle of the matching balloon color at 60 to 80% opacity, blur 40 to 60 px.

## 3. Typography

Fonts
- Wordmark only: Gloock 400 (Google Fonts, OFL). Letter-spacing -0.03em.
- Display: New York (iOS system serif, `Font.Design.serif` or `fontFamily: 'New York'` in RN). The mockups use Fraunces as a stand-in; metrics are close. Weight 500 for titles, 300 for big numbers, italic for quotes.
- Text: SF Pro (system). Never Inter, Roboto, Helvetica.

Scale (pt / line height)
| Role | Font | Size | Example |
|---|---|---|---|
| Count | New York 300 | 112/100, letter-spacing -0.03em, word-spacing 0.22em when two words | "3rd", "a balloon" |
| Countdown | New York 300 | 56/56 tabular | "4" under "Round 2 in" |
| Hero | New York 500 | 44/46, -0.02em | "Good evening, Lasse.", "Mia chose Ben." |
| Title | New York 500 | 40/42, -0.02em | "Settings", "Matches", "Not this time." |
| Title small | New York 500 | 30/34 to 36/40, -0.015em | onboarding titles, "You popped Noah." |
| Question | New York 400 | 32/38 (round), 26/32 (waiting), 24/30 (final) | the chooser's question |
| Question in list | New York 400 | 19/24 | pick a question rows |
| Quote | New York italic | 18 to 20 / 24 to 26 | answers on cards |
| Chat bubble | SF Pro 400 | 16/21 | |
| Body | SF Pro 400 | 17/22 or 16/22 | paragraphs |
| Button | SF Pro 600 | 17 | |
| Row | SF Pro 500 | 17/22 | list rows |
| Secondary | SF Pro 400 | 15/20 | helper text under titles |
| Label | SF Pro 600 | 13/18 | section headers, "You asked", "Photos" |
| Meta | SF Pro 400 | 13/18 and 12/16 | timestamps, hints, "0 of 6" |
| Tag | SF Pro 600 | 11 to 12 | "Photo 1", "Round 1", "You" |
Nothing under 11 pt. Numbers that change use tabular figures.

## 4. Layout

- Screen 390 x 844 reference. Side margin 20 pt everywhere. Status bar area: content starts at y 62 (headers) or 64 (wordmark). Home indicator: bottom buttons end 34 pt above the edge.
- 8 pt base grid. Section gaps 24. Inside cards 14 to 18 pt padding. List rows 52 to 60 pt tall with a hairline between.
- Radii by role: primary button 16, card 14 (small) 16 to 22 (large), photo card 20 to 22, input 12, chips and pills 999, photo tiles 12, sheets 28 top corners, app icon 12 at 52 pt.
- Header pattern (in a room): left stack "Round 1 of 4" 15/600 over a 12 pt secondary subtitle; right side a 999-radius surface2 pill: timer (tabular), "Leave", or a 40 pt ring timer.
- Progress: four 3 pt segments, gap 6, active #F6EAE6, inactive #562627. Onboarding uses ten segments, gap 4.
- Balloon row: 12 x 15 pt balloons with 14 to 16 pt gaps; the active one 15 x 18 with the ring; inactive ones at 45% opacity; popped ones are a 14 pt hollow ring at 30%.
- Tab bar: floating 999 pill, surface1, hairline, 20 pt from the sides, 30 pt from the bottom, three 44 x 36 items: balloon (home), chat bubble, gear. Active item in text color, inactive in text tertiary.
- One primary button per screen, full width, 54 pt, radius 16. Secondary action below it as a 44 pt text button.
- Countdowns are never buttons: a 13 pt label and a 56 pt number centered, the number is the tap target only in the mockups.

## 5. Components

Primary button: fill #F6EAE6, text #1D070E 17/600, radius 16, height 54. Finish: inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(0,0,0,.4), 0 14px 30px -12px rgba(246,234,230,.35). Press: scale 0.97 in 180 ms.
Coral button: same shape, #F0695C fill, #1D070E text, shadow 0 14px 32px -10px rgba(240,105,92,.6). Only for Pop, Match, Recording, Pop and report.
Secondary button: #3B141A fill, hairline strong, text color, same shape.
Text button: 44 pt tall, 15/500, text secondary.
Chip: 36 to 40 pt, 999 radius, surface2; selected is #F6EAE6 fill with #1D070E text.
Option row (onboarding): 56 pt, radius 12, surface1, hairline; selected: 2 px #F6EAE6 inset ring and a filled circle check on the right.
Input: 52 pt, radius 12, surface1, hairline strong; focused: 2 px ring in text color. Label 13/600 secondary above, helper 13 tertiary below.
Card: surface1, radius 14 to 22, 1 px hairline, no shadow in velvet; large photo cards get 0 30px 60px -30px rgba(0,0,0,.8).
Photo card: 3:4, radius 20 to 22, scrim linear-gradient(to top, rgba(29,7,14,.85) 0%, rgba(29,7,14,.3) 40%, transparent 65%), "Photo n" tag 12/600 in rgba(29,7,14,.55) pill top left, name 16/600 and verified check bottom left, quote in italic below the name. Voice player: 34 pt cream play circle, 20 bars of 2.5 pt at gap 3, time 12 tabular, on a glass strip rgba(246,234,230,0.12) blur 16.
Verified check: 14 pt circle #F6EAE6 with a 1.6 pt #1D070E check.
Avatar: circle, player's tint tile color, initial in New York, hairline ring. 40 pt in headers, 48 to 56 in lists, 64 on Home.
Toggle: 50 x 30 (44 x 26 inside cards), track #F6EAE6 on with #1D070E knob, #562627 off with #F6EAE6 knob.
Toast: 999 pill, #F6EAE6, #1D070E 14/600, check icon, slides from the top, 3 s.
Sheet: surface1, 28 pt top radius, 36 x 5 grabber at 30% text, dim rgba(29,7,14,.6) behind, slides up 520 ms cubic-bezier(.32,.72,0,1).
Skeleton: shimmer between #2B0D14 and #3B141A, 1.6 s. Never a spinner.
Lock screen Live Activity: compact pill shows the crimson balloon and "3rd in line"; expanded card shows "3rd" at 56 New York light, "in line, Zürich", a 4 pt progress bar (#3B141A track, #F6EAE6 fill), "4 of 6", and "We'll buzz twice when your room opens."

## 6. Brand assets

Wordmark: "P" + balloon + "pdate" in Gloock. The balloon replaces the o: SVG `brand/wordmark-balloon-o.svg` sized .52em x .953em, vertical-align -.35em, margin 0 .01em 0 .02em. String color #E9BE72 on velvet, #9A6A26 on cream. Sizes used: 20 pt (headers), 16 (recap card), 15 (Live Activity).
App icon: `brand/app-icon.svg`. Alternates in Settings: paper (#F3E3CF background, #9A6A26 strings) and crimson (#C21F35 background, #F6E7D6 strings).
Balloon: `brand/balloon-<color>.svg`, viewBox 0 0 120 132. Body path, knot, highlight ellipse at (40,36) rotated -28, gold rim ellipse at (88,84). Render as vector at every size from 12 pt to 300 pt. Never a flat oval, never an emoji.

## 7. Motion and haptics

Global
- Screen entrance: each top level block fades in and rises 14 pt, scale .985 to 1, 760 ms, ease cubic-bezier(.22,1,.36,1), stagger 70 ms per block starting at 40 ms. SwiftUI: `.spring(duration: 0.76, bounce: 0.1)` with `.delay(index * 0.07)`.
- Press: scale 0.97, 180 ms. Release returns with the same spring.
- Progress segments: scaleX from .2 to 1, 600 ms, stagger 40 ms.
- Lamp glow (velvet only): opacity .55 to 1 and scale 1 to 1.06, 7 s ease-in-out, infinite.
- Photo tint blobs drift 8 to 10 pt over 9 s, alternate.
- Reduce Motion on: all of the above off, instant states.

Moments
- Welcome hero balloon: floats up 9 pt and rotates -1.5 deg over 5.2 s, string sways 6 to 3 deg.
- Queue: two rings expand from .6 to 1.9 scale over 2.6 s, offset by 1.3 s. Balloons enter from 140 pt below, scale .6 to 1, 1.2 s, each 300 ms after the last. Ghost seats pulse .25 to .55 opacity over 1.6 s.
- Dynamic Island: pill widens from 126 to 200 pt over 3 s when the position changes.
- Role reveal: "a balloon" appears from scale .7 with blur 8 px, 900 ms, 300 ms after the screen. Seats pop in with bounce (cubic-bezier(.34,1.4,.64,1)) 700 ms, 100 ms apart from 900 ms. Chooser avatar glows 24 to 40 px over 2.8 s.
- Round: ring timer, 60 s linear. Waveform bars scaleY .3 to 1, 0.9 to 1.1 s each, randomized phase. Recording button pulses a coral ring to 16 px over 1.4 s. Typing dots .3 to 1 opacity, 1.2 s, 200 ms apart.
- Reveal: the current card blooms from grayscale(1) to grayscale(0) over 2.4 s, starting 1.1 s after the screen. Side cards stay grayscale at 60% opacity and scale .9.
- The pop (the only big animation in the app):
  0 ms screen enters, balloon visible and still.
  600 ms balloon swells: scale 1 to 1.24 with a rotate -2 then 1.5 deg wobble, 1.6 s, cubic-bezier(.34,1.3,.64,1).
  2300 ms burst: balloon hidden in one frame; a white flash radial-gradient at center expands from .3 to 1.6 over 420 ms; a 3 px cream ring expands from .5 to 3.2 over 650 ms and fades; 9 latex shards (two tone of the balloon color plus its dark stop) fly out 120 to 190 pt with rotation, 1.1 s, cubic-bezier(.15,.75,.3,1); the string drops 420 pt and rotates -35 deg over 1.3 s; the whole screen shakes 4 pt for 320 ms.
  2900 ms result text rises in, 800 ms.
  Sound: one pop (short, dry, latex). Haptic: one custom transient at 2300 ms, sharpness .8 intensity 1, followed by a 120 ms decaying continuous at intensity .4. Nothing else in the app bounces.
- Chooser hold to pop: a 180 pt ring fills coral over 2.2 s while held, release cancels. At full, the burst above plays.
- Final two: cards slide in from -60 and +60 pt rotating to -4 and 4 deg, 900 ms, 150 ms apart. The chooser's current favorite breathes scale 1 to 1.04 over 3 s with a 2 px coral ring.
- Match: two aura blobs in the match's dominant photo colors (extract with a palette library, fall back to the balloon color) at blur 90 to 100 px, 28 to 32% opacity, drift 30 to 40 pt over 9 to 11 s alternate. Cards fly in from 60 pt below rotating to -6 and 5 deg, 1.1 s, 200 ms apart. Title fades up from 20 pt with blur 6 px at 1.3 s. Haptic: `.success` once. Sound: the match sting, once.
- Chat: messages rise 12 pt and scale .96 to 1, 600 ms, 150 ms apart on first open.
- Recap card: card rises 80 pt with a 18 deg x-rotation unfolding, 1 s. Stats fade up 150 ms apart from 800 ms. A soft sheen crosses the card every 6 s.
- Not this time: the balloon deflates (scaleY to .22, rotate -18) over 1.4 s, then text rises at 1.5 s.
- Chooser left: the chooser's balloon floats away up right over 2.4 s and fades.
- Profile hero photo: slow Ken Burns scale 1 to 1.08 over 14 s alternate.
- Edit profile: the dragged photo lifts (translateY -6, rotate 2 deg, 2 px cream ring, long shadow).
- Verification: scan line travels the oval over 2.2 s, oval ring flickers cream to gold.

Haptic vocabulary (iOS `UIFeedbackGenerator` / `sensoryFeedback`)
- selection: chip and option taps, balloon row changes, toggle
- impact light: Continue, Get in line, sending an answer
- impact soft: your balloon survives a round (the moment the next round label appears)
- custom transient plus decay: the pop (see above)
- notification success: match, verification passed, room found (two short buzzes when the Live Activity fires)
- notification warning: 10 s left on your answer
- notification error: never. Errors are quiet inline cards.

Sound
- Only two sounds: pop and match sting. On by default inside a live room only. One toggle "Pop and match sounds" in Settings. Muted when the ringer switch is off. No sound anywhere else.

## 8. Behaviour rules the screens cannot show

- Hints ("Swipe through the five", "Release to send, slide left to cancel", "Photos unlock one round at a time", "Leave the app, we'll hold your place", "Hold the balloon. Let go to change your mind", "Tap the one you want to keep") show only during a user's first 3 rooms. Store `roomsPlayed` locally, hide them from room 4.
- The queue is a queue. Rooms open when six people in the same city are ready. Home shows the live count of people in line near you and a rolling average fill time. The Live Activity shows the place in line and buzzes twice when the room opens. Leaving the app keeps your place for 10 minutes.
- Roles: the chooser is picked by the server; a user is chooser roughly one room in six. Chooser screens are C01 to C06; holder screens are Role, Round, Reveal, Pop, FinalTwo, Match, Lost.
- Round timing: question pick 30 s, answers 60 s, chooser decision 30 s, reveal to all 5 s, countdown to next round 5 s. Four rounds. In the final two the chooser taps the one to keep.
- Voice answers max 20 s, text max 140 characters. Text is always available. A missing answer shows "No answer this round" and the chooser sees it too.
- Photos: six per profile, one unlocked per round for the chooser (photo 1 on join, photo 2 after round 1, etc.). The holders never see each other's photos, only the chooser's photo 1 and name. Real photos: 3:4, never dimmed, 1 px hairline ring. The grayscale-to-color bloom applies to the chooser's view of holders' cards: a holder's card is grayscale until they survive the round, then blooms.
- A holder who leaves mid room: their balloon pops, the room continues. The chooser leaving ends the room, nobody is penalised, everyone goes to the front of the queue.
- Connection loss: the room freezes for everyone for up to 20 s with the "Reconnecting" pill; after that the round continues without the missing answer.
- Verification: selfie compared to photo 1, deleted after. Verified users get the cream check next to their name everywhere.
- Report: available to the chooser on any card ("Report Noah") and from any chat. Pop and report pops the balloon immediately and files the reason. Three reports suspend an account.
- Matches: both get the chat seeded with the four questions and both answers (voice clips playable inline). Reactions: long press a bubble, five reactions in a 999 pill. Voice replies: hold the mic. Photos: the camera button.
- Recap card: generated after every room for everyone (holder or chooser), rendered at 1080 x 1920 in the cream theme regardless of app theme, with the wordmark, "Last balloon standing", rounds survived, the question that got you, the room's balloon row, and your last answer. Share sheet to Stories.
- Settings appearance: Match system, Cream, Velvet. App icon: velvet, paper, crimson. Sound toggle, haptics toggle. Notifications: room ready, new matches.
- Permissions: microphone asked just before the first room (screen X01), notifications asked in onboarding (S16), location asked in onboarding (S11). Denied states are inline (X02), never blocking modals.
- Empty queue: Home card switches to the "Quiet in Zürich right now" variant (X04) and offers to wait in line.
- Monetisation: none in the MVP. Nothing in the core loop is ever paywalled.
