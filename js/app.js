const config = window.STORE_CONFIG;
const CART_KEY = "fares-cart-v1";
const UNCATEGORIZED = "__uncategorized__";
const UNCATEGORIZED_LABEL = "ללא קטגוריה";
const URL_CAT_NONE = "_none";

let catalog = {
  products: [],
  collections: [],
  collectionMeta: [],
  brandMeta: [],
  ribbonMeta: [],
  subcategoryTree: {},
  subcategoryMeta: {},
  meta: {},
};
let filtered = [];
let activeCategory = "";
let activeSubcategory = "";
let activeBrand = "";
let activeRibbon = "";
let onSaleOnly = false;
let searchQuery = "";
let currentPage = 1;
let categoryCountMap = null;

const $ = (sel) => document.querySelector(sel);

function formatPrice(n) {
  return `₪${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
}

function effectivePrice(p) {
  return p.salePrice != null ? p.salePrice : p.price;
}

function isInStock(p) {
  const inv = (p.inventory || "").toLowerCase();
  return inv !== "outofstock" && inv !== "out of stock";
}

function whatsappLink(text) {
  const phone = config.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function cartTotal(cart) {
  return Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = catalog.products.find((x) => x.id === id);
    return sum + (p ? effectivePrice(p) * qty : 0);
  }, 0);
}

function updateCartBadge() {
  const cart = loadCart();
  const badge = $("#cart-badge");
  const n = cartCount(cart);
  badge.textContent = String(n);
  badge.classList.toggle("visible", n > 0);
}

function buildCategoryCountMap() {
  if (categoryCountMap) return categoryCountMap;
  if (catalog.collectionMeta?.length) {
    categoryCountMap = Object.fromEntries(
      catalog.collectionMeta.map((c) => [c.name, c.count])
    );
    const uncategorized = catalog.products.filter((p) => !p.collections.length).length;
    if (uncategorized > 0) categoryCountMap[UNCATEGORIZED] = uncategorized;
    return categoryCountMap;
  }
  categoryCountMap = {};
  for (const p of catalog.products) {
    if (!p.collections.length) {
      categoryCountMap[UNCATEGORIZED] = (categoryCountMap[UNCATEGORIZED] || 0) + 1;
      continue;
    }
    for (const c of p.collections) {
      categoryCountMap[c] = (categoryCountMap[c] || 0) + 1;
    }
  }
  return categoryCountMap;
}

function getCategoryList() {
  const counts = buildCategoryCountMap();
  const items = catalog.collections.map((name) => ({
    id: name,
    label: name,
    count: counts[name] || 0,
  }));
  if (counts[UNCATEGORIZED] > 0) {
    items.push({
      id: UNCATEGORIZED,
      label: UNCATEGORIZED_LABEL,
      count: counts[UNCATEGORIZED],
    });
  }
  return items;
}

function categoryLabel(cat) {
  if (!cat) return "";
  return cat === UNCATEGORIZED ? UNCATEGORIZED_LABEL : cat;
}

function productMatchesCategory(p, cat) {
  if (!cat) return true;
  if (cat === UNCATEGORIZED) return p.collections.length === 0;
  return p.collections.includes(cat);
}

function productMatchesSubcategory(p, cat, sub) {
  if (!sub || !cat) return true;
  const subs = p.subcategories?.[cat] || [];
  return subs.includes(sub);
}

function getSubcategoriesForCategory(cat) {
  if (!cat || cat === UNCATEGORIZED) return [];
  return catalog.subcategoryTree?.[cat] || [];
}

function getSubcategoryFacets() {
  if (!activeCategory || activeCategory === UNCATEGORIZED) return [];
  const labels = getSubcategoriesForCategory(activeCategory);
  if (!labels.length) return [];
  const pool = getFacetPool({
    excludeBrand: true,
    excludeRibbon: true,
    excludeSale: true,
    excludeSubcategory: true,
  });
  const counts = Object.fromEntries(labels.map((l) => [l, 0]));
  for (const p of pool) {
    for (const label of p.subcategories?.[activeCategory] || []) {
      if (label in counts) counts[label] += 1;
    }
  }
  return labels
    .map((name) => ({ name, count: counts[name] || 0 }))
    .filter((s) => s.count > 0);
}

function productMatchesSearch(p, q) {
  if (!q) return true;
  return (
    p.name.toLowerCase().includes(q) ||
    (p.brand && p.brand.toLowerCase().includes(q)) ||
    p.collections.some((c) => c.toLowerCase().includes(q)) ||
    (p.excerpt && p.excerpt.toLowerCase().includes(q))
  );
}

function productMatchesSubfilters(p, { brand = true, ribbon = true, sale = true } = {}) {
  if (brand && activeBrand && p.brand !== activeBrand) return false;
  if (ribbon && activeRibbon && p.ribbon !== activeRibbon) return false;
  if (sale && onSaleOnly && p.salePrice == null) return false;
  return true;
}

function getFacetPool({ excludeBrand = false, excludeRibbon = false, excludeSale = false, excludeSubcategory = false } = {}) {
  const q = searchQuery.trim().toLowerCase();
  return catalog.products.filter((p) => {
    if (!productMatchesCategory(p, activeCategory)) return false;
    if (!productMatchesSearch(p, q)) return false;
    if (!excludeSubcategory && !productMatchesSubcategory(p, activeCategory, activeSubcategory)) {
      return false;
    }
    if (!productMatchesSubfilters(p, {
      brand: !excludeBrand,
      ribbon: !excludeRibbon,
      sale: !excludeSale,
    })) return false;
    return true;
  });
}

function countFacets(products, field) {
  const counts = {};
  for (const p of products) {
    const value = p[field];
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "he"));
}

function getBrandFacets() {
  return countFacets(getFacetPool({ excludeBrand: true }), "brand");
}

function getRibbonFacets() {
  return countFacets(getFacetPool({ excludeRibbon: true }), "ribbon");
}

function getSaleFacetCount() {
  return getFacetPool({ excludeSale: true }).filter((p) => p.salePrice != null).length;
}

function applyFilters() {
  const q = searchQuery.trim().toLowerCase();
  filtered = catalog.products.filter((p) => {
    if (!productMatchesCategory(p, activeCategory)) return false;
    if (!productMatchesSubcategory(p, activeCategory, activeSubcategory)) return false;
    if (!productMatchesSearch(p, q)) return false;
    if (!productMatchesSubfilters(p)) return false;
    return true;
  });
  currentPage = 1;
  updateResultsMeta();
  syncUrlState();
  syncSubcategoryUI();
  syncSubfilterUI();
  renderProducts();
}

function setCategory(cat, { scroll = true } = {}) {
  activeCategory = cat;
  activeSubcategory = "";
  syncCategoryUI();
  applyFilters();
  if (scroll) {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }
}

function setSubcategory(sub, { scroll = false } = {}) {
  activeSubcategory = sub;
  syncSubcategoryUI();
  applyFilters();
  if (scroll) {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }
}

function setBrand(brand) {
  activeBrand = brand;
  applyFilters();
}

function setRibbon(ribbon) {
  activeRibbon = ribbon;
  applyFilters();
}

function setOnSaleOnly(enabled) {
  onSaleOnly = enabled;
  applyFilters();
}

function syncCategoryUI() {
  renderCategoryChips();
  renderCategorySidebar();
}

function syncSubcategoryUI() {
  renderSubcategoryBar();
}

function getSubcategoryThumbnail(category, subName) {
  const product = catalog.products.find((p) => {
    if (!productMatchesCategory(p, category)) return false;
    if (!subName) return Boolean(p.image);
    return (p.subcategories?.[category] || []).includes(subName) && p.image;
  });
  return product?.image || null;
}

function subcategoryTileHtml(subName, label, count, imageUrl) {
  const active = activeSubcategory === subName ? " active" : "";
  const imgContent = imageUrl
    ? `<img src="${escapeAttr(imageUrl)}" alt="" loading="lazy" />`
    : `<span class="subcategory-tile-placeholder">${escapeHtml(label.charAt(0))}</span>`;
  return `
    <button type="button" class="subcategory-tile${active}" data-sub="${escapeAttr(subName)}" role="tab" aria-selected="${activeSubcategory === subName}">
      <span class="subcategory-tile-img">${imgContent}</span>
      <span class="subcategory-tile-label">${escapeHtml(label)}</span>
      <span class="subcategory-tile-count">${count.toLocaleString("he-IL")} מוצרים</span>
    </button>`;
}

function updateSubcategoryScrollButtons() {
  const carousel = $("#subcategory-chips");
  const prev = $("#subcategory-scroll-prev");
  const next = $("#subcategory-scroll-next");
  if (!carousel || !prev || !next) return;
  const maxScroll = carousel.scrollWidth - carousel.clientWidth;
  if (maxScroll <= 4) {
    prev.hidden = true;
    next.hidden = true;
    return;
  }
  prev.hidden = false;
  next.hidden = false;
  prev.disabled = carousel.scrollLeft <= 4;
  next.disabled = carousel.scrollLeft >= maxScroll - 4;
}

function bindSubcategoryCarousel() {
  const carousel = $("#subcategory-chips");
  const prev = $("#subcategory-scroll-prev");
  const next = $("#subcategory-scroll-next");
  if (!carousel) return;

  const step = 200;
  prev?.addEventListener("click", () => {
    carousel.scrollBy({ left: -step, behavior: "smooth" });
  });
  next?.addEventListener("click", () => {
    carousel.scrollBy({ left: step, behavior: "smooth" });
  });
  carousel.addEventListener("scroll", () => updateSubcategoryScrollButtons(), { passive: true });
}

function renderSubcategoryBar() {
  const bar = $("#subcategory-bar");
  const el = $("#subcategory-chips");
  const title = $("#subcategory-bar-title");
  if (!bar || !el) return;

  const facets = getSubcategoryFacets();
  if (!activeCategory || !facets.length) {
    bar.hidden = true;
    el.innerHTML = "";
    return;
  }

  bar.hidden = false;
  if (title) {
    title.textContent = categoryLabel(activeCategory);
  }

  const allCount = getFacetPool({
    excludeBrand: true,
    excludeRibbon: true,
    excludeSale: true,
    excludeSubcategory: true,
  }).length;
  const allImage = getSubcategoryThumbnail(activeCategory, "");

  el.innerHTML = [
    subcategoryTileHtml("", "הכל", allCount, allImage),
    ...facets.map((s) =>
      subcategoryTileHtml(s.name, s.name, s.count, getSubcategoryThumbnail(activeCategory, s.name))
    ),
  ].join("");

  el.querySelectorAll(".subcategory-tile").forEach((btn) => {
    btn.addEventListener("click", () => setSubcategory(btn.dataset.sub || ""));
  });

  requestAnimationFrame(() => {
    el.scrollLeft = 0;
    updateSubcategoryScrollButtons();
  });
}

function syncSubfilterUI() {
  renderSubfiltersSidebar();
  renderSubfiltersMobile();
}

function renderCategoryChips() {
  const el = $("#categories");
  el.innerHTML = [
    `<button type="button" class="chip${activeCategory === "" ? " active" : ""}" data-cat="">הכל</button>`,
    ...getCategoryList().map(
      (c) =>
        `<button type="button" class="chip${activeCategory === c.id ? " active" : ""}" data-cat="${escapeAttr(c.id)}">${escapeHtml(c.label)}</button>`
    ),
  ].join("");
  el.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => setCategory(btn.dataset.cat || ""));
  });
}

function renderCategorySidebar() {
  const el = $("#category-sidebar-list");
  if (!el) return;
  const allCount = catalog.products.length;
  const items = [
    { id: "", label: "הכל", count: allCount },
    ...getCategoryList(),
  ];
  el.innerHTML = items
    .map(
      (c) => `
    <button type="button" class="category-item${activeCategory === c.id ? " active" : ""}" data-cat="${escapeAttr(c.id)}">
      <span>${escapeHtml(c.label)}</span>
      <span class="count">(${c.count.toLocaleString("he-IL")})</span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => setCategory(btn.dataset.cat || ""));
  });
}

function renderSubfiltersSidebar() {
  const saleCount = getSaleFacetCount();
  const brands = getBrandFacets();
  const ribbons = getRibbonFacets();

  const optionsEl = $("#subfilter-options");
  if (optionsEl) {
    optionsEl.innerHTML =
      saleCount > 0
        ? `<button type="button" class="subfilter-toggle${onSaleOnly ? " active" : ""}" id="sidebar-sale-toggle">
            <span>במבצע בלבד</span>
            <span class="count">(${saleCount.toLocaleString("he-IL")})</span>
          </button>`
        : "";
    $("#sidebar-sale-toggle")?.addEventListener("click", () => setOnSaleOnly(!onSaleOnly));
  }

  const brandsWrap = $("#subfilter-brands-wrap");
  const brandsEl = $("#subfilter-brands");
  if (brandsWrap && brandsEl) {
    if (brands.length) {
      brandsWrap.hidden = false;
      brandsEl.innerHTML = [
        `<button type="button" class="subfilter-item${activeBrand === "" ? " active" : ""}" data-brand="">כל המותגים</button>`,
        ...brands.map(
          (b) =>
            `<button type="button" class="subfilter-item${activeBrand === b.name ? " active" : ""}" data-brand="${escapeAttr(b.name)}">
              <span>${escapeHtml(b.name)}</span>
              <span class="count">(${b.count.toLocaleString("he-IL")})</span>
            </button>`
        ),
      ].join("");
      brandsEl.querySelectorAll("[data-brand]").forEach((btn) => {
        btn.addEventListener("click", () => setBrand(btn.dataset.brand || ""));
      });
    } else {
      brandsWrap.hidden = true;
      brandsEl.innerHTML = "";
    }
  }

  const ribbonsWrap = $("#subfilter-ribbons-wrap");
  const ribbonsEl = $("#subfilter-ribbons");
  if (ribbonsWrap && ribbonsEl) {
    if (ribbons.length) {
      ribbonsWrap.hidden = false;
      ribbonsEl.innerHTML = [
        `<button type="button" class="subfilter-item${activeRibbon === "" ? " active" : ""}" data-ribbon="">כל התוויות</button>`,
        ...ribbons.map(
          (r) =>
            `<button type="button" class="subfilter-item${activeRibbon === r.name ? " active" : ""}" data-ribbon="${escapeAttr(r.name)}">
              <span>${escapeHtml(r.name)}</span>
              <span class="count">(${r.count.toLocaleString("he-IL")})</span>
            </button>`
        ),
      ].join("");
      ribbonsEl.querySelectorAll("[data-ribbon]").forEach((btn) => {
        btn.addEventListener("click", () => setRibbon(btn.dataset.ribbon || ""));
      });
    } else {
      ribbonsWrap.hidden = true;
      ribbonsEl.innerHTML = "";
    }
  }
}

function renderSubfiltersMobile() {
  const brands = getBrandFacets();
  const ribbons = getRibbonFacets();
  const saleCount = getSaleFacetCount();

  const brandSelect = $("#brand-select");
  if (brandSelect) {
    brandSelect.innerHTML = [
      `<option value="">כל המותגים</option>`,
      ...brands.map(
        (b) =>
          `<option value="${escapeAttr(b.name)}"${activeBrand === b.name ? " selected" : ""}>${escapeHtml(b.name)} (${b.count})</option>`
      ),
    ].join("");
    brandSelect.onchange = () => setBrand(brandSelect.value);
  }

  const saleToggle = $("#sale-toggle");
  if (saleToggle) {
    saleToggle.hidden = saleCount === 0;
    saleToggle.classList.toggle("active", onSaleOnly);
    saleToggle.onclick = () => setOnSaleOnly(!onSaleOnly);
  }

  const ribbonSelect = $("#ribbon-select");
  if (ribbonSelect) {
    if (ribbons.length) {
      ribbonSelect.hidden = false;
      ribbonSelect.innerHTML = [
        `<option value="">כל התוויות</option>`,
        ...ribbons.map(
          (r) =>
            `<option value="${escapeAttr(r.name)}"${activeRibbon === r.name ? " selected" : ""}>${escapeHtml(r.name)} (${r.count})</option>`
        ),
      ].join("");
      ribbonSelect.onchange = () => setRibbon(ribbonSelect.value);
    } else {
      ribbonSelect.hidden = true;
      ribbonSelect.innerHTML = `<option value="">כל התוויות</option>`;
    }
  }
}

function updateResultsMeta() {
  const total = filtered.length;
  const parts = [];
  if (activeCategory) parts.push(categoryLabel(activeCategory));
  if (activeSubcategory) parts.push(activeSubcategory);
  if (activeBrand) parts.push(activeBrand);
  if (onSaleOnly) parts.push("במבצע");
  if (activeRibbon) parts.push(activeRibbon);
  parts.push(`${total.toLocaleString("he-IL")} מוצרים`);
  $("#results-count").textContent = parts.join(" · ");

  const hasFilters =
    activeCategory ||
    activeSubcategory ||
    activeBrand ||
    onSaleOnly ||
    activeRibbon ||
    searchQuery.trim();
  const clearBtn = $("#clear-filters");
  if (clearBtn) clearBtn.hidden = !hasFilters;
}

function clearFilters() {
  activeCategory = "";
  activeSubcategory = "";
  activeBrand = "";
  activeRibbon = "";
  onSaleOnly = false;
  searchQuery = "";
  const input = $("#search-input");
  if (input) input.value = "";
  syncCategoryUI();
  applyFilters();
}

function categoryToUrlParam(cat) {
  if (!cat) return "";
  if (cat === UNCATEGORIZED) return URL_CAT_NONE;
  return cat;
}

function categoryFromUrlParam(param) {
  if (!param) return "";
  if (param === URL_CAT_NONE) return UNCATEGORIZED;
  if (param === UNCATEGORIZED) return UNCATEGORIZED;
  if (catalog.collections.includes(param)) return param;
  return "";
}

function syncUrlState() {
  const params = new URLSearchParams();
  const catParam = categoryToUrlParam(activeCategory);
  if (catParam) params.set("cat", catParam);
  if (activeSubcategory) params.set("sub", activeSubcategory);
  if (activeBrand) params.set("brand", activeBrand);
  if (activeRibbon) params.set("ribbon", activeRibbon);
  if (onSaleOnly) params.set("sale", "1");
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  history.replaceState(null, "", url);
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const cat = categoryFromUrlParam(params.get("cat") || "");
  const q = params.get("q") || "";
  const sub = params.get("sub") || "";
  const brand = params.get("brand") || "";
  const ribbon = params.get("ribbon") || "";
  const sale = params.get("sale") === "1";
  if (cat) activeCategory = cat;
  if (sub) activeSubcategory = sub;
  if (brand) activeBrand = brand;
  if (ribbon) activeRibbon = ribbon;
  if (sale) onSaleOnly = true;
  if (q) {
    searchQuery = q;
    const input = $("#search-input");
    if (input) input.value = q;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function renderProducts() {
  const grid = $("#product-grid");
  const empty = $("#empty-state");
  const pagination = $("#pagination");
  const pageSize = config.pageSize || 24;
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  $("#page-info").textContent =
    total > 0 ? `עמוד ${currentPage} מתוך ${pages}` : "";

  if (total === 0) {
    grid.hidden = true;
    empty.hidden = false;
    pagination.hidden = true;
    return;
  }

  empty.hidden = true;
  grid.hidden = false;
  grid.innerHTML = slice.map(productCardHtml).join("");
  bindProductCards();
  renderPagination(pages);
}

function productCardHtml(p) {
  const sale = p.salePrice != null;
  const inStock = isInStock(p);
  const prices = sale
    ? `<span class="price-sale">${formatPrice(p.salePrice)}</span><span class="price-old">${formatPrice(p.price)}</span>`
    : `<span class="price-regular">${formatPrice(p.price)}</span>`;
  const ribbon = p.ribbon
    ? `<span class="ribbon">${escapeHtml(p.ribbon)}</span>`
    : "";
  const stockBadge = inStock ? "" : `<span class="ribbon out-of-stock">אזל מהמלאי</span>`;
  const addBtn = inStock
    ? `<button type="button" class="btn-add" data-add="${escapeAttr(p.id)}">הוספה לעגלה</button>`
    : `<button type="button" class="btn-add" disabled>אזל מהמלאי</button>`;
  return `
    <article class="product-card${inStock ? "" : " out-of-stock"}" data-id="${escapeAttr(p.id)}">
      <div class="thumb">
        ${ribbon}
        ${stockBadge}
        <img src="${escapeAttr(p.image)}" alt="" loading="lazy" width="300" height="300" />
      </div>
      <div class="product-body">
        <h4>${escapeHtml(p.name)}</h4>
        <div class="prices">${prices}</div>
        <div class="card-actions">
          ${addBtn}
          <button type="button" class="btn-details" data-details="${escapeAttr(p.id)}">פרטים</button>
        </div>
      </div>
    </article>`;
}

function bindProductCards() {
  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      addToCart(btn.dataset.add);
    });
  });
  document.querySelectorAll("[data-details]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openProductModal(btn.dataset.details);
    });
  });
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openProductModal(card.dataset.id);
    });
  });
}

function renderPagination(pages) {
  const el = $("#pagination");
  if (pages <= 1) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const buttons = [];
  buttons.push(
    `<button type="button" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>הקודם</button>`
  );
  const range = pageRange(currentPage, pages);
  range.forEach((p) => {
    if (p === "...") {
      buttons.push(`<span style="padding:0 0.25rem">…</span>`);
    } else {
      buttons.push(
        `<button type="button" class="${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`
      );
    }
  });
  buttons.push(
    `<button type="button" data-page="${currentPage + 1}" ${currentPage === pages ? "disabled" : ""}>הבא</button>`
  );
  el.innerHTML = buttons.join("");
  el.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = Number(btn.dataset.page);
      if (p >= 1 && p <= pages) {
        currentPage = p;
        renderProducts();
        document.getElementById("products").scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

function pageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("...");
    out.push(p);
    prev = p;
  }
  return out;
}

function addToCart(id, qty = 1) {
  const p = catalog.products.find((x) => x.id === id);
  if (p && !isInStock(p)) {
    alert("מוצר זה אזל מהמלאי");
    return;
  }
  const cart = loadCart();
  cart[id] = (cart[id] || 0) + qty;
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function setCartQty(id, qty) {
  const cart = loadCart();
  if (qty <= 0) delete cart[id];
  else cart[id] = qty;
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function renderCart() {
  const cart = loadCart();
  const el = $("#cart-items");
  const ids = Object.keys(cart);
  if (!ids.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--muted)">העגלה ריקה</p>';
    $("#cart-total").textContent = formatPrice(0);
    return;
  }
  el.innerHTML = ids
    .map((id) => {
      const p = catalog.products.find((x) => x.id === id);
      if (!p) return "";
      const q = cart[id];
      return `
        <div class="cart-item" data-id="${escapeAttr(id)}">
          <img src="${escapeAttr(p.image)}" alt="" width="64" height="64" />
          <div class="cart-item-info">
            <h4>${escapeHtml(p.name)}</h4>
            <div>${formatPrice(effectivePrice(p))} × ${q}</div>
            <div class="qty-row">
              <button type="button" data-dec="${escapeAttr(id)}">−</button>
              <span>${q}</span>
              <button type="button" data-inc="${escapeAttr(id)}">+</button>
              <button type="button" data-rm="${escapeAttr(id)}" style="margin-right:auto;color:var(--brand)">הסר</button>
            </div>
          </div>
        </div>`;
    })
    .join("");

  el.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => setCartQty(b.dataset.inc, cart[b.dataset.inc] + 1))
  );
  el.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => setCartQty(b.dataset.dec, cart[b.dataset.dec] - 1))
  );
  el.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => setCartQty(b.dataset.rm, 0))
  );

  $("#cart-total").textContent = formatPrice(cartTotal(cart));
}

function openCart() {
  renderCart();
  $("#cart-panel").classList.add("open");
  $("#overlay").classList.add("open");
}

function closePanels() {
  $("#cart-panel").classList.remove("open");
  $("#product-modal").classList.remove("open");
  $("#overlay").classList.remove("open");
}

function openProductModal(id) {
  const p = catalog.products.find((x) => x.id === id);
  if (!p) return;
  const sale = p.salePrice != null;
  const prices = sale
    ? `<span class="price-sale">${formatPrice(p.salePrice)}</span><span class="price-old">${formatPrice(p.price)}</span>`
    : `<span class="price-regular">${formatPrice(p.price)}</span>`;

  $("#modal-title").textContent = p.name;
  const inStock = isInStock(p);
  $("#modal-body").innerHTML = `
    <div class="modal-image"><img src="${escapeAttr(p.image)}" alt="" /></div>
    <div class="prices" style="margin-bottom:0.75rem">${prices}</div>
    ${inStock ? "" : `<p class="stock-note">אזל מהמלאי — ניתן לפנות בוואטסאפ לבדיקת זמינות</p>`}
    ${p.brand ? `<button type="button" class="modal-brand-link" data-modal-brand="${escapeAttr(p.brand)}">מותג: ${escapeHtml(p.brand)}</button>` : ""}
    <div class="description">${p.description || `<p>${escapeHtml(p.excerpt)}</p>`}</div>`;
  $("#modal-footer").innerHTML = `
    <div class="prices">${prices}</div>
    <button type="button" class="btn-add" id="modal-add" ${inStock ? "" : "disabled"}>${inStock ? "הוספה לעגלה" : "אזל מהמלאי"}</button>`;
  $("#modal-add").addEventListener("click", () => {
    if (!inStock) return;
    addToCart(id);
    closePanels();
    openCart();
  });
  $("#modal-body").querySelectorAll("[data-modal-brand]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closePanels();
      setBrand(btn.dataset.modalBrand);
      document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
    });
  });
  $("#product-modal").classList.add("open");
  $("#overlay").classList.add("open");
}

function buildOrderMessage() {
  const cart = loadCart();
  const lines = ["שלום, אני מעוניין/ת להזמין:", ""];
  let i = 1;
  for (const [id, qty] of Object.entries(cart)) {
    const p = catalog.products.find((x) => x.id === id);
    if (!p) continue;
    lines.push(`${i}. ${p.name} — ${qty} × ${formatPrice(effectivePrice(p))}`);
    i++;
  }
  lines.push("", `סה״כ משוער: ${formatPrice(cartTotal(cart))}`);
  lines.push("", "תודה!");
  return lines.join("\n");
}

function buildCartItems() {
  const cart = loadCart();
  return Object.entries(cart).map(([productId, qty]) => ({ productId, qty }));
}

async function checkoutWithHyp() {
  const cart = loadCart();
  if (!cartCount(cart)) {
    alert("העגלה ריקה");
    return;
  }

  const btn = $("#checkout-hyp");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "מעביר לתשלום...";
  }

  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: buildCartItems() }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 503 && data.error === "hyp_not_configured") {
      alert("תשלום מאובטח יהיה זמין מחר לאחר חיבור Hyp Pay.\nבינתיים אפשר לשלוח הזמנה בוואטסאפ.");
      return;
    }

    if (!res.ok) {
      alert(data.message || data.error || "שגיאה ביצירת תשלום");
      return;
    }

    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    }
  } catch {
    alert("לא ניתן להתחבר לשרת התשלום. נסו שוב או שלחו הזמנה בוואטסאפ.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "תשלום מאובטח";
    }
  }
}

function setupWhatsAppLinks() {
  const msg = encodeURIComponent("שלום, אשמח לייעוץ לגבי מוצרים בחנות פארס פארס");
  const href = whatsappLink(decodeURIComponent(msg));
  ["#btn-whatsapp-header", "#hero-whatsapp", "#footer-whatsapp"].forEach((sel) => {
    const a = $(sel);
    if (a) a.href = href;
  });
}

function setupConfig() {
  const meta = catalog.meta || {};
  $("#store-name").textContent = config.storeName || meta.storeName || "פארס פארס";
  $("#store-tagline").textContent = config.tagline || meta.tagline || "";
  $("#footer-address").textContent = config.address || meta.address || "";
  const phoneEl = $("#footer-phone");
  if (phoneEl && config.phone) {
    phoneEl.hidden = false;
    phoneEl.innerHTML = `טלפון: <a href="tel:${escapeAttr(config.phone.replace(/\s/g, ""))}">${escapeHtml(config.phone)}</a>`;
  }
  document.title = `${config.storeName || "פארס פארס"} | חנות אונליין`;

  const banner = $("#wix-banner");
  if (config.wixStoreUrl) {
    banner.classList.add("visible");
    banner.innerHTML = `ניהול המוצרים מתבצע ב-Wix. <a href="${escapeAttr(config.wixStoreUrl)}">לחנות המלאה ב-Wix</a>`;
  }
}

let searchTimer;
function setupSearch() {
  $("#search-input").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value;
      applyFilters();
    }, 200);
  });
}

function setupUI() {
  $("#year").textContent = new Date().getFullYear();
  $("#btn-cart").addEventListener("click", openCart);
  $("#bar-cart").addEventListener("click", openCart);
  $("#close-cart").addEventListener("click", closePanels);
  $("#close-modal").addEventListener("click", closePanels);
  $("#overlay").addEventListener("click", closePanels);
  $("#clear-filters")?.addEventListener("click", clearFilters);
  $("#clear-cart").addEventListener("click", () => {
    saveCart({});
    updateCartBadge();
    renderCart();
  });
  $("#checkout-whatsapp").addEventListener("click", () => {
    const cart = loadCart();
    if (!cartCount(cart)) {
      alert("העגלה ריקה");
      return;
    }
    window.open(whatsappLink(buildOrderMessage()), "_blank", "noopener");
  });
  $("#checkout-hyp")?.addEventListener("click", checkoutWithHyp);

  document.querySelectorAll(".mobile-bar [data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
      document.querySelectorAll(".mobile-bar button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  setupWhatsAppLinks();
  setupSearch();
  bindSubcategoryCarousel();
}

async function init() {
  setupConfig();
  setupUI();
  try {
    const res = await fetch("data/products.json");
    if (!res.ok) throw new Error(res.statusText);
    catalog = await res.json();
    if (catalog.meta) {
      catalog.meta = { ...catalog.meta, ...config };
    }
    categoryCountMap = null;
    readUrlState();
    filtered = [...catalog.products];
    $("#loading").hidden = true;
    syncCategoryUI();
    syncSubfilterUI();
    applyFilters();
    updateCartBadge();
  } catch (err) {
    $("#loading").innerHTML =
      '<p style="color:var(--brand)">שגיאה בטעינת המוצרים. הריצו אתר דרך שרת מקומי (ראו README).</p>';
    console.error(err);
  }
}

init();
