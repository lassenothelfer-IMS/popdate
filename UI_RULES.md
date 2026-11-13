# Popdate UI rules

Read this before any UI work. After any UI work, check the whole app against it, not only the screen you touched.

Every rule is meant to be testable: look at a screenshot and answer yes or no. When Lasse corrects a UI decision, add the correction here as a new rule **before** fixing anything. The date in brackets is when the rule was given.

## Text

1. **No grey filler text.** Every line must say something new and useful. A line that repeats a heading, a button label or something obvious is deleted. *(Nov 2026)*
2. **No small grey text.** Helper captions are removed. Any text that stays is at least body size (15 pt and up) and readable. *(11 Nov 2026, repeated several times)*
   The only things that may stay smaller: message times and send status in chat, names under the balloons in a room, tags on photos (like "Round 1"), tab bar labels, and the legal small print under a price. *(13 Nov 2026)*
3. **Text is never cut off.** No fixed heights on text containers. `lineHeight` is always larger than `fontSize`. Numbers are never truncated. Large Dynamic Type sizes are capped with `maxFontSizeMultiplier`, never clipped. *(11 Nov 2026: the seat count was cut off)*
4. **Question and answer are the same colour.** They differ only, and strongly, in size and typeface: a small sans question and a large serif answer. Use `src/components/prompt.tsx`, the same style everywhere. *(11 Nov 2026)*
5. **Strong hierarchy.** One clear focal point per screen. Headings are dramatically larger than body text. *(Nov 2026)*
   Headings are **Instrument Serif** (one weight plus italic), set large: 62 pt for a hero line, 52 pt for a screen title, 40 pt for a question, against 17 pt body text in the system sans. No other heading font. *(13 Nov 2026)*
6. **No "tonight" or "evening" copy, no fake urgency, no fake social proof.** *(standing rule)*
7. **Legal lines say exactly what they mean.** For example "By continuing, you agree to the terms and the privacy policy." Never a sentence that bundles unrelated claims. *(13 Nov 2026)*

## Layout

8. **No scrolling on screens whose content fits.** Use a plain View, not a ScrollView, unless the content really overflows. Short screens get `bounces={false}`. In a room, the screen never scrolls: the live reveal fits the page and its photo shrinks to the space left. *(11 and 13 Nov 2026)*
9. **No grey rounded boxes.** Group with space, hairlines and type size. Choices are outlined, not filled grey. *(11 Nov 2026)*
10. **No cards inside cards.** Prefer whitespace over borders and shadows. *(Nov 2026)*
11. **No white space left over at the bottom of a screen**, for example under the last card in a room. *(11 Nov 2026)*
12. **Respect safe areas exactly once.** Never stack safe-area padding on top of manual padding. Nothing sits under the notch or the home bar. *(Nov 2026)*

## Photos

13. **Photos use `expo-image`** with `contentFit="cover"`, and `contentPosition="top"` for portraits, in a container with a fixed aspect ratio (4:5 for profile photos). Faces are never cropped at the top. *(Nov 2026)*
14. **Faces are not zoomed in too far.** On the match screen the photo takes the top part of the screen, not all of it. *(11 Nov 2026)*
15. **No shade line or scrim artefact at the bottom of a photo.** Gradients are sized in points, never in percent. *(11 Nov 2026)*
16. **A photo shows only once it is revealed.** In the room, the stage never shows a photo before its reveal. *(11 Nov 2026)*

## Colour and theme

17. **Hinge-like palette:** near-white paper background, near-black text. Primary buttons are black pills with white text, secondary buttons are outlined, "Not now" is plain text. *(9 Nov 2026)*
18. **Plum is an accent,** used in at most one strong place per screen. *(9 Nov 2026)*
19. **Light mode only.** Never add dark-mode styles. *(Nov 2026)*
20. **Never hard-code colours, font sizes, spacing or radii** outside `src/constants/theme.ts`. Use the theme and the existing components. *(Nov 2026)*
21. **Don't change the colours, the brand fonts or the app's flows unless Lasse asks.** *(iOS UI brief, Nov 2026)*

## Native feel and motion

22. **Hinge is the reference.** Use the system Liquid Glass tab bar (Play, Rooms, Matches, You) and glass capsule buttons over photos. *(11 Nov 2026)*
23. **Everything new gets a proper transition:** entering a screen, switching tabs or panes, things appearing and disappearing. Nothing pops in. *(11 Nov 2026)*
24. **No grey flash when something is pressed, anywhere.** Press feedback is a dim or a scale, never a grey fill. *(11 Nov 2026)*
25. **Every button has a pressed state, and every tap has a light haptic.** The pop gets a heavy haptic. Swipe-back works everywhere it makes sense. *(Nov 2026)*
26. **Use Apple's own controls where they beat ours:** system sheets, the date wheel, segmented controls, long-press menus and native alerts. *(12–13 Nov 2026)*
27. **No emoji as icons.** Use SF Symbols through `src/components/icon.tsx`. *(Nov 2026)*

## Screens

28. **Welcome:** the video, the logo, the headline and Sign in with Apple. Nothing else: no paragraph, no "Get started". *(13 Nov 2026)*
29. **Onboarding input screens:** a big bold question with the input directly under it. Both sit centred in the space above the keyboard, with Continue pinned on top of the keyboard. The input focuses itself. A thin progress bar at the top. *(Nov 2026)*
30. **No line under a question when the title already says it all.** For example "I'm a" and "I want to meet" have no subtitle. *(13 Nov 2026)*
31. **Pop is on the balloon itself** (hold to pop). There is no separate Pop button. *(11 Nov 2026)*
32. **Match profile follows Hinge's order:** photo, then who they are (one fact per line), then alternating photo and room answer. Chat and Profile are tabs you can also swipe between. *(11 Nov 2026)*
33. **The Random / Popper / Balloon role picker on Play is for the test server only.** Don't redesign or feature it. *(Nov 2026)*

## How to check

- Screenshot every screen you touch in the browser at an iPhone 15 Pro viewport (393 × 852) and inspect it against these rules before saying it's done.
- The web preview isn't pixel-perfect iOS. A real iPhone screenshot from Lasse always overrides it.
- Before reporting, screenshot every main screen (onboarding steps, Play, Rooms, Matches, You, profile, match) and confirm no rule is broken anywhere.
