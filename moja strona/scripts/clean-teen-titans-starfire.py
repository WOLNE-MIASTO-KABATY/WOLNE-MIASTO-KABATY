from PIL import Image, ImageFilter

SRC = r"C:\Users\mattb\.cursor\projects\c-Users-mattb-Downloads-Pulpit-moja-strona\assets\c__Users_mattb_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-481a7368-8614-4df8-8433-2a847d370017.png"
DST = r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\comics\mlodzi-tytani.png"


def rect(w, h, x0, y0, x1, y1):
    return (int(w * x0), int(h * y0), int(w * x1), int(h * y1))


def blur_box(img, box, radius=24):
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(img.width, x1), min(img.height, y1)
    region = img.crop((x0, y0, x1, y1))
    region = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(region, (x0, y0))


def patch_from(img, dst_box, src_box):
    patch = img.crop(src_box)
    patch = patch.resize((dst_box[2] - dst_box[0], dst_box[3] - dst_box[1]), Image.Resampling.LANCZOS)
    img.paste(patch, (dst_box[0], dst_box[1]))


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size

    # Mirror left sky onto right top for seamless night sky
    logo_box = rect(w, h, 0.52, 0.0, 1.0, 0.36)
    sky_src = rect(w, h, 0.02, 0.0, 0.52, 0.36)
    patch_from(img, logo_box, sky_src)
    blur_box(img, logo_box, radius=5)

    # Speech bubbles
    bubbles_box = rect(w, h, 0.70, 0.07, 0.99, 0.49)
    gap_sky = rect(w, h, 0.48, 0.10, 0.62, 0.38)
    patch_from(img, bubbles_box, gap_sky)
    blur_box(img, bubbles_box, radius=7)

    # Signature — blend into water/city
    mark_box = rect(w, h, 0.74, 0.91, 1.0, 1.0)
    water_src = rect(w, h, 0.48, 0.72, 0.70, 0.88)
    patch_from(img, mark_box, water_src)
    blur_box(img, mark_box, radius=5)

    img.save(DST, format="PNG", optimize=True)
    print(f"Saved {DST} ({w}x{h})")


if __name__ == "__main__":
    main()
