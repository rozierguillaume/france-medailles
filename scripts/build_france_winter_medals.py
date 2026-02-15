#!/usr/bin/env python3
import argparse
import csv
import json
import os
from typing import Dict, List


def _to_int(value: str) -> int:
    value = (value or "").strip()
    if value == "":
        return 0
    try:
        return int(float(value))
    except ValueError:
        return 0


def _normalize(value: str) -> str:
    return (value or "").strip().lower()


def load_rows(path: str) -> List[Dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def filter_rows(
    rows: List[Dict[str, str]],
    season: str,
    country: str,
    noc: str,
) -> List[Dict[str, str]]:
    season_key = season.strip().lower()
    country_key = country.strip().lower()
    noc_key = noc.strip().upper()

    output: List[Dict[str, str]] = []
    for row in rows:
        edition = row.get("edition", "")
        if season_key and season_key not in edition.lower():
            continue
        row_country = _normalize(row.get("country", ""))
        row_noc = (row.get("country_noc", "") or "").strip().upper()
        if country_key and row_country != country_key and row_noc != noc_key:
            continue
        output.append(row)
    return output


def to_series(rows: List[Dict[str, str]]) -> List[Dict[str, int]]:
    series: List[Dict[str, int]] = []
    for row in rows:
        series.append(
            {
                "edition": (row.get("edition", "") or "").strip(),
                "year": _to_int(row.get("year", "")),
                "gold": _to_int(row.get("gold", "")),
                "silver": _to_int(row.get("silver", "")),
                "bronze": _to_int(row.get("bronze", "")),
                "total": _to_int(row.get("total", "")),
            }
        )
    series.sort(key=lambda item: item["year"])
    return series



def write_json(path: str, series: List[Dict[str, int]]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(series, f, ensure_ascii=False, indent=2)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Build medal time series for a country and season "
            "from data/Olympic_Medal_Tally_History.csv."
        )
    )
    parser.add_argument(
        "--input",
        default="data/Olympic_Medal_Tally_History.csv",
        help="Path to Olympic_Medal_Tally_History.csv",
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        help="Directory where output files will be written",
    )
    parser.add_argument(
        "--season",
        default="Winter",
        help="Season filter matched within the edition label (default: Winter)",
    )
    parser.add_argument(
        "--country",
        default="France",
        help="Country name filter (default: France)",
    )
    parser.add_argument(
        "--noc",
        default="FRA",
        help="Country NOC filter (default: FRA)",
    )
    args = parser.parse_args()

    rows = load_rows(args.input)
    filtered = filter_rows(rows, args.season, args.country, args.noc)
    series = to_series(filtered)

    os.makedirs(args.output_dir, exist_ok=True)
    json_path = os.path.join(
        args.output_dir, "france_winter_medals_by_edition.json"
    )

    write_json(json_path, series)

    print(f"Wrote {len(series)} rows to {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
