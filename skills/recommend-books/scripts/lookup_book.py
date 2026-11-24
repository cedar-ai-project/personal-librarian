#!/usr/bin/env python3
"""Look up candidate books on WeChat Reading to verify availability, rating, cover and link.

    python3 lookup_book.py 漫步华尔街 投资最重要的事     # top search hits per title
    python3 lookup_book.py --id 3300114108               # full info (with intro) for one bookId

Prints JSON. Requires WEREAD_API_KEY.
"""

import json
import sys

from weread import call, rating_percent


def summarize(info: dict) -> dict:
    return {
        "bookId": info.get("bookId"),
        "title": info.get("title"),
        "author": info.get("author"),
        "rating": rating_percent(info.get("newRating")),
        "ratingCount": info.get("newRatingCount"),
        "ratingTitle": (info.get("newRatingDetail") or {}).get("title") or None,
        "link": info.get("readerLink") or info.get("deepLink"),
        "cover": info.get("cover"),
    }


def search(title: str) -> list[dict]:
    res = call("/store/search", keyword=title, scope=10, count=5, context=f"为好书推荐核实《{title}》是否上架及评分")
    hits = []
    for group in res.get("results", []):
        for b in group.get("books", []):
            hits.append(summarize(b.get("bookInfo", b)))
    return hits[:5]


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--id":
        info = call("/book/info", bookId=args[1])
        print(json.dumps({**summarize(info), "category": info.get("category"), "intro": info.get("intro")}, ensure_ascii=False, indent=2))
        return
    print(json.dumps({title: search(title) for title in args}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
