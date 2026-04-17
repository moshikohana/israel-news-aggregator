import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

TELEGRAM_WEB_BASE = 'https://t.me/s/'

DEFAULT_CHANNELS = [
    'kann_news',
    'ynet_news',
    'N12chat',
    'abualiexpress',
    'hakolhayehudi',
    'channel14il',
    'srugim',
    '0404',
    'israelhayomonline',
    'doronkopel',
    'israel_news_channel',
]

DEFAULT_KEYWORDS = [
    'אריאל קלנר',
    'קלנר',
    'ח"כ קלנר',
    'ועדת החוקה',
    'ליכוד',
    'רפורמה משפטית',
    'הסדרי התיישבות',
]

DIRECT_KEYWORDS = [
    'אריאל קלנר',
    'קלנר',
    'ח"כ קלנר',
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}


def fetch_channel_messages(channel_name, limit=50):
    url = f'{TELEGRAM_WEB_BASE}{channel_name}'
    messages = []
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        for item in soup.select('.tgme_widget_message'):
            if limit and len(messages) >= limit:
                break

            text_tag = item.select_one('.tgme_widget_message_text')
            text = text_tag.get_text(separator=' ', strip=True) if text_tag else ''

            date_tag = item.select_one('.tgme_widget_message_date time')
            date = date_tag.get('datetime') if date_tag else 'No date found'

            link_tag = item.select_one('.tgme_widget_message_date')
            link = link_tag.get('href') if link_tag else ''

            views_tag = item.select_one('.tgme_widget_message_views')
            views = views_tag.get_text(strip=True) if views_tag else '0'

            if not text:
                continue

            messages.append({
                'text': text,
                'date': date,
                'link': link,
                'views': views,
                'channel': channel_name,
            })

        return messages
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the Telegram channel {channel_name}: {e}")
        return []


def classify_mention(message, keywords):
    text = message.get('text', '')
    direct_terms = [kw for kw in keywords if kw in DIRECT_KEYWORDS]
    if not direct_terms:
        direct_terms = DIRECT_KEYWORDS

    for term in direct_terms:
        if term in text:
            return 'direct'
    return 'indirect'


def _message_matches_keywords(message, keywords):
    text = message.get('text', '')
    if not text:
        return False
    for keyword in keywords:
        if keyword in text:
            return True
    return False


def search_channels_for_keywords(channels, keywords, limit_per_channel=50, max_workers=8):
    if not channels:
        channels = DEFAULT_CHANNELS
    if not keywords:
        keywords = DEFAULT_KEYWORDS

    matches = []
    seen_links = set()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_channel = {
            executor.submit(fetch_channel_messages, channel, limit_per_channel): channel
            for channel in channels
        }

        for future in as_completed(future_to_channel):
            channel = future_to_channel[future]
            try:
                channel_messages = future.result()
            except Exception as e:
                print(f"Error processing channel {channel}: {e}")
                continue

            for message in channel_messages:
                link = message.get('link', '')
                if link and link in seen_links:
                    continue
                if link:
                    seen_links.add(link)

                if _message_matches_keywords(message, keywords):
                    message['mention_type'] = classify_mention(message, keywords)
                    matches.append(message)

    return matches


def get_kallner_mentions(extra_channels=None, extra_keywords=None, limit_per_channel=50):
    channels = list(DEFAULT_CHANNELS)
    if extra_channels:
        for ch in extra_channels:
            if ch not in channels:
                channels.append(ch)

    keywords = list(DEFAULT_KEYWORDS)
    if extra_keywords:
        for kw in extra_keywords:
            if kw not in keywords:
                keywords.append(kw)

    return search_channels_for_keywords(channels, keywords, limit_per_channel=limit_per_channel)


if __name__ == '__main__':
    results = get_kallner_mentions()
    print(f"Found {len(results)} matching messages")
    for msg in results:
        print(f"[{msg['mention_type']}] {msg['channel']} ({msg['date']}): {msg['text'][:120]}...")
        print(f"  Link: {msg['link']} | Views: {msg['views']}")
