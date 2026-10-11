import json
import urllib.request
import base64
import os
import sys
from PIL import Image

def generate_card_art(prompt, card_name, size=(1024, 1024)):
    cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    api_key = cfg["api_key"]
    url = "https://token.sensenova.cn/v1/images/generations"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "sensenova-u1.5-lite",
        "prompt": prompt,
        "size": f"{size[0]}x{size[1]}",
        "n": 1
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    print(f"[SenseNova] Generating '{card_name}' ...")
    with urllib.request.urlopen(req, timeout=120) as resp:
        res = json.loads(resp.read().decode("utf-8"))

    b64_data = res["data"][0]["b64_json"]
    raw_bytes = base64.b64decode(b64_data)

    cards_dir = r"d:\sync\project\Spectromancer\android\public\cards"
    master_path = os.path.join(cards_dir, f"{card_name}_master.png")
    with open(master_path, "wb") as f:
        f.write(raw_bytes)

    im = Image.open(master_path).convert("RGB")
    w, h = im.size

    # Seamlessly blend out corner watermark
    patch = im.crop((w - 450, h - 220, w - 150, h))
    mask = Image.new("L", patch.size, 0)
    for x in range(mask.width):
        alpha = int(255 * (x / mask.width))
        for y in range(mask.height):
            mask.putpixel((x, y), alpha)
    im.paste(patch, (w - 300, h - 220), mask)
    im.save(master_path, "PNG")

    return im, master_path

if __name__ == "__main__":
    if len(sys.argv) > 2:
        generate_card_art(sys.argv[1], sys.argv[2])
