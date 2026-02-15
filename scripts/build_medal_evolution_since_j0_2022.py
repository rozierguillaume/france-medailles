#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple


MONTHS = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}

DATE_PATTERN = re.compile(
    r"(\d{1,2})\s*(?:\D+\d{1,2}\s*)?"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s*(\d{4})"
)


def parse_date(raw: str) -> Optional[date]:
    if not raw:
        return None
    match = DATE_PATTERN.search(raw)
    if not match:
        return None
    day = int(match.group(1))
    month_name = match.group(2)
    year = int(match.group(3))
    month = MONTHS.get(month_name)
    if not month:
        return None
    return date(year, month, day)


def load_country_profiles(path: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            country = (row.get("country") or "").strip().lower()
            noc = (row.get("noc") or "").strip().upper()
            if country and noc and country not in mapping:
                mapping[country] = noc
    return mapping


def resolve_noc(country: str, noc: str, profiles_path: str) -> Optional[str]:
    noc = (noc or "").strip().upper()
    if noc:
        return noc
    country_key = (country or "").strip().lower()
    if not country_key:
        return None
    mapping = load_country_profiles(profiles_path)
    return mapping.get(country_key)


def load_result_dates(
    path: str, edition: str
) -> Tuple[Dict[str, date], Optional[date], Optional[date], int]:
    result_dates: Dict[str, date] = {}
    min_date: Optional[date] = None
    max_date: Optional[date] = None
    missing = 0
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("edition") or "").strip() != edition:
                continue
            raw_date = row.get("result_date") or ""
            parsed = parse_date(raw_date)
            if not parsed:
                missing += 1
                continue
            result_id = (row.get("result_id") or "").strip()
            if not result_id:
                continue
            result_dates[result_id] = parsed
            if min_date is None or parsed < min_date:
                min_date = parsed
            if max_date is None or parsed > max_date:
                max_date = parsed
    return result_dates, min_date, max_date, missing


def build_daily_counts(
    path: str,
    edition: str,
    result_dates: Dict[str, date],
    noc_filter: Optional[str],
    j0_date: date,
) -> Tuple[Dict[int, Dict[str, int]], int]:
    daily = defaultdict(lambda: {"gold": 0, "silver": 0, "bronze": 0})
    dedup_team = set()
    missing_date = 0

    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if (row.get("edition") or "").strip() != edition:
                continue
            medal = (row.get("medal") or "").strip()
            if medal not in ("Gold", "Silver", "Bronze"):
                continue
            noc = (row.get("country_noc") or "").strip().upper()
            if noc_filter and noc != noc_filter:
                continue
            result_id = (row.get("result_id") or "").strip()
            result_date = result_dates.get(result_id)
            if not result_date:
                missing_date += 1
                continue
            is_team = (row.get("isTeamSport") or "").strip().lower() in (
                "1",
                "true",
                "yes",
            )
            if is_team:
                dedup_key = (result_id, noc, medal)
                if dedup_key in dedup_team:
                    continue
                dedup_team.add(dedup_key)

            day_index = (result_date - j0_date).days
            key = medal.lower()
            daily[day_index][key] += 1

    return daily, missing_date


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    return re.sub(r"[^a-z0-9]+", "_", value).strip("_")


def extract_year(edition: str) -> str:
    match = re.search(r"\d{4}", edition or "")
    return match.group(0) if match else "unknown"



def write_json(path: str, rows: List[Dict[str, object]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Build medal evolution since J0 (first competition day) "
            "for a specific edition."
        )
    )
    parser.add_argument(
        "--edition",
        default="2022 Winter Olympics",
        help="Edition label (default: 2022 Winter Olympics)",
    )
    parser.add_argument(
        "--country",
        default="",
        help="Optional country name filter (e.g., France)",
    )
    parser.add_argument(
        "--noc",
        default="",
        help="Optional NOC filter (e.g., FRA)",
    )
    parser.add_argument(
        "--event-results",
        default="data/Olympic_Event_Results.csv",
        help="Path to Olympic_Event_Results.csv",
    )
    parser.add_argument(
        "--event-details",
        default="data/Olympic_Athlete_Event_Details.csv",
        help="Path to Olympic_Athlete_Event_Details.csv",
    )
    parser.add_argument(
        "--country-profiles",
        default="data/Olympic_Country_Profiles.csv",
        help="Path to Olympic_Country_Profiles.csv",
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Directory where output files will be written",
    )
    args = parser.parse_args()

    edition = args.edition.strip()
    if not edition:
        raise SystemExit("Edition label is required.")

    noc_filter = resolve_noc(args.country, args.noc, args.country_profiles)
    if args.country and not noc_filter:
        raise SystemExit(f"Unknown country '{args.country}'.")

    result_dates, min_date, max_date, missing_results = load_result_dates(
        args.event_results, edition
    )
    if not result_dates or not min_date or not max_date:
        raise SystemExit(f"No result dates found for edition '{edition}'.")

    daily, missing_detail_dates = build_daily_counts(
        args.event_details, edition, result_dates, noc_filter, min_date
    )

    rows: List[Dict[str, object]] = []
    cumulative = {"gold": 0, "silver": 0, "bronze": 0}
    last_day = (max_date - min_date).days
    for day_index in range(0, last_day + 1):
        counts = daily.get(day_index, {"gold": 0, "silver": 0, "bronze": 0})
        cumulative["gold"] += counts["gold"]
        cumulative["silver"] += counts["silver"]
        cumulative["bronze"] += counts["bronze"]
        total = cumulative["gold"] + cumulative["silver"] + cumulative["bronze"]
        rows.append(
            {
                "day_index": day_index,
                "date": (min_date + timedelta(days=day_index)).isoformat(),
                "gold": cumulative["gold"],
                "silver": cumulative["silver"],
                "bronze": cumulative["bronze"],
                "total": total,
            }
        )

    os.makedirs(args.output_dir, exist_ok=True)
    year = extract_year(edition)
    suffix = f"_{noc_filter}" if noc_filter else ""
    base = f"medal_evolution_since_j0_{year}{suffix}"
    json_path = os.path.join(args.output_dir, f"{base}.json")

    write_json(json_path, rows)

    label = f"{edition}"
    if noc_filter:
        label += f" ({noc_filter})"
    print(f"J0 = {min_date.isoformat()} for {label}")
    print(f"Wrote {len(rows)} rows to {json_path}")
    if missing_results:
        print(f"Skipped {missing_results} event results with unparsed dates.")
    if missing_detail_dates:
        print(f"Skipped {missing_detail_dates} medal rows with missing dates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
