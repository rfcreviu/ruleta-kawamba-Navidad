// ===================== Ruleta Kawamba - Campaña de Navidad =====================
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const resultModal = document.getElementById("resultModal");
const errorModal = document.getElementById("errorModal");
const nameModal = document.getElementById("nameModal");
const nameForm = document.getElementById("nameForm");
const playerNameInput = document.getElementById("playerNameInput");
const playerEmailInput = document.getElementById("playerEmailInput");
const nameError = document.getElementById("nameError");
const resultImg = document.getElementById("resultImg");
const resultName = document.getElementById("resultName");
const resultPlayer = document.getElementById("resultPlayer");
const resultCode = document.getElementById("resultCode");
const errorText = document.getElementById("errorText");

const SLICE_COLORS = [
  { base: "#FFC83D", text: "#1a1200" },
  { base: "#0A5EBD", text: "#ffffff" },
  { base: "#1C8A5C", text: "#ffffff" },
  { base: "#FFF7E0", text: "#1a1200" },
  { base: "#E4572E", text: "#ffffff" },
  { base: "#063A7A", text: "#ffffff" },
  { base: "#2EC4B6", text: "#042b26" },
  { base: "#B11226", text: "#ffffff" },
  { base: "#2D6A4F", text: "#ffffff" },
  { base: "#FFD166", text: "#1a1200" },
];

let prizes = [];
let currentRotation = -Math.PI / 2; // empezamos alineados con el puntero
let spinning = false;
const imageCache = new Map();

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.src = src;
  const promise = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
  imageCache.set(src, promise);
  return promise;
}

async function fetchPrizes() {
  try {
    const res = await fetch("/api/premios");
    const data = await res.json();
    prizes = data.premios || [];
  } catch (e) {
    prizes = [];
  }
}

function getSliceAngle() {
  return (2 * Math.PI) / prizes.length;
}

async function drawWheel() {
  const size = canvas.width;
  const radius = size / 2;
  const sliceAngle = getSliceAngle();

  ctx.clearRect(0, 0, size, size);

  const imgs = await Promise.all(prizes.map((p) => loadImage(p.imagen)));

  const rim = radius * 0.012; // separación interior antes del aro exterior
  const outerR = radius - rim;

  for (let i = 0; i < prizes.length; i++) {
    const palette = SLICE_COLORS[i % SLICE_COLORS.length];
    const startAngle = currentRotation + i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const midAngle = startAngle + sliceAngle / 2;

    // --- Recorte del sector (wedge) ---
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, outerR, startAngle, endAngle);
    ctx.closePath();
    ctx.clip();

    // --- Fondo de color del sector (gradiente de marca) ---
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(startAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, outerR, 0, sliceAngle);
    ctx.closePath();
    const bgGrad = ctx.createRadialGradient(0, 0, outerR * 0.1, 0, 0, outerR);
    bgGrad.addColorStop(0, shadeHex(palette.base, 12));
    bgGrad.addColorStop(1, shadeHex(palette.base, -18));
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.restore();

    // --- Medallón de la imagen, con borde difuminado para fundirse con el fondo ---
    const img = imgs[i];
    if (img) {
      // Con más premios, los sectores son más estrechos: reducimos el medallón
      // y lo acercamos un poco más al borde para aprovechar mejor el espacio.
      const sizeFactor = Math.max(0.16, Math.min(0.3, 1.1 / prizes.length + 0.08));
      const medallionR = outerR * sizeFactor;
      const centerDist = outerR * 0.66;
      const cx = radius + Math.cos(midAngle) * centerDist;
      const cy = radius + Math.sin(midAngle) * centerDist;

      const medSize = medallionR * 2;
      const off = document.createElement("canvas");
      off.width = medSize;
      off.height = medSize;
      const octx = off.getContext("2d");

      // Imagen a modo "contain" centrada (sin deformar ni cortar mal)
      const iw = img.width, ih = img.height;
      const scale = Math.max(medSize / iw, medSize / ih) * 1.08;
      const dw = iw * scale, dh = ih * scale;
      octx.drawImage(img, medSize / 2 - dw / 2, medSize / 2 - dh / 2, dw, dh);

      // Máscara radial: opaco en el centro, transparente en el borde (feather)
      octx.globalCompositeOperation = "destination-in";
      const mask = octx.createRadialGradient(medSize / 2, medSize / 2, medallionR * 0.58, medSize / 2, medSize / 2, medallionR);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = mask;
      octx.fillRect(0, 0, medSize, medSize);

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = outerR * 0.035;
      ctx.drawImage(off, cx - medallionR, cy - medallionR);
      ctx.restore();
    }

    // --- Vignette hacia el centro para legibilidad del hub ---
    const vignette = ctx.createRadialGradient(radius, radius, outerR * 0.08, radius, radius, outerR * 0.42);
    vignette.addColorStop(0, "rgba(10,8,4,0.5)");
    vignette.addColorStop(1, "rgba(10,8,4,0)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    // --- Separador dorado fino entre sectores ---
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(startAngle);
    ctx.beginPath();
    ctx.moveTo(outerR * 0.1, 0);
    ctx.lineTo(outerR, 0);
    const divGrad = ctx.createLinearGradient(outerR * 0.1, 0, outerR, 0);
    divGrad.addColorStop(0, "rgba(255,216,130,0.15)");
    divGrad.addColorStop(1, "rgba(255,216,130,0.75)");
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = Math.max(1.5, radius * 0.006);
    ctx.stroke();
    ctx.restore();
  }

  // --- Aro exterior tipo "rueda de la fortuna" con pequeñas luces ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, outerR, 0, Math.PI * 2);
  ctx.lineWidth = radius * 0.028;
  const rimGrad = ctx.createLinearGradient(0, 0, size, size);
  rimGrad.addColorStop(0, "#fff3c4");
  rimGrad.addColorStop(0.5, "#d9a62b");
  rimGrad.addColorStop(1, "#fff3c4");
  ctx.strokeStyle = rimGrad;
  ctx.stroke();
  ctx.restore();

  const lightCount = prizes.length * 2;
  for (let i = 0; i < lightCount; i++) {
    const angle = currentRotation + (i * Math.PI * 2) / lightCount;
    const lx = radius + Math.cos(angle) * outerR;
    const ly = radius + Math.sin(angle) * outerR;
    ctx.beginPath();
    ctx.arc(lx, ly, radius * 0.011, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8e1";
    ctx.shadowColor = "rgba(255,216,130,0.9)";
    ctx.shadowBlur = radius * 0.02;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // --- Hub central elegante ---
  const hub = radius * 0.145;
  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, hub + radius * 0.02, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(radius, radius, hub, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(radius - hub * 0.3, radius - hub * 0.3, hub * 0.1, radius, radius, hub);
  hubGrad.addColorStop(0, "#fffdf3");
  hubGrad.addColorStop(0.55, "#ffe08a");
  hubGrad.addColorStop(1, "#c99a2e");
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(2, radius * 0.008);
  ctx.strokeStyle = "#fff3c4";
  ctx.stroke();
  ctx.restore();

}

function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function shadeHex(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function animateSpin(targetIndex, onDone) {
  const sliceAngle = getSliceAngle();
  const targetCenter = targetIndex * sliceAngle + sliceAngle / 2;
  const pointerAngle = -Math.PI / 2;

  const extraTurns = 6 + Math.floor(Math.random() * 3);
  const startRotation = currentRotation;

  let desiredFinal = pointerAngle - targetCenter;
  while (desiredFinal < startRotation) {
    desiredFinal += 2 * Math.PI;
  }
  desiredFinal += extraTurns * 2 * Math.PI;

  const duration = 4400;
  const startTime = performance.now();

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOutCubic(t);
    currentRotation = startRotation + (desiredFinal - startRotation) * eased;
    drawWheel();

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      currentRotation = desiredFinal % (2 * Math.PI);
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

async function performSpin(playerName, playerEmail) {
  spinning = true;
  spinBtn.disabled = true;

  try {
    const res = await fetch("/api/girar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: playerName, correo: playerEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "No se pudo realizar el giro");
    }
    const data = await res.json();

    animateSpin(data.index, () => {
      showResult(data.premio, playerName, data.codigo);
      spinning = false;
      spinBtn.disabled = false;
    });
  } catch (err) {
    spinning = false;
    spinBtn.disabled = false;
    showError(err.message || "Error de conexión con el servidor");
  }
}

function openNameModal() {
  nameError.textContent = "";
  const savedName = localStorage.getItem("kawamba_player_name") || "";
  const savedEmail = localStorage.getItem("kawamba_player_email") || "";
  playerNameInput.value = savedName;
  playerEmailInput.value = savedEmail;
  nameModal.classList.remove("hidden");
  setTimeout(() => playerNameInput.focus(), 150);
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (spinning) return;
  const submitBtn = nameForm.querySelector('button[type="submit"]');
  if (submitBtn && submitBtn.disabled) return;
  const name = playerNameInput.value.trim();
  const email = playerEmailInput.value.trim();
  if (!name) {
    nameError.textContent = "Por favor, escribe tu nombre";
    return;
  }
  if (submitBtn) submitBtn.disabled = true;
  localStorage.setItem("kawamba_player_name", name);
  localStorage.setItem("kawamba_player_email", email);
  nameModal.classList.add("hidden");
  performSpin(name, email).finally(() => {
    if (submitBtn) submitBtn.disabled = false;
  });
});

function showResult(premio, playerName, codigo) {
  resultImg.src = premio.imagen;
  resultImg.alt = premio.nombre;
  resultName.textContent = premio.nombre;
  resultPlayer.textContent = playerName;
  if (resultCode) resultCode.textContent = codigo || "";
  resultModal.classList.remove("hidden");
  launchConfetti();
}

function showError(msg) {
  errorText.textContent = msg;
  errorModal.classList.remove("hidden");
}

document.getElementById("closeModalBtn").addEventListener("click", () => {
  resultModal.classList.add("hidden");
});
document.getElementById("closeErrorBtn").addEventListener("click", () => {
  errorModal.classList.add("hidden");
});

spinBtn.addEventListener("click", () => {
  if (spinning || prizes.length === 0) return;
  openNameModal();
});

function launchConfetti() {
  const container = document.querySelector(".confetti");
  if (!container) return;
  container.innerHTML = "";
  const colors = ["#FFC83D", "#0A5EBD", "#1C8A5C", "#E4572E", "#ffffff"];
  for (let i = 0; i < 44; i++) {
    const piece = document.createElement("div");
    piece.style.position = "absolute";
    piece.style.width = "8px";
    piece.style.height = "8px";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left = Math.random() * 100 + "%";
    piece.style.top = "-10px";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.opacity = "0.9";
    piece.animate(
      [
        { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
        { transform: `translateY(${320 + Math.random() * 120}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 1600 + Math.random() * 900, easing: "ease-out" }
    );
    container.appendChild(piece);
  }
  setTimeout(() => { container.innerHTML = ""; }, 2700);
}

async function init() {
  await fetchPrizes();
  if (prizes.length === 0) {
    showError("No hay premios configurados. Contacta al administrador.");
    spinBtn.disabled = true;
    return;
  }
  await drawWheel();
}

init();
