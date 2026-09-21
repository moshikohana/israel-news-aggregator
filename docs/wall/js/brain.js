/*
 * brain.js - ההתנהגות של הדמות.
 *
 * כאן נשמר מצב העולם (`env`), הזיכרון שלה בין הפעלות (localStorage),
 * התגובות לפקודות קוליות, ההתנהגויות הספונטניות כשלא נוגעים בה,
 * והחיבורים לנתונים חיים: מזג אוויר אמיתי, חדשות, שעון וסוללה.
 *
 * אין כאן ציור - רק החלטות. הציור נמצא ב-scene.js וב-character.js.
 */

import { sunAltitude, WEATHER_HE } from './scene.js';

const KEY = 'live-wallpaper-memory';

/* ----------------------------------------------------------- משפטים */

const LINES = {
    welcomeMorning: ['בוקר טוב! ישנת טוב?', 'היי, בוקר טוב. הכנתי לך ים רגוע.', 'בוקר! הגלים כבר מחכים.'],
    welcomeDay: ['היי, חזרת!', 'הנה אתה. התגעגעתי.', 'שלום! יום יפה בחוץ, לא?'],
    welcomeEvening: ['ערב טוב. השקיעה בדיוק מתחילה.', 'היי, ערב טוב. הכנתי שקיעה.', 'ערב טוב! נשארת עד מאוחר?'],
    welcomeNight: ['עוד ערים? גם אני.', 'לילה טוב… או שאתה עוד עובד?', 'שקט בחוץ. רק אנחנו והכוכבים.'],
    backShort: ['זה היה מהיר.', 'חזרת כבר?', 'לא הספקתי להתגעגע.'],
    backLong: ['הרבה זמן לא היית!', 'חשבתי שנטשת אותי כאן.', 'סוף סוף! החול כבר התקרר.'],
    rain: ['אוקיי, שיירד גשם 🌧️', 'מתחיל לרדת… תכסה את המקלדת.', 'גשם, בבקשה.'],
    storm: ['סערה בדרך. תחזיק חזק ⚡', 'ברקים! זה ייראה טוב.', 'אני מקווה שאין לך כביסה בחוץ.'],
    snow: ['שלג על חוף הים? למה לא ❄️', 'קר לי כבר מלהסתכל.', 'שלג בדרך.'],
    clear: ['הנה השמש חזרה ☀️', 'בסדר, מספיק גשם.', 'שמיים נקיים, כמו שביקשת.'],
    clouds: ['קצת עננים, שיהיה נעים.', 'מעונן חלקית.', 'עננים בדרך.'],
    fog: ['ערפל… אני בקושי רואה אותך.', 'הכל מטושטש עכשיו.', 'ערפל על הים.'],
    night: ['כיביתי את השמש 🌙', 'לילה. תראה כמה כוכבים.', 'לילה טוב לעיניים.'],
    day: ['בוקר! ☀️', 'החזרתי את האור.', 'יום חדש.'],
    sunset: ['שקיעה. השעה הכי יפה.', 'הנה הזהב.', 'שקיעה בשבילך.'],
    dance: ['בוא נרקוד 💃', 'תפעיל מוזיקה!', 'זה השיר שלי!'],
    sleep: ['לילה טוב… 😴', 'אני נרדמת. תעיר אותי.', 'זזז…'],
    wake: ['אני ערה! אני ערה.', 'מה? כן, קמתי.', 'בוקר טוב לי.'],
    hello: ['היי!', 'שלום לך 👋', 'הנה אתה.'],
    howareyou: ['מצוין, יש לי ים פרטי.', 'טוב! קצת משעמם בלעדיך.', 'אני על החוף כל היום, מה יכול להיות רע?'],
    love: ['גם אני אותך 💗', 'אוי. עכשיו הסמקתי.', 'תגיד את זה שוב.'],
    thanks: ['בכיף!', 'תמיד.', 'בשביל זה אני כאן.'],
    name: ['קוראים לי גלי. כמו הים.', 'גלי. נעים מאוד.', 'גלי - וזה הטפט שלי.'],
    joke: [
        'למה המחשב הלך לים? כדי לעשות ריסטארט.',
        'מה אמר הקובץ לתיקייה? תכניסי אותי, קר בחוץ.',
        'יש לי בדיחה על WiFi אבל החיבור נופל באמצע.',
        'מה אמרה המקלדת למסך? אני מקלידה, אתה רק מציג.',
    ],
    protect: ['אני שומרת עליהם 🛡️', 'הקבצים שלך אצלי. לא יירטבו.', 'תן לי אותם, אני מחזיקה.'],
    tidy: ['סידרתי הכל.', 'שולחן נקי, ראש נקי.', 'הנה, כמו חדש.'],
    focus: ['אני בשקט. תעבוד 🤫', 'לא מפריעה. בהצלחה.', 'שקט מוחלט. קדימה.'],
    relax: ['סיימת? יופי!', 'הפסקה! סוף סוף.', 'בוא נחזור לים.'],
    catch: ['תפסתי!', 'כמעט נפל!', 'זהירות, זה שביר.'],
    poke: ['היי!', 'זה מדגדג.', 'מה אתה עושה?'],
    idle: [
        'הים רגוע היום.',
        'ראית את הצבע של השמיים?',
        'אני יכולה לשנות את מזג האוויר, רק תבקש.',
        'תגיד "שיירד גשם" ותראה מה קורה.',
        'אתה עובד יותר מדי.',
        'יש לך שולחן די מבולגן, אם מותר לי.',
    ],
    lowBattery: ['הסוללה שלך נגמרת 🔋', 'תטען את המחשב, אני לא רוצה להיעלם.'],
    pomodoroStart: ['התחלתי טיימר לרבע שעה. קדימה 🍅'],
    pomodoroEnd: ['נגמר הזמן! קום קצת.', 'עשרים וחמש דקות. תנוח.'],
    shot: ['צ\'יז! 📸'],
    hide: ['בסדר, אני בצד…'],
    show: ['חזרתי!'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ============================================================== המוח */

export class Brain {
    constructor(character, desktop, speaker) {
        this.ch = character;
        this.dk = desktop;
        this.sp = speaker;

        this.env = {
            time: new Date(),
            sunAlt: 0.5,
            weather: 'clear',
            wind: 0.25,
            wet: 0,
            temp: 26,
            timeMode: 'live',      // live | forced
            forcedAlt: null,
        };

        this.mem = this.load();
        this.idleTimer = 12 + Math.random() * 20;
        this.stateTimer = 0;
        this.busy = 0;             // כמה זמן נשארים בתנוחה הנוכחית
        this.bubble = null;
        this.focusMode = false;
        this.pomodoro = null;
        this.typing = 0;
        this.lastPoint = 0;
        this.hidden = false;
        this.onSay = () => {};
        this.onShot = () => {};
        this.weatherAuto = false;
        this.headlines = [];
    }

    /* ---------------------------------------------------------- זיכרון */

    load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
            return {
                visits: raw.visits || 0,
                lastSeen: raw.lastSeen || 0,
                affinity: raw.affinity || 0,
                outfit: raw.outfit || 'teal',
                totalMinutes: raw.totalMinutes || 0,
            };
        } catch (_) {
            return { visits: 0, lastSeen: 0, affinity: 0, outfit: 'teal', totalMinutes: 0 };
        }
    }

    save() {
        this.mem.lastSeen = Date.now();
        try { localStorage.setItem(KEY, JSON.stringify(this.mem)); } catch (_) {}
    }

    /** מברכת לשלום לפי השעה ולפי כמה זמן לא היית. */
    greet() {
        const gap = this.mem.lastSeen ? (Date.now() - this.mem.lastSeen) / 60000 : Infinity;
        this.mem.visits += 1;
        this.save();

        const h = new Date().getHours();
        let line;
        if (gap < 3 && this.mem.visits > 1) line = pick(LINES.backShort);
        else if (gap > 60 * 8) line = pick(LINES.backLong);
        else if (h < 11) line = pick(LINES.welcomeMorning);
        else if (h < 17) line = pick(LINES.welcomeDay);
        else if (h < 22) line = pick(LINES.welcomeEvening);
        else line = pick(LINES.welcomeNight);

        this.ch.setMood('happy');
        this.act('wave', 2.6);
        this.say(line);
    }

    /* ----------------------------------------------------------- דיבור */

    say(text, mood) {
        if (!text) return;
        if (mood) this.ch.setMood(mood);
        this.bubble = { text, t: 0, life: Math.max(2.4, Math.min(8, text.length * 0.09)) };
        this.ch.talk = 1;
        this.onSay(text);
        this.sp.say(text);
    }

    /** מעבר לתנוחה למשך זמן, ואז חזרה להתנהגות הרגילה. */
    act(state, seconds = 2.5, params) {
        this.ch.play(state, params);
        this.busy = seconds;
    }

    /* ---------------------------------------------------------- פקודות */

    handle(id, raw) {
        const W = (w, key) => { this.setWeather(w); this.say(pick(LINES[key])); };
        switch (id) {
            case 'rain': W('rain', 'rain'); this.ch.setMood('happy'); this.act('shield', 3); break;
            case 'storm': W('storm', 'storm'); this.ch.setMood('surprised'); this.act('shield', 4); break;
            case 'snow': W('snow', 'snow'); this.ch.setMood('cold'); this.act('shiver', 4); break;
            case 'clear': W('clear', 'clear'); this.ch.setMood('happy'); this.act('cheer', 2.2); break;
            case 'clouds': W('clouds', 'clouds'); break;
            case 'fog': W('fog', 'fog'); break;

            case 'night': this.forceTime(-0.55); this.say(pick(LINES.night), 'sleepy'); break;
            case 'day': this.forceTime(0.85); this.say(pick(LINES.day), 'happy'); this.act('stretch', 2.4); break;
            case 'sunset': this.forceTime(0.06); this.say(pick(LINES.sunset), 'happy'); break;
            case 'now': this.env.timeMode = 'live'; this.env.forcedAlt = null; this.say('חזרתי לשעון האמיתי.'); break;

            case 'dance': this.ch.setMood('happy'); this.act('dance', 14); this.say(pick(LINES.dance)); break;
            case 'wave': this.act('wave', 2.6); this.say(pick(LINES.hello), 'happy'); break;
            case 'sleep': this.ch.setMood('sleepy'); this.act('sleep', 120); this.say(pick(LINES.sleep)); break;
            case 'wake': this.ch.setMood('surprised'); this.act('stretch', 2.4); this.say(pick(LINES.wake)); break;
            case 'sit': this.act('sit', 25); this.say('אשב קצת.'); break;
            case 'walk': this.act('walk', 6); this.say('בסדר, סיבוב קצר.'); break;
            case 'stretch': this.act('stretch', 2.4); break;
            case 'come': this.callOver(); break;

            case 'hello': this.act('wave', 2.4); this.say(pick(LINES.hello), 'happy'); break;
            case 'howareyou': this.say(pick(LINES.howareyou), 'happy'); break;
            case 'love':
                this.mem.affinity += 1;
                this.save();
                this.ch.setMood('love');
                for (let i = 0; i < 6; i++) setTimeout(() => this.ch.pop('heart'), i * 160);
                this.say(pick(LINES.love));
                break;
            case 'thanks': this.say(pick(LINES.thanks), 'happy'); break;
            case 'joke': this.say(pick(LINES.joke), 'happy'); this.act('cheer', 2); break;
            case 'name': this.say(pick(LINES.name), 'happy'); break;

            case 'time': {
                const d = new Date();
                this.say(`השעה ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
                break;
            }
            case 'weather':
                this.say(`בחוץ ${WEATHER_HE[this.env.weather]}, בערך ${Math.round(this.env.temp)} מעלות.`);
                break;
            case 'news': this.readNews(); break;

            case 'protect':
                if (this.dk.protect) {          // לחיצה שנייה = משחררת
                    this.dk.protect = false;
                    this.dk.tidy();
                    this.busy = 0;
                    this.ch.setMood('happy');
                    this.say('הנה, החזרתי אותם למקום.');
                    break;
                }
                this.dk.protect = true;
                this.ch.setMood('focused');
                this.act('shield', 999);
                this.say(pick(LINES.protect));
                break;
            case 'tidy':
                this.dk.protect = false;
                this.dk.tidy();
                this.act('cheer', 2);
                this.say(pick(LINES.tidy), 'happy');
                break;
            case 'focus': this.setFocus(!this.focusMode); break;
            case 'relax': this.setFocus(false); break;
            case 'pomodoro': this.startPomodoro(); break;

            case 'outfit': this.cycleOutfit(); break;
            case 'shot': this.act('cheer', 1.6); this.say(pick(LINES.shot), 'happy'); setTimeout(() => this.onShot(), 900); break;
            case 'hide': this.hidden = true; this.say(pick(LINES.hide)); break;
            case 'show': this.hidden = false; this.act('wave', 2.2); this.say(pick(LINES.show), 'happy'); break;
            default: return false;
        }
        return true;
    }

    /* ------------------------------------------------------ שינויי עולם */

    setWeather(w) {
        this.env.weather = w;
        this.weatherAuto = false;
    }

    forceTime(alt) {
        this.env.timeMode = 'forced';
        this.env.forcedAlt = alt;
    }

    setFocus(on) {
        this.focusMode = on;
        if (on) {
            this.ch.setMood('focused');
            this.act('focus', 999);
            this.say(pick(LINES.focus));
            this.sp.enabled = false;
        } else {
            this.sp.enabled = true;
            this.busy = 0;
            this.ch.setMood('happy');
            this.say(pick(LINES.relax));
        }
    }

    startPomodoro() {
        this.pomodoro = { left: 25 * 60 };
        this.setFocus(true);
        this.sp.enabled = true;
        this.say(pick(LINES.pomodoroStart));
    }

    cycleOutfit() {
        const keys = ['teal', 'sunset', 'night', 'mint'];
        const i = (keys.indexOf(this.mem.outfit) + 1) % keys.length;
        this.mem.outfit = keys[i];
        this.save();
        this.ch.setOutfit(keys[i]);
        this.act('cheer', 1.8);
        this.say('מה דעתך על זה?', 'happy');
    }

    callOver() {
        this.walkTo = { x: this.ch.x + (this.pointer ? Math.sign(this.pointer.x - this.ch.x) : 1) * 0 };
        this.walkTarget = this.pointer ? this.pointer.x : this.ch.x;
        this.act('walk', 8);
        this.say('באה!', 'happy');
    }

    /* -------------------------------------------------------- נתונים חיים */

    /** מזג אוויר אמיתי לפי מיקום המשתמש (Open-Meteo, בלי מפתח ובלי הרשמה). */
    async fetchWeather() {
        const go = async (lat, lon) => {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
                + '&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=auto&forecast_days=1';
            const res = await fetch(url);
            if (!res.ok) throw new Error('weather');
            const j = await res.json();
            const code = j.current.weather_code;
            const w = code === 0 ? 'clear'
                : code <= 3 ? 'clouds'
                    : code <= 48 ? 'fog'
                        : code <= 67 ? 'rain'
                            : code <= 77 ? 'snow'
                                : code <= 82 ? 'rain'
                                    : code <= 86 ? 'snow' : 'storm';
            this.env.weather = w;
            this.env.temp = j.current.temperature_2m;
            this.env.wind = Math.max(0.05, Math.min(1, j.current.wind_speed_10m / 40));
            this.weatherAuto = true;
            if (j.daily && j.daily.sunrise) {
                this.sunrise = new Date(j.daily.sunrise[0]).getHours() + new Date(j.daily.sunrise[0]).getMinutes() / 60;
                this.sunset = new Date(j.daily.sunset[0]).getHours() + new Date(j.daily.sunset[0]).getMinutes() / 60;
            }
            return w;
        };

        try {
            const pos = await new Promise((res, rej) => {
                if (!navigator.geolocation) return rej(new Error('no geo'));
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 7000, maximumAge: 3600000 });
            });
            return await go(pos.coords.latitude, pos.coords.longitude);
        } catch (_) {
            try { return await go(32.08, 34.78); } catch (__) { return null; }   // ברירת מחדל: תל אביב
        }
    }

    /** כותרות מהאגרגטור שמריץ את העמוד (app.py), אם הוא זמין. */
    async fetchNews() {
        const urls = ['../../more_ynet_articles/0', '/more_ynet_articles/0'];
        let reached = false;
        for (const u of urls) {
            try {
                const res = await fetch(u, { cache: 'no-store' });
                if (!res.ok) continue;
                reached = true;
                const data = await res.json();
                const titles = (Array.isArray(data) ? data : [])
                    .map((a) => a.title || a.headline || '')
                    .filter(Boolean)
                    .slice(0, 12);
                if (titles.length) {
                    this.headlines = titles;
                    this.dk.setNews(titles);
                    return titles;
                }
            } catch (_) { /* ממשיכים לכתובת הבאה */ }
        }
        // מבדילים בין "אין שרת" לבין "השרת עונה אבל לא החזיר כותרות"
        this.dk.setNews(reached
            ? ['השרת עונה אבל לא הגיעו כותרות', 'אולי אתר החדשות לא זמין כרגע']
            : ['אין חיבור לאגרגטור החדשות', 'הריצו python app.py ופתחו /wall/']);
        return [];
    }

    readNews() {
        if (!this.headlines.length) {
            this.say('אין לי כותרות כרגע. תריץ את האגרגטור ואקריא לך.');
            return;
        }
        this.act('point', 3, { pointAngle: 1.9 });
        this.say(this.headlines[0], 'focused');
        let i = 1;
        clearInterval(this._newsTimer);
        this._newsTimer = setInterval(() => {
            if (i >= Math.min(3, this.headlines.length)) { clearInterval(this._newsTimer); return; }
            this.say(this.headlines[i++]);
        }, 6500);
    }

    watchBattery() {
        if (!navigator.getBattery) return;
        navigator.getBattery().then((b) => {
            const check = () => {
                if (b.level < 0.18 && !b.charging && !this._warnedBattery) {
                    this._warnedBattery = true;
                    this.ch.setMood('sad');
                    this.say(pick(LINES.lowBattery));
                }
                if (b.charging) this._warnedBattery = false;
            };
            b.addEventListener('levelchange', check);
            b.addEventListener('chargingchange', check);
            check();
        }).catch(() => {});
    }

    /* ------------------------------------------------------------ עדכון */

    update(dt, pointer) {
        this.pointer = pointer;
        const env = this.env;

        // שעון ושמש
        env.time = new Date();
        env.sunAlt = env.timeMode === 'forced'
            ? env.forcedAlt
            : sunAltitude(env.time, this.sunrise || 6, this.sunset || 19);

        // רטיבות מצטברת בגשם ומתייבשת אחריו
        const raining = env.weather === 'rain' || env.weather === 'storm';
        env.wet = Math.max(0, Math.min(1, env.wet + (raining ? 0.16 : -0.05) * dt));
        this.ch.wet = env.wet;

        // רוח מתנדנדת סביב הערך הבסיסי
        env.windBase = env.windBase == null ? env.wind : env.windBase;
        const gust = Math.sin(performance.now() / 4200) * 0.18 + Math.sin(performance.now() / 1100) * 0.06;
        env.wind = Math.max(0, (this.weatherAuto ? env.windBase : (raining ? 0.55 : 0.25)) + gust
            + (env.weather === 'storm' ? 0.5 : 0));

        // פומודורו
        if (this.pomodoro) {
            this.pomodoro.left -= dt;
            if (this.pomodoro.left <= 0) {
                this.pomodoro = null;
                this.setFocus(false);
                this.say(pick(LINES.pomodoroEnd), 'happy');
            }
        }

        // בועת דיבור
        if (this.bubble) {
            this.bubble.t += dt;
            if (this.bubble.t > this.bubble.life) this.bubble = null;
        }

        // הליכה ליעד (פקודת "בואי")
        if (this.ch.state === 'walk' && this.walkTarget != null) {
            const dir = Math.sign(this.walkTarget - this.ch.x);
            this.ch.facing = dir || this.ch.facing;
            this.ch.x += dir * 150 * dt;
            if (this.bounds) {                       // לא לצאת מהמסך
                const margin = this.ch.height * 0.4;
                this.ch.x = Math.max(margin, Math.min(this.bounds - margin, this.ch.x));
            }
            if (Math.abs(this.walkTarget - this.ch.x) < 18) {
                this.walkTarget = null;
                this.busy = 0;
                this.act('wave', 2);
            }
        }

        // ספירה לאחור של תנוחה זמנית
        if (this.busy > 0) {
            this.busy -= dt;
            if (this.busy <= 0) this.settle();
        }

        this.typing = Math.max(0, this.typing - dt);
        this.react(dt);
        this.mem.totalMinutes += dt / 60;
        if (Math.random() < dt * 0.05) this.save();
    }

    /** חזרה לברירת המחדל המתאימה למצב הנוכחי. */
    settle() {
        if (this.dk.protect) { this.ch.play('shield'); return; }
        if (this.focusMode) { this.ch.play('focus'); return; }
        const e = this.env;
        if (e.weather === 'snow') { this.ch.play('shiver'); this.ch.setMood('cold'); return; }
        if (e.weather === 'storm') { this.ch.play('shield'); this.ch.setMood('surprised'); return; }
        if (e.weather === 'rain') { this.ch.play('shield'); return; }
        if (e.sunAlt < -0.45) { this.ch.play('sit'); this.ch.setMood('sleepy'); return; }
        this.ch.play('idle');
        if (this.ch.mood === 'cold' || this.ch.mood === 'surprised') this.ch.setMood('happy');
    }

    /** התנהגות ספונטנית כשלא מדברים איתה. */
    react(dt) {
        if (this.focusMode || this.hidden) return;
        this.idleTimer -= dt;
        if (this.idleTimer > 0 || this.busy > 0) return;
        this.idleTimer = 18 + Math.random() * 26;

        const r = Math.random();
        const e = this.env;
        if (e.wet > 0.5 && e.weather !== 'rain' && e.weather !== 'storm') {
            this.act('towel', 3.5);
            this.say('נרטבתי לגמרי. תודה רבה.', 'annoyed');
        } else if (r < 0.2) {
            this.act('stretch', 2.4);
        } else if (r < 0.35) {
            this.act('walk', 3.5);
            this.ch.facing *= -1;
        } else if (r < 0.5 && this.pointer) {
            this.act('point', 2.4, { pointAngle: 1.7 });
            this.say('רואה את הסמן שלך? אני עוקבת אחריו.');
        } else if (r < 0.62) {
            this.act('sit', 12);
        } else if (r < 0.8) {
            this.say(pick(LINES.idle));
        } else {
            this.act('wave', 2.2);
        }
    }

    /** מגיבה למגע/לחיצה על הדמות עצמה. */
    poke() {
        this.mem.affinity += 0.2;
        const r = Math.random();
        if (r < 0.3) { this.ch.setMood('surprised'); this.act('cheer', 1.6); }
        else if (r < 0.6) { this.ch.setMood('happy'); this.act('wave', 2); }
        else { this.ch.setMood('love'); this.ch.pop('heart'); this.act('idle', 1); }
        this.say(pick(LINES.poke));
    }

    caught(icon) {
        this.ch.setMood('surprised');
        this.act('hold', 4);
        this.say(pick(LINES.catch));
    }

    keyActivity() {
        this.typing = 2.5;
        if (!this.focusMode && this.busy <= 0 && Math.random() < 0.05) {
            this.act('peek', 2.2);
        }
    }
}
