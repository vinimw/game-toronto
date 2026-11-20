#!/usr/bin/env python3
"""Sample the archived HRDEM bare-earth crop at the game-grid vertices."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import from_bounds

BBOX = (43.6359, -79.4725, 43.65415, -79.4565)
SOURCE = 'https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-2m/8_2-mosaic-2m-dtm.tif'
LANDING_LAT, LANDING_LON = 43.6533238, -79.4652439


def crop(path):
    south, west, north, east = BBOX
    with rasterio.open(SOURCE) as source:
        bounds = transform_bounds('EPSG:4326', source.crs, west-.0002, south-.0002,
                                  east+.0002, north+.0002, densify_pts=21)
        window = from_bounds(*bounds, source.transform)
        left, top = math.floor(window.col_off), math.floor(window.row_off)
        right, bottom = math.ceil(window.col_off+window.width), math.ceil(window.row_off+window.height)
        window = rasterio.windows.Window(left, top, right-left, bottom-top)
        profile = source.profile.copy()
        profile.update(width=int(window.width), height=int(window.height),
                       transform=source.window_transform(window), compress='deflate',
                       tiled=False, blockxsize=None, blockysize=None)
        with rasterio.open(path, 'w', **profile) as output:
            output.write(source.read(1, window=window), 1)


def convert(path, output):
    south, west, north, east = BBOX
    cols, rows = 161, 255
    dx, dy = (east-west)/(cols-1), (north-south)/(rows-1)
    dst = np.full((rows, cols), np.nan, dtype='float32')
    with rasterio.open(path) as source:
        reproject(rasterio.band(source, 1), dst, dst_crs='EPSG:4326',
                  dst_transform=from_origin(west-dx/2, north+dy/2, dx, dy),
                  dst_nodata=np.nan, resampling=Resampling.bilinear)
    if not np.isfinite(dst).all() or np.min(dst) < 0 or np.max(dst) > 400:
        raise ValueError('Incomplete or invalid terrain coverage')
    col, row = round((LANDING_LON-west)/dx), round((north-LANDING_LAT)/dy)
    meta = {
        'version': 1, 'source': SOURCE, 'license': 'Open Government Licence – Canada',
        'datum': 'CGVD2013', 'sourceCellMeters': 2, 'bboxWgs84': BBOX,
        'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'sampleSizeMeters': [round(dx*111320*math.cos(math.radians(LANDING_LAT)), 2), round(dy*111320, 2)],
        'width': cols, 'height': rows, 'zeroMeters': round(float(dst[row, col]), 2),
        'minimumMeters': round(float(dst.min()), 2), 'maximumMeters': round(float(dst.max()), 2),
        'heightsCm': np.rint(dst*100).astype(int).ravel().tolist(),
    }
    output.write_text(json.dumps(meta, separators=(',', ':'))+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    if args.download:
        crop(args.source)
    convert(args.source, args.output)
