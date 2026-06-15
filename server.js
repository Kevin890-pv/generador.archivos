const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const GALLERY_ROOT = path.join(ROOT, "galeria");
const GSM = "https://www.gsmarena.com";
const SESSION_COOKIE = "gc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const USERS = parseUsers(process.env.APP_USERS || "smith@mye.com:smith123","paola@mye.com:paola123");
const sessions = new Map();
const PHONE_APIS = [
  "https://api-mobilespecs.azharimm.dev",
  "https://phone-specs-api-2.azharimm.dev",
];
const BRAND_PAGES = [
  { brand: "Samsung", aliases: ["samsung", "galaxy"], url: "samsung-phones-9.php" },
  { brand: "Xiaomi", aliases: ["xiaomi", "redmi", "poco"], url: "xiaomi-phones-80.php" },
  { brand: "Honor", aliases: ["honor"], url: "honor-phones-121.php" },
  { brand: "Motorola", aliases: ["motorola", "moto"], url: "motorola-phones-4.php" },
  { brand: "Apple", aliases: ["apple", "iphone"], url: "apple-phones-48.php" },
  { brand: "Huawei", aliases: ["huawei"], url: "huawei-phones-58.php" },
  { brand: "Realme", aliases: ["realme"], url: "realme-phones-118.php" },
  { brand: "Oppo", aliases: ["oppo"], url: "oppo-phones-82.php" },
  { brand: "Vivo", aliases: ["vivo"], url: "vivo-phones-98.php" },
  { brand: "Tecno", aliases: ["tecno"], url: "tecno-phones-120.php" },
  { brand: "Infinix", aliases: ["infinix"], url: "infinix-phones-119.php" },
];
const BRAND_ALIAS_TOKENS = new Set(BRAND_PAGES.flatMap((brand) => brand.aliases));
const brandCache = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function safeName(value, fallback) {
  const clean = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parseUsers(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [username, password] = item.split(":");
      return {
        username: String(username || "").trim(),
        passwordHash: hashPassword(String(password || "")),
      };
    })
    .filter((item) => item.username && item.passwordHash);
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function requireSession(req, res) {
  const session = getSession(req);
  if (session) return session;
  sendJson(res, 401, { message: "Inicia sesion para continuar." });
  return null;
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

async function readJsonBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_500_000_000) throw new Error("Solicitud demasiado grande (max 1.5 GB).");
  }
  return body ? JSON.parse(body) : {};
}

async function handleAuth(req, res, url) {
  if (url.pathname === "/api/session" && req.method === "GET") {
    const session = getSession(req);
    return sendJson(res, 200, { authenticated: Boolean(session), username: session?.username || "" });
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const user = USERS.find((item) => item.username === username && item.passwordHash === hashPassword(password));

    if (!user) return sendJson(res, 401, { message: "Usuario o contrasena incorrectos." });

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token);
    return sendJson(res, 200, { authenticated: true, username });
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    clearSessionCookie(res);
    return sendJson(res, 200, { authenticated: false });
  }

  return false;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyNumber(value) {
  const match = String(value || "").match(/[\d.]+/);
  return match ? match[0] : "";
}

function cameraMp(value) {
  const matches = String(value || "").match(/\d+(?:\.\d+)?\s*MP/gi);
  return matches ? matches.map((item) => item.replace(/\s+/g, "")).join("+") : "";
}

function memoryNumber(amount, unit) {
  const number = Number(amount);
  return unit.toUpperCase() === "TB" ? number * 1024 : number;
}

function memoryLabel(amount, unit) {
  return `${amount}${unit.toUpperCase()}`;
}

function memoryOptions(value) {
  const text = String(value || "");
  const options = [];
  const regex = /(\d+)\s*(GB|TB)(?:\s+(\d+)\s*GB\s*RAM)?/gi;
  let match;

  while ((match = regex.exec(text))) {
    options.push({
      storage: memoryLabel(match[1], match[2]),
      storageScore: memoryNumber(match[1], match[2]),
      ram: match[3] ? `${match[3]}GB` : "",
      ramScore: match[3] ? Number(match[3]) : 0,
    });
  }

  return options;
}

function bestMemoryOption(value) {
  const options = memoryOptions(value);
  const preferred = options
    .filter((item) => item.storageScore === 256)
    .sort((a, b) => b.ramScore - a.ramScore)[0];
  if (preferred) return preferred;
  return options.sort((a, b) => b.storageScore - a.storageScore || b.ramScore - a.ramScore)[0] || null;
}

function ramFromInternal(value) {
  const best = bestMemoryOption(value);
  if (best?.ram) return best.ram;
  const matches = String(value || "").match(/\d+\s*GB\s*RAM/gi);
  if (!matches || !matches.length) return "";
  return matches[matches.length - 1].replace(/\s*RAM/i, "").replace(/\s+/g, "");
}

function internalFromMemory(value) {
  const best = bestMemoryOption(value);
  if (best?.storage) return best.storage;
  const match = String(value || "").match(/\d+\s*GB|\d+\s*TB/i);
  return match ? match[0].replace(/\s+/g, "") : "";
}

function parseSearch(html) {
  const results = [];
  const cardRegex = /<li>\s*<a href="([^"]+\.php)">\s*<img\s+([^>]*?)>\s*<strong>\s*<span>([\s\S]*?)<\/span>/gi;
  let cardMatch;

  while ((cardMatch = cardRegex.exec(html))) {
    const slug = cardMatch[1];
    const attrs = cardMatch[2];
    const name = decodeHtml(cardMatch[3]);
    const image = attrs.match(/src=(?:"([^"]+)"|([^\s>]+))/i)?.[1] || attrs.match(/src=(?:"([^"]+)"|([^\s>]+))/i)?.[2] || "";
    const title = decodeHtml(attrs.match(/title=(?:"([^"]+)"|'([^']+)')/i)?.[1] || attrs.match(/title=(?:"([^"]+)"|'([^']+)')/i)?.[2] || "");

    if (name && slug !== "/") {
      results.push({
        name,
        title,
        slug,
        image: image.startsWith("http") ? image : `${GSM}/${image.replace(/^\//, "")}`,
      });
    }
  }

  if (results.length) return results.slice(0, 200);

  const makers = html;
  const linkRegex = /<a href="([^"]+)">([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(makers))) {
    const slug = match[1];
    const body = match[2];
    if (!slug.endsWith(".php") || slug === "/") continue;
    const name = decodeHtml(body.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] || body);
    const image = body.match(/<img[^>]+src=(?:"([^"]+)"|([^\s>]+))/i)?.[1] || body.match(/<img[^>]+src=(?:"([^"]+)"|([^\s>]+))/i)?.[2] || "";
    const title = decodeHtml(body.match(/<img[^>]+title=(?:"([^"]+)"|'([^']+)')/i)?.[1] || body.match(/<img[^>]+title=(?:"([^"]+)"|'([^']+)')/i)?.[2] || "");
    if (name) {
      results.push({
        name,
        title,
        slug,
        image: image.startsWith("http") ? image : `${GSM}/${image.replace(/^\//, "")}`,
      });
    }
  }

  return results.slice(0, 12);
}

function queryTokens(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function searchable(value) {
  return queryTokens(value).join(" ");
}

function matchingBrands(q) {
  const tokens = queryTokens(q);
  const matches = BRAND_PAGES.filter((brand) => brand.aliases.some((alias) => tokens.includes(alias)));
  return matches.length ? matches : BRAND_PAGES;
}

function scorePhone(phone, q) {
  const tokens = queryTokens(q);
  const brand = searchable(phone.brand || "");
  const name = searchable(phone.name);
  const slug = searchable(phone.slug);
  const title = searchable(phone.title || "");
  const modelTokens = tokens.filter((token) => !BRAND_ALIAS_TOKENS.has(token));
  let score = 0;

  if (modelTokens.length) {
    const modelMatched = modelTokens.some((token) => name.includes(token) || slug.includes(token) || title.includes(token));
    if (!modelMatched) return 0;
  }

  tokens.forEach((token) => {
    if (name.includes(token)) score += 8;
    if (slug.includes(token)) score += 4;
    if (title.includes(token)) score += 2;
    if (brand.includes(token)) score += 1;
  });

  if (name === tokens.join(" ")) score += 40;
  if (tokens.length && tokens.every((token) => name.includes(token) || slug.includes(token) || title.includes(token))) {
    score += 15;
  }
  return score;
}

function discoverBrandPages(html, brandUrl) {
  const pages = new Set([brandUrl]);
  const pageLinks = html.match(/[a-z0-9-]+-phones-f-\d+-0-p\d+\.php/gi) || [];
  pageLinks.slice(0, 10).forEach((item) => pages.add(item));
  return [...pages];
}

async function fetchBrandPhones(brand) {
  const cached = brandCache.get(brand.url);
  if (cached && Date.now() - cached.time < 1000 * 60 * 60) return cached.phones;

  const firstResponse = await gsmFetch(`${GSM}/${brand.url}`);
  const firstHtml = await firstResponse.text();
  const pages = discoverBrandPages(firstHtml, brand.url);
  const phones = parseSearch(firstHtml).map((phone) => ({ ...phone, brand: brand.brand }));

  for (const page of pages.slice(1, 8)) {
    try {
      const response = await gsmFetch(`${GSM}/${page}`);
      const html = await response.text();
      phones.push(...parseSearch(html).map((phone) => ({ ...phone, brand: brand.brand })));
    } catch {
      // Keep the phones already collected from this brand.
    }
  }

  const unique = uniqueResults(phones);
  const ordered = unique.map((phone, index) => ({ ...phone, order: index }));
  brandCache.set(brand.url, { time: Date.now(), phones: ordered });
  return ordered;
}

async function searchBrandPages(q) {
  const brands = matchingBrands(q);
  const allPhones = [];

  for (const brand of brands) {
    try {
      allPhones.push(...(await fetchBrandPhones(brand)));
    } catch {
      // Try the next brand/source.
    }
  }

  return uniqueResults(allPhones)
    .map((phone) => ({ ...phone, score: scorePhone(phone, q) }))
    .filter((phone) => phone.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order || a.name.localeCompare(b.name))
    .slice(0, 30)
    .map(({ score, order, ...phone }) => phone);
}

function uniqueResults(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.source || "gsm"}:${item.slug}`;
    if (!item.name || !item.slug || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSpecs(html) {
  const specs = {};
  let currentSection = "";
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  rows.forEach((row) => {
    const section = row.match(/<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/i)?.[1];
    if (section) currentSection = decodeHtml(section);

    const label = row.match(/<td[^>]*class="ttl"[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    const value = row.match(/<td[^>]*class="nfo"[^>]*>([\s\S]*?)<\/td>/i)?.[1];
    if (!label || !value || !currentSection) return;

    specs[currentSection] = specs[currentSection] || {};
    specs[currentSection][decodeHtml(label)] = decodeHtml(value);
  });

  return specs;
}

function getSpec(specs, section, label) {
  return specs[section]?.[label] || "";
}

function androidFromOs(os) {
  const iosMatch = os.match(/iOS\s*([\d.]+)/i);
  if (iosMatch) return iosMatch[1];
  const match = os.match(/Android\s*([\d.]+)/i);
  return match ? match[1] : os;
}

function coresFromCpu(cpu) {
  const match = cpu.match(/Octa-core|Hexa-core|Quad-core|Dual-core/i);
  if (!match) return "";
  const map = {
    "Octa-core": "8x",
    "Hexa-core": "6x",
    "Quad-core": "4x",
    "Dual-core": "2x",
  };
  return map[match[0]] || match[0];
}

function ghzFromCpu(cpu) {
  const matches = cpu.match(/\d+(?:\.\d+)?\s*GHz/gi);
  if (!matches) return "";
  return matches.map((item) => item.replace(/\s*GHz/i, "")).join("/");
}

function dimensions(value) {
  const cm = value.match(/\(([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*cm\)/i);
  if (cm) return { height: cm[1], width: cm[2], thickness: cm[3] };

  const mm = value.match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*mm/i);
  if (!mm) return { height: "", width: "", thickness: "" };
  return {
    height: (Number(mm[1]) / 10).toFixed(1),
    width: (Number(mm[2]) / 10).toFixed(1),
    thickness: (Number(mm[3]) / 10).toFixed(1),
  };
}

function storageTitle(internal, ram) {
  const storage = internalFromMemory(internal);
  const memory = ramFromInternal(internal) || ram;
  return [storage, memory].filter(Boolean).join(" ");
}

function valueText(value) {
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(" ");
  if (value && typeof value === "object") return valueText(value.val || value.value || value.text || "");
  return decodeHtml(value);
}

function normalizeTitle(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findApiSpec(sections, sectionName, keyName) {
  const sectionNeedle = normalizeTitle(sectionName);
  const keyNeedle = normalizeTitle(keyName);
  const section = sections.find((item) => normalizeTitle(item.title || item.name).includes(sectionNeedle));
  if (!section) return "";

  const specs = section.specs || section.data || section.items || [];
  const spec = specs.find((item) => normalizeTitle(item.key || item.name || item.title).includes(keyNeedle));
  return valueText(spec?.val ?? spec?.value ?? spec?.text ?? "");
}

function firstApiSpec(sections, sectionName, keyNames) {
  for (const key of keyNames) {
    const value = findApiSpec(sections, sectionName, key);
    if (value) return value;
  }
  return "";
}

function normalizeApiSlug(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.split("?")[0].replace(/\/$/, "");
  return clean.split("/").pop();
}

function parseApiSearch(data) {
  const root = data?.data || data;
  const phones = root?.phones || root?.results || root || [];
  if (!Array.isArray(phones)) return [];

  return phones.slice(0, 18).map((phone) => {
    const slug = normalizeApiSlug(phone.slug || phone.phone_slug || phone.detail || phone.url);
    return {
      name: phone.phone_name || phone.name || phone.model || "",
      slug: `api:${slug}`,
      source: "api",
      image: phone.image || phone.thumbnail || "",
    };
  });
}

function parseApiPhone(data) {
  const root = data?.data || data;
  const sections = root?.specifications || root?.specs || [];
  const os = firstApiSpec(sections, "Platform", ["OS"]);
  const displaySize = firstApiSpec(sections, "Display", ["Size"]);
  const mainCamera = firstApiSpec(sections, "Main Camera", ["Quad", "Triple", "Dual", "Single"]);
  const selfieCamera = firstApiSpec(sections, "Selfie camera", ["Dual", "Single"]);
  const internal = firstApiSpec(sections, "Memory", ["Internal"]);
  const cardSlot = firstApiSpec(sections, "Memory", ["Card slot"]);
  const cpu = firstApiSpec(sections, "Platform", ["CPU"]);
  const weight = firstApiSpec(sections, "Body", ["Weight"]);
  const size = dimensions(firstApiSpec(sections, "Body", ["Dimensions"]));
  const battery = firstApiSpec(sections, "Battery", ["Type"]);

  return {
    name: root.phone_name || root.name || "",
    image: root.thumbnail || root.image || "",
    android: androidFromOs(os),
    screen: onlyNumber(displaySize),
    rearCamera: cameraMp(mainCamera),
    frontCamera: cameraMp(selfieCamera),
    internal: internalFromMemory(internal),
    storageTitle: storageTitle(internal, ""),
    cardSlot: /microSD/i.test(cardSlot) ? "Si" : /no/i.test(cardSlot) ? "No" : cardSlot,
    cores: coresFromCpu(cpu),
    ghz: ghzFromCpu(cpu),
    ram: ramFromInternal(internal),
    weight: onlyNumber(weight),
    height: size.height,
    width: size.width,
    thickness: size.thickness,
    battery: onlyNumber(battery),
    band2g: firstApiSpec(sections, "Network", ["2G bands"]),
    band3g: firstApiSpec(sections, "Network", ["3G bands"]),
    band4g: firstApiSpec(sections, "Network", ["4G bands"]),
    band5g: firstApiSpec(sections, "Network", ["5G bands"]),
  };
}

function parsePhone(html) {
  const name = decodeHtml(html.match(/<h1[^>]*class="specs-phone-name-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const imageMatch = html.match(/<div class="specs-photo-main">[\s\S]*?<img[^>]+src=(?:"([^"]+)"|([^\s>]+))/i);
  const imageRaw = imageMatch?.[1] || imageMatch?.[2] || "";
  const image = imageRaw ? (imageRaw.startsWith("http") ? imageRaw : `${GSM}/${imageRaw.replace(/^\//, "")}`) : "";
  const specs = parseSpecs(html);

  const os = getSpec(specs, "Platform", "OS");
  const displaySize = getSpec(specs, "Display", "Size");
  const mainCamera = getSpec(specs, "Main Camera", "Single") || getSpec(specs, "Main Camera", "Dual") || getSpec(specs, "Main Camera", "Triple") || getSpec(specs, "Main Camera", "Quad");
  const selfieCamera = getSpec(specs, "Selfie camera", "Single") || getSpec(specs, "Selfie camera", "Dual");
  const internal = getSpec(specs, "Memory", "Internal");
  const cardSlot = getSpec(specs, "Memory", "Card slot");
  const cpu = getSpec(specs, "Platform", "CPU");
  const weight = getSpec(specs, "Body", "Weight");
  const size = dimensions(getSpec(specs, "Body", "Dimensions"));
  const battery = getSpec(specs, "Battery", "Type");

  return {
    name,
    image,
    android: androidFromOs(os),
    screen: onlyNumber(displaySize),
    rearCamera: cameraMp(mainCamera),
    frontCamera: cameraMp(selfieCamera),
    internal: internalFromMemory(internal),
    storageTitle: storageTitle(internal, ""),
    cardSlot: /microSD/i.test(cardSlot) ? "Si" : cardSlot.includes("No") ? "No" : cardSlot,
    cores: coresFromCpu(cpu),
    ghz: ghzFromCpu(cpu),
    ram: ramFromInternal(internal),
    weight: onlyNumber(weight),
    height: size.height,
    width: size.width,
    thickness: size.thickness,
    battery: onlyNumber(battery),
    band2g: getSpec(specs, "Network", "2G bands"),
    band3g: getSpec(specs, "Network", "3G bands"),
    band4g: getSpec(specs, "Network", "4G bands"),
    band5g: getSpec(specs, "Network", "5G bands"),
  };
}

async function gsmFetch(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`GSMArena respondio ${response.status}`);
  return response;
}

async function plainFetch(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "application/json,text/html,image/*,*/*",
    },
  });
  if (!response.ok) throw new Error(`Servicio respondio ${response.status}`);
  return response;
}

async function searchApi(q) {
  for (const host of PHONE_APIS) {
    try {
      const response = await plainFetch(`${host}/search?query=${encodeURIComponent(q)}`);
      const results = parseApiSearch(await response.json());
      if (results.length) return results;
    } catch {
      // Try the next public mirror before falling back to GSMArena.
    }
  }
  return [];
}

async function searchGsm(q) {
  try {
    const response = await gsmFetch(`${GSM}/res.php3?sSearch=${encodeURIComponent(q)}`);
    const html = await response.text();
    return parseSearch(html);
  } catch {
    return [];
  }
}

async function getApiPhone(slug) {
  let lastError = null;
  for (const host of PHONE_APIS) {
    try {
      const response = await plainFetch(`${host}/${encodeURIComponent(slug)}`);
      return parseApiPhone(await response.json());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No se pudo leer la ficha tecnica.");
}

async function handleApi(req, res, url) {
  try {
    const authHandled = await handleAuth(req, res, url);
    if (authHandled !== false) return;
    if (!requireSession(req, res)) return;

    if (url.pathname === "/api/search") {
      const q = url.searchParams.get("q") || "";
      if (!q.trim()) return sendJson(res, 400, { message: "Escribe un modelo para buscar." });
      const [brandResults, apiResults, gsmResults] = await Promise.all([searchBrandPages(q), searchApi(q), searchGsm(q)]);
      return sendJson(res, 200, { results: uniqueResults([...brandResults, ...apiResults, ...gsmResults]).slice(0, 30) });
    }

    if (url.pathname === "/api/save-image") {
      if (req.method !== "POST") {
        return sendJson(res, 405, { message: "Metodo no permitido." });
      }
      const body = await readJsonBody(req);
      const brand = safeName(body.brand, "Sin marca");
      const name = safeName(body.name, "plantilla");
      const dataUrl = String(body.dataUrl || "");
      const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
      if (!match) return sendJson(res, 400, { message: "Imagen invalida." });

      const extension = match[1] === "jpeg" ? "jpg" : "png";
      const brandDir = path.join(GALLERY_ROOT, brand);
      fs.mkdirSync(brandDir, { recursive: true });

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${name}-${stamp}.${extension}`;
      const fullPath = path.join(brandDir, filename);
      fs.writeFileSync(fullPath, Buffer.from(match[2], "base64"));

      return sendJson(res, 200, {
        message: "Imagen guardada.",
        brand,
        filename,
        url: `/galeria/${encodeURIComponent(brand)}/${encodeURIComponent(filename)}`,
      });
    }

    if (url.pathname === "/api/library") {
      fs.mkdirSync(GALLERY_ROOT, { recursive: true });
      const brands = fs
        .readdirSync(GALLERY_ROOT, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .map((dir) => {
          const files = fs
            .readdirSync(path.join(GALLERY_ROOT, dir.name), { withFileTypes: true })
            .filter((item) => item.isFile() && /\.(png|jpe?g)$/i.test(item.name))
            .map((file) => ({
              name: file.name,
              url: `/galeria/${encodeURIComponent(dir.name)}/${encodeURIComponent(file.name)}`,
            }))
            .sort((a, b) => b.name.localeCompare(a.name));
          return { brand: dir.name, files };
        })
        .filter((item) => item.files.length)
        .sort((a, b) => a.brand.localeCompare(b.brand));

      return sendJson(res, 200, { brands });
    }

    if (url.pathname === "/api/phone") {
      const slug = url.searchParams.get("slug") || "";
      if (slug.startsWith("api:")) {
        const phoneSlug = slug.replace(/^api:/, "");
        if (!/^[a-z0-9_()-]+$/i.test(phoneSlug)) return sendJson(res, 400, { message: "Resultado invalido." });
        return sendJson(res, 200, await getApiPhone(phoneSlug));
      }
      if (!/^[a-z0-9_()-]+\.php$/i.test(slug)) return sendJson(res, 400, { message: "Resultado invalido." });
      const response = await gsmFetch(`${GSM}/${slug}`);
      const html = await response.text();
      return sendJson(res, 200, parsePhone(html));
    }

    if (url.pathname === "/api/image") {
      const imageUrl = url.searchParams.get("url") || "";
      if (
        !imageUrl.startsWith("https://fdn2.gsmarena.com/") &&
        !imageUrl.startsWith("https://fdn.gsmarena.com/") &&
        !imageUrl.startsWith("https://api-mobilespecs.azharimm.dev/")
      ) {
        return sendJson(res, 400, { message: "Imagen no permitida." });
      }
      const response = await plainFetch(imageUrl);
      res.writeHead(200, { "Content-Type": response.headers.get("content-type") || "image/jpeg" });
      const buffer = Buffer.from(await response.arrayBuffer());
      return res.end(buffer);
    }

    return sendJson(res, 404, { message: "Ruta no encontrada." });
  } catch (error) {
    return sendJson(res, 500, { message: error.message || "Error consultando GSMArena." });
  }
}

function serveStatic(req, res, url) {
  if (url.pathname.startsWith("/galeria/") && !getSession(req)) {
    res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Inicia sesion para ver esta imagen.");
  }

  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(ROOT, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function runSearchTest(queries) {
  for (const query of queries) {
    const results = await searchBrandPages(query);
    console.log(`\n${query}`);
    results.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} -> ${item.slug}`);
    });
    if (!results.length) console.log("Sin resultados");
  }
}

if (process.argv[2] === "--test-search") {
  const queries = process.argv.slice(3);
  runSearchTest(queries.length ? queries : ["samsung", "redmi", "honor", "motorola", "iphone"])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  return;
}

if (process.argv[2] === "--dump-brand") {
  const brandName = process.argv[3] || "motorola";
  const brand = BRAND_PAGES.find((item) => item.aliases.includes(brandName.toLowerCase())) || BRAND_PAGES[0];
  fetchBrandPhones(brand)
    .then((phones) => {
      phones
        .filter((phone) => searchable(`${phone.name} ${phone.slug}`).includes(searchable(process.argv[4] || "")))
        .slice(0, 30)
        .forEach((phone) => console.log(`${phone.name} -> ${phone.slug}`));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  return;
}

if (process.argv[2] === "--contains") {
  const brandName = process.argv[3] || "motorola";
  const needle = process.argv[4] || "G06";
  const brand = BRAND_PAGES.find((item) => item.aliases.includes(brandName.toLowerCase())) || BRAND_PAGES[0];
  gsmFetch(`${GSM}/${brand.url}`)
    .then((response) => response.text())
    .then((html) => {
      console.log(html.includes(needle));
      const index = html.indexOf(needle);
      if (index >= 0) console.log(html.slice(Math.max(0, index - 250), index + 500));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  return;
}

if (process.argv[2] === "--parse-debug") {
  const brandName = process.argv[3] || "motorola";
  const needle = searchable(process.argv[4] || "g06");
  const brand = BRAND_PAGES.find((item) => item.aliases.includes(brandName.toLowerCase())) || BRAND_PAGES[0];
  gsmFetch(`${GSM}/${brand.url}`)
    .then((response) => response.text())
    .then((html) => {
      const phones = parseSearch(html);
      console.log("count", phones.length);
      phones.filter((phone) => searchable(`${phone.name} ${phone.slug} ${phone.title}`).includes(needle)).forEach((phone) => console.log(phone));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  return;
}

if (process.argv[2] === "--test-phone") {
  const slugs = process.argv.slice(3);
  Promise.all(
    slugs.map(async (slug) => {
      const response = await gsmFetch(`${GSM}/${slug}`);
      const phone = parsePhone(await response.text());
      console.log(`\n${slug}`);
      console.log(JSON.stringify(phone, null, 2));
    })
  )
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  return;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Generador listo en http://localhost:${PORT}`);
});