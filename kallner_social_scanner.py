import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote_plus
from email.utils import parsedate_to_datetime
import hashlib
import re

DEFAULT_KEYWORDS = [
    "אריאל קלנר",
    "Ariel Kallner",
    "קלנר ליכוד",
    "ועדת החוקה",
    "תקנון הכנסת",
]

DIRECT_KEYWORDS = {"אריאל קלנר", "Ariel Kallner", "קלנר ליכוד"}

DEFAULT_NITTER_INSTANCES = [
    "https://nitter.net",
    "https://nitter.privacydev.net",
    "https://nitter.poast.org",
]

DEFAULT_FACEBOOK_PAGES = [
    "https://www.facebook.com/KnessetIsrael",
    "https://www.facebook.com/Likud.org.il",
    "https://www.facebook.com/ArielKallner",
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
}

TIMEOUT = 10


def _match_keywords(text, keywords):
    if not text:
        return []
    lowered = text.lower()
    matched = []
    for kw in keywords:
        if kw.lower() in lowered:
            matched.append(kw)
    return matched


def _classify_type(matched_keywords):
    for kw in matched_keywords:
        if kw in DIRECT_KEYWORDS:
            return "direct"
    return "indirect"


def _hash_link(link):
    if not link:
        return None
    return hashlib.md5(link.encode('utf-8', errors='ignore')).hexdigest()


def scan_nitter(query, instances=None, keywords=None):
    if instances is None:
        instances = DEFAULT_NITTER_INSTANCES
    if keywords is None:
        keywords = [query]

    results = []
    last_error = None

    for instance in instances:
        try:
            url = f"{instance}/search?f=tweets&q={quote_plus(query)}"
            response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            tweet_items = soup.select('.timeline-item')
            if not tweet_items:
                last_error = f"No tweets parsed from {instance}"
                continue

            for item in tweet_items:
                content_tag = item.select_one('.tweet-content')
                text = content_tag.get_text(separator=' ', strip=True) if content_tag else ''

                author_tag = item.select_one('.username')
                author = author_tag.get_text(strip=True) if author_tag else 'Unknown'

                date_tag = item.select_one('.tweet-date a')
                date = date_tag.get('title', '') if date_tag else ''
                link_rel = date_tag.get('href', '') if date_tag else ''
                link = f"{instance}{link_rel}" if link_rel.startswith('/') else link_rel

                matched = _match_keywords(text, keywords)
                if not matched:
                    continue

                results.append({
                    'platform': 'Nitter/X',
                    'author': author,
                    'text': text,
                    'link': link,
                    'date': date,
                    'matched_keywords': matched,
                    'type': _classify_type(matched),
                })
            return results
        except requests.exceptions.RequestException as e:
            last_error = f"Nitter instance {instance} failed: {e}"
            print(last_error)
            continue
        except Exception as e:
            last_error = f"Nitter parsing error on {instance}: {e}"
            print(last_error)
            continue

    if last_error:
        print(f"All nitter instances failed. Last error: {last_error}")
    return results


def scan_facebook_public(page_urls=None, keywords=None):
    if page_urls is None:
        page_urls = DEFAULT_FACEBOOK_PAGES
    if keywords is None:
        keywords = DEFAULT_KEYWORDS

    results = []
    for url in page_urls:
        try:
            response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')

            page_text = soup.get_text(separator=' ', strip=True)

            if 'login' in response.url.lower() or 'checkpoint' in response.url.lower():
                print(f"Facebook page {url} blocked (requires login)")
                continue

            matched = _match_keywords(page_text, keywords)
            if not matched:
                continue

            snippets = []
            for kw in matched:
                idx = page_text.lower().find(kw.lower())
                if idx >= 0:
                    start = max(0, idx - 100)
                    end = min(len(page_text), idx + len(kw) + 100)
                    snippets.append(page_text[start:end])

            title_tag = soup.find('title')
            author = title_tag.get_text(strip=True) if title_tag else url

            results.append({
                'platform': 'Facebook',
                'author': author,
                'text': ' | '.join(snippets) if snippets else (page_text[:300] if page_text else ''),
                'link': url,
                'date': '',
                'matched_keywords': matched,
                'type': _classify_type(matched),
            })
        except requests.exceptions.RequestException as e:
            print(f"Facebook page {url} failed: {e}")
            continue
        except Exception as e:
            print(f"Facebook parse error {url}: {e}")
            continue

    return results


def search_google_news(query, lang='he', keywords=None):
    if keywords is None:
        keywords = [query]

    results = []
    try:
        url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl={lang}&gl=IL&ceid=IL:{lang}"
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'xml')

        items = soup.find_all('item')
        for item in items:
            title = item.title.get_text(strip=True) if item.title else ''
            link = item.link.get_text(strip=True) if item.link else ''
            pub_date = item.pubDate.get_text(strip=True) if item.pubDate else ''
            source_tag = item.find('source')
            author = source_tag.get_text(strip=True) if source_tag else 'Google News'

            description = item.description.get_text(strip=True) if item.description else ''
            desc_text = BeautifulSoup(description, 'html.parser').get_text(separator=' ', strip=True)

            combined = f"{title} {desc_text}"
            matched = _match_keywords(combined, keywords)
            if not matched:
                continue

            results.append({
                'platform': 'Google News',
                'author': author,
                'text': title,
                'link': link,
                'date': pub_date,
                'matched_keywords': matched,
                'type': _classify_type(matched),
            })
    except requests.exceptions.RequestException as e:
        print(f"Google News search failed: {e}")
    except Exception as e:
        print(f"Google News parse error: {e}")

    return results


def scan_reddit(keywords=None, subreddits=None):
    if keywords is None:
        keywords = DEFAULT_KEYWORDS
    if subreddits is None:
        subreddits = ['Israel', 'IsraelNews']

    results = []
    for subreddit in subreddits:
        for kw in keywords:
            try:
                url = f"https://www.reddit.com/r/{subreddit}/search.json?q={quote_plus(kw)}&restrict_sr=on&limit=25"
                response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
                response.raise_for_status()
                data = response.json()

                children = data.get('data', {}).get('children', [])
                for child in children:
                    post = child.get('data', {})
                    title = post.get('title', '')
                    selftext = post.get('selftext', '')
                    author = post.get('author', 'unknown')
                    permalink = post.get('permalink', '')
                    link = f"https://www.reddit.com{permalink}" if permalink else post.get('url', '')
                    created_utc = post.get('created_utc', 0)

                    import datetime
                    date = datetime.datetime.utcfromtimestamp(created_utc).isoformat() if created_utc else ''

                    combined = f"{title} {selftext}"
                    matched = _match_keywords(combined, keywords)
                    if not matched:
                        continue

                    results.append({
                        'platform': f'Reddit/r/{subreddit}',
                        'author': author,
                        'text': title + ((' - ' + selftext[:200]) if selftext else ''),
                        'link': link,
                        'date': date,
                        'matched_keywords': matched,
                        'type': _classify_type(matched),
                    })
            except requests.exceptions.RequestException as e:
                print(f"Reddit scan failed for r/{subreddit} q={kw}: {e}")
                continue
            except ValueError as e:
                print(f"Reddit JSON parse error for r/{subreddit}: {e}")
                continue
            except Exception as e:
                print(f"Reddit error r/{subreddit}: {e}")
                continue

    return results


def _deduplicate(findings):
    seen = set()
    unique = []
    for f in findings:
        link = f.get('link', '')
        key = _hash_link(link) if link else hashlib.md5(
            (f.get('text', '') + f.get('author', '')).encode('utf-8', errors='ignore')
        ).hexdigest()
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    return unique


def scan_all_social(keywords=None):
    if keywords is None:
        keywords = DEFAULT_KEYWORDS

    all_findings = []

    tasks = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        for kw in keywords:
            tasks.append(('nitter', kw, executor.submit(scan_nitter, kw, None, keywords)))
            tasks.append(('google_news', kw, executor.submit(search_google_news, kw, 'he', keywords)))

        tasks.append(('facebook', None, executor.submit(scan_facebook_public, None, keywords)))
        tasks.append(('reddit', None, executor.submit(scan_reddit, keywords, None)))

        for source, query, future in tasks:
            try:
                result = future.result(timeout=TIMEOUT * 3)
                if result:
                    all_findings.extend(result)
            except Exception as e:
                print(f"Scanner {source} (q={query}) failed: {e}")
                continue

    return _deduplicate(all_findings)


if __name__ == '__main__':
    findings = scan_all_social()
    print(f"Total findings: {len(findings)}")
    for f in findings[:20]:
        print(f"[{f['platform']}] ({f['type']}) {f['author']}: {f['text'][:120]}... -> {f['link']}")
