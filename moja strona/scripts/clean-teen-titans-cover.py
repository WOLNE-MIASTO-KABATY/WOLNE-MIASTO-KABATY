from PIL import Image, ImageFilter, ImageStat

SRC = r"C:\Users\mattb\.cursor\projects\c-Users-mattb-Downloads-Pulpit-moja-strona\assets\c__Users_mattb_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-02ae2fcc-0f11-4bb6-b1aa-8db80369e807.png"
DST = r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\games\teen-titans.png"


def rect(w, h, x0, y0, x1, y1):
    return (int(w * x0), int(h * y0), int(w * x1), int(h * y1))


def blur_box(img, box, radius=24):
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(img.width, x1), min(img.height, y1)
    region = img.crop((x0, y0, x1, y1))
    region = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(region, (x0, y0))


def fill_from_sample(img, dst_box, src_box):
    sample = img.crop(src_box)
    color = tuple(int(v) for v in ImageStat.Stat(sample).mean)
    x0, y0, x1, y1 = dst_box
    block = Image.new("RGB", (x1 - x0, y1 - y0), color)
    img.paste(block, (x0, y0))


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size

    # Entire early access label block
    label_box = rect(w, h, 0.30, 0.545, 0.70, 0.82)

    # Split: left on sky, right on tower
    mid_x = int(w * 0.52)
    left_box = (label_box[0], label_box[1], mid_x, label_box[3])
    right_box = (mid_x, label_box[1], label_box[2], label_box[3])

    fill_from_sample(img, left_box, rect(w, h, 0.10, 0.34, 0.34, 0.50))
    fill_from_sample(img, right_box, rect(w, h, 0.60, 0.40, 0.78, 0.52))

    blur_box(img, label_box, radius=12)

    img.save(DST, format="PNG", optimize=True)
    print(f"Saved {DST} ({w}x{h})")


if __name__ == "__main__":
    main()
