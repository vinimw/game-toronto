"""Downsample approved Poly Haven JPEG maps for local WebGL. Requires Pillow."""
import argparse
from pathlib import Path
from PIL import Image

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("source",type=Path)
parser.add_argument("output",type=Path)
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
for path in sorted(args.source.glob("*.jpg")):
    if path.stem.rsplit("-",1)[-1] not in {"Diffuse","nor_gl","arm"}:
        continue
    with Image.open(path) as source:
        image=source.convert("RGB")
        image.thumbnail((512,512),Image.Resampling.LANCZOS)
        if path.name in {"asphalt_track-Diffuse.jpg","grass_medium_01-Diffuse.jpg"}:
            offsets=(52,55,57) if path.name.startswith("asphalt") else (57,76,36)
            scale=.79 if path.name.startswith("asphalt") else 1.13
            image=image.point([min(255,round(offset+value*scale)) for offset in offsets for value in range(256)])
        image.save(args.output/path.name,quality=85,subsampling=0,optimize=True)
