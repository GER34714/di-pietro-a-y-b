// public/app.js
const SUPABASE_URL = "https://tgzcpnhrqyvldvbbbuen.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5ww2RCVjjnHS8P1T2n9FZw_wzZr4ZAg";
const WHATSAPP_NUMBER = "5491164312020";
const INSTAGRAM_URL = "https://www.instagram.com/dipietro_comercial?igsh=MW50cGRta3c5MmMyNg==";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

function safeText(s){ return (s || "").toString().trim(); }

function moneyARS(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style:"currency", currency:"ARS", maximumFractionDigits:0 });
}

function waLink(text){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

let allProducts = [];
let filtered = [];

const CART_KEY = "dp_cart_v2";
function loadCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || "{}"); } catch { return {}; } }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
function cartCount(cart){ return Object.values(cart).reduce((a,b)=>a+(b?.qty||0),0); }
function cartTotal(cart){
  let total = 0;
  for (const k of Object.keys(cart)){
    const it = cart[k];
    total += (Number(it.price)||0) * (Number(it.qty)||0);
  }
  return total;
}

function initLinks(){
  $("waFloat").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("waLinkFooter").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("ctaWhats").href = `https://wa.me/${WHATSAPP_NUMBER}`;
  $("igLinkFooter").href = INSTAGRAM_URL;
}

function initMenu(){
  const hamb = $("hamb");
  const menu = $("mobileMenu");
  hamb.addEventListener("click", () => {
    const isOpen = !menu.hasAttribute("hidden");
    if (isOpen) { menu.setAttribute("hidden",""); hamb.setAttribute("aria-expanded","false"); }
    else { menu.removeAttribute("hidden"); hamb.setAttribute("aria-expanded","true"); }
  });
  menu.addEventListener("click", (e)=>{ if (e.target && e.target.matches("a")) { menu.setAttribute("hidden",""); hamb.setAttribute("aria-expanded","false"); } });
}

function initCartUI(){
  const open = () => { $("drawer").classList.add("isOpen"); $("drawer").setAttribute("aria-hidden","false"); renderCart(); };
  const close = () => { $("drawer").classList.remove("isOpen"); $("drawer").setAttribute("aria-hidden","true"); };
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
    for (const it of items){
      lines.push(`- ${it.name} x${it.qty} = ${moneyARS((Number(it.price)||0)*(Number(it.qty)||0))}`);
    }
    lines.push("");
    lines.push(`Total: ${moneyARS(cartTotal(cart))}`);
    lines.push("");
    lines.push("Queria confirmar stock y precio actual. Gracias!");

    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });
}

function updateCartBadges(){
  const cart = loadCart();
  const c = cartCount(cart);
  $("cartCount").textContent = String(c);
  $("cartCountMobile").textContent = String(c);
}

function renderCart(){
  const cart = loadCart();
  const items = Object.values(cart);
  $("drawerSub").textContent = `${items.length} items`;
  $("cartTotal").textContent = moneyARS(cartTotal(cart));

  const holder = $("cartItems");
  holder.innerHTML = "";

  if (!items.length){
    holder.innerHTML = `<div class="empty"><div class="empty__title">Carrito vacio</div><div class="empty__desc">Agrega productos desde el catalogo.</div></div>`;
    return;
  }

  for (const it of items){
    const row = document.createElement("div");
    row.className = "cartRow";
    row.innerHTML = `
      <div>
        <div class="cartRow__name">${safeText(it.name)}</div>
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

async function fetchProducts(){
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,description,price,category,image_url,badges,active,created_at,gallery")
    .eq("active", true)
    .order("created_at", { ascending:false });

  if (error){
    console.error(error);
    allProducts = [];
    return;
  }
  allProducts = Array.isArray(data) ? data : [];
}

function fillCategories(){
  const sel = $("cat");
  const cats = Array.from(new Set(allProducts.map(p=>safeText(p.category)).filter(Boolean)));
  cats.sort((a,b)=>a.localeCompare(b,"es"));
  sel.innerHTML = `<option value="all">Todas</option>` + cats.map(c=>`<option value="${c}">${c}</option>`).join("");
}

function applyFilters(){
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

  if (sort === "priceAsc") filtered.sort((a,b)=>(a.price||0)-(b.price||0));
  if (sort === "priceDesc") filtered.sort((a,b)=>(b.price||0)-(a.price||0));
  if (sort === "nameAsc") filtered.sort((a,b)=>safeText(a.name).localeCompare(safeText(b.name),"es"));
  if (sort === "new") filtered.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

  renderGrid();
}

function addToCart(p){
  const cart = loadCart();
  if (!cart[p.id]) cart[p.id] = { id:p.id, name:safeText(p.name), price:Number(p.price)||0, qty:1 };
  else cart[p.id].qty += 1;
  saveCart(cart);
  updateCartBadges();
}

function isOffer(p){
  const badges = Array.isArray(p.badges) ? p.badges : [];
  return badges.some(b => safeText(b).toLowerCase().includes("oferta"));
}

function renderOffers(){
  const rail = $("offersRail");
  const empty = $("offersEmpty");
  rail.innerHTML = "";

  const offers = allProducts.filter(isOffer).slice(0, 16);

  if (!offers.length){
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const p of offers){
    const el = document.createElement("div");
    el.className = "offerCard";
    el.innerHTML = `
      <div class="offerImg"><img src="${safeText(p.image_url)}" alt="${safeText(p.name)}" loading="lazy" /></div>
      <div class="offerBody">
        <div class="offerTitle">${safeText(p.name)}</div>
        <div class="offerMeta">
          <div>${safeText(p.category)}</div>
          <div class="offerPrice">${moneyARS(p.price)}</div>
        </div>
      </div>
    `;
    el.addEventListener("click", ()=>openModal(p));
    rail.appendChild(el);
  }
}

function renderGrid(){
  const grid = $("grid");
  const empty = $("empty");
  grid.innerHTML = "";

  if (!filtered.length){
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const p of filtered){
    const card = document.createElement("div");
    card.className = "card";

    const badges = Array.isArray(p.badges) ? p.badges : [];
    const badgeHTML = badges.slice(0,3).map(b=>`<span class="badge">${safeText(b)}</span>`).join("");

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
      </div>
    `;

    card.addEventListener("click", ()=>openModal(p));
    grid.appendChild(card);
  }
}

/* MODAL + GALERIA */
let modalProduct = null;
let modalImgs = [];
let modalIdx = 0;

function openModal(p){
  modalProduct = p;

  const g = Array.isArray(p.gallery) ? p.gallery : [];
  modalImgs = [safeText(p.image_url), ...g.map(safeText)].filter(Boolean);
  modalImgs = Array.from(new Set(modalImgs));
  modalIdx = 0;

  $("mTitle").textContent = safeText(p.name);
  $("mPrice").textContent = moneyARS(p.price);
  $("mCat").textContent = safeText(p.category);
  $("mDesc").textContent = safeText(p.description);

  const badges = Array.isArray(p.badges) ? p.badges : [];
  $("mBadges").innerHTML = badges.slice(0,6).map(b=>`<span class="badge">${safeText(b)}</span>`).join("");

  renderModalImg();
  renderThumbs();

  $("modal").classList.add("isOpen");
  $("modal").setAttribute("aria-hidden","false");
  document.documentElement.style.overflow = "hidden";
}

function closeModal(){
  $("modal").classList.remove("isOpen");
  $("modal").setAttribute("aria-hidden","true");
  document.documentElement.style.overflow = "";
}

function renderModalImg(){
  const src = modalImgs[modalIdx] || "";
  $("mImg").src = src;
}

function renderThumbs(){
  const holder = $("mThumbs");
  holder.innerHTML = "";
  for (let i=0;i<modalImgs.length;i++){
    const t = document.createElement("button");
    t.type = "button";
    t.className = "thumb" + (i===modalIdx ? " isActive" : "");
    t.innerHTML = `<img src="${modalImgs[i]}" alt="thumb" loading="lazy" />`;
    t.addEventListener("click", ()=>{
      modalIdx = i;
      renderModalImg();
      renderThumbs();
    });
    holder.appendChild(t);
  }
}

function nextImg(){
  if (!modalImgs.length) return;
  modalIdx = (modalIdx + 1) % modalImgs.length;
  renderModalImg();
  renderThumbs();
}
function prevImg(){
  if (!modalImgs.length) return;
  modalIdx = (modalIdx - 1 + modalImgs.length) % modalImgs.length;
  renderModalImg();
  renderThumbs();
}

/* INIT */
async function main(){
  initLinks();
  initMenu();
  initCartUI();
  updateCartBadges();

  $("modalClose").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", closeModal);
  $("mNext").addEventListener("click", nextImg);
  $("mPrev").addEventListener("click", prevImg);

  $("mAdd").addEventListener("click", ()=>{
    if (!modalProduct) return;
    addToCart(modalProduct);
  });

  $("mAsk").addEventListener("click", ()=>{
    if (!modalProduct) return;
    const p = modalProduct;
    const msg = [
      "Hola! Vengo del catalogo de Di Pietro.",
      "",
      `Queria consultar por: ${safeText(p.name)}`,
      `Precio: ${moneyARS(p.price)}`,
      "",
      "Me confirmas stock y precio actual?"
    ].join("\n");
    window.open(waLink(msg), "_blank", "noopener");
  });

  await fetchProducts();
  fillCategories();
  renderOffers();

  filtered = [...allProducts];
  renderGrid();

  $("q").addEventListener("input", applyFilters);
  $("cat").addEventListener("change", applyFilters);
  $("sort").addEventListener("change", applyFilters);

  $("clearFilters").addEventListener("click", ()=>{
    $("q").value = "";
    $("cat").value = "all";
    $("sort").value = "new";
    applyFilters();
  });

  document.addEventListener("keydown", (e)=>{
    if (!$("modal").classList.contains("isOpen")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowRight") nextImg();
    if (e.key === "ArrowLeft") prevImg();
  });
}

main();
