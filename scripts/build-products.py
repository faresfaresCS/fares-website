#!/usr/bin/env python3
"""Convert Wix catalog_products.csv export into data/products.json."""

import csv
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(ROOT, "data", "catalog_products.csv")
RULES_PATH = os.path.join(ROOT, "data", "subcategory-rules.json")


def load_subcategory_rules() -> dict:
    if not os.path.isfile(RULES_PATH):
        return {}
    with open(RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


def classify_subcategories(name: str, collection: str, rules: dict) -> list[str]:
    cfg = rules.get(collection)
    if not cfg:
        return []
    matched: list[str] = []
    for sub in cfg.get("subcategories", []):
        label = sub["label"]
        for pattern in sub.get("keywords", []):
            if re.search(pattern, name, re.IGNORECASE):
                matched.append(label)
                break
    if cfg.get("exclusive") and matched:
        return [matched[0]]
    return matched


def assign_product_subcategories(products: list[dict], rules: dict) -> dict:
    tree: dict[str, list[str]] = {
        cat: [s["label"] for s in cfg.get("subcategories", [])]
        for cat, cfg in rules.items()
    }
    for product in products:
        by_collection: dict[str, list[str]] = {}
        for collection in product.get("collections", []):
            subs = classify_subcategories(product["name"], collection, rules)
            if subs:
                by_collection[collection] = subs
        product["subcategories"] = by_collection
    return tree


def strip_html(text: str, limit: int = 200) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def calc_prices(row: dict) -> tuple[float, float | None]:
    price = float(row.get("price") or 0)
    mode = row.get("discountMode", "")
    val = float(row.get("discountValue") or 0)
    if mode == "AMOUNT" and val:
        sale = price - val
        return price, sale if sale < price else None
    if mode == "PERCENT" and val:
        sale = round(price * (1 - val / 100), 2)
        return price, sale if sale < price else None
    return price, None


def build(csv_path: str) -> None:
    products = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("fieldType") != "Product":
                continue
            if row.get("visible", "").lower() != "true":
                continue

            price, sale_price = calc_prices(row)
            img = (row.get("productImageUrl") or "").strip()
            products.append(
                {
                    "id": row["handleId"],
                    "name": row["name"],
                    "price": price,
                    "salePrice": sale_price,
                    "image": (
                        f"https://static.wixstatic.com/media/{img}" if img else None
                    ),
                    "collections": [
                        c.strip()
                        for c in (row.get("collection") or "").split(";")
                        if c.strip()
                    ],
                    "ribbon": row.get("ribbon") or None,
                    "brand": row.get("brand") or None,
                    "inventory": row.get("inventory"),
                    "excerpt": strip_html(row.get("description", "")),
                    "description": row.get("description", ""),
                }
            )

    collections = sorted({c for p in products for c in p["collections"]})
    collection_counts: dict[str, int] = {}
    for p in products:
        for c in p["collections"]:
            collection_counts[c] = collection_counts.get(c, 0) + 1
    collection_meta = [
        {"name": name, "count": collection_counts[name]} for name in collections
    ]
    brand_counts: dict[str, int] = {}
    ribbon_counts: dict[str, int] = {}
    sale_count = 0
    for p in products:
        if p.get("brand"):
            brand_counts[p["brand"]] = brand_counts.get(p["brand"], 0) + 1
        if p.get("ribbon"):
            ribbon_counts[p["ribbon"]] = ribbon_counts.get(p["ribbon"], 0) + 1
        if p.get("salePrice") is not None:
            sale_count += 1
    brand_meta = sorted(
        [{"name": name, "count": count} for name, count in brand_counts.items()],
        key=lambda x: (-x["count"], x["name"]),
    )
    ribbon_meta = sorted(
        [{"name": name, "count": count} for name, count in ribbon_counts.items()],
        key=lambda x: (-x["count"], x["name"]),
    )
    rules = load_subcategory_rules()
    subcategory_tree = assign_product_subcategories(products, rules)
    subcategory_meta: dict[str, list[dict]] = {}
    for cat, labels in subcategory_tree.items():
        counts = {label: 0 for label in labels}
        for p in products:
            if cat not in p.get("collections", []):
                continue
            for label in p.get("subcategories", {}).get(cat, []):
                if label in counts:
                    counts[label] += 1
        subcategory_meta[cat] = [
            {"name": label, "count": counts[label]} for label in labels
        ]
    payload = {
        "meta": {
            "storeName": "פארס פארס",
            "tagline": "חומרי בניין, צבע, אינסטלציה וכלי עבודה",
            "address": "רחוב ח'ורי 33, חיפה",
        },
        "collections": collections,
        "collectionMeta": collection_meta,
        "brandMeta": brand_meta,
        "ribbonMeta": ribbon_meta,
        "saleCount": sale_count,
        "subcategoryTree": subcategory_tree,
        "subcategoryMeta": subcategory_meta,
        "products": products,
    }

    out = os.path.join(ROOT, "data", "products.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    dest_csv = os.path.join(ROOT, "data", "catalog_products.csv")
    if os.path.abspath(csv_path) != os.path.abspath(dest_csv):
        shutil.copy(csv_path, dest_csv)

    print(f"Wrote {len(products)} products → {out}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    build(src)
