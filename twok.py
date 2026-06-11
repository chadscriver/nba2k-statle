#!/usr/bin/env python3
"""Shared 2kratings.com scraping + parsing for NBA 2K Statle.

Single source of truth for page fetching and player/roster/logo parsing,
imported by both scraper.py (current rosters) and scripts/scrape_classic.py
(classic teams). Do NOT fork this parser — extend it here so both stay in sync.

The fetch layer caches raw HTML under .cache/2kratings/ so scrapes are
resumable and only sleep (politely) on live network requests, never cache hits.
"""
import os
import re
import time

import requests
from bs4 import BeautifulSoup

BASE = "https://www.2kratings.com"
SIX = ["Outside Scoring", "Inside Scoring", "Playmaking",
       "Athleticism", "Defense", "Rebounding"]
ROLLUPS = SIX + ["Intangibles"]
TIERS = {"hof": "HOF", "legend": "Legend", "gold": "Gold",
         "silver": "Silver", "bronze": "Bronze"}
UA = "Mozilla/5.0 (compatible; statle-data-bot; educational project)"

# Map 2kratings' full category labels to the short keys used by the app/pools.
SHORT_CAT = {"Outside Scoring": "OUT", "Inside Scoring": "IN", "Playmaking": "PLY",
             "Athleticism": "ATH", "Defense": "DEF", "Rebounding": "REB"}

# A handful of badges display under non-attribute pills ("General Offense" /
# "All Around") on 2kratings but the shipped pool files them under a real
# attribute category. These assignments were derived from the existing
# pool.json badge counts (a 0-mismatch solve across all 300 players).
ODDBALL_BADGE_CAT = {"Brick Wall": "IN", "Pogo Stick": "DEF", "Slippery Off-Ball": "OUT"}

# Per-category attribute order, mirroring app/src/App.jsx SUBS exactly. The pools
# store attribute lists in this order, so it MUST stay in sync with the app.
SUBS = {
    "OUT": ["Three-Point Shot", "Mid-Range Shot", "Close Shot", "Free Throw",
            "Offensive Consistency", "Shot IQ"],
    "IN": ["Layup", "Driving Dunk", "Standing Dunk", "Post Hook", "Post Fade",
           "Post Control", "Draw Foul", "Hands"],
    "PLY": ["Ball Handle", "Speed with Ball", "Pass Accuracy", "Pass Vision", "Pass IQ"],
    "ATH": ["Speed", "Strength", "Agility", "Vertical", "Hustle", "Stamina",
            "Overall Durability"],
    "DEF": ["Block", "Steal", "Pass Perception", "Interior Defense",
            "Perimeter Defense", "Help Defense IQ", "Defensive Consistency"],
    "REB": ["Defensive Rebound", "Offensive Rebound"],
}

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.environ.get("SCRAPE_CACHE", os.path.join(ROOT, ".cache", "2kratings"))
DELAY = float(os.environ.get("SCRAPE_DELAY", "1.25"))  # polite delay between live requests

_SESSION = None


def session():
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
        _SESSION.headers.update({"User-Agent": UA})
    return _SESSION


def _cache_path(url):
    key = url.split(BASE + "/", 1)[-1] or "index"
    key = re.sub(r"[^A-Za-z0-9._-]", "_", key) or "index"
    return os.path.join(CACHE_DIR, key + ".html")


def fetch(url, tries=3, delay=None, use_cache=True):
    """Return page HTML (cached, resumable) or None.

    Sleeps `delay` seconds after a *live* fetch (never on a cache hit) so callers
    don't need to manage politeness themselves. A page is considered valid only
    if it returns 200 and contains an <h1 (filters Cloudflare/error interstitials).
    """
    delay = DELAY if delay is None else delay
    cp = _cache_path(url)
    if use_cache and os.path.exists(cp):
        with open(cp, encoding="utf-8") as f:
            return f.read()
    s = session()
    for t in range(tries):
        try:
            r = s.get(url, timeout=25)
            if r.status_code == 200 and "<h1" in r.text:
                if use_cache:
                    os.makedirs(CACHE_DIR, exist_ok=True)
                    with open(cp, "w", encoding="utf-8") as f:
                        f.write(r.text)
                time.sleep(delay)
                return r.text
        except requests.RequestException:
            pass
        time.sleep(1.0 * (t + 1))
    return None


def soup_of(html):
    return BeautifulSoup(html, "lxml")


def parse_roster(html):
    """Ordered, de-duplicated player slugs from a team page's roster tables."""
    soup = soup_of(html)
    out = []
    for table in soup.find_all("table"):
        for a in table.select("a[href]"):
            m = re.match(rf"^{re.escape(BASE)}/([a-z0-9-]+)$", a["href"])
            if m and a.get_text(strip=True):
                out.append(m.group(1))
    return list(dict.fromkeys(out))


def team_h1(html):
    soup = soup_of(html)
    h1 = soup.find("h1")
    return h1.get_text(strip=True) if h1 else None


def main_logo_url(html):
    """The team's own header logo (era-correct). Identified by the <img> whose
    alt matches the page <h1> (optionally suffixed with ' NBA 2K26 Roster')."""
    soup = soup_of(html)
    h1 = soup.find("h1")
    if not h1:
        return None
    label = h1.get_text(strip=True)
    for img in soup.find_all("img"):
        alt = (img.get("alt") or "").strip()
        if alt == label or alt.startswith(label + " NBA"):
            src = img.get("data-src") or img.get("src") or ""
            if src and "1x1.png" not in src:
                return src if src.startswith("http") else BASE + src
    return None


def parse_player(html):
    """Parse a player page into the wide dict used to build CSV rows.

    Returns identity, overall, imperial body, the 6 category rollups +
    Intangibles, every individual attribute, and every badge with its tier and
    category. Verbatim logic shared with scraper.py — keep them identical.
    """
    soup = soup_of(html)
    h1 = soup.find("h1")
    if not h1:
        return None
    node = h1
    for _ in range(5):
        if node.parent is None:
            break
        node = node.parent
    txt = re.sub(r"\s+", " ", node.get_text(" ", strip=True))

    p = {"name": h1.get_text(strip=True)}
    m = re.search(r"(\d{2,3})\s*OVERALL", txt);            p["overall"] = int(m.group(1)) if m else None
    m = re.search(r"Position:\s*([A-Z/ ]+?)\s*(?:Archetype|Height)", txt); p["pos"] = m.group(1).strip() if m else None
    m = re.search(r"Team:\s*(.+?)\s*Jersey", txt);          p["team"] = m.group(1).strip() if m else None
    m = re.search(r"Height:\s*(\d+)'(\d+)", txt)
    if m: p["height"] = f"{m.group(1)}'{m.group(2)}\""; p["height_in"] = int(m.group(1))*12+int(m.group(2))
    m = re.search(r"Weight:\s*(\d+)lbs", txt);              p["weight_lbs"] = int(m.group(1)) if m else None
    m = re.search(r"Wingspan:\s*(\d+)'(\d+)", txt)
    if m: p["wingspan"] = f"{m.group(1)}'{m.group(2)}\""; p["wingspan_in"] = int(m.group(1))*12+int(m.group(2))

    # category averages (rollups)
    for h in soup.select("h4.card-title"):
        name = h.get_text(strip=True)
        if name in ROLLUPS:
            box = h.find_next(class_="attribute-box")
            if box and box.get("data-order"):
                try: p[name] = float(box["data-order"])
                except ValueError: pass

    # individual attributes, scoped to the per-category cards
    attrs, attr_cat = {}, {}
    for h in soup.select("h4.card-title"):
        cat = h.get_text(strip=True)
        if cat not in SIX:
            continue
        card = h.find_parent(class_="card")
        body = card.find(class_="card-body") if card else None
        if not body:
            continue
        for li in body.select("li"):
            box = li.find(class_="attribute-box")
            if not box or not box.get("data-order"):
                continue
            raw = re.sub(r"\s+", " ", li.get_text(" ", strip=True))
            an = re.sub(r"\s*\d+(\.\d+)?\s*$", "", raw).strip()
            if not re.fullmatch(r"[A-Za-z0-9\- ]{2,40}", an):
                continue
            try: attrs[an] = int(float(box["data-order"]))
            except ValueError: continue
            attr_cat[an] = cat
    p["_attrs"], p["_attr_cat"] = attrs, attr_cat

    # badges (tier read from the lazy-loaded image filename)
    badges, badge_cat = {}, {}
    for c in soup.select(".badge-card"):
        img = c.find("img")
        if not img:
            continue
        bn = (img.get("alt") or "").strip()
        m = re.search(r"-(legend|hof|gold|silver|bronze)-badge", img.get("data-src", ""))
        if not (bn and m):
            continue
        badges[bn] = TIERS[m.group(1)]
        pill = c.find(class_="badge-pill")
        badge_cat[bn] = pill.get_text(strip=True) if pill else ""
    p["_badges"], p["_badge_cat"] = badges, badge_cat
    return p
