from PIL import Image
import os

INPUT_IMAGE = "logo-original.png"
OUTPUT_DIR = "assets/logos"

SIZES = {
    "logo-xs": 32, "logo-sm": 48, "logo-md": 64,
    "logo-lg": 128, "logo-xl": 256,
    "icon-192": 192, "icon-512": 512,
}

def remove_white_background(img, threshold=245):
    """تحويل البكسلات البيضاء إلى شفافة"""
    img = img.convert("RGBA")
    datas = img.getdata()
    new_data = []
    for item in datas:
        # لو البكسل أبيض أو قريب من الأبيض، نجعله شفاف
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    return img

def process_logo():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print("Opening image...")
    img = Image.open(INPUT_IMAGE)

    print("Removing white background...")
    transparent = remove_white_background(img)

    transparent.save(f"{OUTPUT_DIR}/logo-transparent.png")
    print("OK: logo-transparent.png")

    for name, size in SIZES.items():
        resized = transparent.copy()
        resized.thumbnail((size, size), Image.Resampling.LANCZOS)
        resized.save(f"{OUTPUT_DIR}/{name}.png")
        print(f"OK: {name}.png ({size}x{size})")

    transparent.save(f"{OUTPUT_DIR}/favicon.ico", format="ICO", sizes=[(32, 32), (48, 48), (64, 64)])
    print("OK: favicon.ico")

if __name__ == "__main__":
    process_logo()
    print("\nDone! All logos in assets/logos/")
