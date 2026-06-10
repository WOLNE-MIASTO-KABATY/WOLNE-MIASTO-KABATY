from PIL import Image, ImageFilter

SRC = r"C:\Users\mattb\.cursor\projects\c-Users-mattb-Downloads-Pulpit-moja-strona\assets\c__Users_mattb_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-209c7d9a-213c-4699-bfc7-2c640f2328f8.png"
DST = r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\games\teen-titans.png"


def rect(w, h, x0, y0, x1, y1):
    return (
        int(w * x0),
        int(h * y0),
        int(w * x1),
        int(h * y1),
    )


def blur_box(img, box, radius=22):
    x0, y0, x1, y1 = box
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(img.width, x1)
    y1 = min(img.height, y1)
    if x1 <= x0 or y1 <= y0:
        return
    region = img.crop((x0, y0, x1, y1))
    region = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(region, (x0, y0))


def patch_from_below(img, box, sample_offset=0.02):
    x0, y0, x1, y1 = box
    sh = y1 - y0
    sy1 = min(img.height, y1 + int(img.height * sample_offset))
    sy0 = sy1 - sh
    if sy0 < 0:
        return
    patch = img.crop((x0, sy0, x1, sy1))
    img.paste(patch, (x0, y0))


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size

    # Remove "18 TITANS" — patch + heavy blur
    title_box = rect(w, h, 0.12, 0.0, 0.88, 0.15)
    patch_from_below(img, title_box, sample_offset=0.03)
    blur_box(img, title_box, radius=28)

    # Remove GF logo top-left
    logo_box = rect(w, h, 0.0, 0.0, 0.12, 0.12)
    blur_box(img, logo_box, radius=24)

    # Remove "Download" button
    dl_box = rect(w, h, 0.24, 0.82, 0.76, 0.98)
    patch_from_below(img, dl_box, sample_offset=0.04)
    blur_box(img, dl_box, radius=30)

    # Blur censorship on exposed chests (not black bars)
    blur_regions = [
        rect(w, h, 0.33, 0.49, 0.49, 0.66),   # center Starfire
        rect(w, h, 0.49, 0.49, 0.65, 0.66),   # center Raven
        rect(w, h, 0.02, 0.58, 0.20, 0.76),   # left Starfire
        rect(w, h, 0.14, 0.44, 0.30, 0.60),   # left Raven
        rect(w, h, 0.74, 0.68, 0.94, 0.84),   # bottom-right
        rect(w, h, 0.68, 0.30, 0.84, 0.44),   # upper-right pair
        rect(w, h, 0.04, 0.24, 0.20, 0.38),   # top-left blonde
        rect(w, h, 0.78, 0.54, 0.96, 0.70),   # masked character
    ]
    for box in blur_regions:
        blur_box(img, box, radius=20)

    img.save(DST, format="PNG", optimize=True)
    print(f"Saved {DST} ({w}x{h})")


if __name__ == "__main__":
    main()
