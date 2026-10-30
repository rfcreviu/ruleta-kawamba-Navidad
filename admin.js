// ===================== Panel Admin - Ruleta Kawamba =====================
const loginCard = document.getElementById("loginCard");
const panel = document.getElementById("panel");
const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const prizeList = document.getElementById("prizeList");
const totalWeightEl = document.getElementById("totalWeight");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");
const saveStatus = document.getElementById("saveStatus");
const newPinInput = document.getElementById("newPinInput");
const changePinBtn = document.getElementById("changePinBtn");
const pinStatus = document.getElementById("pinStatus");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmText = document.getElementById("confirmText");
const confirmYesBtn = document.getElementById("confirmYesBtn");
const confirmNoBtn = document.getElementById("confirmNoBtn");

function confirmDialog(message, title) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title || "¿Confirmar?";
    confirmText.textContent = message;
    confirmModal.classList.remove("hidden");

    function cleanup(result) {
      confirmModal.classList.add("hidden");
      confirmYesBtn.removeEventListener("click", onYes);
      confirmNoBtn.removeEventListener("click", onNo);
      resolve(result);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    confirmYesBtn.addEventListener("click", onYes);
    confirmNoBtn.addEventListener("click", onNo);
  });
}

let currentPin = sessionStorage.getItem("kawamba_admin_pin") || "";
let prizes = [];
let historyCache = [];

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = "status-msg" + (type ? " " + type : "");
  if (msg) {
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 4000);
  }
}

async function tryLogin(pin) {
  loginError.textContent = "";
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (data.ok) {
      currentPin = pin;
      sessionStorage.setItem("kawamba_admin_pin", pin);
      loginCard.classList.add("hidden");
      panel.classList.remove("hidden");
      await loadPrizes();
      await loadHistory();
    } else {
      loginError.textContent = data.error || "PIN incorrecto";
    }
  } catch (e) {
    loginError.textContent = "Error de conexión con el servidor";
  }
}

loginBtn.addEventListener("click", () => {
  const pin = pinInput.value.trim();
  if (pin) tryLogin(pin);
});
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem("kawamba_admin_pin");
  currentPin = "";
  panel.classList.add("hidden");
  loginCard.classList.remove("hidden");
  pinInput.value = "";
});

async function loadPrizes() {
  const res = await fetch(`/api/admin/premios?pin=${encodeURIComponent(currentPin)}`);
  if (!res.ok) {
    logoutBtn.click();
    return;
  }
  const data = await res.json();
  prizes = data.premios;
  renderPrizes();
}

function renderPrizes() {
  prizeList.innerHTML = "";
  const total = prizes.reduce((sum, p) => sum + (p.activo ? Number(p.peso) : 0), 0);
  totalWeightEl.textContent = total.toFixed(0);

  prizes.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "prize-row";

    const pct = total > 0 && p.activo ? ((p.peso / total) * 100).toFixed(1) : "0.0";
    const stockValue = p.stock === null || p.stock === undefined ? "" : p.stock;
    const agotado = p.stock !== null && p.stock !== undefined && p.stock <= 0;

    row.innerHTML = `
      <img src="${p.imagen}" alt="${p.nombre}">
      <div class="prize-info">
        <input type="text" value="${p.nombre}" data-field="nombre" data-idx="${idx}">
        <div class="percent-bar-wrap">
          <div class="percent-bar" style="width:${pct}%"></div>
        </div>
        ${agotado ? '<span class="stock-badge agotado">AGOTADO</span>' : ""}
      </div>
      <div class="prize-controls">
        <div>
          <label>Peso</label><br>
          <input type="number" min="0" step="1" class="weight-input" value="${p.peso}" data-field="peso" data-idx="${idx}">
        </div>
        <div>
          <label>Stock</label><br>
          <input type="number" min="0" step="1" class="stock-input" placeholder="∞" value="${stockValue}" data-field="stock" data-idx="${idx}">
        </div>
        <div class="percent-badge">${pct}%</div>
        <label class="toggle-switch">
          <input type="checkbox" ${p.activo ? "checked" : ""} data-field="activo" data-idx="${idx}">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
    prizeList.appendChild(row);
  });

  prizeList.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", onFieldChange);
    input.addEventListener("change", onFieldChange);
  });
}

function onFieldChange(e) {
  const idx = Number(e.target.dataset.idx);
  const field = e.target.dataset.field;
  if (field === "activo") {
    prizes[idx].activo = e.target.checked;
  } else if (field === "peso") {
    prizes[idx].peso = Number(e.target.value) || 0;
  } else if (field === "nombre") {
    prizes[idx].nombre = e.target.value;
  } else if (field === "stock") {
    const val = e.target.value.trim();
    prizes[idx].stock = val === "" ? null : Math.max(0, Number(val) || 0);
  }
  renderPrizes();
}

saveBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/admin/premios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin, premios: prizes }),
    });
    const data = await res.json();
    if (data.ok) {
      setStatus(saveStatus, "✅ Cambios guardados correctamente", "success");
      prizes = data.premios;
      renderPrizes();
    } else {
      setStatus(saveStatus, data.error || "Error al guardar", "error");
    }
  } catch (e) {
    setStatus(saveStatus, "Error de conexión", "error");
  }
});

resetBtn.addEventListener("click", async () => {
  const ok = await confirmDialog("¿Restaurar los valores por defecto de todos los premios?", "Restaurar premios");
  if (!ok) return;
  try {
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin }),
    });
    const data = await res.json();
    if (data.ok) {
      prizes = data.premios;
      renderPrizes();
      setStatus(saveStatus, "✅ Valores restaurados", "success");
    } else {
      setStatus(saveStatus, data.error || "Error al restaurar", "error");
    }
  } catch (e) {
    setStatus(saveStatus, "Error de conexión", "error");
  }
});

changePinBtn.addEventListener("click", async () => {
  const nuevo = newPinInput.value.trim();
  if (nuevo.length < 4) {
    setStatus(pinStatus, "El PIN debe tener al menos 4 caracteres", "error");
    return;
  }
  try {
    const res = await fetch("/api/admin/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin, nuevo_pin: nuevo }),
    });
    const data = await res.json();
    if (data.ok) {
      currentPin = nuevo;
      sessionStorage.setItem("kawamba_admin_pin", nuevo);
      newPinInput.value = "";
      setStatus(pinStatus, "✅ PIN actualizado correctamente", "success");
    } else {
      setStatus(pinStatus, data.error || "Error al cambiar PIN", "error");
    }
  } catch (e) {
    setStatus(pinStatus, "Error de conexión", "error");
  }
});

async function loadHistory() {
  try {
    const res = await fetch(`/api/admin/historial?pin=${encodeURIComponent(currentPin)}`);
    const data = await res.json();
    historyCache = data.historial || [];
    renderHistory();
  } catch (e) {
    historyList.innerHTML = "<p>Error al cargar el historial.</p>";
  }
}

function renderHistory() {
  if (historyCache.length === 0) {
    historyList.innerHTML = "<p style='opacity:0.7'>Aún no hay giros registrados.</p>";
    return;
  }
  historyList.innerHTML = historyCache
    .slice(0, 80)
    .map(
      (h) => `
      <div class="history-item" data-codigo="${escapeHtml(h.codigo)}">
        <div class="history-main">
          <span class="history-player">${escapeHtml(h.jugador || "—")}</span>
          ${h.correo ? `<span class="history-email">${escapeHtml(h.correo)}</span>` : ""}
          <span class="history-date">${h.fecha || ""}</span>
        </div>
        <span class="history-prize">${escapeHtml(h.premio_nombre)}</span>
        <button class="history-delete" data-codigo="${escapeHtml(h.codigo)}" title="Eliminar este giro" aria-label="Eliminar este giro">✕</button>
      </div>`
    )
    .join("");

  historyList.querySelectorAll(".history-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteHistoryEntry(btn.dataset.codigo));
  });
}

async function deleteHistoryEntry(codigo) {
  const ok = await confirmDialog("¿Eliminar este giro del historial?", "Eliminar giro");
  if (!ok) return;
  try {
    const res = await fetch("/api/admin/historial", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin, codigos: [codigo] }),
    });
    const data = await res.json();
    if (data.ok) {
      historyCache = data.historial || historyCache.filter((h) => h.codigo !== codigo);
      renderHistory();
    } else {
      setStatus(saveStatus, data.error || "No se pudo eliminar el giro", "error");
    }
  } catch (e) {
    setStatus(saveStatus, "Error de conexión al eliminar el giro", "error");
  }
}

clearHistoryBtn.addEventListener("click", async () => {
  if (historyCache.length === 0) return;
  const ok = await confirmDialog("¿Vaciar TODO el historial de giros? Esta acción no se puede deshacer.", "Vaciar historial");
  if (!ok) return;
  try {
    const res = await fetch("/api/admin/historial/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin }),
    });
    const data = await res.json();
    if (data.ok) {
      historyCache = [];
      renderHistory();
    } else {
      setStatus(saveStatus, data.error || "No se pudo vaciar el historial", "error");
    }
  } catch (e) {
    setStatus(saveStatus, "Error de conexión al vaciar el historial", "error");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Auto-login si ya había sesión
if (currentPin) {
  tryLogin(currentPin);
}
