// ============================================================
// MeD — Village Medicine Delivery App — Main Application JS
// ============================================================

// ── State ──────────────────────────────────────────────────
const State = {
  user: null,          // { mobile, name, role, provider_id? }
  areas: [],
  providers: [],
  orders: [],
  shopkeeperOrders: { today: [], tomorrow: [], thisWeek: [] },
  currentView: "login",
};

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = id => $(id) && $(id).classList.remove("hidden");
const hide = id => $(id) && $(id).classList.add("hidden");

function showSpinner() {
  let el = $("spinner");
  if (!el) {
    el = document.createElement("div");
    el.id = "spinner";
    el.className = "spinner-overlay";
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.remove("hidden");
}
function hideSpinner() { const el = $("spinner"); if (el) el.classList.add("hidden"); }

function toast(msg, type = "info") {
  let container = $("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(8px)"; t.style.transition = ".3s"; setTimeout(() => t.remove(), 300); }, 3200);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function timelineLabel(t) {
  const map = { today: "🚀 Aaj", tomorrow: "📅 Kal", "3days": "📦 3 Din Mein", week: "🗓️ 1 Hafte Mein" };
  return map[t] || t;
}
function badgeClass(status) {
  if (!status) return "badge-pending";
  const s = status.toLowerCase();
  if (s === "delivered") return "badge-delivered";
  if (s === "cancelled") return "badge-cancelled";
  return "badge-pending";
}

// ── API ────────────────────────────────────────────────────
// NOTE: Google Apps Script redirects POST requests (loses body + triggers CORS preflight).
// Solution: Send everything as GET with URL query params — Apps Script handles this perfectly.
async function api(payload) {
  showSpinner();
  try {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(payload)) {
      params.append(key, typeof val === "object" ? JSON.stringify(val) : val);
    }
    const url = `${CONFIG.APPS_SCRIPT_URL}?${params.toString()}`;
    const res = await fetch(url, { redirect: "follow" });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("Apps Script response (not JSON):", text);
      return { success: false, message: "Server se galat response aaya. Apps Script deploy check karein." };
    }
  } catch (e) {
    console.error("API error:", e);
    toast("Network error. Internet check karein.", "error");
    return { success: false, message: "Network error" };
  } finally {
    hideSpinner();
  }
}

// ── ImgBB Upload ────────────────────────────────────────────
async function uploadPhoto(file) {
  if (!file) return null;
  if (!CONFIG.IMGBB_API_KEY || CONFIG.IMGBB_API_KEY === "YOUR_IMGBB_API_KEY") {
    toast("ImgBB API key set nahi hai — photo skip ki ja rahi hai.", "warning");
    return null;
  }
  showSpinner();
  try {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`, { method: "POST", body: formData });
    const data = await res.json();
    return data.success ? data.data.url : null;
  } catch { return null; }
  finally { hideSpinner(); }
}

// ── Session Persistence ─────────────────────────────────────
function saveSession(user) {
  State.user = user;
  sessionStorage.setItem("med_user", JSON.stringify(user));
}
function loadSession() {
  const raw = sessionStorage.getItem("med_user");
  if (raw) { State.user = JSON.parse(raw); return true; }
  return false;
}
function clearSession() { State.user = null; sessionStorage.removeItem("med_user"); }

// ── Router ─────────────────────────────────────────────────
function navigate(view, data = {}) {
  State.currentView = view;
  const app = $("app");
  app.innerHTML = "";
  const views = { login, register, resetPassword, userDashboard, orderForm, shopkeeperDashboard };
  if (views[view]) views[view](data);
}

// ── VIEW: Login ─────────────────────────────────────────────
function login() {
  const app = $("app");
  app.innerHTML = `
  <div class="auth-bg">
    <div class="auth-card view-enter">
      <div class="brand">
        <div class="brand-icon">💊</div>
        <h1>${CONFIG.APP_NAME}</h1>
        <p>Apni dawai, ghar ke paas</p>
      </div>
      <div class="form-group">
        <label for="login-mobile">📱 Mobile Number</label>
        <input id="login-mobile" type="tel" placeholder="10 digit mobile number" maxlength="10" inputmode="numeric">
      </div>
      <div class="form-group">
        <label for="login-pwd">🔑 Password</label>
        <input id="login-pwd" type="password" placeholder="SMS se mila password">
      </div>
      <button class="btn btn-primary" id="btn-login">Login Karein →</button>
      <div class="or-divider">ya</div>
      <div class="auth-links">
        <a id="go-register">Nayi Registration</a>
        <span>|</span>
        <a id="go-reset">Password Bhool Gaye?</a>
      </div>
    </div>
  </div>`;

  $("btn-login").addEventListener("click", async () => {
    const mobile = $("login-mobile").value.trim();
    const password = $("login-pwd").value.trim();
    if (!/^\d{10}$/.test(mobile)) { toast("10 digit mobile number daalein.", "error"); return; }
    if (!password) { toast("Password daalein.", "error"); return; }
    const res = await api({ action: "login", mobile, password });
    if (res.success) {
      saveSession({ mobile, name: res.name, role: res.role, provider_id: res.provider_id, area_id: res.area_id });
      toast(`Welcome back, ${res.name}! 👋`, "success");
      if (res.role === "shopkeeper") navigate("shopkeeperDashboard");
      else navigate("userDashboard");
    } else {
      toast(res.message || "Login fail. Dobara try karein.", "error");
    }
  });
  $("go-register").addEventListener("click", () => navigate("register"));
  $("go-reset").addEventListener("click", () => navigate("resetPassword"));
}

// ── VIEW: Register ──────────────────────────────────────────
function register() {
  const app = $("app");
  app.innerHTML = `
  <div class="auth-bg">
    <div class="auth-card view-enter">
      <div class="brand">
        <div class="brand-icon">✨</div>
        <h1>Nayi Registration</h1>
        <p>Password SMS pe milega</p>
      </div>
      <div class="form-group">
        <label for="reg-mobile">📱 Mobile Number</label>
        <input id="reg-mobile" type="tel" placeholder="10 digit mobile number" maxlength="10" inputmode="numeric">
      </div>
      <div class="form-group">
        <label for="reg-name">👤 Aapka Naam</label>
        <input id="reg-name" type="text" placeholder="Apna naam likhein">
      </div>
      <button class="btn btn-primary" id="btn-register">Register Karein →</button>
      <button class="btn btn-secondary" id="go-login-from-reg">← Wapas Login</button>
    </div>
  </div>`;

  $("btn-register").addEventListener("click", async () => {
    const mobile = $("reg-mobile").value.trim();
    const name = $("reg-name").value.trim();
    if (!/^\d{10}$/.test(mobile)) { toast("10 digit mobile number daalein.", "error"); return; }
    if (!name) { toast("Naam daalna zaroori hai.", "error"); return; }
    const res = await api({ action: "register", mobile, name });
    if (res.success) { toast(res.message, "success"); setTimeout(() => navigate("login"), 2000); }
    else toast(res.message, "error");
  });
  $("go-login-from-reg").addEventListener("click", () => navigate("login"));
}

// ── VIEW: Reset Password ────────────────────────────────────
function resetPassword() {
  const app = $("app");
  app.innerHTML = `
  <div class="auth-bg">
    <div class="auth-card view-enter">
      <div class="brand">
        <div class="brand-icon">🔄</div>
        <h1>Password Reset</h1>
        <p>Naya password SMS pe aayega</p>
      </div>
      <div class="form-group">
        <label for="reset-mobile">📱 Mobile Number</label>
        <input id="reset-mobile" type="tel" placeholder="Registered mobile number" maxlength="10" inputmode="numeric">
      </div>
      <button class="btn btn-primary" id="btn-reset">Naya Password Bhejein →</button>
      <button class="btn btn-secondary" id="go-login-from-reset">← Wapas Login</button>
    </div>
  </div>`;

  $("btn-reset").addEventListener("click", async () => {
    const mobile = $("reset-mobile").value.trim();
    if (!/^\d{10}$/.test(mobile)) { toast("10 digit mobile number daalein.", "error"); return; }
    const res = await api({ action: "resetPassword", mobile });
    if (res.success) { toast(res.message, "success"); setTimeout(() => navigate("login"), 2500); }
    else toast(res.message, "error");
  });
  $("go-login-from-reset").addEventListener("click", () => navigate("login"));
}

// ── VIEW: User Dashboard ────────────────────────────────────
async function userDashboard() {
  const user = State.user;
  const app = $("app");
  app.innerHTML = `
  ${renderTopNav(user)}
  <div class="dashboard">
    <div class="greeting-card">
      <h2>Namaste, ${user.name}! 🙏</h2>
      <p>Aaj kya chahiye? Order karein ya history dekhein.</p>
    </div>
    <div class="quick-actions">
      <div class="action-card" id="ac-new-order">
        <div class="action-icon">🛒</div>
        <h3>Naya Order</h3>
        <p>Dawai mangwayein</p>
      </div>
      <div class="action-card" id="ac-history">
        <div class="action-icon">📋</div>
        <h3>Order History</h3>
        <p>Pichhle 7 din</p>
      </div>
    </div>
    <div class="section-card" id="order-history-section">
      <div class="section-header">
        <h2>📦 Hamare Orders</h2>
      </div>
      <div id="orders-list"><div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div></div>
    </div>
  </div>`;

  $("ac-new-order").addEventListener("click", () => navigate("orderForm"));
  $("ac-history").addEventListener("click", () => $("order-history-section").scrollIntoView({ behavior: "smooth" }));
  $("btn-logout-nav").addEventListener("click", logout);

  const res = await api({ action: "getOrders", mobile: user.mobile });
  if (res.success) renderOrderList(res.orders || []);
  else { $("orders-list").innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>${res.message}</p></div>`; }
}

function renderOrderList(orders) {
  const container = $("orders-list");
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Abhi koi order nahi hai.<br>Pehla order karein!</p></div>`;
    return;
  }
  container.innerHTML = orders.map(o => `
    <div class="order-card" onclick="showOrderModal('user', '${o.order_id}')">
      <div class="order-card-header">
        <span class="order-id">#${o.order_id || "---"}</span>
        ${(o.status && o.status.toLowerCase() !== "pending") ? `<span class="order-badge ${badgeClass(o.status)}">${o.status}</span>` : ""}
      </div>
      <div class="order-medicines">${o.medicines || ""}</div>
      <div class="order-meta">
        <span class="order-meta-item">📍 ${o.area || ""}</span>
        <span class="order-meta-item">🏪 ${o.provider || "Local Dukaan"}</span>
        <span class="order-meta-item">⏰ ${timelineLabel(o.timeline)}</span>
        <span class="order-meta-item">📅 ${formatDate(o.created_at)}</span>
      </div>
      ${o.photo_url ? `<span class="order-photo-link">📷 ${o.photo_url.split(',').length} Photos attached</span>` : ""}
    </div>`).join("");
}

// ── Order Details Modal ──────────────────────────────────────
window.showOrderModal = function(type, orderId, tab = "") {
  let order = null;
  if (type === "user") order = State.orders.find(o => o.order_id === orderId);
  else if (type === "shop") order = State.shopkeeperOrders[tab].find(o => o.order_id === orderId);
  
  if (!order) return;

  const photos = order.photo_url ? order.photo_url.split(",").map(u => u.trim()).filter(Boolean) : [];
  
  const modalHTML = `
  <div class="modal-overlay" id="order-modal-overlay" onclick="if(event.target === this) this.remove()">
    <div class="modal-content">
      <button class="modal-close" onclick="document.getElementById('order-modal-overlay').remove()">✕</button>
      <div class="modal-header">
        <h2>Order #${order.order_id || "---"}</h2>
        ${(order.status && order.status.toLowerCase() !== "pending") ? `<span class="order-badge ${badgeClass(order.status)}">${order.status}</span>` : ""}
      </div>
      
      <div class="modal-section">
        <div class="modal-label">User Details</div>
        <div class="modal-value">👤 ${order.user_name || "N/A"} <br> 📱 ${order.mobile || "N/A"}</div>
      </div>
      
      <div class="modal-section">
        <div class="modal-label">Location & Provider</div>
        <div class="modal-value">📍 Area: ${order.area || "N/A"} <br> 🏪 Provider: ${order.provider || "Local Shopkeeper"}</div>
      </div>
      
      <div class="modal-section">
        <div class="modal-label">Timeline</div>
        <div class="modal-value">⏰ ${timelineLabel(order.timeline)} <br> 📅 Created: ${formatDate(order.created_at)}</div>
      </div>
      
      <div class="modal-section">
        <div class="modal-label">Medicines / Symptoms</div>
        <div class="modal-value">💊 ${order.medicines || "N/A"}</div>
      </div>
      
      ${photos.length ? `
      <div class="modal-section">
        <div class="modal-label">Attached Photos (${photos.length})</div>
        <div class="image-grid">
          ${photos.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="Prescription"></a>`).join("")}
        </div>
      </div>` : ""}
    </div>
  </div>`;
  
  document.body.insertAdjacentHTML("beforeend", modalHTML);
}

// ── VIEW: Order Form ────────────────────────────────────────
async function orderForm() {
  const user = State.user;
  const app = $("app");

  // Check 7 PM cutoff
  const now = new Date();
  const pastCutoff = now.getHours() >= CONFIG.DELIVERY_CUTOFF_HOUR;

  app.innerHTML = `
  ${renderTopNav(user)}
  <div class="dashboard">
    <div class="section-card view-enter">
      <div class="section-header">
        <h2>🛒 Naya Order</h2>
        <button class="btn btn-sm btn-secondary" id="back-to-dash">← Wapas</button>
      </div>
      ${pastCutoff ? `<div class="cutoff-banner">⚠️ Shaam ke 7 baj gaye! "Aaj" select karein to delivery kal subah hogi.</div>` : ""}
      <div class="form-group">
        <label for="sel-area">📍 Apna Area Chunein</label>
        <select id="sel-area"><option value="">-- Area chunein --</option></select>
      </div>
      <div class="form-group">
        <label for="sel-provider">🏪 Dukandaar Chunein</label>
        <select id="sel-provider"><option value="">-- Pehle area chunein --</option></select>
      </div>
      <div class="form-group">
        <label for="inp-medicines">💊 Dawai ka Naam / Takleef</label>
        <textarea id="inp-medicines" placeholder="Jaise: Crocin, Betadine cream, Ya -- sirdard aur bukhar ke liye dawai --"></textarea>
      </div>
      <div class="form-group">
        <label>📷 Prescription / Wrapper (Max 8 photos)</label>
        <div class="upload-area" id="upload-area">
          <div>📁</div>
          <p>Photos yahan tap karein ya drag karein</p>
          <input type="file" id="photo-input" accept="image/*" multiple style="display:none">
        </div>
        <div id="photo-preview-grid" class="image-grid hidden"></div>
      </div>
      <div class="form-group">
        <label for="sel-timeline">⏰ Kab Chahiye?</label>
        <select id="sel-timeline">
          <option value="today">🚀 Aaj (7:30 PM tak)</option>
          <option value="tomorrow">📅 Kal</option>
          <option value="3days">📦 3 Din Mein</option>
          <option value="week">🗓️ 1 Hafte Mein</option>
        </select>
      </div>
      <button class="btn btn-primary mt-16" id="btn-submit-order">✅ Order Submit Karein</button>
    </div>
  </div>`;

  $("back-to-dash").addEventListener("click", () => navigate("userDashboard"));
  $("btn-logout-nav").addEventListener("click", logout);

  // Load areas
  showSpinner();
  const areasRes = await api({ action: "getAreas" });
  hideSpinner();
  if (areasRes.success && areasRes.areas.length) {
    State.areas = areasRes.areas;
    const sel = $("sel-area");
    areasRes.areas.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.area_id; opt.textContent = a.area_name;
      sel.appendChild(opt);
    });
  }

  // Area change → load providers
  $("sel-area").addEventListener("change", async () => {
    const area_id = $("sel-area").value;
    const pSel = $("sel-provider");
    pSel.innerHTML = "<option value=''>-- Loading... --</option>";
    if (!area_id) { pSel.innerHTML = "<option value=''>-- Pehle area chunein --</option>"; return; }
    const res = await api({ action: "getProvidersByArea", area_id });
    if (res.success && res.providers.length) {
      State.providers = res.providers;
      pSel.innerHTML = "<option value=''>-- Dukandaar chunein --</option>";
      res.providers.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.provider_id; opt.textContent = p.name;
        pSel.appendChild(opt);
      });
    } else {
      pSel.innerHTML = "<option value='local'>🏠 Local Shopkeeper / Gaon ka Ladka</option>";
    }
  });

  // Photo upload
  $("upload-area").addEventListener("click", () => $("photo-input").click());
  $("upload-area").addEventListener("dragover", e => { e.preventDefault(); $("upload-area").classList.add("drag-over"); });
  $("upload-area").addEventListener("dragleave", () => $("upload-area").classList.remove("drag-over"));
  $("upload-area").addEventListener("drop", e => { e.preventDefault(); $("upload-area").classList.remove("drag-over"); handlePhotoFiles(e.dataTransfer.files); });
  $("photo-input").addEventListener("change", e => handlePhotoFiles(e.target.files));

  // Auto-handle cutoff
  if (pastCutoff) {
    $("sel-timeline").value = "tomorrow";
  }

  // Submit
  $("btn-submit-order").addEventListener("click", submitOrder);
}

let selectedPhotoFiles = [];
function handlePhotoFiles(files) {
  if (!files || files.length === 0) return;
  
  const newFiles = Array.from(files);
  if (selectedPhotoFiles.length + newFiles.length > 8) {
    toast("Max 8 photos allowed!", "warning");
    newFiles.splice(8 - selectedPhotoFiles.length);
  }
  
  selectedPhotoFiles = [...selectedPhotoFiles, ...newFiles];
  
  const grid = $("photo-preview-grid");
  grid.classList.remove("hidden");
  
  $("upload-area").querySelector("p").textContent = `${selectedPhotoFiles.length} photos selected`;
  
  newFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement("img");
      img.src = e.target.result;
      grid.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

async function submitOrder() {
  const user = State.user;
  const area_id   = $("sel-area").value;
  const prov_id   = $("sel-provider").value;
  const medicines = $("inp-medicines").value.trim();
  const timeline  = $("sel-timeline").value;

  if (!area_id) { toast("Area chunein.", "error"); return; }
  if (!medicines) { toast("Dawai ka naam ya takleef likhein.", "error"); return; }

  const area     = State.areas.find(a => String(a.area_id) === String(area_id));
  const provider = State.providers.find(p => String(p.provider_id) === String(prov_id));

  // Upload photos if selected
  let final_photo_urls = [];
  if (selectedPhotoFiles.length > 0) {
    const uploadPromises = selectedPhotoFiles.map(file => uploadPhoto(file));
    const results = await Promise.all(uploadPromises);
    final_photo_urls = results.filter(url => url !== null);
  }

  const res = await api({
    action: "submitOrder",
    mobile:      user.mobile,
    user_name:   user.name,
    area:        area ? area.area_name : area_id,
    area_id,
    provider:    provider ? provider.name : (prov_id || "Local Shopkeeper"),
    provider_id: prov_id || "",
    medicines,
    photo_url:   final_photo_urls.join(", "),
    timeline,
  });

  if (res.success) {
    toast("Order submit ho gaya! 🎉", "success");
    selectedPhotoFiles = [];
    setTimeout(() => navigate("userDashboard"), 1500);
  } else {
    toast(res.message || "Order fail. Dobara try karein.", "error");
  }
}

// ── VIEW: Shopkeeper Dashboard ──────────────────────────────
async function shopkeeperDashboard() {
  const user = State.user;
  const app = $("app");
  app.innerHTML = `
  ${renderTopNav(user, true)}
  <div class="dashboard">
    <div class="greeting-card">
      <h2>Namaste, ${user.name}! 🏪</h2>
      <p>Aaj ke saare orders yahaan hain.</p>
    </div>
    <div class="section-card">
      <div class="section-header"><h2>📋 Orders</h2></div>
      <div class="tab-bar">
        <button class="tab-btn active" id="tab-today" data-tab="today">🚀 Aaj</button>
        <button class="tab-btn" id="tab-tomorrow" data-tab="tomorrow">📅 Kal</button>
        <button class="tab-btn" id="tab-week" data-tab="week">🗓️ Hafte Mein</button>
      </div>
      <div id="sk-order-list"><div class="empty-state"><div class="empty-icon">⏳</div><p>Loading...</p></div></div>
    </div>
  </div>`;

  $("btn-logout-nav").addEventListener("click", logout);

  const res = await api({ action: "getShopkeeperOrders", provider_id: user.provider_id || "", area_id: user.area_id || "" });
  if (res.success) {
    State.shopkeeperOrders = res.orders;
    renderSkOrders("today");
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSkOrders(btn.dataset.tab);
    });
  });
}

function renderSkOrders(tab) {
  const map = { today: "today", tomorrow: "tomorrow", week: "thisWeek" };
  const orders = State.shopkeeperOrders[map[tab]] || [];
  const container = $("sk-order-list");
  if (!orders.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>Is waqt koi order nahi.</p></div>`;
    return;
  }
  container.innerHTML = orders.map(o => `
    <div class="shop-order-card" onclick="showOrderModal('shop', '${o.order_id}', '${map[tab]}')">
      <div class="order-card-header">
        <span class="order-id">#${o.order_id || "---"}</span>
        ${(o.status && o.status.toLowerCase() !== "pending") ? `<span class="order-badge ${badgeClass(o.status)}">${o.status}</span>` : ""}
      </div>
      <div class="row">
        <span class="pill">👤 ${o.user_name || o.mobile}</span>
        <span class="pill">📍 ${o.area || ""}</span>
        <span class="pill">⏰ ${timelineLabel(o.timeline)}</span>
        <span class="pill">📅 ${formatDate(o.created_at)}</span>
      </div>
      <div class="medicine-text"><strong>💊 Dawai / Takleef:</strong><br>${o.medicines || ""}</div>
      ${o.photo_url ? `<span class="order-photo-link">📷 ${o.photo_url.split(',').length} Photos attached</span>` : ""}
      <div class="mt-8 text-muted">📱 ${o.mobile}</div>
    </div>`).join("");
}

// ── Nav & Logout ────────────────────────────────────────────
function renderTopNav(user, isShopkeeper = false) {
  return `<nav class="topnav">
    <div class="nav-brand">
      <span class="nav-icon">💊</span>
      <div>
        <h2>MeD</h2>
        <small>${isShopkeeper ? "Shopkeeper Panel" : "Dawai Delivery"}</small>
      </div>
    </div>
    <div class="nav-right">
      <span class="user-badge">👤 ${user.name}</span>
      <button class="btn-logout" id="btn-logout-nav">Logout</button>
    </div>
  </nav>`;
}

function logout() {
  clearSession();
  State.user = null;
  toast("Aap logout ho gaye.", "info");
  navigate("login");
}

// ── Boot ────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  if (loadSession() && State.user) {
    if (State.user.role === "shopkeeper") navigate("shopkeeperDashboard");
    else navigate("userDashboard");
  } else {
    navigate("login");
  }
});
