# brag-plan — תשובה לבקוביץ׳

## Brief

- **Source material:** a video in which Yinon Bekovich presents a slide deck arguing that Netanyahu is "the biggest leftist of them all," listing 1996–2018 concessions.
- **Deliverable:** a 60-second vertical rebuttal video plus the script and a sourced fact sheet.
- **Angle:** counter-presentation. He showed slides; we show the same slides with the fine print restored.
- **This is not a product brag.** The `/brag` workflow (inspect → plan → Hyperframes → render) is being used as the production pipeline; the "product" is the argument.

## Planning rubric

| Question | Answer |
|---|---|
| What is it? | A typographic rebuttal to a political attack video |
| Who is it for? | Hebrew-speaking social feeds (Instagram / TikTok / X) |
| What is the single claim? | Each slide is true and incomplete — the omitted half changes the meaning |
| What is the hook? | "מצגת יפה. חבל שהיא נעצרת באמצע המשפט." |
| What must be shown? | The opponent's own claim, verbatim, before each rebuttal |
| What is the proof? | Vote counts and dates — 87–17, 2% of 13%, 7 Aug 2005, 26–3, 13–7 |
| What is the punchline? | "ואף מדינה פלסטינית לא קמה." |
| What must NOT be claimed? | Qatar 2018, the 1996 "found a friend" quote, the 2015 "no Palestinian state" line |
| What would embarrass us? | Denying the disengagement vote. So the video concedes it in the largest type on screen. |

## Tone and format

- **Tone:** `polished`, pushed toward `deadpan`. Dry, documentary, no snark. The numbers carry it.
- **Format:** vertical, 1080×1920.
- **Duration:** 60s — the user asked for 60, overriding the 15–25s creative law.
- **Typography:** Heebo 400/700/900, subset files vendored into `assets/fonts/` so the render is deterministic and offline.
- **No faces, no footage.** Type and rules only. Nothing that could be mistaken for a fabricated clip of a real person.

## Storyboard

| Scene | In–Out | Beat | Motion | SFX |
|---|---|---|---|---|
| S0 | 0.0–5.0 | "מצגת יפה." → "חבל שהיא נעצרת באמצע המשפט." | Line 1 settles centered; hold 1.9s; line 2 rises under it | `interface/bong_001` @ 0.2 |
| S1 | 5.0–10.0 | Six year chips light up, then the thesis line | Chips stagger 0.22s apart, thesis fades up at 7.6 | `casino/card-place-1` ×6 |
| S2 | 10.0–18.0 | 1997 · חברון — 87–17 | Claim strip slides in from the right; fine-print panel rises at +1.4s; figure counts in at +4.2s | `impact/impactSoft_medium_000` @ card in, `interface/drop_001` @ panel |
| S3 | 18.0–25.5 | 1998 · וואי — 2% מתוך 13% | same card mechanic | same pair |
| S4 | 25.5–33.5 | 2005 · התנתקות — התפטר שבוע לפני | same, but "נכון." lands alone first | same pair |
| S5 | 33.5–41.5 | 2009 · בר-אילן — 10 חודשים, בלי ירושלים | same | same pair |
| S6 | 41.5–49.0 | 2011 · שליט — 26–3 | same | same pair |
| S7 | 49.0–55.0 | 2013 · 104 אסירים — 13–7 | same, tightened | same pair |
| S8 | 55.0–60.0 | Three closing lines | Lines 1–2 in muted grey, line 3 in white, full stop | `impact/impactBell_heavy_000` @ 58.3 |

Scene durations sum to **60.0s**.

## Audio

**Music: none, deliberately.** The five bundled tracks are upbeat corporate beds ("Happy Beats / Business Moves"). Any of them under a political fact-check reads as a parody of itself. Silence plus sparse dry cues is the honest register here, and `references/audio.md` allows silence when the plan chooses it explicitly.

SFX kept to two families so the palette stays coherent: a soft impact when a card lands, a soft drop when its fine print rises, one bell at the hook and one at the close. All at 0.5–0.65.

Music cue guidance: not applicable; no music bed.

Audio-reactive treatment: none; no music to react to.

## Known weaknesses (carried into script.md)

The video answers each slide individually. It does not answer the pattern — right-wing rhetoric alongside a record that contains concessions. That is the strongest available counter-argument and the video does not attempt it.
