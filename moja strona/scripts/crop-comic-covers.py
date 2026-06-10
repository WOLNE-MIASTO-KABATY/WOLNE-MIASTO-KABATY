from PIL import Image

COVERS = [
    r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\comics\iniemamocni.png",
    r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\comics\mlodzi-tytani.png",
]

# Keep top portion, trim bottom (~14%)
KEEP_RATIO = 0.86


def main():
    for path in COVERS:
        img = Image.open(path).convert("RGB")
        w, h = img.size
        new_h = int(h * KEEP_RATIO)
        cropped = img.crop((0, 0, w, new_h))
        cropped.save(path, format="PNG", optimize=True)
        print(f"{path} -> {cropped.size}")


if __name__ == "__main__":
    main()
