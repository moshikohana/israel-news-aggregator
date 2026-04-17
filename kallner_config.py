"""Configuration for the Ariel Kallner monitoring agent.

Defines keyword sets for direct name mentions and for indirect mentions
related to his public activity (committees, legislation, party, topics).
All keywords are public information about a public official (MK).
"""

DIRECT_KEYWORDS = [
    "אריאל קלנר",
    "ח\"כ קלנר",
    "חבר הכנסת קלנר",
    "חה\"כ קלנר",
    "קלנר",
    "Ariel Kallner",
    "Kallner",
]

INDIRECT_KEYWORDS = [
    "ועדת החוקה חוק ומשפט",
    "ועדת החוקה",
    "ועדת הכנסת",
    "תקנון הכנסת",
    "חוק יסוד השפיטה",
    "רפורמה משפטית",
    "הרפורמה המשפטית",
    "הסדרת ההתיישבות",
    "הסדרי התיישבות",
    "סיעת הליכוד",
    "ליכוד כנסת",
    "הצעת חוק קלנר",
    "חוק קלנר",
]

NEWS_SITES = [
    "ynet",
    "n12",
    "kan11",
    "now14",
    "walla",
    "haaretz",
    "israelhayom",
    "maariv",
    "globes",
    "mako",
    "calcalist",
]

TELEGRAM_CHANNELS = [
    "kann_news",
    "ynet_news",
    "N12chat",
    "abualiexpress",
    "hakolhayehudi",
    "channel14il",
    "srugim",
    "israelhayomonline",
    "doronkopel",
    "0404",
]

SOCIAL_PLATFORMS = ["nitter", "google_news", "reddit", "facebook_public"]

FACEBOOK_PUBLIC_PAGES = [
    "https://www.facebook.com/ArielKallner",
    "https://www.facebook.com/LikudIsrael",
    "https://www.facebook.com/KnessetIsrael",
]

CACHE_TTL_SECONDS = 60 * 60 * 24
DEFAULT_TIMEOUT = 10
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def all_keywords():
    return DIRECT_KEYWORDS + INDIRECT_KEYWORDS


def classify(text):
    if not text:
        return None, []
    lower = text
    matched_direct = [k for k in DIRECT_KEYWORDS if k in lower]
    matched_indirect = [k for k in INDIRECT_KEYWORDS if k in lower]
    if matched_direct:
        return "direct", matched_direct + matched_indirect
    if matched_indirect:
        return "indirect", matched_indirect
    return None, []
