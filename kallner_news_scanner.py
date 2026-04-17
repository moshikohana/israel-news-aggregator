"""
kallner_news_scanner.py
-----------------------

Module for scanning Israeli news websites (YNET, N12, KAN11, Now14, Walla,
Haaretz, Calcalist, Maariv, Israel Hayom, Globes, Mako) for mentions of
MK Ariel Kallner ("אריאל קלנר").

The module supports both RSS feeds (preferred) and HTML scraping fallbacks,
runs site scans in parallel using ThreadPoolExecutor, classifies each mention
as direct (explicit name) or indirect (policy topics he is associated with),
and maintains a simple in-memory cache with a 24-hour TTL to avoid duplicates.

Typical usage:

    from kallner_news_scanner import scan_all_news_sites, build_search_queries

    queries = build_search_queries()
    articles = scan_all_news_sites(queries)
    for a in articles:
        print(a["source"], a["title"], a["matched_keywords"])
"""

from __future__ import annotations

import concurrent.futures
import hashlib
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

try:
    import feedparser  # type: ignore
    _FEEDPARSER_AVAILABLE = True
except ImportError:  # pragma: no cover
    feedparser = None  # type: ignore
    _FEEDPARSER_AVAILABLE = False


logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REQUEST_TIMEOUT = 10  # seconds
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours
MAX_WORKERS = 8
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 "
    "KallnerNewsScanner/1.0"
)
HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept-Language": "he,en;q=0.8",
}


# Default search queries. The dict is structured so callers can extend or
# override any category. `build_search_queries()` flattens it to a list.
DEFAULT_QUERIES: Dict[str, List[str]] = {
    "direct_name": [
        "אריאל קלנר",
        'ח"כ קלנר',
        "ח״כ קלנר",
        "חבר הכנסת קלנר",
        "חבר הכנסת אריאל קלנר",
        "קלנר",
    ],
    "party": [
        "ליכוד",
    ],
    "committees": [
        "ועדת החוקה",
        "ועדת החוקה חוק ומשפט",
        "ועדת הכנסת",
    ],
    "legislation_topics": [
        "חוק יסוד השפיטה",
        "רפורמה משפטית",
        "הרפורמה המשפטית",
        "הסדרי התיישבות",
        "תקנון הכנסת",
    ],
}

# Any query classified as indirect (subject/role based, not explicit name).
_INDIRECT_CATEGORIES = {"party", "committees", "legislation_topics"}


# Site definitions. Each site has an optional list of RSS feeds (preferred)
# and an HTML fallback (listing URL + CSS selector for article links).
SITE_CONFIG: Dict[str, Dict] = {
    "YNET": {
        "rss": [
            "https://www.ynet.co.il/Integration/StoryRss2.xml",
            "https://www.ynet.co.il/Integration/StoryRss1854.xml",  # news
        ],
        "html": {
            "url": "https://www.ynet.co.il/news",
            "selector": "a",
            "base": "https://www.ynet.co.il",
        },
    },
    "N12": {
        "rss": [],
        "html": {
            "url": "https://www.n12.co.il/",
            "selector": "a",
            "base": "https://www.n12.co.il",
        },
    },
    "KAN11": {
        "rss": [
            "https://www.kan.org.il/rss/news.xml",
        ],
        "html": {
            "url": "https://www.kan.org.il/",
            "selector": "a",
            "base": "https://www.kan.org.il",
        },
    },
    "Now14": {
        "rss": [],
        "html": {
            "url": "https://www.now14.co.il/",
            "selector": "a",
            "base": "https://www.now14.co.il",
        },
    },
    "Walla": {
        "rss": [
            "https://rss.walla.co.il/feed/1?type=main",
            "https://rss.walla.co.il/feed/22",  # news
        ],
        "html": {
            "url": "https://news.walla.co.il/",
            "selector": "a",
            "base": "https://news.walla.co.il",
        },
    },
    "Haaretz": {
        "rss": [
            "https://www.haaretz.co.il/srv/htz---all-content",
            "https://www.haaretz.co.il/cmlink/1.1470869",  # news
        ],
        "html": {
            "url": "https://www.haaretz.co.il/news",
            "selector": "a",
            "base": "https://www.haaretz.co.il",
        },
    },
    "Calcalist": {
        "rss": [
            "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml",
        ],
        "html": {
            "url": "https://www.calcalist.co.il/",
            "selector": "a",
            "base": "https://www.calcalist.co.il",
        },
    },
    "Maariv": {
        "rss": [
            "https://www.maariv.co.il/Rss/RssFeedsAsara",
            "https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot",
        ],
        "html": {
            "url": "https://www.maariv.co.il/",
            "selector": "a",
            "base": "https://www.maariv.co.il",
        },
    },
    "IsraelHayom": {
        "rss": [
            "https://www.israelhayom.co.il/rss.xml",
        ],
        "html": {
            "url": "https://www.israelhayom.co.il/",
            "selector": "a",
            "base": "https://www.israelhayom.co.il",
        },
    },
    "Globes": {
        "rss": [
            "https://www.globes.co.il/WebService/rss/rssfeeder.asmx/FeedsRSS?iID=585",
        ],
        "html": {
            "url": "https://www.globes.co.il/news/",
            "selector": "a",
            "base": "https://www.globes.co.il",
        },
    },
    "Mako": {
        "rss": [
            "https://rcs.mako.co.il/rss/news-israel.xml",
            "https://rcs.mako.co.il/rss/news-military.xml",
        ],
        "html": {
            "url": "https://www.mako.co.il/news",
            "selector": "a",
            "base": "https://www.mako.co.il",
        },
    },
}


# ---------------------------------------------------------------------------
# Simple TTL cache to prevent duplicates across scans
# ---------------------------------------------------------------------------

# Maps hash(title + link) -> inserted_at (epoch seconds)
_seen_cache: Dict[str, float] = {}


def _cache_key(title: str, link: str) -> str:
    """Hash a (title, link) pair for use as cache key."""
    raw = f"{(title or '').strip()}||{(link or '').strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _cache_is_fresh(key: str, now: Optional[float] = None) -> bool:
    """True iff the key exists in the cache and hasn't exceeded its TTL."""
    now = now if now is not None else time.time()
    ts = _seen_cache.get(key)
    if ts is None:
        return False
    if now - ts > CACHE_TTL_SECONDS:
        _seen_cache.pop(key, None)
        return False
    return True


def _cache_add(key: str) -> None:
    _seen_cache[key] = time.time()


def clear_cache() -> None:
    """Wipe the duplicate-prevention cache (useful in tests)."""
    _seen_cache.clear()


def _purge_stale_cache() -> None:
    """Remove entries older than CACHE_TTL_SECONDS."""
    now = time.time()
    stale = [k for k, ts in _seen_cache.items() if now - ts > CACHE_TTL_SECONDS]
    for k in stale:
        _seen_cache.pop(k, None)


# ---------------------------------------------------------------------------
# Public: query construction
# ---------------------------------------------------------------------------

def build_search_queries(
    extra: Optional[Dict[str, Iterable[str]]] = None,
) -> List[str]:
    """
    Return a flat, de-duplicated list of search query strings.

    The default categories cover Ariel Kallner's direct name variants as well
    as topics he is known to work on (Likud party, Constitution Committee,
    Knesset Committee, Basic Law: The Judiciary, the judicial reform,
    settlement arrangements, Knesset bylaws).

    Callers can pass `extra` to extend any existing category or add new ones::

        build_search_queries(extra={"committees": ["ועדת הכספים"]})
    """
    merged: Dict[str, List[str]] = {k: list(v) for k, v in DEFAULT_QUERIES.items()}
    if extra:
        for cat, values in extra.items():
            merged.setdefault(cat, []).extend(values)

    out: List[str] = []
    seen = set()
    for values in merged.values():
        for q in values:
            q_clean = (q or "").strip()
            if not q_clean or q_clean in seen:
                continue
            seen.add(q_clean)
            out.append(q_clean)
    return out


def _category_for_query(query: str) -> str:
    """Return the category name that a query belongs to (or 'custom')."""
    for cat, values in DEFAULT_QUERIES.items():
        if query in values:
            return cat
    return "custom"


# ---------------------------------------------------------------------------
# Matching / classification
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    """Lowercase + collapse whitespace for fuzzy text matching."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip().lower()


def _match_queries(text: str, queries: Iterable[str]) -> List[str]:
    """Return the subset of `queries` that appear (substring) in `text`."""
    norm = _normalize(text)
    if not norm:
        return []
    matched: List[str] = []
    for q in queries:
        if q and q.lower() in norm:
            matched.append(q)
    return matched


def classify_mention(article: Dict, queries: Iterable[str]) -> str:
    """
    Classify an article mention as 'direct' or 'indirect'.

    - 'direct'   : at least one matched keyword is an explicit name variant
                   (from the `direct_name` category).
    - 'indirect' : only policy/topic keywords matched (party, committees,
                   legislation topics, or other custom categories).

    Unknown / empty matches return 'indirect' as the most conservative label.
    """
    matched = article.get("matched_keywords") or []
    if not matched:
        # Fall back to re-matching title+snippet if caller didn't pre-populate.
        haystack = " ".join(
            [article.get("title", ""), article.get("snippet", "")]
        )
        matched = _match_queries(haystack, queries)

    direct_names = set(DEFAULT_QUERIES["direct_name"])
    for m in matched:
        if m in direct_names:
            return "direct"
    return "indirect"


# ---------------------------------------------------------------------------
# Fetching helpers
# ---------------------------------------------------------------------------

def _http_get(url: str) -> Optional[requests.Response]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp
    except requests.RequestException as exc:
        logger.warning("HTTP error for %s: %s", url, exc)
        return None


def _parse_rss(feed_url: str) -> List[Dict]:
    """
    Parse an RSS/Atom feed and return a list of normalized article dicts
    with keys: title, link, snippet, date.
    """
    if not _FEEDPARSER_AVAILABLE:
        logger.debug("feedparser not installed; skipping RSS for %s", feed_url)
        return []
    try:
        # feedparser accepts a URL directly, but going through requests gives
        # us consistent headers + timeouts.
        resp = _http_get(feed_url)
        if resp is None:
            return []
        parsed = feedparser.parse(resp.content)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to parse RSS %s: %s", feed_url, exc)
        return []

    entries: List[Dict] = []
    for entry in getattr(parsed, "entries", []) or []:
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or "").strip()
        snippet = (
            entry.get("summary")
            or entry.get("description")
            or ""
        )
        # Strip HTML from snippet if present.
        if snippet and ("<" in snippet and ">" in snippet):
            try:
                snippet = BeautifulSoup(snippet, "html.parser").get_text(
                    separator=" ", strip=True
                )
            except Exception:
                pass

        date_str = (
            entry.get("published")
            or entry.get("updated")
            or entry.get("pubDate")
            or ""
        )
        entries.append(
            {
                "title": title,
                "link": link,
                "snippet": snippet,
                "date": date_str,
            }
        )
    return entries


def _parse_html_listing(site_name: str, cfg: Dict) -> List[Dict]:
    """Scrape a site homepage/listing for candidate article links."""
    html_cfg = cfg.get("html") or {}
    url = html_cfg.get("url")
    if not url:
        return []
    resp = _http_get(url)
    if resp is None:
        return []

    try:
        soup = BeautifulSoup(resp.content, "html.parser")
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to parse HTML for %s: %s", site_name, exc)
        return []

    base = html_cfg.get("base") or url
    selector = html_cfg.get("selector") or "a"

    seen_links = set()
    entries: List[Dict] = []
    for link_tag in soup.select(selector):
        href = link_tag.get("href") or ""
        title = link_tag.get_text(separator=" ", strip=True)
        if not href or not title:
            continue
        # Skip obvious non-article links.
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        full_link = href if href.startswith("http") else urljoin(base, href)
        if full_link in seen_links:
            continue
        seen_links.add(full_link)
        entries.append(
            {
                "title": title,
                "link": full_link,
                "snippet": "",
                "date": "",
            }
        )
    return entries


# ---------------------------------------------------------------------------
# Public: per-site and aggregate scanning
# ---------------------------------------------------------------------------

def scan_site(site_name: str, search_queries: Iterable[str]) -> List[Dict]:
    """
    Scan a single configured site for articles matching any of `search_queries`.

    Returns a list of article dicts; an empty list on any error or when the
    site produces no matches. A failing site never raises out of this call.
    """
    cfg = SITE_CONFIG.get(site_name) or SITE_CONFIG.get(site_name.upper()) or SITE_CONFIG.get(site_name.lower())
    if not cfg:
        logger.warning("Unknown site: %s", site_name)
        return []

    queries = list(search_queries)
    if not queries:
        return []

    candidates: List[Dict] = []

    # 1. Prefer RSS feeds where available.
    for feed_url in cfg.get("rss", []) or []:
        try:
            candidates.extend(_parse_rss(feed_url))
        except Exception as exc:  # defensive: never let a site crash the scan
            logger.warning("RSS failure for %s (%s): %s", site_name, feed_url, exc)

    # 2. Fall back to (or supplement with) HTML listing.
    if not candidates:
        try:
            candidates.extend(_parse_html_listing(site_name, cfg))
        except Exception as exc:
            logger.warning("HTML failure for %s: %s", site_name, exc)

    scan_time = datetime.now(timezone.utc).isoformat()
    results: List[Dict] = []
    for item in candidates:
        title = item.get("title", "")
        link = item.get("link", "")
        snippet = item.get("snippet", "")
        haystack = f"{title} \n {snippet}"

        matched = _match_queries(haystack, queries)
        if not matched:
            continue

        key = _cache_key(title, link)
        if _cache_is_fresh(key):
            continue
        _cache_add(key)

        article = {
            "title": title,
            "link": link,
            "source": site_name,
            "matched_keywords": matched,
            "snippet": snippet,
            "date": item.get("date", ""),
            "scan_time": scan_time,
        }
        article["classification"] = classify_mention(article, queries)
        results.append(article)

    logger.info("Scanned %s: %d match(es)", site_name, len(results))
    return results


def scan_all_news_sites(queries: Optional[Iterable[str]] = None) -> List[Dict]:
    """
    Concurrently scan every configured news site.

    Args:
        queries: iterable of query strings. If None, `build_search_queries()`
                 is used.

    Returns:
        A unified list of article dicts. Each dict has:
            title, link, source, matched_keywords, snippet, date,
            scan_time, classification.
    """
    _purge_stale_cache()
    q_list = list(queries) if queries is not None else build_search_queries()

    all_results: List[Dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        future_map = {
            pool.submit(scan_site, site, q_list): site
            for site in SITE_CONFIG.keys()
        }
        for future in concurrent.futures.as_completed(future_map):
            site = future_map[future]
            try:
                site_results = future.result()
                all_results.extend(site_results)
            except Exception as exc:
                # scan_site already handles its own errors, but just in case.
                logger.warning("Unexpected error scanning %s: %s", site, exc)

    logger.info(
        "scan_all_news_sites complete: %d total article(s) across %d sites",
        len(all_results),
        len(SITE_CONFIG),
    )
    return all_results


# ---------------------------------------------------------------------------
# CLI entrypoint for quick manual testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":  # pragma: no cover
    import json

    articles = scan_all_news_sites()
    print(json.dumps(articles, ensure_ascii=False, indent=2))
    print(f"\nTotal matches: {len(articles)}")
