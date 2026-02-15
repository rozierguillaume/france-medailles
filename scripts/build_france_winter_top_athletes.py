#!/usr/bin/env python3
"""Build top 15 French Winter Olympics athletes by medal count."""

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "Olympic_Athlete_Event_Details.csv"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "output" / "france_winter_top_athletes.json"

VALID_MEDALS = {"Gold", "Silver", "Bronze"}


def main():
    # Read and filter rows
    rows = []
    with open(DATA_PATH, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if (
                row["country_noc"] == "FRA"
                and "Winter" in row["edition"]
                and row["medal"] in VALID_MEDALS
            ):
                rows.append(row)

    # Deduplicate: one entry per (edition, event, medal, athlete)
    seen = set()
    deduped = []
    for row in rows:
        key = (row["edition"], row["event"], row["medal"], row["athlete"])
        if key not in seen:
            seen.add(key)
            deduped.append(row)

    # Group by athlete
    athletes = defaultdict(lambda: {"gold": 0, "silver": 0, "bronze": 0, "sports": set(), "editions": set()})
    for row in deduped:
        name = row["athlete"]
        a = athletes[name]
        medal = row["medal"].lower()
        a[medal] += 1
        a["sports"].add(row["sport"])
        # Extract year from edition string like "2018 Winter Olympics"
        m = re.search(r"(\d{4})", row["edition"])
        if m:
            a["editions"].add(int(m.group(1)))

    # Build list and sort
    result = []
    for name, a in athletes.items():
        total = a["gold"] + a["silver"] + a["bronze"]
        result.append({
            "athlete": name,
            "sport": " / ".join(sorted(a["sports"])),
            "gold": a["gold"],
            "silver": a["silver"],
            "bronze": a["bronze"],
            "total": total,
            "editions": sorted(a["editions"]),
        })

    result.sort(key=lambda x: (-x["total"], -x["gold"]))
    top15 = result[:15]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(top15, f, ensure_ascii=False, indent=2)

    print(json.dumps(top15, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
