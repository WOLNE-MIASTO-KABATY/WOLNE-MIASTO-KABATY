from PIL import Image

SRC = r"C:\Users\mattb\.cursor\projects\c-Users-mattb-Downloads-Pulpit-moja-strona\assets\c__Users_mattb_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-02ae2fcc-0f11-4bb6-b1aa-8db80369e807.png"
DST = r"C:\Users\mattb\Downloads\Pulpit\moja strona\moja strona\images\games\teen-titans.png"

# Crop bottom-right corner text (18titans / 1.4.2), keep original art untouched elsewhere.
CROP = {
    "left": 0,
    "top": 0,
    "right": 0.80,
    "bottom": 0.88,
}

img = Image.open(SRC).convert("RGB")
w, h = img.size
box = (
    int(w * CROP["left"]),
    int(h * CROP["top"]),
    int(w * CROP["right"]),
    int(h * CROP["bottom"]),
)
cropped = img.crop(box)
cropped.save(DST, format="PNG", optimize=True)
print(f"Saved {DST} {cropped.size}")
