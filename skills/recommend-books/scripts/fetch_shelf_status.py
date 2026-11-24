#!/usr/bin/env python3
"""Shelf status of recommended books, plus a list of unread shelf books.

Run from the personal-librarian repository root:
    python3 <skill-dir>/scripts/fetch_shelf_status.py            # write recommendations/shelf-status.json
    python3 <skill-dir>/scripts/fetch_shelf_status.py --unread   # print unread shelf books (candidates for 书架上的遗珠)

shelf-status.json maps every bookId recommended in recommendations/*.md to whether it is on the
WeChat Reading shelf and finished, so the website can label it 已在书架 / 已读. Requires WEREAD_API_KEY.
"""

import datetime
import json
import pathlib
import re
import sys

from weread import call

TZ = datetime.timezone(datetime.timedelta(hours=8))
REC_DIR = pathlib.Path("recommendations")
OUTPUT = REC_DIR / "shelf-status.json"


def recommended_ids() -> set[str]:
    ids = set()
    for f in REC_DIR.glob("*.md"):
        ids.update(re.findall(r"^- bookId：(\S+)", f.read_text(encoding="utf-8"), re.M))
    return ids


def local_titles() -> set[str]:
    return {d.name for root in ("notes", "reflections") for d in pathlib.Path(root).iterdir() if d.is_dir()}


def main() -> None:
    if not pathlib.Path("notes").is_dir():
        sys.exit("Run this script from the personal-librarian repository root.")
    shelf = call("/shelf/sync").get("books", [])

    if "--unread" in sys.argv:
        local = local_titles()
        for b in sorted(shelf, key=lambda b: b.get("category") or ""):
            title = b.get("title", "")
            if b.get("finishReading") or any(title == t or title.startswith(t + "（") for t in local):
                continue
            print(f"{b.get('bookId')}\t{b.get('category') or '-'}\t{title}\t{b.get('author') or ''}")
        return

    by_id = {b["bookId"]: b for b in shelf if b.get("bookId")}
    status = {}
    for book_id in sorted(recommended_ids()):
        b = by_id.get(book_id)
        status[book_id] = {"onShelf": bool(b), "finished": bool(b and b.get("finishReading") == 1)}
    REC_DIR.mkdir(exist_ok=True)
    data = {"snapshotDate": datetime.datetime.now(TZ).date().isoformat(), "books": status}
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}: {sum(s['onShelf'] for s in status.values())}/{len(status)} recommended books on the shelf")


if __name__ == "__main__":
    main()
