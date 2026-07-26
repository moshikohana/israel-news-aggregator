# Recording "בחצי היום עם אסתי פרז" (כאן ב')

Esti Perez (אסתי פרז) hosts **בחצי היום** on **כאן ב'** (Kan Bet, 95FM), the
midday current-affairs show, daily **12:00–14:00** Israel time.

There are two ways to get the 12:00–13:00 segment. **The podcast is the
recommended route** — studio quality, no timing risk, no missed minutes.

## Option 1 (recommended): download the podcast

Kan publishes the full show as a podcast shortly after broadcast, so you don't
need to record anything live:

- Kan: <https://www.kan.org.il/content/kan/kan-b/p-10023/>
- Omny: <https://omny.fm/shows/half-day/playlists/podcast>

Open the day's episode and download the MP3, then keep the first hour if you
only want 12:00–13:00.

## Option 2: record the live stream

Use `record_kan_bet.sh` on a machine that can reach Kan (i.e. **not** this
sandboxed cloud container — the environment blocks Kan's servers, and it has no
`ffmpeg`). Requires `ffmpeg` and `curl`.

```bash
# Record 60 minutes (12:00–13:00) starting now:
./record_kan_bet.sh

# Full 2-hour show:
DURATION=7200 ./record_kan_bet.sh

# If auto-detection fails, pass the stream URL yourself
# (grab it from the browser Network tab on kan.org.il/live):
STREAM_URL="https://…/live.m3u8" ./record_kan_bet.sh
```

### Start it automatically at 12:00

Using `at` (one-off, today):

```bash
echo "cd $(pwd) && ./record_kan_bet.sh" | at 12:00
```

Using `cron` (every day at 12:00, output into ~/recordings):

```cron
0 12 * * *  cd /path/to/scripts && OUTPUT="$HOME/recordings/kan_bet_$(date +\%F).m4a" ./record_kan_bet.sh
```

> Note: schedule times are in the machine's local timezone — make sure it's set
> to Israel time (or adjust the hour accordingly).
