// admin/app.js
const SUPABASE_URL = "https://tgzcpnhrqyvldvbbbuen.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5ww2RCVjjnHS8P1T2n9FZw_wzZr4ZAg";
const BUCKET = "imagenes y videos di pietro";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

function safeText(s){ return (s || "").toString().trim(); }

function setNote(el, msg, show){
  el.textContent = safeText(msg);
  el.hidden = !show;
}

function moneyARS(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style:"currency", currency:"ARS", maximumFractionDigits:0 });
}

function parsePriceARS(raw){
  let s = (raw || "").toString().trim();
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return 0;
  const parts = s.split(",");
  const intPart = (parts[0] || "").replace(/\./g, "");
  const n = Number(intPart);
  return Number.isFinite(n) ? n : 0;
}

function formatPriceARS(n){
  const v = Number(n || 0);
  return v ? v.toLocaleString("es-AR") : "";
}

let sessionUser = null;
let uploaded = { path:null, publicUrl:null };

async function getSession(){
  const { data } = await supabaseClient.auth.getSession();
  sessionUser = data?.session?.user || null;
  return sessionUser;
}

async function checkAdmin(){
  if (!sessionUser?.id) return false;
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", sessionUser.id)
    .maybeSingle();

  if (error) { console.error(error); return false; }
  return !!data?.user_id;
}

function showUI(isAdmin){
  $("authCard").hidden = isAdmin;
  $("panelCard").hidden = !isAdmin;
  $("listCard").hidden = !isAdmin;

  $("btnLogout").hidden = !isAdmin;
  $("whoami").textContent = isAdmin && sessionUser?.email ? sessionUser.email : "No autenticado";
}

async function uploadSelectedFile(file){
  uploaded = { path:null, publicUrl:null };
  $("btnPublish").disabled = true;
  $("btnViewRemote").hidden = true;
  $("btnClearImage").hidden = true;

  if (!file){
    $("imgPreview").removeAttribute("src");
    $("imgHint").textContent = "Selecciona una imagen. Primero preview, despues se sube a Storage.";
    setNote($("imgStatus"), "", false);
    return;
  }

  try { $("imgPreview").src = URL.createObjectURL(file); } catch {}

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = `products/${base}.${ext}`;

  $("imgHint").textContent = "Subiendo imagen...";
  setNote($("imgStatus"), `Subiendo a Storage... (bucket: ${BUCKET})`, true);

  const { error: upErr } = await supabaseClient.storage
    .from(BUCKET)
    .upload(path, file, { upsert:false, cacheControl:"3600" });

  if (upErr){
    console.error(upErr);
    $("imgHint").textContent = "Error al subir la imagen.";
    setNote($("imgStatus"), `Error upload: ${upErr.message || upErr}`, true);
    return;
  }

  const { data: pub } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl || null;

  uploaded = { path, publicUrl };

  $("imgHint").textContent = "Imagen subida OK.";
  setNote($("imgStatus"), "Imagen subida OK. Ahora publica.", true);
  $("btnViewRemote").hidden = !publicUrl;
  $("btnClearImage").hidden = false;
  $("btnPublish").disabled = false;
}

function clearImage(){
  uploaded = { path:null, publicUrl:null };
  $("p_img").value = "";
  $("imgPreview").removeAttribute("src");
  $("imgHint").textContent = "Selecciona una imagen. Primero preview, despues se sube a Storage.";
  setNote($("imgStatus"), "", false);
  $("btnPublish").disabled = true;
  $("btnViewRemote").hidden = true;
  $("btnClearImage").hidden = true;
}

async function createProduct(payload){
  const { error } = await supabaseClient.from("products").insert(payload);
  if (error) throw error;
}

async function fetchAllProductsAdmin(){
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,price,category,active,created_at")
    .order("created_at", { ascending:false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function setActive(id, active){
  const { error } = await supabaseClient.from("products").update({ active }).eq("id", id);
  if (error) throw error;
}

async function deleteProduct(id){
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) throw error;
}

async function renderList(){
  const el = $("list");
  el.innerHTML = "";
  try{
    const items = await fetchAllProductsAdmin();
    if (!items.length){
      el.innerHTML = `<div class="note">No hay productos cargados todavia.</div>`;
      return;
    }

    for (const p of items){
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div>
          <div class="itemTitle">${safeText(p.name)}</div>
          <div class="itemMeta">${safeText(p.category)} | ${moneyARS(p.price)} | ${p.active ? "ACTIVO" : "OCULTO"}</div>
        </div>
        <div class="itemActions">
          <button class="btn btn--soft" type="button" data-toggle="${p.id}">${p.active ? "Ocultar" : "Activar"}</button>
          <button class="btn btn--danger" type="button" data-del="${p.id}">Borrar</button>
        </div>
      `;

      row.addEventListener("click", async (e)=>{
        const tBtn = e.target.closest("[data-toggle]");
        const dBtn = e.target.closest("[data-del]");
        try{
          if (tBtn){
            const id = tBtn.getAttribute("data-toggle");
            await setActive(id, !p.active);
            await renderList();
          }
          if (dBtn){
            const id = dBtn.getAttribute("data-del");
            await deleteProduct(id);
            await renderList();
          }
        }catch(err){
          console.error(err);
          setNote($("listMsg"), `Error: ${err.message || err}`, true);
        }
      });

      el.appendChild(row);
    }
  }catch(err){
    console.error(err);
    el.innerHTML = `<div class="note">Error cargando lista: ${safeText(err.message || err)}</div>`;
  }
}

async function doLogin(){
  const email = safeText($("email").value);
  const password = safeText($("pass").value);
  setNote($("authMsg"), "Entrando...", true);

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error){
    setNote($("authMsg"), `Error: ${error.message}`, true);
    return;
  }
  sessionUser = data?.user || null;
  await boot();
}

async function doLogout(){
  await supabaseClient.auth.signOut();
  location.reload();
}

async function doPublish(){
  try{
    setNote($("panelMsg"), "Publicando...", true);

    if (!uploaded.publicUrl){
      setNote($("panelMsg"), "Falta la imagen (subila primero).", true);
      return;
    }

    const name = safeText($("p_name").value);
    const description = safeText($("p_desc").value);
    const category = safeText($("p_category").value) || "Otros";
    const price = parsePriceARS($("p_price").value);

    if (!name){
      setNote($("panelMsg"), "Falta el nombre.", true);
      return;
    }
    if (!price || price <= 0){
      setNote($("panelMsg"), "Precio invalido. Ej: 339.900", true);
      return;
    }

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

    setNote($("panelMsg"), "Producto publicado OK. Ya aparece en la web.", true);

    $("p_name").value = "";
    $("p_price").value = "";
    $("p_desc").value = "";
    $("p_category").value = "";
    clearImage();
    await renderList();
  }catch(err){
    console.error(err);
    setNote($("panelMsg"), `Error: ${err.message || err}`, true);
  }
}

async function boot(){
  await getSession();

  if (!sessionUser){
    showUI(false);
    setNote($("authMsg"), "Entrá con tu usuario admin de Supabase Auth.", true);
    return;
  }

  const ok = await checkAdmin();
  if (!ok){
    showUI(false);
    setNote($("authMsg"), "No autorizado. Falta tu UID en la tabla admin_users.", true);
    return;
  }

  showUI(true);
  setNote($("authMsg"), "", false);
  setNote($("panelMsg"), `Listo. Subi una imagen y publica. (bucket: ${BUCKET})`, true);
  await renderList();
}

function init(){
  $("btnLogin").addEventListener("click", doLogin);
  $("btnLogout").addEventListener("click", doLogout);
  $("btnPublish").addEventListener("click", doPublish);
  $("btnRefresh").addEventListener("click", renderList);

  $("p_img").addEventListener("change", async (e)=>{
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    await uploadSelectedFile(file);
  });

  $("btnViewRemote").addEventListener("click", ()=>{
    if (uploaded.publicUrl) window.open(uploaded.publicUrl, "_blank", "noopener");
  });

  $("btnClearImage").addEventListener("click", clearImage);

  $("p_price").addEventListener("blur", ()=>{
    const n = parsePriceARS($("p_price").value);
    $("p_price").value = n ? formatPriceARS(n) : "";
  });

  boot();
}

init();
