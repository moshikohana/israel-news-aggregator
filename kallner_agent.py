"""Ariel Kallner monitoring orchestrator.

Coordinates the three scanners (news, Telegram, social) in parallel,
merges findings, deduplicates and ranks them by relevance.
"""

import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from kallner_config import (
    DIRECT_KEYWORDS,
    INDIRECT_KEYWORDS,
    TELEGRAM_CHANNELS,
    FACEBOOK_PUBLIC_PAGES,
    all_keywords,
    classify,
)


def _fingerprint(item):
    key = (item.get("link") or "") + "|" + (item.get("title") or item.get("text") or "")
    return hashlib.sha1(key.encode("utf-8", errors="ignore")).hexdigest()


def _normalize(item, source_type):
    text = item.get("text") or item.get("title") or item.get("snippet") or ""
    mention_type, matched = classify(text)
    return {
        "id": _fingerprint(item),
        "source_type": source_type,
        "source": item.get("source") or item.get("channel") or item.get("platform") or "unknown",
        "title": item.get("title") or (text[:120] + ("..." if len(text) > 120 else "")),
        "text": text,
        "link": item.get("link"),
        "author": item.get("author"),
        "date": item.get("date"),
        "mention_type": mention_type or item.get("type") or "indirect",
        "matched_keywords": matched or item.get("matched_keywords") or [],
        "scan_time": datetime.utcnow().isoformat(),
    }


def _safe_call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs) or []
    except Exception as e:
        print(f"[kallner_agent] {fn.__name__} failed: {e}")
        return []


def run_full_scan(extra_keywords=None):
    """Run all three scanners in parallel and return a merged report."""
    from kallner_news_scanner import scan_all_news_sites
    from kallner_telegram_monitor import search_channels_for_keywords
    from kallner_social_scanner import scan_all_social

    keywords = all_keywords() + (extra_keywords or [])
    started = time.time()

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {
            ex.submit(_safe_call, scan_all_news_sites, keywords): "news",
            ex.submit(_safe_call, search_channels_for_keywords, TELEGRAM_CHANNELS, keywords): "telegram",
            ex.submit(_safe_call, scan_all_social, keywords): "social",
        }
        raw = {"news": [], "telegram": [], "social": []}
        for fut in as_completed(futures):
            raw[futures[fut]] = fut.result()

    merged = []
    seen = set()
    for source_type, items in raw.items():
        for it in items:
            n = _normalize(it, source_type)
            if n["id"] in seen:
                continue
            if not n["mention_type"]:
                continue
            seen.add(n["id"])
            merged.append(n)

    direct = [m for m in merged if m["mention_type"] == "direct"]
    indirect = [m for m in merged if m["mention_type"] == "indirect"]

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "elapsed_seconds": round(time.time() - started, 2),
        "keyword_profile": {
            "direct": DIRECT_KEYWORDS,
            "indirect": INDIRECT_KEYWORDS,
        },
        "counts": {
            "total": len(merged),
            "direct": len(direct),
            "indirect": len(indirect),
            "by_source": {k: len(v) for k, v in raw.items()},
        },
        "direct_mentions": sorted(direct, key=lambda x: x.get("date") or "", reverse=True),
        "indirect_mentions": sorted(indirect, key=lambda x: x.get("date") or "", reverse=True),
    }


if __name__ == "__main__":
    import json
    report = run_full_scan()
    print(json.dumps(report, ensure_ascii=False, indent=2))
