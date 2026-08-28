#!/usr/bin/env python3
"""Re-encode simple launcher artwork as compact 256-color PNG files."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from PIL import Image


ASSETS = (
    Path("assets/images/icon.png"),
    Path("assets/images/splash-icon.png"),
    Path("assets/images/android-icon-foreground.png"),
)


def optimize_png(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as image:
        image.load()
        suffix = path.suffix
        with tempfile.NamedTemporaryFile(
            dir=path.parent, suffix=suffix, delete=False
        ) as candidate_file:
            candidate = Path(candidate_file.name)
        try:
            # The launcher artwork is simple vector-like black, white and teal art.
            # Indexed PNG preserves crisp edges while avoiding full 24-bit storage.
            if image.mode in {"RGB", "RGBA"}:
                output = image.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
            else:
                output = image
            output.save(candidate, format="PNG", optimize=True, compress_level=9)
            after = candidate.stat().st_size
            if after < before:
                os.replace(candidate, path)
                return before, after
            return before, before
        finally:
            candidate.unlink(missing_ok=True)


def main() -> None:
    for asset in ASSETS:
        if not asset.is_file():
            raise FileNotFoundError(asset)
        before, after = optimize_png(asset)
        print(f"{asset}: {before} -> {after} bytes")


if __name__ == "__main__":
    main()
