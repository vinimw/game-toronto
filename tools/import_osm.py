#!/usr/bin/env python3
"""Build a real-geometry High Park snapshot from the archived OSM Map API response.

No Google Maps data, tiles or copyrighted imagery are scraped.
The output contains simplified geographic features in local meters (east, south).
Copyright © OpenStreetMap contributors, licensed ODbL 1.0.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import pathlib
import sys

DEFAULT_BBOX = (43.65055, -79.467485, 43.65415, -79.462515)  # south, west, north, east
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "high-park.osm.json"


def project(lat: float, lon: float, center: dict[str, float], *, rounded=True) -> list[float]:
    x = (lon - center["lon"]) * 111_320 * math.cos(math.radians(center["lat"]))
    z = -(lat - center["lat"]) * 111_320
    return [round(x, 2), round(z, 2)] if rounded else [x, z]


def is_closed(points: list[list[float]]) -> bool:
    return len(points) >= 4 and math.dist(points[0], points[-1]) < 1


def classify(tags: dict, closed: bool) -> str | None:
    if tags.get("building") not in (None, "no") and closed:
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


def clip_line(points, bounds):
    """Liang–Barsky per segment, retaining disconnected parts in source order."""
    west, north, east, south = bounds
    parts = []
    for a, b in zip(points, points[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        start, end = 0., 1.
        for p, q in [(-dx, a[0]-west), (dx, east-a[0]), (-dz, a[1]-north), (dz, south-a[1])]:
            if p < 0:
                start = max(start, q/p)
            elif p > 0:
                end = min(end, q/p)
            elif q < 0:
                end = -1
        if start >= end:
            continue
        first = a if start == 0 else [a[0]+dx*start, a[1]+dz*start]
        last = b if end == 1 else [a[0]+dx*end, a[1]+dz*end]
        if parts and parts[-1][-1] == first:
            parts[-1].append(last)
        else:
            parts.append([first, last])
    return parts


def clip_polygon(points, bounds):
    """Intersect a simple exterior ring with the four rectangle boundaries."""
    ring = points[:-1] if points[0] == points[-1] else points
    for axis, edge, sign in [(0,bounds[0],1),(1,bounds[1],1),(0,bounds[2],-1),(1,bounds[3],-1)]:
        if not ring:
            return []
        output = []
        for a, b in zip(ring[-1:] + ring[:-1], ring):
            inside_a, inside_b = (a[axis]-edge)*sign >= 0, (b[axis]-edge)*sign >= 0
            if inside_a != inside_b:
                t = (edge-a[axis])/(b[axis]-a[axis])
                intersection = [a[j]+(b[j]-a[j])*t for j in range(2)]
                intersection[axis] = edge
                output.append(intersection)
            if inside_b:
                output.append(b)
        ring = output
    return [ring+[ring[0]]] if len(ring) >= 3 else []


def convert_api(raw, source_bytes, bbox, *, dataset="high-park-north", origin=None):
    """Normalize the archived OSM Map API response, using its original node IDs."""
    expected = tuple(raw['bounds'][key] for key in ('minlat','minlon','maxlat','maxlon'))
    if expected != bbox:
        raise ValueError('BBox deve coincidir com o recorte exato do arquivo de origem')
    origin = origin or {'lat': round((bbox[0]+bbox[2])/2, 7), 'lon': round((bbox[1]+bbox[3])/2, 7)}
    lo, hi = project(*bbox[:2], origin, rounded=False), project(*bbox[2:], origin, rounded=False)
    bounds = [lo[0], hi[1], hi[0], lo[1]]
    nodes = {element['id']: element for element in raw['elements'] if element['type'] == 'node'}
    features, clipped, missing, skipped_relations = [], [], [], []
    for element in raw['elements']:
        tags, osm_id = element.get('tags', {}), element['id']
        if element['type'] == 'relation':
            if tags.get('type') == 'multipolygon':
                skipped_relations.append(osm_id)
            continue
        if element['type'] != 'way':
            continue
        ids = element.get('nodes', [])
        if len(ids) < 2:
            continue
        closed = len(ids) >= 4 and ids[0] == ids[-1]
        kind = classify(tags, closed)
        if dataset == 'high-park-expanded' and closed and tags.get('leisure') in ('pitch', 'swimming_pool'):
            kind = 'sport'
        if kind is None:
            if any(key in tags for key in ('building','natural','waterway','landuse','leisure','highway')):
                missing.append({'id':osm_id,'reason':'classe não renderizada ou contorno aberto'})
            continue
        if any(node_id not in nodes for node_id in ids):
            missing.append({'id':osm_id,'reason':'nós ausentes na origem'})
            continue
        if tags.get('tunnel') in ('yes','building_passage') or tags.get('highway') == 'proposed':
            missing.append({'id':osm_id,'reason':'geometria subterrânea ou proposta'})
            continue
        geographic = [[nodes[n]['lon'], nodes[n]['lat']] for n in ids]
        points = [project(lat, lon, origin, rounded=False) for lon, lat in geographic]
        parts = (clip_line if kind in ('path','rail') else clip_polygon)(points, bounds)
        if not parts:
            missing.append({'id':osm_id,'reason':'sem geometria no interior do recorte'})
            continue
        if parts != [points]:
            clipped.append(osm_id)
        for part, vertices in enumerate(parts, 1):
            rounded = [[round(x, 2),round(z, 2)] for x,z in vertices]
            if len({tuple(point) for point in rounded}) < (2 if kind in ('path','rail') else 3):
                continue
            features.append({'kind':kind,'osmType':'way','osmId':osm_id,'part':part,
                             'name':tags.get('name',''),'tags':tags,'points':rounded})
    classes = ('path','building','green','water','rail') + (('sport',) if dataset == 'high-park-expanded' else ())
    counts = {kind:len({f['osmId'] for f in features if f['kind']==kind})
              for kind in classes}
    return {
        'version':2,'mode':'osm','dataset':dataset,'origin':origin,'bbox':[round(value, 2) for value in bounds],
        'bboxWgs84':list(bbox),'extractedAt':raw['extractedAt'],'sourceUrl':raw['sourceUrl'],
        'sourceSha256':hashlib.sha256(source_bytes).hexdigest(),'source':'© OpenStreetMap contributors',
        'license':'ODbL 1.0 - https://www.openstreetmap.org/copyright',
        'features':features,
        'coverage':{'waysByClass':counts,'clippedWayIds':clipped,'omittedWays':missing,
                    'unrenderedMultipolygonIds':skipped_relations},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Importar vias e construções reais de High Park (Toronto) usando a resposta arquivada da API OSM")
    ap.add_argument("--bbox", metavar=("S", "W", "N", "E"), type=float, nargs=4, default=DEFAULT_BBOX,
                    help="Limites geográficos: latitude sul, longitude oeste, latitude norte, longitude leste")
    ap.add_argument("--input", type=pathlib.Path, help="Ler recorte JSON arquivado da API OSM, sem internet")
    ap.set_defaults(input=ROOT / "tools" / "data" / "high-park-north.osm-source.json")
    ap.add_argument("--dataset", choices=("high-park-north","high-park-expanded"), default="high-park-north")
    ap.add_argument("--origin", metavar=("LAT","LON"), type=float, nargs=2)
    ap.add_argument("--output", type=pathlib.Path, default=OUTPUT)
    args = ap.parse_args()
    south, west, north, east = args.bbox
    if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        ap.error("BBox inválida; esperado: sul oeste norte leste")
    try:
        source_bytes = gzip.decompress(args.input.read_bytes()) if args.input.suffix == ".gz" else args.input.read_bytes()
        raw = json.loads(source_bytes)
        output = convert_api(raw, source_bytes, tuple(args.bbox), dataset=args.dataset,
                             origin=dict(zip(("lat","lon"), args.origin)) if args.origin else None)
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
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
