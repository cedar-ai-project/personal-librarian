#!/usr/bin/env python3
"""Snapshot WeChat Reading (微信读书) statistics into profile/reading-stats.json.

Run from the personal-librarian repository root:
    python3 <skill-dir>/scripts/fetch_reading_stats.py

Requires the WEREAD_API_KEY environment variable. Only aggregated statistics are written;
book lists (top books, start/finish/last-read times) are limited to books that exist under notes/ or reflections/.
"""

import datetime
import json
import os
import pathlib
import re
import sys
import urllib.request

GATEWAY = "https://i.weread.qq.com/api/agent/gateway"
SKILL_VERSION = "1.0.6"
TZ = datetime.timezone(datetime.timedelta(hours=8))
OUTPUT = pathlib.Path("profile") / "reading-stats.json"


def call(api_name: str, **params) -> dict:
    body = json.dumps({"api_name": api_name, **params, "skill_version": SKILL_VERSION}).encode()
    req = urllib.request.Request(GATEWAY, data=body, headers={
        "Authorization": f"Bearer {os.environ['WEREAD_API_KEY']}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def local_books() -> dict[str, str | None]:
    """Book directory name -> WeChat Reading reader link (if known)."""
    books: dict[str, str | None] = {}
    for root in ("notes", "reflections"):
        for d in sorted(pathlib.Path(root).iterdir()):
            if not d.is_dir():
                continue
            link = books.get(d.name)
            notes = d / "划线与想法.md"
            meta = d / "meta.json"
            if notes.exists():
                m = re.search(r"^- 来源：\[[^\]]*\]\(([^)]+)\)", notes.read_text(encoding="utf-8"), re.M)
                link = link or (m and m.group(1))
            if meta.exists():
                link = link or json.loads(meta.read_text(encoding="utf-8")).get("link")
            books[d.name] = link
    return books


def match(book: dict, books: dict[str, str | None]) -> str | None:
    """Map an API book to a local directory name: reader link first, then title."""
    title = book.get("title", "")
    for name, link in books.items():
        if link and link == book.get("readerLink"):
            return name
    for name in books:
        if title == name or re.match(re.escape(name) + r"[（(：:]", title):
            return name
    return None


def book_id_by_link(name: str, link: str, notebooks: list[dict]) -> str | None:
    """Find the bookId for a reader link: books with notes first, then a title search."""
    for item in notebooks:
        if (item.get("book") or {}).get("readerLink") == link:
            return item.get("bookId")
    res = call("/store/search", keyword=name, scope=10, count=5, context=f"为阅读画像查找《{name}》的阅读进度")
    for group in res.get("results", []):
        for b in group.get("books", []):
            info = b.get("bookInfo", b)
            if info.get("readerLink") == link:
                return info.get("bookId")
    return None


def count(stats: list[dict], name: str) -> int | None:
    for s in stats:
        if s.get("stat") == name:
            m = re.match(r"\d+", s.get("counts", ""))
            return int(m.group()) if m else None
    return None


def main() -> None:
    if not os.environ.get("WEREAD_API_KEY"):
        sys.exit("WEREAD_API_KEY is not set: export WEREAD_API_KEY=<your_api_key>")
    if not pathlib.Path("notes").is_dir():
        sys.exit("Run this script from the personal-librarian repository root.")

    books = local_books()
    overall = call("/readdata/detail", mode="overall", baseTime=0)
    shelf = call("/shelf/sync")

    yearly = [
        {"year": datetime.datetime.fromtimestamp(int(ts), TZ).year, "readTime": secs}
        for ts, secs in sorted((overall.get("readTimes") or {}).items(), key=lambda kv: int(kv[0]))
    ]
    # Drop empty years before the first year with reading time.
    while yearly and not yearly[0]["readTime"]:
        yearly.pop(0)

    # preferTime starts at 06:00; re-index it so hourly[h] is the reading time at hour h.
    prefer_time = overall.get("preferTime") or []
    hourly = [0] * 24
    for i, secs in enumerate(prefer_time):
        hourly[(6 + i) % 24] = secs

    top_books = []
    for item in overall.get("readLongest", []):
        name = match(item.get("book") or {}, books)
        if name:
            top_books.append({"title": name, "readTime": item.get("readTime", 0), "tags": item.get("tags", [])})

    # Per-book reading times: bookId from the shelf, or (for books removed from it) via the reader link.
    shelf_books = {}
    for book in shelf.get("books", []):
        name = match(book, books)
        if name:
            shelf_books[name] = book
    notebooks = call("/user/notebooks", count=100).get("books", [])
    last_read = {}
    for name, link in books.items():
        shelf_book = shelf_books.get(name, {})
        book_id = shelf_book.get("bookId") or (link and book_id_by_link(name, link, notebooks))
        progress = (call("/book/getprogress", bookId=book_id).get("book") or {}) if book_id else {}
        last_read_at = shelf_book.get("readUpdateTime") or progress.get("updateTime")
        if not last_read_at:
            continue
        last_read[name] = {
            "startedAt": progress.get("startReadingTime") or None,
            "finishedAt": progress.get("finishTime") or None,
            "lastReadAt": last_read_at,
            "finished": shelf_book.get("finishReading") == 1 or bool(progress.get("finishTime")),
        }

    read_stat = overall.get("readStat", [])
    data = {
        "snapshotDate": datetime.datetime.now(TZ).date().isoformat(),
        "registTime": overall.get("registTime"),
        "overview": {
            "totalReadTime": overall.get("totalReadTime"),
            "readDays": overall.get("readDays"),
            "readCount": count(read_stat, "读过"),
            "finishCount": count(read_stat, "读完"),
            "noteCount": count(read_stat, "笔记"),
        },
        "yearly": yearly,
        "categories": [
            {"title": c["categoryTitle"], "parent": c.get("parentCategoryTitle"), "readTime": c.get("readingTime", 0), "count": c.get("readingCount", 0)}
            for c in overall.get("preferCategory", [])
            if c.get("readingTime")
        ],
        "preferCategoryWord": overall.get("preferCategoryWord"),
        "hourly": hourly,
        "preferTimeWord": overall.get("preferTimeWord"),
        "topBooks": top_books,
        "books": dict(sorted(last_read.items())),
    }

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = sorted(set(books) - set(last_read))
    print(f"Wrote {OUTPUT}: {len(top_books)} top books, reading times for {len(last_read)}/{len(books)} books")
    if missing:
        print("No reading time from WeChat Reading for: " + "、".join(missing) + " (set \"readAt\": \"YYYY-MM\" in reflections/<book>/meta.json)")


if __name__ == "__main__":
    main()
