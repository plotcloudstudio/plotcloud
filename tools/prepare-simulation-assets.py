"""Encode approved imagegen edits and build a visual QA sheet, without changing composition."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[1]
records = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
tiles = []
for record in records:
    source = Path(record["source"])
    with Image.open(source) as image:
        image = image.convert("RGB")
        record["dimensions"] = list(image.size)
        if image.width < 1200 or abs(image.width / image.height - 1672 / 941) > .025:
            raise ValueError(f"Unexpected master framing: {record['id']} {image.size}")
        image.save(root / "mvp/img/home" / (record["id"] + ".webp"), "WEBP", quality=90, method=6)
        tile = Image.new("RGB", (334, 212), "white")
        tile.paste(ImageOps.contain(image, (334, 188)), (0, 0))
        ImageDraw.Draw(tile).text((8, 193), record["id"] + " / " + record["master"], fill="#172739")
        tiles.append(tile)
sheet = Image.new("RGB", (4 * 350, ((len(tiles) + 3) // 4) * 228), "#e9edf1")
for i, tile in enumerate(tiles):
    sheet.paste(tile, (8 + (i % 4) * 350, 8 + (i // 4) * 228))
output = root / "tmp/simulation-master-models-contact-sheet.png"
output.parent.mkdir(parents=True, exist_ok=True)
sheet.save(output)
print(json.dumps({"encoded": len(records), "contactSheet": str(output)}))
