const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const searchBtn = document.getElementById("searchBtn");
const searchStatus = document.getElementById("searchStatus");
const searchResults = document.getElementById("searchResults");
const resultLabel = document.getElementById("resultLabel");
const downloadBtn = document.getElementById("downloadBtn");
const saveImageBtn = document.getElementById("saveImageBtn");
const saveStatus = document.getElementById("saveStatus");
const creatorView = document.getElementById("creatorView");
const libraryView = document.getElementById("libraryView");
const creatorModeBtn = document.getElementById("creatorModeBtn");
const libraryModeBtn = document.getElementById("libraryModeBtn");
const refreshLibraryBtn = document.getElementById("refreshLibraryBtn");
const libraryGrid = document.getElementById("libraryGrid");
const libraryStatus = document.getElementById("libraryStatus");
const canvas = document.getElementById("cardCanvas");
const ctx = canvas.getContext("2d");

const fieldIds = [
  "deviceName",
  "storage",
  "android",
  "screen",
  "rearCamera",
  "frontCamera",
  "internal",
  "cardSlot",
  "cores",
  "ghz",
  "ram",
  "weight",
  "height",
  "widthPhone",
  "thickness",
  "battery",
  "band3g",
  "band2g",
  "band4g",
  "band5g",
  "format",
  "saveBrand",
  "saveName",
];

let deviceImage = null;
let gsmImageUrl = "";
let searchItems = [];

function getValue(id) {
  return document.getElementById(id).value.trim();
}

function setValue(id, value) {
  if (value !== undefined && value !== null && value !== "") {
    document.getElementById(id).value = value;
  }
}

function inferBrand(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("samsung") || text.includes("galaxy")) return "Samsung";
  if (text.includes("redmi") || text.includes("xiaomi") || text.includes("poco")) return "Xiaomi";
  if (text.includes("motorola") || text.includes("moto")) return "Motorola";
  if (text.includes("iphone") || text.includes("apple")) return "Apple";
  if (text.includes("honor")) return "Honor";
  if (text.includes("huawei")) return "Huawei";
  if (text.includes("realme")) return "Realme";
  if (text.includes("oppo")) return "Oppo";
  if (text.includes("vivo")) return "Vivo";
  return String(name || "Sin marca").split(" ")[0] || "Sin marca";
}

function syncSaveFields() {
  const deviceName = getValue("deviceName");
  setValue("saveBrand", inferBrand(deviceName));
  setValue("saveName", `${deviceName} ${getValue("storage")}`.trim());
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  drawCard();
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

async function postJson(url, data = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "No se pudo completar la operacion.");
  }
  return payload;
}

async function checkSession() {
  try {
    const response = await fetch("/api/session");
    const data = await response.json();
    if (data.authenticated) {
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace("Disclaimer.", "")
    .trim();
}

function fitText(text, x, y, maxWidth, size, weight = 800, align = "center") {
  let fontSize = size;
  ctx.textAlign = align;
  do {
    ctx.font = `${weight} ${fontSize}px Arial`;
    if (ctx.measureText(text).width <= maxWidth || fontSize <= 12) break;
    fontSize -= 2;
  } while (fontSize > 12);
  ctx.fillText(text, x, y);
}

function wrapText(text, x, y, maxWidth, lineHeight, maxLines = 3, align = "center") {
  const words = cleanText(text).split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);

  ctx.textAlign = align;
  lines.slice(0, maxLines).forEach((item, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    ctx.fillText(`${item}${suffix}`, x, y + index * lineHeight);
  });
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function iconRect(x, y, width, height, radius = 8, fill = false) {
  roundedRect(x, y, width, height, radius);
  if (fill) ctx.fill();
  ctx.stroke();
}

function drawLens(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4, radius / 2.4), 0, Math.PI * 2);
  ctx.fill();
}

function drawIcon(type, x, y) {
  ctx.save();
  ctx.fillStyle = "#ec2b12";
  ctx.strokeStyle = "#ec2b12";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (type === "android") {
    ctx.beginPath();
    ctx.arc(x - 18, y - 32, 3, 0, Math.PI * 2);
    ctx.arc(x + 18, y - 32, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 40);
    ctx.lineTo(x - 34, y - 56);
    ctx.moveTo(x + 22, y - 40);
    ctx.lineTo(x + 34, y - 56);
    ctx.stroke();
    roundedRect(x - 34, y - 34, 68, 58, 16);
    ctx.fill();
    ctx.fillStyle = "#eeeeee";
    ctx.beginPath();
    ctx.arc(x - 13, y - 10, 4, 0, Math.PI * 2);
    ctx.arc(x + 13, y - 10, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "ios") {
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 40);
    ctx.bezierCurveTo(x + 21, y - 56, x + 37, y - 48, x + 25, y - 30);
    ctx.bezierCurveTo(x + 12, y - 28, x + 4, y - 31, x + 6, y - 40);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 22);
    ctx.bezierCurveTo(x - 32, y - 38, x - 54, y - 5, x - 40, y + 27);
    ctx.bezierCurveTo(x - 29, y + 53, x - 10, y + 46, x, y + 38);
    ctx.bezierCurveTo(x + 13, y + 50, x + 34, y + 48, x + 45, y + 19);
    ctx.bezierCurveTo(x + 20, y + 10, x + 19, y - 18, x + 42, y - 27);
    ctx.bezierCurveTo(x + 24, y - 45, x + 5, y - 32, x - 7, y - 22);
    ctx.fill();
  } else if (type === "screen") {
    iconRect(x - 36, y - 28, 72, 50, 8);
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 34);
    ctx.lineTo(x + 14, y + 34);
    ctx.moveTo(x, y + 23);
    ctx.lineTo(x, y + 34);
    ctx.stroke();
    ctx.fillRect(x - 18, y - 10, 36, 6);
    ctx.fillRect(x - 18, y + 4, 24, 6);
  } else if (type === "camera") {
    iconRect(x - 38, y - 25, 76, 54, 10);
    ctx.fillRect(x - 22, y - 34, 24, 12);
    drawLens(x + 4, y + 2, 17);
    ctx.fillRect(x + 24, y - 14, 8, 8);
  } else if (type === "storage") {
    iconRect(x - 30, y - 36, 60, 72, 7);
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 18);
    ctx.lineTo(x + 30, y - 18);
    ctx.moveTo(x - 14, y - 36);
    ctx.lineTo(x - 14, y - 20);
    ctx.moveTo(x + 6, y - 36);
    ctx.lineTo(x + 6, y - 20);
    ctx.stroke();
    ctx.fillRect(x - 15, y + 8, 30, 8);
  } else if (type === "sd") {
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 36);
    ctx.lineTo(x + 12, y - 36);
    ctx.lineTo(x + 32, y - 16);
    ctx.lineTo(x + 32, y + 36);
    ctx.lineTo(x - 30, y + 36);
    ctx.closePath();
    ctx.stroke();
    ctx.fillRect(x - 16, y - 22, 8, 16);
    ctx.fillRect(x, y - 22, 8, 16);
    ctx.fillRect(x + 16, y - 8, 8, 16);
  } else if (type === "chip") {
    iconRect(x - 28, y - 28, 56, 56, 8);
    iconRect(x - 14, y - 14, 28, 28, 4);
    for (let i = -20; i <= 20; i += 20) {
      ctx.beginPath();
      ctx.moveTo(x + i, y - 44);
      ctx.lineTo(x + i, y - 31);
      ctx.moveTo(x + i, y + 31);
      ctx.lineTo(x + i, y + 44);
      ctx.moveTo(x - 44, y + i);
      ctx.lineTo(x - 31, y + i);
      ctx.moveTo(x + 31, y + i);
      ctx.lineTo(x + 44, y + i);
      ctx.stroke();
    }
  } else if (type === "ram") {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x, y - 24 + i * 24, 34, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 34, y - 24 + i * 24);
      ctx.lineTo(x - 34, y - 10 + i * 24);
      ctx.moveTo(x + 34, y - 24 + i * 24);
      ctx.lineTo(x + 34, y - 10 + i * 24);
      ctx.stroke();
    }
  } else if (type === "weight") {
    ctx.beginPath();
    ctx.moveTo(x - 32, y + 26);
    ctx.lineTo(x - 20, y - 22);
    ctx.lineTo(x + 20, y - 22);
    ctx.lineTo(x + 32, y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y - 22, 12, Math.PI, 0);
    ctx.stroke();
  } else if (type === "phone") {
    iconRect(x - 24, y - 38, 48, 76, 8);
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 28);
    ctx.lineTo(x + 8, y - 28);
    ctx.moveTo(x - 9, y + 28);
    ctx.lineTo(x + 9, y + 28);
    ctx.stroke();
    ctx.fillRect(x - 12, y - 8, 24, 6);
    ctx.fillRect(x - 12, y + 7, 18, 6);
  } else if (type === "battery") {
    iconRect(x - 24, y - 36, 48, 72, 8);
    ctx.fillRect(x - 10, y - 48, 20, 10);
    ctx.fillRect(x - 11, y + 6, 22, 20);
    ctx.beginPath();
    ctx.moveTo(x, y - 25);
    ctx.lineTo(x - 10, y - 3);
    ctx.lineTo(x + 2, y - 3);
    ctx.lineTo(x - 6, y + 18);
    ctx.lineTo(x + 14, y - 10);
    ctx.lineTo(x + 1, y - 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCell(x, y, w, h, icon, top, main, sub) {
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(x, y, w, h);
  drawIcon(icon, x + 56, y + h / 2);

  ctx.fillStyle = "#000";
  if (top) {
    ctx.font = "400 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(top, x + w - 76, y + 28);
  }

  fitText(main || "-", x + w - 76, y + h / 2 + 2, w - 128, 34, 800);
  ctx.font = "400 24px Arial";
  wrapText(sub || "", x + w - 76, y + h / 2 + 36, w - 134, 28, 2);
}

function drawNetworkCell(x, y, w, h, label, value) {
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#ec2b12";
  ctx.font = "800 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, x + 48, y + 56);
  ctx.fillStyle = "#000";
  ctx.font = "400 17px Arial";
  wrapText(value, x + w / 2 + 44, y + 28, w - 122, 22, 3);
}

function drawImageContain(img, x, y, w, h) {
  const ratio = Math.min(w / img.width, h / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  const drawX = x + (w - drawWidth) / 2;
  const drawY = y + (h - drawHeight) / 2;
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

function drawPlaceholder(x, y, w, h) {
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#d4d4d4";
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
  ctx.fillStyle = "#ec2b12";
  ctx.font = "800 42px Arial";
  ctx.textAlign = "center";
  ctx.fillText("IMAGEN", x + w / 2, y + h / 2 - 12);
  ctx.fillStyle = "#555";
  ctx.font = "500 24px Arial";
  ctx.fillText("del equipo", x + w / 2, y + h / 2 + 28);
}

function drawCard() {
  const title = `${getValue("deviceName")} ${getValue("storage")}`.trim().toUpperCase();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);

  ctx.fillStyle = "#000";
  fitText(title || "NOMBRE DEL EQUIPO", canvas.width / 2, 84, canvas.width - 140, 62, 800);

  const top = 160;
  const left = 38;
  const imageW = 560;
  const imageH = 690;
  ctx.fillStyle = "#f7f7f7";
  ctx.fillRect(left, top, imageW, imageH);
  ctx.strokeStyle = "#d4d4d4";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, imageW, imageH);

  if (deviceImage) {
    drawImageContain(deviceImage, left + 18, top + 18, imageW - 36, imageH - 36);
  } else {
    drawPlaceholder(left, top, imageW, imageH);
  }

  const gridX = 624;
  const colW = 278;
  const rowH = 170;
  const gap = 9;
  const c = (n) => gridX + n * (colW + gap);
  const r = (n) => top + n * (rowH + gap);
  const systemValue = getValue("android");
  const isIos = /iphone|apple/i.test(getValue("deviceName")) || /^ios/i.test(systemValue);
  const systemLabel = isIos ? "iOS" : "Android";
  const systemIcon = isIos ? "ios" : "android";

  drawCell(c(0), r(0), colW, rowH, systemIcon, "", systemValue, systemLabel);
  drawCell(c(1), r(0), colW, rowH, "screen", "", getValue("screen"), "Pantalla");
  drawCell(c(2), r(0), colW, rowH, "camera", "Trasera", getValue("rearCamera"), "Con Flash");
  drawCell(c(3), r(0), colW, rowH, "camera", "Frontal", getValue("frontCamera"), "Sin Flash");

  drawCell(c(0), r(1), colW, rowH, "storage", "", getValue("internal"), "M. Interna");
  drawCell(c(1), r(1), colW, rowH, "sd", "", getValue("cardSlot"), "Max. SD");
  drawCell(c(2), r(1), colW, rowH, "chip", "", getValue("cores"), "Nucleos");
  drawCell(c(3), r(1), colW, rowH, "chip", "", getValue("ghz"), "GHz");

  drawCell(c(0), r(2), colW, rowH, "ram", "", getValue("ram"), "RAM");
  drawCell(c(1), r(2), colW, rowH, "weight", "", getValue("weight"), "Gramos");
  drawCell(c(2), r(2), colW, rowH, "phone", "", getValue("height"), "cm");
  drawCell(c(3), r(2), colW, rowH, "phone", "", `${getValue("widthPhone")}   ${getValue("thickness")}`, "cm          cm");

  drawCell(c(0), r(3), colW, rowH, "battery", "", getValue("battery"), "Bateria");
  drawNetworkCell(c(1), r(3), colW, rowH / 2 - gap / 2, "3G", getValue("band3g"));
  drawNetworkCell(c(1), r(3) + rowH / 2 + gap / 2, colW, rowH / 2 - gap / 2, "2G", getValue("band2g"));
  drawNetworkCell(c(2), r(3), colW * 2 + gap, rowH / 2 - gap / 2, "4G", getValue("band4g"));
  drawNetworkCell(c(2), r(3) + rowH / 2 + gap / 2, colW * 2 + gap, rowH / 2 - gap / 2, "5G", getValue("band5g"));
}

function downloadCard() {
  drawCard();
  const format = getValue("format");
  const mime = format === "jpg" ? "image/jpeg" : "image/png";
  const extension = format === "jpg" ? "jpg" : "png";
  const title = `${getValue("deviceName") || "equipo"}-${getValue("storage") || "almacenamiento"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const link = document.createElement("a");
  link.download = `${title || "ficha-equipo"}.${extension}`;
  link.href = canvas.toDataURL(mime, 0.95);
  link.click();
}

async function saveCurrentImage() {
  const brand = (getValue("saveBrand") || inferBrand(getValue("deviceName"))).trim();
  const name = (getValue("saveName") || getValue("deviceName")).trim();

  if (!brand) {
    saveStatus.className = "status error";
    saveStatus.textContent = "Escribe el nombre de la carpeta de marca antes de guardar.";
    return;
  }
  if (!name) {
    saveStatus.className = "status error";
    saveStatus.textContent = "Escribe el nombre de archivo antes de guardar.";
    return;
  }

  drawCard();
  saveStatus.className = "status";
  saveStatus.textContent = "Generando imagen...";

  let dataUrl;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (e) {
    saveStatus.className = "status error";
    saveStatus.textContent = "No se pudo generar la imagen del canvas.";
    return;
  }

  saveStatus.textContent = "Guardando en biblioteca...";
  saveImageBtn.disabled = true;

  try {
    const data = await postJson("/api/save-image", { brand, name, dataUrl });
    saveStatus.className = "status success";
    saveStatus.textContent = "Guardado en galeria/" + data.brand + " — " + data.filename;
    await loadLibrary();
  } catch (error) {
    saveStatus.className = "status error";
    saveStatus.textContent = error.message;
  } finally {
    saveImageBtn.disabled = false;
  }
}

async function loadLibrary() {
  libraryStatus.className = "status";
  libraryStatus.textContent = "Cargando biblioteca...";
  libraryGrid.innerHTML = "";

  try {
    const data = await fetchJson("/api/library");
    if (!data.brands || !data.brands.length) {
      libraryStatus.textContent = "Aun no hay imagenes guardadas.";
      return;
    }

    data.brands.forEach((brand) => {
      const section = document.createElement("section");
      section.className = "brand-section";
      const title = document.createElement("h3");
      title.className = "brand-title";
      title.textContent = brand.brand;
      section.appendChild(title);

      const cards = document.createElement("div");
      cards.className = "library-grid";
      brand.files.forEach((file) => {
        const card = document.createElement("article");
        card.className = "saved-card";
        const img = document.createElement("img");
        img.src = file.url;
        img.alt = file.name;
        const link = document.createElement("a");
        link.href = file.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = file.name;
        card.append(img, link);
        cards.appendChild(card);
      });

      section.appendChild(cards);
      libraryGrid.appendChild(section);
    });

    libraryStatus.textContent = "";
  } catch (error) {
    libraryStatus.className = "status error";
    libraryStatus.textContent = error.message;
  }
}

function setMode(mode) {
  const isLibrary = mode === "library";
  creatorView.classList.toggle("hidden", isLibrary);
  libraryView.classList.toggle("hidden", !isLibrary);
  creatorModeBtn.classList.toggle("active", !isLibrary);
  libraryModeBtn.classList.toggle("active", isLibrary);
  if (isLibrary) loadLibrary();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "No se pudo obtener informacion.");
  }
  return response.json();
}

async function searchPhones() {
  const query = getValue("deviceName");
  if (!query) return;

  searchStatus.className = "status";
  searchStatus.textContent = "Buscando caracteristicas...";
  searchBtn.disabled = true;

  try {
    const data = await fetchJson(`/api/search?q=${encodeURIComponent(query)}`);
    searchItems = data.results || [];
    searchResults.innerHTML = "";

    if (!searchItems.length) {
      resultLabel.classList.add("hidden");
      searchStatus.className = "status error";
      searchStatus.textContent = "No encontre resultados. Prueba con marca y modelo, por ejemplo: Xiaomi Redmi Note.";
      return;
    }

    searchItems.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = item.name;
      searchResults.appendChild(option);
    });

    resultLabel.classList.remove("hidden");
    await loadPhone(searchItems[0].slug);
  } catch (error) {
    searchStatus.className = "status error";
    searchStatus.textContent = `${error.message} Ejecuta primero: node server.js`;
  } finally {
    searchBtn.disabled = false;
  }
}

async function loadPhone(slug) {
  searchStatus.className = "status";
  searchStatus.textContent = "Leyendo ficha tecnica...";

  const data = await fetchJson(`/api/phone?slug=${encodeURIComponent(slug)}`);
  setValue("deviceName", data.name);
  setValue("android", data.android);
  setValue("screen", data.screen);
  setValue("rearCamera", data.rearCamera);
  setValue("frontCamera", data.frontCamera);
  setValue("internal", data.internal);
  setValue("storage", data.storageTitle);
  setValue("cardSlot", data.cardSlot);
  setValue("cores", data.cores);
  setValue("ghz", data.ghz);
  setValue("ram", data.ram);
  setValue("weight", data.weight);
  setValue("height", data.height);
  setValue("widthPhone", data.width);
  setValue("thickness", data.thickness);
  setValue("battery", data.battery);
  setValue("band2g", data.band2g);
  setValue("band3g", data.band3g);
  setValue("band4g", data.band4g);
  setValue("band5g", data.band5g);
  syncSaveFields();

  if (data.image) {
    gsmImageUrl = `/api/image?url=${encodeURIComponent(data.image)}`;
    const img = new Image();
    img.onload = () => {
      deviceImage = img;
      drawCard();
    };
    img.src = gsmImageUrl;
  }

  searchStatus.className = "status success";
  searchStatus.textContent = "Ficha cargada. Puedes corregir cualquier campo antes de descargar.";
  drawCard();
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginMessage.classList.remove("error");
  loginMessage.textContent = "Validando acceso...";

  postJson("/api/login", {
    username: getValue("username"),
    password: getValue("password"),
  })
    .then(() => {
    loginMessage.classList.remove("error");
    loginMessage.textContent = "Ingresando...";
    showApp();
    })
    .catch((error) => {
      loginMessage.classList.add("error");
      loginMessage.textContent = error.message;
    });
});

logoutBtn.addEventListener("click", () => {
  postJson("/api/logout").finally(showLogin);
});

searchBtn.addEventListener("click", searchPhones);
saveImageBtn.addEventListener("click", saveCurrentImage);
creatorModeBtn.addEventListener("click", () => setMode("creator"));
libraryModeBtn.addEventListener("click", () => setMode("library"));
refreshLibraryBtn.addEventListener("click", loadLibrary);

searchResults.addEventListener("change", async () => {
  const selected = searchItems[Number(searchResults.value)];
  if (selected) await loadPhone(selected.slug);
});

fieldIds.forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    drawCard();
    if (id === "deviceName" || id === "storage") syncSaveFields();
  });
});

document.getElementById("deviceImage").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      deviceImage = img;
      drawCard();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

downloadBtn.addEventListener("click", downloadCard);

checkSession();
