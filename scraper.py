#!/usr/bin/env python3
"""Scrape current NBA player ratings (full detail) from 2kratings.com.

Captures, per player: identity, overall, body (imperial), the 6 category
averages + Intangibles, every individual attribute, and every badge with its
tier (HOF / Gold / Silver / Bronze / Legend, or "-" if not held).

Outputs data/nba2k26.csv and data/nba2k26.json (one wide row per player).
Run:  python scraper.py   |   test:  MAX_TEAMS=2 python scraper.py
"""
import csv, json, os, re, time
import requests
from bs4 import BeautifulSoup

BASE = "https://www.2kratings.com"
SIX = ["Outside Scoring", "Inside Scoring", "Playmaking",
       "Athleticism", "Defense", "Rebounding"]
ROLLUPS = SIX + ["Intangibles"]
TIERS = {"hof": "HOF", "legend": "Legend", "gold": "Gold",
         "silver": "Silver", "bronze": "Bronze"}
TEAMS = ["atlanta-hawks","boston-celtics","brooklyn-nets","charlotte-hornets",
    "chicago-bulls","cleveland-cavaliers","dallas-mavericks","denver-nuggets",
    "detroit-pistons","golden-state-warriors","houston-rockets","indiana-pacers",
    "los-angeles-clippers","los-angeles-lakers","memphis-grizzlies","miami-heat",
    "milwaukee-bucks","minnesota-timberwolves","new-orleans-pelicans","new-york-knicks",
    "oklahoma-city-thunder","orlando-magic","philadelphia-76ers","phoenix-suns",
    "portland-trail-blazers","sacramento-kings","san-antonio-spurs","toronto-raptors",
    "utah-jazz","washington-wizards"]

DELAY     = float(os.environ.get("SCRAPE_DELAY", "0.4"))
MAX_TEAMS = int(os.environ.get("MAX_TEAMS", "0")) or None
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "0")) or None
OUT_DIR = "data"

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (compatible; statle-data-bot; educational project)"})

def fetch(url, tries=3):
    for t in range(tries):
        try:
            r = S.get(url, timeout=25)
            if r.status_code == 200 and "<h1" in r.text:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(1.0 * (t + 1))
    return None

def roster_slugs(team):
    html = fetch(f"{BASE}/teams/{team}")
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    out = []
    for table in soup.find_all("table"):
        for a in table.select("a[href]"):
            m = re.match(rf"^{re.escape(BASE)}/([a-z0-9-]+)$", a["href"])
            if m and a.get_text(strip=True):
                out.append(m.group(1))
    return list(dict.fromkeys(out))

def parse_player(html):
    soup = BeautifulSoup(html, "lxml")
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

def main():
    teams = TEAMS[:MAX_TEAMS] if MAX_TEAMS else TEAMS
    print(f"Enumerating {len(teams)} rosters...", flush=True)
    slugs = []
    for t in teams:
        slugs += roster_slugs(t); time.sleep(DELAY)
    slugs = list(dict.fromkeys(slugs))
    if MAX_PLAYERS: slugs = slugs[:MAX_PLAYERS]
    print(f"{len(slugs)} players to scrape.", flush=True)

    players, fails = [], 0
    attr_order, attr_cat_g = [], {}
    badge_order, badge_cat_g = [], {}
    for i, slug in enumerate(slugs, 1):
        html = fetch(f"{BASE}/{slug}")
        p = parse_player(html) if html else None
        if p and p.get("overall") and p.get("_attrs"):
            p["slug"] = slug
            for a, c in p["_attr_cat"].items():
                if a not in attr_cat_g: attr_cat_g[a] = c; attr_order.append(a)
            for b, c in p["_badge_cat"].items():
                if b not in badge_cat_g: badge_cat_g[b] = c; badge_order.append(b)
            players.append(p)
        else:
            fails += 1
        if i % 50 == 0:
            print(f"  {i}/{len(slugs)} | ok={len(players)} fail={fails}", flush=True)
        time.sleep(DELAY)

    cat_rank = {c: i for i, c in enumerate(SIX)}
    attr_order.sort(key=lambda a: (cat_rank.get(attr_cat_g[a], 9), a))
    badge_order.sort(key=lambda b: (cat_rank.get(badge_cat_g[b], 9), b))

    cols = (["slug","name","team","pos","overall",
             "height","height_in","weight_lbs","wingspan","wingspan_in"]
            + ROLLUPS + attr_order + [f"badge: {b}" for b in badge_order])

    players.sort(key=lambda r: (-(r["overall"] or 0), r["name"]))
    rows = []
    for p in players:
        row = {k: p.get(k) for k in
               ["slug","name","team","pos","overall","height","height_in",
                "weight_lbs","wingspan","wingspan_in", *ROLLUPS]}
        for a in attr_order: row[a] = p["_attrs"].get(a)
        for b in badge_order: row[f"badge: {b}"] = p["_badges"].get(b, "-")
        rows.append(row)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/nba2k26.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    with open(f"{OUT_DIR}/nba2k26.json", "w") as f:
        json.dump(rows, f, indent=2)
    print(f"DONE: {len(rows)} players, {len(attr_order)} attributes, "
          f"{len(badge_order)} badge columns, {fails} skipped.", flush=True)

if __name__ == "__main__":
    main()
