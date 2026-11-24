"""Minimal WeChat Reading (微信读书) API client shared by this skill's scripts."""

import json
import os
import sys
import urllib.request

GATEWAY = "https://i.weread.qq.com/api/agent/gateway"
SKILL_VERSION = "1.0.6"


def call(api_name: str, **params) -> dict:
    if not os.environ.get("WEREAD_API_KEY"):
        sys.exit("WEREAD_API_KEY is not set: export WEREAD_API_KEY=<your_api_key>")
    body = json.dumps({"api_name": api_name, **params, "skill_version": SKILL_VERSION}).encode()
    req = urllib.request.Request(GATEWAY, data=body, headers={
        "Authorization": f"Bearer {os.environ['WEREAD_API_KEY']}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def rating_percent(value) -> float | None:
    """newRating is per mille (827 -> 82.7%)."""
    return round(value / 10, 1) if value else None
