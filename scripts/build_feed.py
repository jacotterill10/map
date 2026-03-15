import json
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import feedparser
from bs4 import BeautifulSoup

# Add or remove feeds here.
# Start with a small trusted list.
FEEDS = [
    {
        "name": "Al Jazeera Middle East",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
    },
    # Add more RSS URLs here later
    # {"name": "Example Source", "url": "https://example.com/rss.xml"},
]

# Keep this broad and non-tactical.
KEYWORDS = [
    "drone",
    "missile",
    "rocket",
    "airstrike",
    "strike",
    "explosion",
    "security alert",
    "airspace",
    "intercept",
    "defence",
    "military",
]

MAX_ITEMS = 30
OUTPUT_FILE = Path("feed.json")


def clean_html(value: str) -> str:
    if not value:
        return ""
    soup = BeautifulSoup(value, "html.parser")
    text = soup.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def parse_date(entry) -> str:
    for key in ("published", "updated", "created"):
        value = entry.get(key)
        if value:
            try:
                dt = parsedate_to_datetime(value)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat()
            except Exception:
                pass
    return datetime.now(timezone.utc).isoformat()


def matches_keywords(text: str) -> bool:
    lower = (text or "").lower()
    return any(keyword in lower for keyword in KEYWORDS)


def detect_type(text: str) -> str:
    lower = (text or "").lower()
    if "drone" in lower:
        return "Drone report"
    if "missile" in lower:
        return "Missile report"
    if "rocket" in lower:
        return "Rocket report"
    if "airstrike" in lower or "strike" in lower:
        return "Strike report"
    if "security alert" in lower or "airspace" in lower:
        return "Security alert"
    return "Source report"


def build_item(source_name: str, entry: dict) -> dict:
    title = clean_html(entry.get("title", "Untitled report"))
    summary = clean_html(
        entry.get("summary", "")
        or entry.get("description", "")
        or title
    )
    link = entry.get("link", "")
    date = parse_date(entry)

    combined = f"{title} {summary}"

    return {
        "title": title[:160],
        "date": date,
        "summary": summary[:500],
        "type": detect_type(combined),
        "source": link,
        "sourceName": source_name,
    }


def main():
    items = []
    seen_links = set()

    for feed in FEEDS:
        parsed = feedparser.parse(feed["url"])

        for entry in parsed.entries:
            title = clean_html(entry.get("title", ""))
            summary = clean_html(
                entry.get("summary", "")
                or entry.get("description", "")
            )
            combined = f"{title} {summary}"

            if not matches_keywords(combined):
                continue

            link = entry.get("link", "")
            if not link or link in seen_links:
                continue

            seen_links.add(link)
            items.append(build_item(feed["name"], entry))

    items.sort(key=lambda x: x["date"], reverse=True)
    items = items[:MAX_ITEMS]

    OUTPUT_FILE.write_text(
        json.dumps(items, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Saved {len(items)} items to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
