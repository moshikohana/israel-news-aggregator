# brag-plan — תשובה לברקו (גרסה 2)

## Brief

- **Source material:** a video in which Barko presents a slide deck arguing that Netanyahu is "the biggest leftist of them all," listing 1996–2018 concessions.
- **Deliverable:** a 60-second vertical rebuttal video plus the script and a sourced fact sheet.
- **Angle (v2):** concede every slide, attack the inference. He lists what was signed; we show what was received, what was conditioned, and what never happened. Granting his facts is both the honest position and the harder one to attack.
- **This is not a product brag.** The `/brag` workflow (inspect → plan → Hyperframes → render) is being used as the production pipeline; the "product" is the argument.

## Planning rubric

| Question | Answer |
|---|---|
| What is it? | A typographic rebuttal to a political attack video |
| Who is it for? | Hebrew-speaking social feeds (Instagram / TikTok / X) |
| What is the single claim? | Every slide is true. The conclusion is still wrong, because the deck counts signatures and not outcomes |
| What is the hook? | "ברקו צודק. בכל תשע השקופיות. אז איך המסקנה יצאה הפוכה?" |
| What must be shown? | The opponent's own claim, verbatim, before each rebuttal |
| What is the proof? | Vote counts, dates, and the concessions that were withdrawn — 87–17, 2% of 13%, 7 Aug 2005, 26–3, the cancelled fourth tranche of 26 prisoners |
| What is the punchline? | "בונה מצגת. לא טיעון." — after the missing slide: "מדינה פלסטינית לא קמה." |
| What must NOT be claimed? | Qatar 2018, the 1996 "found a friend" quote, the 2015 "no Palestinian state" line |
| What would embarrass us? | Denying the disengagement vote. So the video concedes it in the largest type on screen. |

## Tone and format

- **Tone:** `polished`, pushed toward `deadpan`. Dry, documentary, no snark. The numbers carry it.
- **Format:** vertical, 1080×1920.
- **Duration:** 60s — the user asked for 60, overriding the 15–25s creative law.
- **Typography:** Heebo 400/700/900, subset files vendored into `assets/fonts/` so the render is deterministic and offline.
- **Type first, footage optional.** As shipped: type and rules only — nothing that could be mistaken for a fabricated clip of a real person. Archive stills or clips, when supplied, sit behind the type as drained background plates; they add weight without costing a second of the 60, and the argument still stands if they are stripped out.

## Storyboard

| Scene | In–Out | Beat | SFX |
|---|---|---|---|
| S0 | 0.0–5.5 | "ברקו צודק." → "בכל תשע השקופיות." → "אז איך המסקנה יצאה הפוכה?" | `interface/bong_001` @ 0.15 |
| S1 | 5.5–10.5 | Name the method: a deck of signatures is not history, it is an edit | `impact/impactSoft_medium_000` @ 9.3 |
| S2 | 10.5–17.0 | 1997 · חברון — 87–17 | impact @ card in, drop @ +1.15 |
| S3 | 17.0–23.5 | 1998 · וואי — 2% | same pair |
| S4 | 23.5–30.0 | 2005 · התנתקות — 7.8.2005 | same pair |
| S5 | 30.0–36.5 | 2009 · בר-אילן — 10 חודשים | same pair |
| S6 | 36.5–43.0 | 2011 · שליט — 26–3 | same pair |
| S7 | 43.0–49.5 | 2013 · אסירים — 26 אסירים שנשארו בכלא | same pair |
| S8 | 49.5–55.0 | The slide that was never in the deck: מדינה פלסטינית לא קמה | `impact/impactSoft_medium_000` @ 52.85 |
| S9 | 55.0–60.0 | "בונה מצגת. לא טיעון." | `impact/impactBell_heavy_000` @ 58.2 |

Scene durations sum to **60.0s**. Every card runs 6.5s: claim by +0.85s, fine print
from +1.7s, verdict at +3.6s, figure at +4.4s — each line holds well past its
reading time.

## Media plates

`build.mjs` regenerates `index.html` from the scene data and wires any file in
`media/<year>.<ext>` in as that card's background plate: grayscale, brightness
0.5, opacity 0.4, under a downward-strengthening scrim, with a slow push-in on
stills. With `media/` empty the composition renders exactly as committed, so the
video never depends on footage that isn't there.

The footage itself has to be supplied by hand — the environment's network policy
returns 403 for every media host, and archival material from these years is
copyrighted. `media/README.md` carries the shot list and the rights note.

## Audio

**Music: none, deliberately.** The five bundled tracks are upbeat corporate beds ("Happy Beats / Business Moves"). Any of them under a political fact-check reads as a parody of itself. Silence plus sparse dry cues is the honest register here, and `references/audio.md` allows silence when the plan chooses it explicitly.

SFX kept to two families so the palette stays coherent: a soft impact when a card lands, a soft drop when its fine print rises, one bell at the hook and one at the close. All at 0.5–0.65.

Music cue guidance: not applicable; no music bed.

Audio-reactive treatment: none; no music to react to.

## Known weaknesses (carried into script.md)

v1 answered each slide and left the pattern untouched. v2 takes the pattern head on and names it: conditional concessions that did not mature. The evidence is on screen — Wye frozen after 2%, the moratorium expired and not renewed, the fourth tranche cancelled, no Palestinian state. That is arguable, but it is an argument rather than an evasion, which is the whole difference between the two versions.
