"""Create an installable archive using only Python's standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent
with ZipFile(root / "shared-connections.zip", "w", ZIP_DEFLATED) as archive:
    for name in ("manifest.json", "main.js", "styles.css"):
        archive.write(root / name, "shared-connections/" + name)
print(root / "shared-connections.zip")
