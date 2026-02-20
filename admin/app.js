// =========================
// /admin/app.js
// =========================

// CONFIG (YA PEGADO CON TUS DATOS)
const SUPABASE_URL = "https://etqcufdmduqbmilpyyfg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWN1ZmRtZHVxYm1pbHB5eWZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTQ1NzIsImV4cCI6MjA4NzEzMDU3Mn0.fHrf3E9HmEjOyzh8n7eusvy_SOkQf4zshDpxRzKGx10";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authBox = document.getElementById("authBox");
const adminBox = document.getElementById("adminBox");

const emailInput = document.getElementById("emailInput");
const passInput = document.getElementById("passInput");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const userEmail = document.getElementById("userEmail");

const imageInput = document.getElementById("imageInput");
const previewImg = document.getElementById("previewImg");

const nameInput = document.getElementById("nameInput");
const priceInput = document.getElementById("priceInput");
const categoryInput = document.getElementById("categoryInput");
const activeSelect = document.getElementById("activeSelect");
const descInput = document.getElementById("descInput");

const publishBtn = document.getElementById("publishBtn");
const adminMsg = document.getElementById("adminMsg");
const listEl = document.getElementById("list");
const refreshBtn = document.getElementById("refreshBtn");

let uploadedImageUrl = "";

function setAuthMsg(msg){ authMsg.textContent = msg || ""; }
function setAdminMsg(msg){ adminMsg.textContent = msg || ""; }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function money(n){
  try{
    return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS"}).format(Number(n||0));
  }catch{
    return "$" + Number(n||0).toFixed(2);
  }
}

async function selfWhitelistCheck(email){
  // Policy permite SELECT solo si email == jwt email
  const { data, error } = await supabase
    .from("admin_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if(error){
    console.error(error);
    return { ok:false, reason:"No se pudo verificar whitelist. Revisa policy admin_users." };
  }
  if(!data?.email){
    return { ok:false, reason:"Solo usuarios autorizados (whitelist)." };
  }
  return { ok:true };
}

async function guardAdmin(){
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if(!session){
    authBox.style.display = "block";
    adminBox.style.display = "none";
    userEmail.textContent = "";
    return;
  }

  const email = session.user.email || "";
  const check = await selfWhitelistCheck(email);

  if(!check.ok){
    setAuthMsg(check.reason);
    await supabase.auth.signOut();
    authBox.style.display = "block";
    adminBox.style.display = "none";
    userEmail.textContent = "";
    return;
  }

  userEmail.textContent = email;
  setAuthMsg("");
  authBox.style.display = "none";
  adminBox.style.display = "block";
  await loadProductsList();
}

loginBtn.addEventListener("click", async ()=>{
  setAuthMsg("Ingresando...");

  const email = (emailInput.value||"").trim();
  const password = passInput.value || "";

  if(!email || !password){
    setAuthMsg("Completa email y password.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(error){
    console.error(error);
    setAuthMsg("No autenticado. Revisa email/password.");
    return;
  }

  await guardAdmin();
});

logoutBtn.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
  uploadedImageUrl = "";
  previewImg.removeAttribute("src");
  imageInput.value = "";
  setAdminMsg("");
  setAuthMsg("");
  await guardAdmin();
});

refreshBtn.addEventListener("click", loadProductsList);

imageInput.addEventListener("change", async ()=>{
  setAdminMsg("");
  const file = imageInput.files?.[0];
  if(!file) return;

  if(!file.type.startsWith("image/")){
    setAdminMsg("El archivo debe ser una imagen.");
    imageInput.value = "";
    return;
  }

  previewImg.src = URL.createObjectURL(file);
  setAdminMsg("Subiendo imagen...");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g,"") || "jpg";
  const path = `products/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from("product-images")
    .upload(path, file, { upsert:false, contentType:file.type });

  if(upErr){
    console.error(upErr);
    setAdminMsg("Error al subir la imagen. Revisa storage policy/whitelist.");
    return;
  }

  const { data: pub } = supabase
    .storage
    .from("product-images")
    .getPublicUrl(path);

  uploadedImageUrl = pub?.publicUrl || "";
  if(!uploadedImageUrl){
    setAdminMsg("La imagen se subio, pero no se pudo obtener URL publica.");
    return;
  }

  setAdminMsg("Imagen subida OK.");
});

publishBtn.addEventListener("click", async ()=>{
  setAdminMsg("");

  const name = (nameInput.value||"").trim();
  const description = (descInput.value||"").trim();
  const category = (categoryInput.value||"").trim();
  const active = activeSelect.value === "true";
  const priceRaw = (priceInput.value||"").trim();
  const price = Number(priceRaw);

  if(!uploadedImageUrl){
    setAdminMsg("Falta subir la imagen.");
    return;
  }
  if(!name){
    setAdminMsg("Falta el nombre.");
    return;
  }
  if(!priceRaw || Number.isNaN(price) || price <= 0){
    setAdminMsg("Precio invalido. Usa un numero (ej 339.90).");
    return;
  }

  setAdminMsg("Publicando producto...");

  const { error } = await supabase
    .from("products")
    .insert([{
      name,
      description,
      price,
      category,
      image_url: uploadedImageUrl,
      active
    }]);

  if(error){
    console.error(error);
    setAdminMsg("No se pudo publicar. Revisa RLS/whitelist en products.");
    return;
  }

  nameInput.value = "";
  priceInput.value = "";
  categoryInput.value = "";
  descInput.value = "";
  activeSelect.value = "true";
  imageInput.value = "";
  uploadedImageUrl = "";
  previewImg.removeAttribute("src");

  setAdminMsg("Publicado OK.");
  await loadProductsList();
});

async function loadProductsList(){
  setAdminMsg("");

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,category,active,created_at")
    .order("created_at", { ascending:false })
    .limit(300);

  if(error){
    console.error(error);
    listEl.innerHTML = `<div class="msg">No se pudieron cargar productos. Revisa RLS.</div>`;
    return;
  }

  const items = data || [];
  if(!items.length){
    listEl.innerHTML = `<div class="msg">No hay productos cargados.</div>`;
    return;
  }

  listEl.innerHTML = items.map((p)=>{
    return `
      <div class="item">
        <div>
          <div class="item__title">${escapeHtml(p.name)}</div>
          <div class="item__meta">${escapeHtml(p.category||"")} | ${money(p.price)}</div>
          <div class="item__meta">${new Date(p.created_at).toLocaleString("es-AR")} | ${p.active ? "Activo" : "Inactivo"}</div>
        </div>
        <div class="item__actions">
          <span class="pill">${p.active ? "ON" : "OFF"}</span>
          <button class="btn btn--ghost" data-toggle="${p.id}" type="button">${p.active ? "Desactivar" : "Activar"}</button>
          <button class="btn btn--danger" data-del="${p.id}" type="button">Borrar</button>
        </div>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll("[data-toggle]").forEach((btn)=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-toggle");
      const current = items.find(x=>x.id===id);
      if(!current) return;

      btn.disabled = true;
      const next = !current.active;

      const { error: upErr } = await supabase
        .from("products")
        .update({ active: next })
        .eq("id", id);

      if(upErr){
        console.error(upErr);
        setAdminMsg("No se pudo actualizar el estado.");
      }else{
        await loadProductsList();
      }
      btn.disabled = false;
    });
  });

  listEl.querySelectorAll("[data-del]").forEach((btn)=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-del");
      const ok = confirm("Borrar este producto? No se puede deshacer.");
      if(!ok) return;

      btn.disabled = true;

      const { error: delErr } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if(delErr){
        console.error(delErr);
        setAdminMsg("No se pudo borrar.");
      }else{
        await loadProductsList();
      }

      btn.disabled = false;
    });
  });
}

supabase.auth.onAuthStateChange(()=>{ guardAdmin(); });
guardAdmin();
