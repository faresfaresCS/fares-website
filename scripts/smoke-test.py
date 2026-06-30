#!/usr/bin/env python3
"""Basic smoke tests for the static storefront (run against a local server)."""

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"


def fetch(path: str) -> tuple[int, str, dict]:
    req = urllib.request.Request(f"{BASE}{path}", headers={"User-Agent": "smoke-test/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, body, dict(resp.headers)


def main() -> int:
    errors: list[str] = []

    for path in [
        "/",
        "/index.html",
        "/data/products.json",
        "/js/config.js",
        "/js/app.js",
        "/robots.txt",
        "/sitemap.xml",
        "/favicon.svg",
        "/og-image.png",
        "/apple-touch-icon.png",
        "/checkout/success.html",
        "/checkout/error.html",
    ]:
        try:
            status, _, _ = fetch(path)
            if status != 200:
                errors.append(f"{path}: HTTP {status}")
        except urllib.error.URLError as e:
            errors.append(f"{path}: {e}")
            print("Smoke test failed — is the server running?\n  python3 -m http.server 8080")
            return 1

    _, config_js, _ = fetch("/js/config.js")
    if "972500000000" in config_js:
        errors.append("config.js still has placeholder WhatsApp number")

    _, products_raw, _ = fetch("/data/products.json")
    catalog = json.loads(products_raw)
    products = catalog.get("products", [])
    if len(products) < 800:
        errors.append(f"expected ~838 products, got {len(products)}")

    sample = next((p for p in products if p.get("image")), None)
    if not sample:
        errors.append("no product images found")
    else:
        img_url = sample["image"]
        if not img_url.startswith("http"):
            errors.append(f"unexpected image URL: {img_url}")
        else:
            try:
                subprocess.run(
                    ["curl", "-fsSL", "-o", "/dev/null", img_url],
                    check=True,
                    capture_output=True,
                    timeout=20,
                )
            except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
                errors.append(f"sample image fetch failed: {e}")

    _, html, _ = fetch("/")
    _, css, _ = fetch("/css/styles.css")
    _, app_js, _ = fetch("/js/app.js")

    wa_match = re.search(r'whatsapp:\s*"(\d+)"', config_js)
    if wa_match and "שליחת הזמנה בוואטסאפ" not in html:
        errors.append("checkout WhatsApp button missing from index.html")

    if "og-image.png" not in html:
        errors.append("Open Graph image meta tag missing from index.html")
    if "apple-touch-icon.png" not in html:
        errors.append("apple-touch-icon link missing from index.html")
    if 'id="checkout-hyp"' not in html:
        errors.append("Hyp checkout button missing from index.html")
    if "pointer-events: none" not in css or ".panel.open" not in css:
        errors.append("panel pointer-events fix missing from styles.css")
    if 'id="product-modal"' not in html or 'id="close-modal"' not in html:
        errors.append("product modal markup missing from index.html")
    if 'id="overlay"' not in html:
        errors.append("overlay element missing from index.html")
    broken_images = [p for p in products if p.get("image") and ";" in p["image"]]
    if broken_images:
        errors.append(f"{len(broken_images)} products have malformed image URLs (semicolon in URL)")

    if errors:
        print("Smoke test FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"Smoke test OK ({len(products)} products, base={BASE})")
    if wa_match:
        print(f"  WhatsApp configured: {wa_match.group(1)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
