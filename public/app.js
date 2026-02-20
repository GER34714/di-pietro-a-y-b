// public/app.js
const SUPABASE_URL = "https://tgzcpnhrqyvldvbbbuen.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5ww2RCVjjnHS8P1T2n9FZw_wzZr4ZAg";
const WHATSAPP_NUMBER = "5491164312020";
const INSTAGRAM_URL = "https://www.instagram.com/dipietro_comercial?igsh=MW50cGRta3c5MmMyNg==";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

function moneyARS(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}
function waLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
function safeText(s) {
  return (s || "").toString().trim();
}

let allProducts = [];
let filtered = [];

const CART_KEY = "dp_cart_v1";
function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || "{}"); } catch { return {}; } }
function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function cartCount(cart) { return Object.values(cart).reduce((a, b) => a + (b?.qty || 0), 0); }
function cartTotal(cart) {
  let total = 0;
  for (const k of Object.keys(cart)) {
    const it = cart[k];
    total += (Number(it.price) || 0) * (Number(it.qty) || 0);
  }
  return total;
}

function initLinks() {
  $("waFloat").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("waLinkFooter").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("ctaWhats").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("igLinkFooter").href = INSTAGRAM_URL;
}

function initMenu() {
  const hamb = $("hamb");
  const menu = $("mobileMenu");
  hamb.addEventListener("click", () => {
    const isOpen = !menu.hasAttribute("hidden");
    if (isOpen) {
      menu.setAttribute("hidden", "");
      hamb.setAttribute("aria-expanded", "false");
    } else {
      menu.removeAttribute("hidden");
      hamb.setAttribute("aria-expanded", "true");
    }
  });
  const closeMenu = () => {
    if (!menu.hasAttribute("hidden")) menu.setAttribute("hidden", "");
    hamb.setAttribute("aria-expanded", "false");
  };
  menu.addEventListener("click", (e) => { if (e.target && e.target.matches("a")) closeMenu(); });
}

function initCartUI() {
  const open = () => {
    $("drawer").classList.add("isOpen");
    $("drawer").setAttribute("aria-hidden", "false");
    renderCart();
  };
  const close = () => {
    $("drawer").classList.remove("isOpen");
    $("drawer").setAttribute("aria-hidden", "true");
  };

  $("openCart").addEventListener("click", open);
  $("openCartMobile").addEventListener("click", open);
  $("closeCart").addEventListener("click", close);
  $("drawerBackdrop").addEventListener("click", close);

  $("clearCart").addEventListener("click", () => {
    saveCart({});
    updateCartBadges();
    renderCart();
  });

  $("sendWhats").addEventListener("click", () => {
    const cart = loadCart();
    const items = Object.values(cart);
    if (!items.length) return;

    const lines = [];
    lines.push("Hola! Vengo del catalogo de Di Pietro.");
    lines.push("");
    lines.push("Pedido:");
    for (const it of items) {
      const line = `- ${it.name} x${it.qty} = ${moneyARS((Number(it.price) || 0) * (Number(it.qty) || 0))}`;
      lines.push(line);
    }
    lines.push("");
    lines.push(`Total: ${moneyARS(cartTotal(cart))}`);
    lines.push("");
    lines.push("Queria confirmar stock y precio actual. Gracias!");

    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });
}

function updateCartBadges() {
  const cart = loadCart();
  const c = cartCount(cart);
  $("cartCount").textContent = String(c);
  $("cartCountMobile").textContent = String(c);
}

function renderCart() {
  const cart = loadCart();
  const items = Object.values(cart);
  $("drawerSub").textContent = `${items.length} items`;
  $("cartTotal").textContent = moneyARS(cartTotal(cart));

  const holder = $("cartItems");
  holder.innerHTML = "";

  if (!items.length) {
    holder.innerHTML = `<div class="empty"><div class="empty__title">Carrito vacio</div><div class="empty__desc">Agrega productos desde el catalogo.</div></div>`;
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "cartRow";

    row.innerHTML = `
      <div>
        <div class="cartRow__name">${it.name}</div>
        <div class="cartRow__muted">${moneyARS(it.price)} c/u</div>
      </div>
      <div class="qty">
        <button type="button" data-act="dec" data-id="${it.id}">-</button>
        <span>${it.qty}</span>
        <button type="button" data-act="inc" data-id="${it.id}">+</button>
      </div>
    `;

    row.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      const id = btn.getAttribute("data-id");
      const c = loadCart();
      const cur = c[id];
      if (!cur) return;

      if (act === "inc") cur.qty += 1;
      if (act === "dec") cur.qty -= 1;

      if (cur.qty <= 0) delete c[id];
      saveCart(c);
      updateCartBadges();
      renderCart();
    });

    holder.appendChild(row);
  }
}

async function fetchProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price,category,image_url,badges,active,created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    allProducts = [];
    return;
  }
  allProducts = Array.isArray(data) ? data : [];
}

function fillCategories() {
  const sel = $("cat");
  const cats = Array.from(new Set(allProducts.map(p => safeText(p.category)).filter(Boolean)));
  cats.sort((a,b) => a.localeCompare(b, "es"));

  sel.innerHTML = `<option value="all">Todas</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function applyFilters() {
  const q = safeText($("q").value).toLowerCase();
  const cat = $("cat").value;
  const sort = $("sort").value;

  filtered = allProducts.filter(p => {
    const name = safeText(p.name).toLowerCase();
    const desc = safeText(p.description).toLowerCase();
    const matchesQ = !q || name.includes(q) || desc.includes(q);
    const matchesCat = (cat === "all") || safeText(p.category) === cat;
    return matchesQ && matchesCat;
  });

  if (sort === "priceAsc") filtered.sort((a,b) => (a.price||0) - (b.price||0));
  if (sort === "priceDesc") filtered.sort((a,b) => (b.price||0) - (a.price||0));
  if (sort === "nameAsc") filtered.sort((a,b) => safeText(a.name).localeCompare(safeText(b.name), "es"));
  if (sort === "new") filtered.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  renderGrid();
}

function addToCart(p) {
  const cart = loadCart();
  if (!cart[p.id]) {
    cart[p.id] = { id: p.id, name: safeText(p.name), price: Number(p.price)||0, qty: 1 };
  } else {
    cart[p.id].qty += 1;
  }
  saveCart(cart);
  updateCartBadges();
}

function renderGrid() {
  const grid = $("grid");
  const empty = $("empty");
  grid.innerHTML = "";

  if (!filtered.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const p of filtered) {
    const card = document.createElement("div");
    card.className = "card";

    const badges = Array.isArray(p.badges) ? p.badges : [];
    const badgeHTML = badges.slice(0, 3).map(b => `<span class="badge">${safeText(b)}</span>`).join("");

    card.innerHTML = `
      <div class="card__img">
        <img src="${safeText(p.image_url)}" alt="${safeText(p.name)}" loading="lazy" />
        <div class="badgeRow">${badgeHTML}</div>
      </div>
      <div class="card__body">
        <div class="card__title">${safeText(p.name)}</div>
        <div class="card__desc">${safeText(p.description)}</div>
        <div class="card__meta">
          <div class="price">${moneyARS(p.price)}</div>
          <div class="smallMuted">${safeText(p.category)}</div>
        </div>
        <div class="card__actions">
          <button class="btn btn--primary" type="button" data-add="${p.id}">Agregar al carrito</button>
          <button class="btn btn--soft" type="button" data-wap="${p.id}">Consultar</button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const addBtn = e.target.closest("[data-add]");
      const waBtn = e.target.closest("[data-wap]");

      if (addBtn) {
        addToCart(p);
        return;
      }

      if (waBtn) {
        const msg = [
          "Hola! Vengo del catalogo de Di Pietro.",
          "",
          `Queria consultar por: ${safeText(p.name)}`,
          `Precio: ${moneyARS(p.price)}`,
          "",
          "Me confirmas stock y precio actual?"
        ].join("\n");
        window.open(waLink(msg), "_blank", "noopener");
      }
    });

    grid.appendChild(card);
  }
}

async function main() {
  initLinks();
  initMenu();
  initCartUI();
  updateCartBadges();

  await fetchProducts();
  fillCategories();
  filtered = [...allProducts];
  renderGrid();

  $("q").addEventListener("input", applyFilters);
  $("cat").addEventListener("change", applyFilters);
  $("sort").addEventListener("change", applyFilters);

  $("clearFilters").addEventListener("click", () => {
    $("q").value = "";
    $("cat").value = "all";
    $("sort").value = "new";
    applyFilters();
  });
}

main();
