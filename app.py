import requests
from bs4 import BeautifulSoup
from flask import Flask, render_template, jsonify
from collections import defaultdict
import difflib
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from data.polls_data import ELECTIONS, POLLS

app = Flask(__name__)

seen_titles_ynet = set()
seen_titles_n12 = set()
seen_titles_kan11 = set()
seen_titles_now14 = set()

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def fetch_article_details_ynet(url):
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        
        author_tag = soup.find('div', class_='authors')
        author = author_tag.get_text(strip=True) if author_tag else 'No author found'

        date_tag = soup.find('time', class_='DateDisplay')
        date = date_tag.get_text(strip=True) if date_tag else 'No current date found'

        return date, author
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the article details from {url}: {e}")
        return 'No current date found', 'No author found'

def fetch_article_details_n12(url):
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        date_tag = soup.find('div', class_='date')
        date = date_tag.get_text(strip=True) if date_tag else 'No current date found'

        author_tag = soup.find('div', class_='author')
        author = author_tag.get_text(strip=True) if author_tag else 'No author found'

        return date, author
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the article details from {url}: {e}")
        return 'No current date found', 'No author found'

def fetch_article_details_kan11(url):
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        date_tag = soup.find('time', class_='ArticleTimestamp')
        date = date_tag.get_text(strip=True) if date_tag else 'No current date found'

        author_tag = soup.find('div', class_='ArticleAuthor')
        author = author_tag.get_text(strip=True) if author_tag else 'No author found'

        return date, author
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the article details from {url}: {e}")
        return 'No current date found', 'No author found'

def fetch_article_details_now14(url):
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        date_tag = soup.find('span', class_='posted-on')
        date = date_tag.get_text(strip=True) if date_tag else 'No current date found'

        author_tag = soup.find('span', class_='author vcard')
        author = author_tag.get_text(strip=True) if author_tag else 'No author found'

        return date, author
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the article details from {url}: {e}")
        return 'No current date found', 'No author found'

def get_ynet_articles(start=0, limit=10):
    url = 'https://www.ynet.co.il/home/0,7340,L-8,00.html'
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        content = response.content.decode('utf-8')
        soup = BeautifulSoup(content, 'html.parser')

        articles = []
        for index, item in enumerate(soup.select('.slotView')):
            if index < start:
                continue
            if limit and len(articles) >= limit:
                break
            
            link_tag = item.find('a')
            if not link_tag:
                continue

            title = link_tag.get_text(separator=' ', strip=True).replace('\n', ' ')
            title = (title[:75] + '...') if len(title) > 75 else title

            if not title or title in seen_titles_ynet:
                continue
            seen_titles_ynet.add(title)

            link = link_tag['href']
            if link and link.startswith('/'):
                link = 'https://www.ynet.co.il' + link

            date, author = fetch_article_details_ynet(link)
            articles.append({'title': title, 'link': link, 'date': date, 'author': author, 'source': 'YNET'})

        return articles
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")
        return []

def get_n12_articles(start=0, limit=10):
    url = 'https://www.n12.co.il/'
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        content = response.content.decode('utf-8')
        soup = BeautifulSoup(content, 'html.parser')

        articles = []
        for index, item in enumerate(soup.select('.grid-ordering.main1 a')):
            if index < start:
                continue
            if limit and len(articles) >= limit:
                break

            title = item.get_text(strip=True)
            if not title or title in seen_titles_n12:
                continue
            seen_titles_n12.add(title)

            link = item['href']
            if link and link.startswith('/'):
                link = 'https://www.n12.co.il' + link

            date, author = fetch_article_details_n12(link)
            articles.append({'title': title, 'link': link, 'date': date, 'author': author, 'source': 'N12'})

        return articles
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")
        return []

def get_kan11_articles(start=0, limit=10):
    url = 'https://www.kan.org.il/'
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        content = response.content.decode('utf-8')
        soup = BeautifulSoup(content, 'html.parser')

        articles = []
        for index, item in enumerate(soup.select('.articles-simple.grid-xs-2.list-unstyled.mb-0 a')):
            if index < start:
                continue
            if limit and len(articles) >= limit:
                break

            title = item.get_text(strip=True)
            if not title or title in seen_titles_kan11:
                continue
            seen_titles_kan11.add(title)

            link = item['href']
            if link and link.startswith('/'):
                link = 'https://www.kan.org.il' + link

            date, author = fetch_article_details_kan11(link)
            articles.append({'title': title, 'link': link, 'date': date, 'author': author, 'source': 'KAN11'})

        return articles
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")
        return []

def get_now14_articles(start=0, limit=10):
    url = 'https://www.now14.co.il/'
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        content = response.content.decode('utf-8')
        soup = BeautifulSoup(content, 'html.parser')

        articles = []
        for index, item in enumerate(soup.select('#ketanim-posts a, #under-ketanim a')):
            if index < start:
                continue
            if limit and len(articles) >= limit:
                break

            title = item.get_text(strip=True)
            if title == 'No Tag To Print':
                continue

            if not title or title in seen_titles_now14:
                continue
            seen_titles_now14.add(title)

            link = item['href']
            if link and link.startswith('/'):
                link = 'https://www.now14.co.il' + link

            date, author = fetch_article_details_now14(link)
            articles.append({'title': title, 'link': link, 'date': date, 'author': author, 'source': 'Now14'})

        return articles
    except requests.exceptions.RequestException as e:
        print(f"Error fetching the URL: {e}")
        return []

def group_articles_by_title(articles):
    grouped_articles = defaultdict(list)
    for article in articles:
        matched = False
        for key in list(grouped_articles.keys()):
            if difflib.SequenceMatcher(None, article['title'], key).ratio() > 0.5:
                grouped_articles[key].append(article)
                matched = True
                break
        if not matched:
            grouped_articles[article['title']].append(article)
    grouped_articles = {k: v for k, v in grouped_articles.items() if len(v) > 1}
    return grouped_articles

def get_all_articles():
    ynet_articles = get_ynet_articles()
    n12_articles = get_n12_articles()
    kan11_articles = get_kan11_articles()
    now14_articles = get_now14_articles()

    all_articles = ynet_articles + n12_articles + kan11_articles + now14_articles
    grouped_articles = group_articles_by_title(all_articles)
    return grouped_articles

@app.route('/')
def home():
    global seen_titles_ynet, seen_titles_n12, seen_titles_kan11, seen_titles_now14
    seen_titles_ynet = set()
    seen_titles_n12 = set()
    seen_titles_kan11 = set()
    seen_titles_now14 = set()
    ynet_articles = get_ynet_articles(limit=3)
    n12_articles = get_n12_articles(limit=3)
    kan11_articles = get_kan11_articles(limit=3)
    now14_articles = get_now14_articles(limit=3)
    grouped_articles = get_all_articles()
    return render_template('home.html', ynet_articles=ynet_articles, n12_articles=n12_articles, kan11_articles=kan11_articles, now14_articles=now14_articles, grouped_articles=grouped_articles)

@app.route('/more_ynet_articles/<int:start>')
def more_ynet_articles(start):
    articles = get_ynet_articles(start=start, limit=5)
    return jsonify(articles)

@app.route('/more_n12_articles/<int:start>')
def more_n12_articles(start):
    articles = get_n12_articles(start=start, limit=5)
    return jsonify(articles)

@app.route('/more_kan11_articles/<int:start>')
def more_kan11_articles(start):
    articles = get_kan11_articles(start=start, limit=5)
    return jsonify(articles)

@app.route('/more_now14_articles/<int:start>')
def more_now14_articles(start):
    articles = get_now14_articles(start=start, limit=5)
    return jsonify(articles)

def calculate_poll_mae(poll, election):
    errors = []
    results = election["results"]
    all_parties = set(poll["predictions"]) | set(results)
    for party in all_parties:
        predicted = poll["predictions"].get(party, 0)
        actual = results.get(party, 0)
        errors.append(abs(predicted - actual))
    return round(sum(errors) / len(errors), 2) if errors else 0


def calculate_poll_bias(poll, election):
    diffs = []
    for party, predicted in poll["predictions"].items():
        actual = election["results"].get(party, 0)
        diffs.append(predicted - actual)
    return round(sum(diffs) / len(diffs), 2) if diffs else 0


def get_pollster_rankings():
    pollster_data = defaultdict(lambda: {"maes": [], "elections": 0})
    for poll in POLLS:
        election = ELECTIONS.get(poll["election_id"])
        if not election:
            continue
        mae = calculate_poll_mae(poll, election)
        bias = calculate_poll_bias(poll, election)
        p = pollster_data[poll["pollster"]]
        p["maes"].append(mae)
        p["elections"] += 1
        p.setdefault("biases", []).append(bias)

    rankings = []
    for name, data in pollster_data.items():
        avg_mae = round(sum(data["maes"]) / len(data["maes"]), 2)
        avg_bias = round(sum(data["biases"]) / len(data["biases"]), 2)
        rankings.append({
            "name": name,
            "elections": data["elections"],
            "avg_mae": avg_mae,
            "avg_bias": avg_bias,
        })
    rankings.sort(key=lambda x: x["avg_mae"])
    for i, r in enumerate(rankings):
        r["rank"] = i + 1
    return rankings


def get_elections_detail():
    result = []
    for eid, election in ELECTIONS.items():
        election_polls = []
        for poll in POLLS:
            if poll["election_id"] != eid:
                continue
            e = ELECTIONS[eid]
            mae = calculate_poll_mae(poll, e)
            bias = calculate_poll_bias(poll, e)
            party_rows = []
            all_parties = sorted(
                set(poll["predictions"]) | set(e["results"]),
                key=lambda p: e["results"].get(p, 0),
                reverse=True,
            )
            for party in all_parties:
                predicted = poll["predictions"].get(party)
                actual = e["results"].get(party, 0)
                if predicted is None:
                    continue
                diff = predicted - actual
                party_rows.append({
                    "party": party,
                    "predicted": predicted,
                    "actual": actual,
                    "diff": diff,
                })
            election_polls.append({
                "pollster": poll["pollster"],
                "poll_date": poll["poll_date"],
                "mae": mae,
                "bias": bias,
                "parties": party_rows,
            })
        election_polls.sort(key=lambda x: x["mae"])
        result.append({
            "id": eid,
            "name": election["name"],
            "date": election["date"],
            "results": election["results"],
            "polls": election_polls,
        })
    result.sort(key=lambda x: x["date"], reverse=True)
    return result


@app.route('/skarim')
def polls_tracker():
    rankings = get_pollster_rankings()
    elections = get_elections_detail()
    return render_template('polls_tracker.html', rankings=rankings, elections=elections)


if __name__ == '__main__':
    app.run(debug=True)
