import { readFileSync } from "node:fs";
import { join } from "node:path";

let catalogCache = null;

function loadCatalog() {
  if (catalogCache) return catalogCache;
  const path = join(process.cwd(), "data", "products.json");
  catalogCache = JSON.parse(readFileSync(path, "utf8"));
  return catalogCache;
}

function isInStock(product) {
  const inv = (product.inventory || "").toLowerCase();
  return inv !== "outofstock" && inv !== "out of stock";
}

function effectivePrice(product) {
  return product.salePrice != null ? product.salePrice : product.price;
}

/** Validate client cart against server catalog; returns priced line items. */
export function validateCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty");
  }

  const catalog = loadCatalog();
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const lines = [];
  let total = 0;

  for (const row of items) {
    const id = String(row?.productId || row?.id || "");
    const qty = Number(row?.qty);
    if (!id || !Number.isFinite(qty) || qty < 1 || qty > 99) {
      throw new Error(`Invalid cart line: ${id}`);
    }

    const product = byId.get(id);
    if (!product) throw new Error(`Unknown product: ${id}`);
    if (!isInStock(product)) throw new Error(`Out of stock: ${product.name}`);

    const unitPrice = effectivePrice(product);
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    lines.push({
      productId: id,
      name: product.name,
      qty,
      unitPrice,
      lineTotal,
    });
  }

  if (total <= 0) throw new Error("Invalid cart total");

  return { lines, total: Math.round(total * 100) / 100, currency: "ILS" };
}
