// =========================
// /public/app.js
// =========================

// CONFIG (YA PEGADO CON TUS DATOS)
const SUPABASE_URL = "https://etqcufdmduqbmilpyyfg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWN1ZmRtZHVxYm1pbHB5eWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTQ1NzIsImV4cCI6MjA4NzEzMDU3Mn0.fHrf3E9HmEjOyzh8n7eusvy_SOkQf4zshDpxRzKGx10";
const WHATSAPP_NUMBER = "5491164312020";
const BRAND_NAME = "Nombre del negocio"; // EDITAR SI QUERES
const OFFERS_CATEGORY = "ofertas"; // categoria que se considera "ofertas" (case-insensitive)

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const brandTitle = document.getElementById("brandTitle");
brandTitle.textContent = BRAND_NAME;

const gridEl = document.getElementById("grid");
const stateBox = document.getElementById("stateBox");
const categorySelect = document.getElementById("categorySelect");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const moreWrap = document.getElementById("moreWrap");
const moreBtn = document.getElementById("moreBtn");

const offersSection = document.getElementById("ofertas");
const offersTrack = document.getElementById("offersTrack");
const offersPrev = document.getElementById("offersPrev");
const offersNext = document.getElementById("offersNext");

const openCartBtn = document.getElementById("openCartBtn");
const openCartBtnMobile = document.getElementById("openCartBtnMobile");
const openCartBtnHero = document.getElementById("openCartBtnHero");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartDrawer = document.getElementById("cartDrawer");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const cartCountEl = document.getElementById("cartCount");
const cartCountMobileEl = document.getElementById("cartCountMobile");

const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");

const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalTitle = document.getElementById("modalTitle");
const modalImg = document.getElementById("modalImg");
const modalPrice = document.getElementById("modalPrice");
const modalDesc = document.getElementById("modalDesc");
const modalAdd = document.getElementById("modalAdd");
const modalGoCart = document.getElementById("modalGoCart");
const zoomViewport = document.getElementById("zoomViewport");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");
const zoomReset = document.getElementById("zoomReset");

let allProducts = [];
let offers = [];
let mainBase = [];
let filtered = [];
let visibleCount = 6;

let cart = loadCart(); // { [id]: {product, qty} }

// ===== utils =====
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function showState(msg){
  stateBox.style.display = "block";
  stateBox.textContent = msg;
}
function hideState(){
  stateBox.style.display = "none";
  stateBox.textContent = "";
}
function money(n){
  try{
    return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS"}).format(Number(n||0));
  }catch{
    return "$" + Number(n||0).toFixed(2);
  }
}
function norm(s){ return String(s||"").trim().toLowerCase(); }
function isOfferCategory(cat){ return norm(cat) === norm(OFFERS_CATEGORY); }

// ===== cart =====
function loadCart(){
  try{
    const raw = localStorage.getItem("cart_v2");
    return raw ? JSON.parse(raw) : {};
  }catch{ return {}; }
}
function saveCart(){
  try{ localStorage.setItem("cart_v2", JSON.stringify(cart)); }catch{}
}
function cartCount(){
  return Object.values(cart).reduce((a,it)=>a+(it.qty||0),0);
}
function cartTotal(){
  return Object.values(cart).reduce((a,it)=>a + (Number(it.product.price)*(it.qty||0)),0);
}
function setQty(product, qty){
  const id = product.id;
  if(qty<=0) delete cart[id];
  else cart[id] = { product, qty };
  saveCart();
  renderCartBadge();
}
function addToCart(product){
  const cur = cart[product.id]?.qty || 0;
  setQty(product, cur + 1);
}
function renderCartBadge(){
  const v = String(cartCount());
  cartCountEl.textContent = v;
  cartCountMobileEl.textContent = v;
}

// ===== drawer =====
function openDrawer(){
  cartDrawer.classList.add("isOpen");
  cartDrawer.setAttribute("aria-hidden","false");
}
function closeDrawer(){
  cartDrawer.classList.remove("isOpen");
  cartDrawer.setAttribute("aria-hidden","true");
}
[openCartBtn, openCartBtnMobile, openCartBtnHero].forEach((btn)=>{
  btn.addEventListener("click", ()=>{
    renderCart();
    openDrawer();
    closeMobileMenu();
  });
});
closeCartBtn.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

// ===== mobile menu =====
function openMobileMenu(){
  mobileMenu.classList.add("isOpen");
  mobileMenu.setAttribute("aria-hidden","false");
  burgerBtn.setAttribute("aria-expanded","true");
}
function closeMobileMenu(){
  mobileMenu.classList.remove("isOpen");
  mobileMenu.setAttribute("aria-hidden","true");
  burgerBtn.setAttribute("aria-expanded","false");
}
burgerBtn.addEventListener("click", ()=>{
  if(mobileMenu.classList.contains("isOpen")) closeMobileMenu();
  else openMobileMenu();
});
mobileMenu.querySelectorAll("[data-close]").forEach((el)=>{
  el.addEventListener("click", closeMobileMenu);
});

// ===== checkout =====
checkoutBtn.addEventListener("click", ()=>{
  const items = Object.values(cart);
  if(!items.length) return;

  const lines = [];
  lines.push("Hola! Vengo del catalogo, mi pedido es:");
  lines.push("");

  items.forEach((it, idx)=>{
    const p = it.product;
    const qty = it.qty || 0;
    const subtotal = Number(p.price)*qty;
    lines.push(`${idx+1}) ${p.name} x${qty} = ${money(subtotal)}`);
  });

  lines.push("");
  lines.push(`Total: ${money(cartTotal())}`);

  const text = encodeURIComponent(lines.join("\n"));
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  window.open(url, "_blank");
});

// ===== cart render =====
function renderCart(){
  const items = Object.values(cart);

  if(!items.length){
    cartItemsEl.innerHTML = `<div class="state" style="display:block">Tu carrito esta vacio.</div>`;
    cartTotalEl.textContent = money(0);
    return;
  }

  cartItemsEl.innerHTML = items.map((it)=>{
    const p = it.product;
    const qty = it.qty || 0;
    const subtotal = Number(p.price)*qty;

    return `
      <div class="cartItem">
        <div>
          <div class="cartItem__name">${escapeHtml(p.name)}</div>
          <div class="cartItem__muted">${escapeHtml(p.category||"")}</div>
          <div class="cartItem__muted">Unidad: ${money(p.price)} | Subtotal: ${money(subtotal)}</div>
        </div>
        <div class="qtyRow">
          <button class="qtyBtn" data-action="dec" data-id="${p.id}">-</button>
          <div class="qtyVal">${qty}</div>
          <button class="qtyBtn" data-action="inc" data-id="${p.id}">+</button>
        </div>
      </div>
    `;
  }).join("");

  cartTotalEl.textContent = money(cartTotal());

  cartItemsEl.querySelectorAll(".qtyBtn").forEach((btn)=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const item = cart[id];
      if(!item) return;
      const next = action === "inc" ? item.qty + 1 : item.qty - 1;
      setQty(item.product, next);
      renderCart();
    });
  });
}

// ===== offers carousel =====
function scrollOffers(dir){
  const amount = 260;
  offersTrack.scrollBy({ left: dir*amount, behavior: "smooth" });
}
offersPrev.addEventListener("click", ()=>scrollOffers(-1));
offersNext.addEventListener("click", ()=>scrollOffers(1));

function renderOffers(){
  if(!offers.length){
    offersSection.style.display = "none";
    offersTrack.innerHTML = "";
    return;
  }
  offersSection.style.display = "block";
  offersTrack.innerHTML = offers.map((p)=>{
    return `
      <article class="offerCard" data-open="${p.id}">
        <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />
        <div class="offerCard__body">
          <div class="offerCard__name">${escapeHtml(p.name)}</div>
          <div class="offerCard__price">${money(p.price)}</div>
        </div>
      </article>
    `;
  }).join("");

  offersTrack.querySelectorAll("[data-open]").forEach((el)=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-open");
      const p = allProducts.find(x=>x.id===id);
      if(p) openModal(p);
    });
  });
}

// ===== grid + pagination =====
function renderGrid(list){
  if(!list.length){
    gridEl.innerHTML = "";
    showState("Todavia no hay productos para mostrar.");
    moreWrap.style.display = "none";
    return;
  }

  hideState();

  const slice = list.slice(0, visibleCount);
  gridEl.innerHTML = slice.map((p)=>{
    return `
      <article class="card" data-open="${p.id}">
        <img class="card__img" src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />
        <div class="card__body">
          <div class="card__row">
            <h3 class="card__name">${escapeHtml(p.name)}</h3>
            <div class="card__price">${money(p.price)}</div>
          </div>
          <p class="card__desc">${escapeHtml(p.description||"")}</p>
        </div>
      </article>
    `;
  }).join("");

  gridEl.querySelectorAll("[data-open]").forEach((el)=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-open");
      const p = allProducts.find(x=>x.id===id);
      if(p) openModal(p);
    });
  });

  moreWrap.style.display = (list.length > visibleCount) ? "flex" : "none";
}

moreBtn.addEventListener("click", ()=>{
  visibleCount += 6;
  renderGrid(filtered);
});

// ===== filters =====
function buildCategories(products){
  const set = new Set();
  products.forEach(p=>{
    if(p.category) set.add(String(p.category).trim());
  });

  const cats = Array.from(set).sort((a,b)=>a.localeCompare(b));
  const opts = [`<option value="__all__">Todas</option>`].concat(
    cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
  );
  categorySelect.innerHTML = opts.join("");
}

function applyFilters(){
  const cat = categorySelect.value;
  const q = norm(searchInput.value);
  const sort = sortSelect.value;

  let base = [];
  const catIsOffers = isOfferCategory(cat);

  if(cat === "__all__"){
    base = mainBase; // por defecto no duplica ofertas
  }else if(catIsOffers){
    base = offers.slice();
  }else{
    base = mainBase.filter(p => String(p.category||"") === cat);
  }

  if(q){
    base = base.filter((p)=>{
      const hay = norm(`${p.name} ${p.description} ${p.category}`);
      return hay.includes(q);
    });
  }

  if(sort === "new"){
    base.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }else if(sort === "price_asc"){
    base.sort((a,b)=> Number(a.price) - Number(b.price));
  }else if(sort === "price_desc"){
    base.sort((a,b)=> Number(b.price) - Number(a.price));
  }

  filtered = base;
  visibleCount = 6;

  // si el usuario filtra Ofertas, oculto el carrusel (ya se ve en grid)
  offersSection.style.display = catIsOffers ? "none" : (offers.length ? "block" : "none");

  renderGrid(filtered);
}

categorySelect.addEventListener("change", applyFilters);
searchInput.addEventListener("input", applyFilters);
sortSelect.addEventListener("change", applyFilters);

// ===== modal zoom =====
let modalProduct = null;

let zoomScale = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

function setTransform(){
  modalImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

function resetZoom(){
  zoomScale = 1;
  panX = 0;
  panY = 0;
  setTransform();
}

function clampPan(){
  const vw = zoomViewport.clientWidth;
  const vh = zoomViewport.clientHeight;

  // aproximacion simple: limita pan segun zoom
  const maxX = (vw * (zoomScale - 1)) / 2;
  const maxY = (vh * (zoomScale - 1)) / 2;

  const limitX = Math.max(0, maxX);
  const limitY = Math.max(0, maxY);

  panX = Math.max(-limitX, Math.min(limitX, panX));
  panY = Math.max(-limitY, Math.min(limitY, panY));
}

function openModal(p){
  modalProduct = p;

  modalTitle.textContent = p.name;
  modalImg.src = p.image_url;
  modalImg.alt = p.name;
  modalPrice.textContent = money(p.price);
  modalDesc.textContent = p.description || "";

  resetZoom();

  modal.classList.add("isOpen");
  modal.setAttribute("aria-hidden","false");
}

function closeModal(){
  modal.classList.remove("isOpen");
  modal.setAttribute("aria-hidden","true");
  modalProduct = null;
}

modalBackdrop.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);

modalAdd.addEventListener("click", ()=>{
  if(!modalProduct) return;
  addToCart(modalProduct);
});

modalGoCart.addEventListener("click", ()=>{
  closeModal();
  renderCart();
  openDrawer();
});

zoomIn.addEventListener("click", ()=>{
  zoomScale = Math.min(4, zoomScale + 0.5);
  clampPan();
  setTransform();
});
zoomOut.addEventListener("click", ()=>{
  zoomScale = Math.max(1, zoomScale - 0.5);
  clampPan();
  setTransform();
});
zoomReset.addEventListener("click", resetZoom);

zoomViewport.addEventListener("dblclick", ()=>{
  if(zoomScale === 1) zoomScale = 2;
  else zoomScale = 1;
  clampPan();
  setTransform();
});

zoomViewport.addEventListener("pointerdown", (e)=>{
  if(zoomScale <= 1) return;
  isDragging = true;
  zoomViewport.setPointerCapture(e.pointerId);
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panStartX = panX;
  panStartY = panY;
});

zoomViewport.addEventListener("pointermove", (e)=>{
  if(!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  panX = panStartX + dx;
  panY = panStartY + dy;
  clampPan();
  setTransform();
});

zoomViewport.addEventListener("pointerup", ()=>{
  isDragging = false;
});

// ===== load products =====
async function loadProducts(){
  showState("Cargando productos...");

  const { data, error } = await supabase
    .from("products")
    .select("id,name,description,price,category,image_url,active,created_at")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if(error){
    console.error(error);
    showState("No se pudieron cargar los productos. Revisa Supabase/RLS.");
    return;
  }

  allProducts = data || [];

  offers = allProducts.filter(p => isOfferCategory(p.category));
  mainBase = allProducts.filter(p => !isOfferCategory(p.category));

  buildCategories(allProducts);

  renderOffers();
  applyFilters();
}

renderCartBadge();
loadProducts();
