#!/usr/bin/env python3
"""Build a real-geometry High Park snapshot from OSM Overpass.

No Google Maps data, tiles or copyrighted imagery are scraped.
The output contains simplified geographic features in local meters (east, south).
Copyright © OpenStreetMap contributors, licensed ODbL 1.0.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BBOX = (43.6450, -79.4728, 43.6535, -79.4565)  # south, west, north, east
OVERPASS_SERVERS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "high-park.osm.json"


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    bounds = f"({s},{w},{n},{e})"
    return f'''[out:json][timeout:75];
(
  way["highway"]{bounds};
  way["building"]{bounds};
  way["railway"~"^(tram|subway|rail)$"]{bounds};
  way["natural"="water"]{bounds};
  way["waterway"="riverbank"]{bounds};
  way["landuse"~"^(forest|grass|meadow|recreation_ground)$"]{bounds};
  way["leisure"~"^(park|garden|nature_reserve)$"]{bounds};
  way["natural"="wood"]{bounds};
);
out geom;'''


def download_osm(query: str) -> dict:
    payload = urllib.parse.urlencode({"data": query}).encode()
    errors = []
    for endpoint in OVERPASS_SERVERS:
        try:
            print(f"Consultando {endpoint} ...", flush=True)
            req = urllib.request.Request(endpoint, data=payload, headers={
                "User-Agent": "GameLoveTorontoPrototype/0.1 (OpenStreetMap; local developer import)",
                "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=110) as resp:
                raw = resp.read()
            result = json.loads(raw)
            if not isinstance(result.get("elements"), list):
                raise RuntimeError("Resposta da API sem lista de elementos")
            return result
        except (OSError, ValueError, RuntimeError) as exc:
            errors.append(f"{endpoint}: {exc}")
            time.sleep(1)
    raise RuntimeError("Não foi possível obter dados da API Overpass:\n" + "\n".join(errors))


def project(lat: float, lon: float, center: dict[str, float]) -> list[float]:
    x = (lon - center["lon"]) * 111_320 * math.cos(math.radians(center["lat"]))
    z = -(lat - center["lat"]) * 111_320
    return [round(x, 2), round(z, 2)]


def is_closed(points: list[list[float]]) -> bool:
    return len(points) >= 4 and math.dist(points[0], points[-1]) < 1


def classify(tags: dict, closed: bool) -> str | None:
    if tags.get("building") and closed:
        return "building"
    if closed and (tags.get("natural") == "water" or tags.get("waterway") == "riverbank"):
        return "water"
    if closed and (tags.get("landuse") in {"forest", "grass", "meadow", "recreation_ground"}
                   or tags.get("leisure") in {"park", "garden", "nature_reserve"}
                   or tags.get("natural") == "wood"):
        return "green"
    if tags.get("highway"):
        return "path"
    if tags.get("railway") in {"tram", "subway", "rail"}:
        return "rail"
    return None


def convert(raw: dict, bbox: tuple[float, float, float, float]) -> dict:
    south, west, north, east = bbox
    center = {"lat": round((south + north) / 2, 7), "lon": round((west + east) / 2, 7)}
    low = project(south, west, center)
    high = project(north, east, center)
    projected_bbox = [low[0], high[1], high[0], low[1]]
    features = []
    for element in raw.get("elements", []):
        if element.get("type") != "way":
            continue
        nodes = element.get("geometry", [])
        if len(nodes) < 2:
            continue
        tags = element.get("tags", {})
        points = [project(node["lat"], node["lon"], center) for node in nodes]
        kind = classify(tags, is_closed(points))
        if kind is None:
            continue
        # Keep useful tags; no unnecessary personal/edit metadata is copied.
        wanted = ("highway", "railway", "building", "building:levels", "height", "natural", "waterway", "landuse", "leisure", "surface", "name")
        cleaned_tags = {key: tags[key] for key in wanted if key in tags}
        features.append({"kind": kind, "name": tags.get("name", ""), "tags": cleaned_tags, "points": points})
    return {
        "version": 1,
        "mode": "osm",
        "origin": center,
        "bbox": [round(x, 2) for x in projected_bbox],
        "source": "OpenStreetMap contributors",
        "license": "ODbL 1.0 - https://www.openstreetmap.org/copyright",
        "features": features,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Importar vias e construções reais de High Park (Toronto) usando Overpass")
    ap.add_argument("--bbox", metavar=("S", "W", "N", "E"), type=float, nargs=4, default=DEFAULT_BBOX,
                    help="Limites geográficos: latitude sul, longitude oeste, latitude norte, longitude leste")
    ap.add_argument("--input", type=pathlib.Path, help="Ler arquivo JSON bruto do Overpass local, sem internet")
    ap.add_argument("--output", type=pathlib.Path, default=OUTPUT)
    args = ap.parse_args()
    south, west, north, east = args.bbox
    if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        ap.error("BBox inválida; esperado: sul oeste norte leste")
    try:
        raw = json.loads(args.input.read_text()) if args.input else download_osm(overpass_query(tuple(args.bbox)))
        output = convert(raw, tuple(args.bbox))
        if len(output["features"]) < 20:
            raise RuntimeError(f"Poucas feições retornadas ({len(output['features'])}). Verifique a bbox ou a API.")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temp = args.output.with_suffix(args.output.suffix + ".tmp")
        temp.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
        temp.replace(args.output)
        summary = {kind: sum(f["kind"] == kind for f in output["features"]) for kind in ("path", "building", "green", "water", "rail")}
        print(f"Mapa criado: {args.output} ({args.output.stat().st_size/1024:.0f} KB)")
        print(f"Total: {len(output['features'])} elementos | {summary}")
        print("Fonte: © OpenStreetMap contributors (ODbL 1.0)")
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
