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

    for path in ["/", "/index.html", "/data/products.json", "/js/config.js", "/js/app.js", "/robots.txt", "/sitemap.xml", "/favicon.svg"]:
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

    wa_match = re.search(r'whatsapp:\s*"(\d+)"', config_js)
    if wa_match:
        phone = wa_match.group(1)
        wa_href = f"https://wa.me/{phone}"
        _, html, _ = fetch("/")
        if "שליחת הזמנה בוואטסאפ" not in html:
            errors.append("checkout WhatsApp button missing from index.html")

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
