/*
 * voice.js - האוזניים והקול של הדמות.
 *
 * שלושה חלקים עצמאיים:
 *   Voice      - זיהוי דיבור (Web Speech API) + התאמת פקודות בעברית ובאנגלית.
 *   Speaker    - דיבור חזרה (speechSynthesis), עם בחירת קול עברי אם קיים.
 *   AudioMeter - מד עוצמה מהמיקרופון, כדי שהדמות תרקוד לפי המוזיקה בחדר.
 *
 * הכל רץ במכשיר. זיהוי הדיבור בכרום עובר דרך שרתי גוגל של הדפדפן עצמו -
 * לכן הוא כבוי כברירת מחדל ונדלק רק בלחיצה מפורשת של המשתמש.
 */

/* ------------------------------------------------------------- פקודות */

// כל פקודה: זיהוי לפי ביטוי רגולרי (עברית + אנגלית) והפעולה שתופעל.
export const COMMANDS = [
    { id: 'rain', he: 'שיירד גשם', re: /(תעש[יה]|שיירד|בוא[יה]?\s*נעשה)?\s*גשם|let it rain|make it rain|rain/i },
    { id: 'storm', re: /סערה|סופה|ברקים|storm|thunder|lightning/i },
    { id: 'snow', re: /שלג|snow|let it snow/i },
    { id: 'clear', re: /שמש|בהיר|תעצר[יי]?\s*(את\s*)?הגשם|מספיק גשם|sun|clear|stop the rain|sunny/i },
    { id: 'clouds', re: /עננים|מעונן|clouds|cloudy|overcast/i },
    { id: 'fog', re: /ערפל|fog|foggy|mist/i },

    { id: 'night', re: /לילה|תחשי[ךכ]|כבה את האור|night|make it night|dark/i },
    { id: 'day', re: /יום|בוקר|אור|day|morning|daylight/i },
    { id: 'sunset', re: /שקיעה|ערב|sunset|golden hour|evening/i },
    { id: 'now', re: /שעה אמיתית|זמן אמת|real time|live time|actual time/i },

    { id: 'dance', re: /תרקד[יי]?|רקד[יי]|בוא[יי]?\s*נרקוד|dance|let'?s dance|party/i },
    { id: 'wave', re: /נופ[פפ]?[יי]|תגיד[יי] שלום|wave|say hi/i },
    { id: 'sleep', re: /ל[כך][יי] לישון|לילה טוב|תיש[נן][יי]|sleep|good night|go to sleep/i },
    { id: 'wake', re: /תתעורר[יי]|קומ[יי]|wake up|get up/i },
    { id: 'sit', re: /שב[יי]|תשב[יי]|sit down|sit/i },
    { id: 'come', re: /בוא[יי] הנה|בוא[יי] אלי|come here|come to me/i },
    { id: 'walk', re: /תסתובב[יי]|תלכ[יי]|טייל[יי]|walk|take a walk|move/i },
    { id: 'stretch', re: /תתמתח[יי]|מתיחה|stretch/i },

    { id: 'hello', re: /^(היי|הי|שלום|אהלן|בוקר טוב|ערב טוב|hey|hi|hello|yo)\b/i },
    { id: 'howareyou', re: /מה נשמע|מה שלומ[ךיי]|איך את|how are you|what'?s up/i },
    { id: 'love', re: /אני אוהב|אוהבת אות[ךי]|את מקסימה|יפה שלי|i love you|you'?re cute|beautiful/i },
    { id: 'thanks', re: /תודה|thank you|thanks/i },
    { id: 'joke', re: /בדיחה|תצחיק[יי]|joke|make me laugh/i },
    { id: 'name', re: /אי[ךכ] קוראים ל[ךי]|מה השם של[ךי]|what'?s your name|your name/i },

    { id: 'time', re: /מה השעה|what time|the time/i },
    { id: 'weather', re: /מה מזג האוויר|איזה מזג אוויר|what'?s the weather|weather outside/i },
    { id: 'news', re: /חדשות|מה קורה בארץ|מה חדש|news|headlines/i },

    { id: 'protect', re: /תשמר[יי] על|שמר[יי] על|תגנ[יי] על|המסמכים|protect my|guard my|documents|my files/i },
    { id: 'tidy', re: /סדר[יי]|תסדר[יי]|tidy|clean up|organize/i },
    { id: 'focus', re: /פוקוס|תתרכז[יי]|שקט|אני עובד|focus|quiet|i'?m working|do not disturb/i },
    { id: 'relax', re: /מספיק עבודה|הפסקה|תפסיק[יי] פוקוס|break time|relax|i'?m done working/i },
    { id: 'pomodoro', re: /פומודורו|טיימר|רבע שעה|pomodoro|timer|start a timer/i },

    { id: 'outfit', re: /תחליפ[יי] בגדים|בגדים אחרים|change outfit|new outfit|change clothes/i },
    { id: 'shot', re: /צילום מסך|תצלמ[יי]|screenshot|take a photo|say cheese/i },
    { id: 'hide', re: /תעלמ[יי]|תסתתר[יי]|hide|go away/i },
    { id: 'show', re: /תחזר[יי]|בוא[יי] בחזרה|come back|show yourself/i },
];

export function matchCommand(text) {
    const t = (text || '').trim();
    if (!t) return null;
    for (const c of COMMANDS) {
        if (c.re.test(t)) return { id: c.id, text: t };
    }
    return null;
}

/* --------------------------------------------------------- זיהוי דיבור */

export class Voice {
    constructor() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.supported = !!SR;
        this.SR = SR;
        this.rec = null;
        this.running = false;
        this.wantRunning = false;
        this.lang = 'he-IL';
        this.onCommand = () => {};
        this.onTranscript = () => {};
        this.onState = () => {};
        this.lastAt = 0;
    }

    start(lang) {
        if (!this.supported) return false;
        if (lang) this.lang = lang;
        this.wantRunning = true;
        this._spin();
        return true;
    }

    stop() {
        this.wantRunning = false;
        if (this.rec) { try { this.rec.stop(); } catch (_) {} }
        this.running = false;
        this.onState(false);
    }

    toggle(lang) { return this.wantRunning ? (this.stop(), false) : (this.start(lang), true); }

    _spin() {
        if (!this.wantRunning || this.running) return;
        const rec = new this.SR();
        rec.lang = this.lang;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 2;

        rec.onstart = () => { this.running = true; this.onState(true); };
        rec.onerror = (e) => {
            // 'no-speech' ו-'aborted' הם שגרתיים - פשוט מתחילים מחדש
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                this.wantRunning = false;
                this.onState(false, 'denied');
            }
        };
        rec.onend = () => {
            this.running = false;
            this.onState(false);
            if (this.wantRunning) setTimeout(() => this._spin(), 350);
        };
        rec.onresult = (ev) => {
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const r = ev.results[i];
                const txt = r[0].transcript;
                if (r.isFinal) {
                    this.onTranscript(txt, true);
                    const hit = matchCommand(txt) || (r[1] && matchCommand(r[1].transcript));
                    if (hit && Date.now() - this.lastAt > 700) {
                        this.lastAt = Date.now();
                        this.onCommand(hit);
                    }
                } else {
                    interim += txt;
                }
            }
            if (interim) this.onTranscript(interim, false);
        };

        this.rec = rec;
        try { rec.start(); } catch (_) { /* כבר רץ */ }
    }
}

/* -------------------------------------------------------------- דיבור */

export class Speaker {
    constructor() {
        this.supported = 'speechSynthesis' in window;
        this.voice = null;
        this.enabled = true;
        this.pitch = 1.15;
        this.rate = 1.0;
        this.onBoundary = () => {};
        this.onEnd = () => {};
        if (this.supported) {
            const pick = () => this.pickVoice();
            pick();
            speechSynthesis.addEventListener('voiceschanged', pick);
        }
    }

    pickVoice() {
        const all = speechSynthesis.getVoices();
        if (!all.length) return;
        this.voices = all;
        this.voice = all.find((v) => /^he/i.test(v.lang) && /female|carmit|כרמית/i.test(v.name))
            || all.find((v) => /^he/i.test(v.lang))
            || all.find((v) => /^en/i.test(v.lang) && /female|samantha|zira/i.test(v.name))
            || all[0];
    }

    say(text, opts = {}) {
        if (!this.supported || !this.enabled || !text) { this.onEnd(); return; }
        try { speechSynthesis.cancel(); } catch (_) {}
        const u = new SpeechSynthesisUtterance(text);
        const heb = /[֐-׿]/.test(text);
        if (this.voice && (heb ? /^he/i.test(this.voice.lang) : true)) u.voice = this.voice;
        else if (this.voices) {
            const alt = this.voices.find((v) => new RegExp('^' + (heb ? 'he' : 'en'), 'i').test(v.lang));
            if (alt) u.voice = alt;
        }
        u.lang = heb ? 'he-IL' : 'en-US';
        u.pitch = opts.pitch || this.pitch;
        u.rate = opts.rate || this.rate;
        u.onboundary = () => this.onBoundary();
        u.onend = () => this.onEnd();
        u.onerror = () => this.onEnd();
        speechSynthesis.speak(u);
        return u;
    }

    shush() { if (this.supported) { try { speechSynthesis.cancel(); } catch (_) {} } }
}

/* ------------------------------------------------------ מד עוצמת קול */

export class AudioMeter {
    constructor() {
        this.level = 0;
        this.beat = 0;
        this.active = false;
        this.ctx = null;
        this.stream = null;
        this._env = 0;
    }

    async start() {
        if (this.active) return true;
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false } });
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            const src = this.ctx.createMediaStreamSource(this.stream);
            this.an = this.ctx.createAnalyser();
            this.an.fftSize = 512;
            this.an.smoothingTimeConstant = 0.72;
            src.connect(this.an);
            this.buf = new Uint8Array(this.an.frequencyBinCount);
            this.active = true;
            return true;
        } catch (_) {
            this.active = false;
            return false;
        }
    }

    stop() {
        if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
        if (this.ctx) this.ctx.close();
        this.stream = this.ctx = null;
        this.active = false;
        this.level = this.beat = 0;
    }

    sample() {
        if (!this.active) return 0;
        this.an.getByteFrequencyData(this.buf);
        // באס = הפעימה; מנרמלים מול ממוצע נע כדי שיעבוד בכל עוצמה
        let bass = 0;
        for (let i = 1; i < 12; i++) bass += this.buf[i];
        bass /= 11 * 255;
        let all = 0;
        for (let i = 0; i < this.buf.length; i++) all += this.buf[i];
        this.level = all / (this.buf.length * 255);
        this._env = this._env * 0.94 + bass * 0.06;
        this.beat = Math.max(0, Math.min(2.2, (bass - this._env) * 7));
        return this.level;
    }
}
