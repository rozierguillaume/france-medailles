import csv
import json

INPUT = "data/Olympic_Athlete_Event_Details.csv"
OUTPUT = "output/france_winter_medals_by_sport.json"

# Read and filter
medals_set = set()
with open(INPUT, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if (row["country_noc"] == "FRA"
                and "Winter" in row["edition"]
                and row["medal"] in ("Gold", "Silver", "Bronze")):
            # Deduplicate team events: one medal per (edition, event, medal)
            key = (row["edition"], row["event"], row["medal"])
            medals_set.add((key, row["sport"], row["event"], row["medal"]))

# Group by sport > event
sport_events = {}
for (key, sport, event, medal) in medals_set:
    if sport not in sport_events:
        sport_events[sport] = {}
    if event not in sport_events[sport]:
        sport_events[sport][event] = {"gold": 0, "silver": 0, "bronze": 0}
    sport_events[sport][event][medal.lower()] += 1

# Build output
result = []
for sport, events in sport_events.items():
    sport_gold = sum(e["gold"] for e in events.values())
    sport_silver = sum(e["silver"] for e in events.values())
    sport_bronze = sum(e["bronze"] for e in events.values())
    sport_total = sport_gold + sport_silver + sport_bronze

    event_list = []
    for event_name, counts in events.items():
        total = counts["gold"] + counts["silver"] + counts["bronze"]
        event_list.append({
            "event": event_name,
            "gold": counts["gold"],
            "silver": counts["silver"],
            "bronze": counts["bronze"],
            "total": total,
        })
    event_list.sort(key=lambda x: x["total"], reverse=True)

    result.append({
        "sport": sport,
        "gold": sport_gold,
        "silver": sport_silver,
        "bronze": sport_bronze,
        "total": sport_total,
        "events": event_list,
    })

result.sort(key=lambda x: x["total"], reverse=True)

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Generated {OUTPUT} with {len(result)} sports")
