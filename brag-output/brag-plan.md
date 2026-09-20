# brag-plan — תשובה לברקו (גרסה 4)

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
- **Footage first, type second.** His broadcast runs in a full-width panel for all 60 seconds; the copy under it is a year, one number and one line. Nothing is ever still, and no frame is fabricated — the only person on screen is the one being answered, in his own clip.

## Storyboard

His graphic holds slides 1996–2009 from 14s to 39s and 2010–2018 from 44s to 66s;
the studio two-shots run 4–13s and 67–77s. Every scene cuts from the stretch that
matches what it is answering — real alignment, not decoration.

| Scene | In–Out | Cuts from | Copy |
|---|---|---|---|
| S0 | 0.0–5.5 | 4.0 (studio) | ברקו צודק. / כל תשע השקופיות. |
| S1 | 5.5–11.0 | 8.0 (studio) + both deck stills | סופרת חתימות. לא תוצאות. |
| 1997 | 11.0–17.5 | 14.0 (panel A) | **87–17** |
| 1998 | 17.5–24.0 | 20.5 (panel A) | **2%** |
| 2005 | 24.0–30.5 | 27.0 (panel A) | **7.8.2005** |
| 2009 | 30.5–37.0 | 32.5 (panel A) | **10 חודשים** |
| 2011 | 37.0–43.5 | 45.0 (panel B) | **26–3** |
| 2013 | 43.5–50.0 | 51.5 (panel B) | **13–7** |
| S8 | 50.0–55.0 | 67.0 (studio) | מדינה פלסטינית לא קמה. |
| S9 | 55.0–60.0 | 71.5 (studio) | בונה מצגת. לא טיעון. |

Scene durations sum to **60.0s**. Copy per card is down from ~22 words to ~9: the
number is the hero, the line is its footnote.

**No sentence-level alignment.** His graphic is static — no row highlights — and
transcription is unavailable here, so there is no way to know which slide he is
speaking at any instant. Half-level alignment is what the footage actually
supports, and the plan claims no more than that.

**His audio stays muted.** Leaving it in means he argues his case while the copy
tries to rebut it, and without a transcript the cut cannot be made to land on the
matching sentence. That is a worse video than silence.

## Media plates

`build.mjs` regenerates `index.html` from the scene data. Any file at
`media/<year>.<ext>` takes over that card's panel from Barko's footage; with none
supplied the panel stays on him and nothing breaks. The Netanyahu clips have to be
fetched by hand — the network policy returns 403 for every media host.
`media/README.md` carries the per-year shot list.

## Audio

**Music: none, deliberately.** The five bundled tracks are upbeat corporate beds ("Happy Beats / Business Moves"). Any of them under a political fact-check reads as a parody of itself. Silence plus sparse dry cues is the honest register here, and `references/audio.md` allows silence when the plan chooses it explicitly.

SFX kept to two families so the palette stays coherent: a soft impact when a card lands, a soft drop when its fine print rises, one bell at the hook and one at the close. All at 0.5–0.65.

Music cue guidance: not applicable; no music bed.

Audio-reactive treatment: none; no music to react to.

## Known weaknesses (carried into script.md)

v1 answered each slide and left the pattern untouched. v2 takes the pattern head on and names it: conditional concessions that did not mature. The evidence is on screen — Wye frozen after 2%, the moratorium expired and not renewed, the fourth tranche cancelled, no Palestinian state. That is arguable, but it is an argument rather than an evasion, which is the whole difference between the two versions.
