// =========================
// CONFIG
// =========================
const SUPABASE_URL = "https://tgzcpnhrqyvldvbbbuen.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5ww2RCVjjnHS8P1T2n9FZw_wzZr4ZAg";

// Usa el bucket que YA existe (el de tu overlay). Si lo queres cambiar despues, cambias solo esto.
const BUCKET = "imagenes y videos di pietro";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================
// HELPERS
// =========================
const $ = (id) => document.getElementById(id);

function safeText(s) {
  return (s || "").toString().trim();
}

function moneyARS(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function slugify(s) {
  return safeText(s)
    .toLowerCase()
    .replace(/á/g,"a").replace(/é/g,"e").replace(/í/g,"i").replace(/ó/g,"o").replace(/ú/g,"u").replace(/ñ/g,"n")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/(^-|-$)/g,"");
}

// =========================
// STATE
// =========================
let sessionUser = null;
let isAdmin = false;

let uploaded = {
  path: null,
  publicUrl: null
};

// =========================
// AUTH
// =========================
async function getSession() {
  const { data } = await supabaseClient.auth.getSession();
  sessionUser = data?.session?.user || null;
  return sessionUser;
}

// WHITELIST POR EMAIL (admin_users.email)
async function checkAdmin() {
  const email = safeText(sessionUser?.email).toLowerCase();
  if (!email) return false;

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("email")
.ilike("email", email)    .maybeSingle();

  if (error) {
    console.error(error);
    return false;
  }
  return !!data?.email;
}

function setStatus(el, msg) {
  el.textContent = safeText(msg);
}

function showAdminUI(on) {
  $("authCard").hidden = on;
  $("adminCard").hidden = !on;
  $("listCard").hidden = !on;
}

// =========================
// UPLOAD (SE SUBE AL TOQUE AL ELEGIR ARCHIVO)
// =========================
async function uploadSelectedFile(file) {
  uploaded = { path: null, publicUrl: null };
  $("publishBtn").disabled = true;

  if (!file) {
    setStatus($("productStatus"), "");
    $("uploadHint").textContent = "Todavia no subiste una imagen.";
    return;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `products/${base}.${ext}`;

  $("uploadHint").textContent = "Subiendo imagen...";
  setStatus($("productStatus"), "Subiendo imagen a Supabase Storage...");

  const { error: upErr } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, cacheControl: "3600" });

  if (upErr) {
    console.error(upErr);
    $("uploadHint").textContent = "Error al subir la imagen.";
    setStatus($("productStatus"), `Error upload: ${upErr.message}`);
    return;
  }

  const { data: pub } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl || null;

  uploaded = { path, publicUrl };

  $("uploadHint").textContent = "Imagen subida OK.";
  setStatus($("productStatus"), "Imagen subida OK. Ahora completa los datos y publica.");
  $("publishBtn").disabled = false;
}

// =========================
// CRUD PRODUCTS
// =========================
async function createProduct(payload) {
  const { error } = await supabaseClient.from("products").insert(payload);
  if (error) throw error;
}

async function fetchAllProductsAdmin() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,price,category,active,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function setActive(id, active) {
  const { error } = await supabaseClient.from("products").update({ active }).eq("id", id);
  if (error) throw error;
}

async function deleteProduct(id) {
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) throw error;
}

// =========================
// UI ACTIONS
// =========================
async function renderList() {
  const el = $("list");
  el.innerHTML = "";
  try {
    const items = await fetchAllProductsAdmin();
    if (!items.length) {
      el.innerHTML = `<div class="status">No hay productos cargados todavia.</div>`;
      return;
    }

    for (const p of items) {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div>
          <div class="rowTitle">${safeText(p.name)}</div>
          <div class="rowMeta">${safeText(p.category)} - ${moneyARS(p.price)} - ${p.active ? "ACTIVO" : "OCULTO"}</div>
        </div>
        <div class="rowActions">
          <button class="btn btn--soft" type="button" data-toggle="${p.id}">${p.active ? "Ocultar" : "Activar"}</button>
          <button class="btn btn--danger" type="button" data-del="${p.id}">Borrar</button>
        </div>
      `;

      row.addEventListener("click", async (e) => {
        const tBtn = e.target.closest("[data-toggle]");
        const dBtn = e.target.closest("[data-del]");
        try {
          if (tBtn) {
            const id = tBtn.getAttribute("data-toggle");
            await setActive(id, !p.active);
            await renderList();
          }
          if (dBtn) {
            const id = dBtn.getAttribute("data-del");
            await deleteProduct(id);
            await renderList();
          }
        } catch (err) {
          console.error(err);
          setStatus($("productStatus"), `Error: ${err.message || err}`);
        }
      });

      el.appendChild(row);
    }
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="status">Error cargando lista: ${safeText(err.message || err)}</div>`;
  }
}

function resetForm() {
  $("file").value = "";
  $("name").value = "";
  $("price").value = "";
  $("desc").value = "";
  $("category").value = "Otros";
  uploaded = { path: null, publicUrl: null };
  $("publishBtn").disabled = true;
  $("uploadHint").textContent = "Todavia no subiste una imagen.";
  setStatus($("productStatus"), "");
}

// =========================
// INIT
// =========================
async function init() {
  $("logout").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  $("refresh").addEventListener("click", async () => {
    await boot();
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus($("authStatus"), "Entrando...");

    const email = safeText($("email").value);
    const password = safeText($("password").value);

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus($("authStatus"), `Error: ${error.message}`);
      return;
    }
    sessionUser = data?.user || null;
    await boot();
  });

  $("file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    await uploadSelectedFile(file);
  });

  $("resetBtn").addEventListener("click", resetForm);

  $("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      setStatus($("productStatus"), "Publicando...");

      if (!uploaded.publicUrl) {
        setStatus($("productStatus"), "Falta la imagen (subila primero).");
        return;
      }

      const name = safeText($("name").value);
      const price = Number($("price").value || 0);
      const description = safeText($("desc").value);
      const category = safeText($("category").value) || "Otros";

      const payload = {
        name,
        price,
        description,
        category,
        image_url: uploaded.publicUrl,
        badges: [],
        active: true
      };

      await createProduct(payload);

      setStatus($("productStatus"), "Producto publicado OK. Ya aparece en la web A.");
      resetForm();
      await renderList();
    } catch (err) {
      console.error(err);
      setStatus($("productStatus"), `Error: ${err.message || err}`);
    }
  });

  await boot();
}

async function boot() {
  await getSession();

  if (!sessionUser) {
    showAdminUI(false);
    setStatus($("authStatus"), "Ingresa con tu usuario admin.");
    return;
  }

  isAdmin = await checkAdmin();

  if (!isAdmin) {
    showAdminUI(false);
    setStatus($("authStatus"), "No autorizado. Falta tu email en la tabla admin_users.");
    return;
  }

  showAdminUI(true);
  setStatus($("authStatus"), "");
  setStatus($("productStatus"), "Listo. Subi una imagen (se sube al toque) y publica.");
  await renderList();
}

init();
