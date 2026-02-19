const SUPABASE_URL = "https://tgzcpnhrqyvldvbbbuen.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5ww2RCVjjnHS8P1T2n9FZw_wzZr4ZAg";

const BUCKET_PRODUCTS = "product-images";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

function show(el, on) { if (!el) return; el.hidden = !on; }
function setText(el, t) { if (el) el.textContent = t; }

function cleanStr(s) { return (s || "").toString().trim(); }
function numVal(s) { const n = Number(s); return Number.isFinite(n) ? n : 0; }

async function getSessionUser() {
  const { data } = await supabaseClient.auth.getSession();
  return data?.session?.user || null;
}

async function isAuthorizedByEmail(email) {
  if (!email) return false;
  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("email")
    .eq("email", email.toLowerCase())
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

let localPreviewUrl = "";
let uploadedPublicUrl = "";
let uploadedPath = "";
let uploading = false;

function setImgPreview(src) {
  const img = $("imgPreview");
  if (!img) return;
  if (!src) {
    img.classList.remove("isOn");
    img.removeAttribute("src");
    return;
  }
  img.src = src;
  img.classList.add("isOn");
}

function setImgStatus(msg, on = true) {
  const s = $("imgStatus");
  if (!s) return;
  setText(s, msg);
  show(s, on);
}

function setMsg(id, msg, on = true) {
  const el = $(id);
  if (!el) return;
  setText(el, msg);
  show(el, on);
}

function togglePublishBtn() {
  const ok =
    cleanStr($("p_name").value) &&
    numVal($("p_price").value) > 0 &&
    cleanStr($("p_desc").value) &&
    uploadedPublicUrl &&
    !uploading;

  $("btnPublish").disabled = !ok;
}

function resetImageState() {
  if (localPreviewUrl) {
    URL.revokeObjectURL(localPreviewUrl);
    localPreviewUrl = "";
  }
  uploadedPublicUrl = "";
  uploadedPath = "";
  setImgPreview("");
  setImgStatus("", false);
  show($("btnViewRemote"), false);
  show($("btnClearImage"), false);
  togglePublishBtn();
}

async function uploadImage(file) {
  uploading = true;
  togglePublishBtn();

  setImgStatus("Subiendo imagen...", true);

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ext || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExt}`;
  const path = `products/${fileName}`;

  const { error } = await supabaseClient
    .storage
    .from(BUCKET_PRODUCTS)
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

  if (error) {
    uploading = false;
    setImgStatus("Error al subir. Proba de nuevo.", true);
    return;
  }

  uploadedPath = path;

  const { data: pub } = supabaseClient
    .storage
    .from(BUCKET_PRODUCTS)
    .getPublicUrl(path);

  uploadedPublicUrl = pub?.publicUrl || "";

  uploading = false;

  setImgStatus("Imagen subida OK", true);

  show($("btnClearImage"), true);
  show($("btnViewRemote"), true);

  togglePublishBtn();
}

async function handleFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  resetImageState();

  localPreviewUrl = URL.createObjectURL(file);
  setImgPreview(localPreviewUrl);

  show($("btnClearImage"), true);

  await uploadImage(file);
}

async function publishProduct() {
  const name = cleanStr($("p_name").value);
  const price = numVal($("p_price").value);
  const category = cleanStr($("p_category").value);
  const description = cleanStr($("p_desc").value);

  if (!name || price <= 0 || !description || !uploadedPublicUrl) return;

  $("btnPublish").disabled = true;
  setMsg("panelMsg", "Publicando...", true);

  const payload = {
    name,
    price,
    category,
    description,
    image_url: uploadedPublicUrl,
    active: true,
    badges: []
  };

  const { error } = await supabaseClient.from("products").insert(payload);

  if (error) {
    setMsg("panelMsg", "No se pudo publicar. Revisa permisos o datos.", true);
    togglePublishBtn();
    return;
  }

  setMsg("panelMsg", "Publicado OK.", true);

  $("p_name").value = "";
  $("p_price").value = "";
  $("p_category").value = "";
  $("p_desc").value = "";
  $("p_img").value = "";
  resetImageState();
  togglePublishBtn();
}

async function doLogin() {
  const email = cleanStr($("email").value).toLowerCase();
  const password = cleanStr($("pass").value);

  if (!email || !password) {
    setMsg("authMsg", "Completa email y password.", true);
    return;
  }

  setMsg("authMsg", "Ingresando...", true);

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    setMsg("authMsg", "Email o password incorrectos.", true);
    return;
  }

  const ok = await isAuthorizedByEmail(data.user.email);
  if (!ok) {
    await supabaseClient.auth.signOut();
    setMsg("authMsg", "No autorizado.", true);
    return;
  }

  await boot();
}

async function doLogout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

async function boot() {
  const user = await getSessionUser();
  const who = $("whoami");
  const btnLogout = $("btnLogout");

  if (!user) {
    setText(who, "No autenticado");
    show(btnLogout, false);
    show($("authCard"), true);
    show($("panelCard"), false);
    return;
  }

  const ok = await isAuthorizedByEmail(user.email);
  if (!ok) {
    await supabaseClient.auth.signOut();
    setText(who, "No autorizado");
    show(btnLogout, false);
    show($("authCard"), true);
    show($("panelCard"), false);
    setMsg("authMsg", "No autorizado.", true);
    return;
  }

  setText(who, user.email);
  show(btnLogout, true);
  show($("authCard"), false);
  show($("panelCard"), true);

  togglePublishBtn();
}

function wire() {
  $("btnLogin").addEventListener("click", doLogin);
  $("btnLogout").addEventListener("click", doLogout);

  $("p_img").addEventListener("change", handleFileChange);

  $("btnClearImage").addEventListener("click", () => {
    $("p_img").value = "";
    resetImageState();
  });

  $("btnViewRemote").addEventListener("click", () => {
    if (uploadedPublicUrl) window.open(uploadedPublicUrl, "_blank", "noopener");
  });

  ["p_name","p_price","p_category","p_desc"].forEach(id => {
    $(id).addEventListener("input", togglePublishBtn);
  });

  $("btnPublish").addEventListener("click", publishProduct);
}

wire();
boot();
