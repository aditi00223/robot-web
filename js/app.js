const WAKE = /(hello|hallo|helo)\s*(robo|robot|rowbo|roboto)/;
const PHOTO = /\b(1|one|won|wan|ek|photo|photos|foto)\b/;
const DIRECTIONS = /\b(2|two|to|too|tu|do|direction|directions)\b/;
const IDLE_HINT = 'Say "Hello Robo" to wake me';
const QR_SECONDS = 30;
const ROUTE_SECONDS = 30;
const MAX_TRIES = 2;

const hint = document.querySelector(".hint");
const menu = document.getElementById("menu");
const idleScreen = document.getElementById("screen-idle");
const photoScreen = document.getElementById("screen-photo");
const photoHint = document.getElementById("photo-hint");
const cameraBox = document.querySelector(".camera-box");
const cam = document.getElementById("cam");
const snap = document.getElementById("snap");
const countdownEl = document.getElementById("countdown");
const qrBox = document.getElementById("qr-box");
const qrCode = document.getElementById("qr-code");
const qrUrl = document.getElementById("qr-url");

const dirScreen = document.getElementById("screen-directions");
const dirTitle = document.getElementById("dir-title");
const dirList = document.getElementById("dir-list");
const dirResult = document.getElementById("dir-result");
const dirMeta = document.getElementById("dir-meta");
const dirSteps = document.getElementById("dir-steps");
const dirHint = document.getElementById("dir-hint");
const dirPhoto = document.getElementById("dir-photo");
const dirDesc = document.getElementById("dir-desc");
const dirMap = document.getElementById("dir-map");

let state = "idle";
let busy = false;
let started = false;
let speakId = 0;
let doneResolve = null;
let dirItems = [];
let dirTries = 0;
let lastActivity = Date.now();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const speakAsync = (text) => new Promise((resolve) => {
  Speak.say(text, resolve);
  setTimeout(resolve, 8000);
});

function waitForDone(ms) {
  return new Promise((resolve) => {
    doneResolve = resolve;
    setTimeout(resolve, ms);
  });
}

function matchName(text, items) {
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const heard = t.split(/\s+/).filter(Boolean);
  for (const item of items) {
    if (t.includes(item.name.toLowerCase())) return item;
  }
  const norm = (w) => w.replace(/s$/, "");
  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const item of items) {
    const words = item.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    const score = words.filter((w) =>
      heard.some((h) => h.length >= 4 && (norm(h) === norm(w) || w.startsWith(h) || h.startsWith(w)))
    ).length;
    if (score > bestScore) { best = item; bestScore = score; tie = false; }
    else if (score === bestScore && score > 0) tie = true;
  }
  return tie ? null : best;
}

function renderTiles(items, onPick) {
  dirList.innerHTML = "";
  items.forEach((item) => {
    const b = document.createElement("button");
    b.className = "tile";
    b.textContent = item.name;
    b.addEventListener("click", () => onPick(item));
    dirList.appendChild(b);
  });
}

function showQR(url) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  qrCode.innerHTML = qr.createImgTag(10, 0);
  const img = qrCode.firstChild;
  if (img) img.style.imageRendering = "pixelated";
  qrUrl.textContent = url;
  cameraBox.hidden = true;
  qrBox.hidden = false;
}

function speakThenListen(text, after) {
  busy = true;
  const id = ++speakId;
  Voice.stop();
  Speak.say(text, () => {
    if (id !== speakId) return;
    setTimeout(() => {
      busy = false;
      if (after) after();
      Voice.start(onHeard);
    }, 700);
  });
}

function backToIdle(listen = true) {
  Speak.stop();
  doneResolve = null;
  Camera.stop(cam);
  photoScreen.hidden = true;
  dirPhoto.hidden = true;
  dirDesc.hidden = true;
  dirScreen.hidden = true;
  dirList.innerHTML = "";
  dirResult.hidden = true;
  dirItems = [];
  dirTries = 0;
  idleScreen.hidden = false;
  cameraBox.hidden = false;
  qrBox.hidden = true;
  qrCode.innerHTML = "";
  cam.hidden = false;
  snap.hidden = true;
  countdownEl.hidden = true;
  menu.hidden = true;
  hint.textContent = IDLE_HINT;
  state = "idle";
  busy = false;
  if (listen) Voice.start(onHeard);
}

async function startPhoto() {
  state = "photo";
  busy = true;
  speakId++;
  Voice.stop();
  menu.hidden = true;
  idleScreen.hidden = true;
  photoScreen.hidden = false;
  cameraBox.hidden = false;
  qrBox.hidden = true;
  cam.hidden = false;
  snap.hidden = true;
  photoHint.textContent = "Starting camera...";

  try {
    await Camera.start(cam);
  } catch (err) {
    console.log("Camera error:", err);
    photoHint.textContent = "Camera not available";
    await speakAsync("Sorry, I cannot use the camera right now.");
    await wait(1500);
    backToIdle();
    return;
  }

  photoHint.textContent = "Please stand in front of me and pose";
  await speakAsync("Please stand in front of me and pose. I will take your photo in a moment.");
  await wait(2000);
  photoHint.textContent = "Get ready!";
  await speakAsync("Get ready.");
  photoHint.textContent = "Smile!";
  await Camera.countdown(countdownEl, 3, (n) => Speak.say(String(n)));

  const blob = await Camera.capture(cam, snap);
  console.log("Photo captured, size:", blob.size);
  Camera.stop(cam);
  cam.hidden = true;
  snap.hidden = false;
  photoHint.textContent = "Uploading your photo...";

  let result;
  try {
    result = await API.uploadPhoto(blob);
    console.log("Uploaded:", result);
  } catch (err) {
    console.log("Upload error:", err);
    photoHint.textContent = "Sorry, upload failed";
    await speakAsync("Sorry, I could not upload your photo. Please try again.");
    await wait(1500);
    backToIdle();
    return;
  }

  showQR(result.url);
  photoHint.textContent = "Scan this QR code to get your photo";
  speakAsync("Scan this QR code with your phone to get your photo.");
  await waitForDone(QR_SECONDS * 1000);
  backToIdle();
}

async function startDirections() {
  state = "dir_cat";
  busy = true;
  speakId++;
  Voice.stop();
  menu.hidden = true;
  idleScreen.hidden = true;
  dirScreen.hidden = false;
  dirResult.hidden = true;
  dirList.innerHTML = "";
  dirTitle.textContent = "Pick a category";
  dirHint.textContent = "Loading...";
  dirTries = 0;

  try {
    dirItems = await API.getCategories();
  } catch (err) {
    console.log("Categories error:", err);
    dirHint.textContent = "Sorry, I cannot get the list right now";
    speakThenListen("Sorry, I cannot get the list right now. Please try again later.", () => backToIdle(false));
    return;
  }

  renderTiles(dirItems, pickCategory);
  dirHint.textContent = "Say a category, or tap one";
  speakThenListen("Which category? " + dirItems.map((c) => c.name).join(", ") + ".");
}

async function pickCategory(cat) {
  if (state !== "dir_cat") return;
  state = "dir_load";
  busy = true;
  speakId++;
  Voice.stop();
  dirTries = 0;
  dirTitle.textContent = cat.name;
  dirList.innerHTML = "";
  dirHint.textContent = "Loading places...";

  try {
    dirItems = await API.getLocations(cat.id);
  } catch (err) {
    console.log("Locations error:", err);
    dirHint.textContent = "Sorry, I cannot get the list right now";
    speakThenListen("Sorry, I cannot get the list right now. Please try again later.", () => backToIdle(false));
    return;
  }
  if (dirItems.length === 0) {
    dirHint.textContent = "No places here yet";
    speakThenListen("Sorry, there are no places here yet.", () => backToIdle(false));
    return;
  }

  state = "dir_place";
  renderTiles(dirItems, pickPlace);
  dirHint.textContent = "Say a place, or tap one";
  speakThenListen("Which place? " + dirItems.map((p) => p.name).join(", ") + ".");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function drawMap(path, startName, placeName) {
  if (!path || path.length < 2) {
    dirMap.setAttribute("hidden", "");
    return;
  }
  const k = Math.cos((path[0][0] * Math.PI) / 180);
  const pts = path.map((p) => [p[1] * k, -p[0]]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 600, H = 300, pad = 50;
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const P = pts.map((p) => [offX + (p[0] - minX) * scale, offY + (p[1] - minY) * scale]);
  const d = P.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const s = P[0];
  const e = P[P.length - 1];
  const endAbove = e[1] <= s[1];

  const lab = (p, text, above) => {
    const x = Math.min(Math.max(p[0], 80), 520);
    const y = above ? p[1] - 20 : p[1] + 36;
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
      '" fill="#e6edf7" font-size="22" text-anchor="middle" font-family="system-ui, Arial">' +
      esc(text) + "</text>";
  };

  dirMap.innerHTML =
    '<path d="' + d + '" fill="none" stroke="#5cc8ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + s[0].toFixed(1) + '" cy="' + s[1].toFixed(1) + '" r="11" fill="#4ade80"/>' +
    '<circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="13" fill="#f87171"/>' +
    lab(s, startName, !endAbove) +
    lab(e, placeName, endAbove);
  dirMap.removeAttribute("hidden");
}

async function showBuilding(loc) {
  let info = null;
  try {
    info = await API.getLocation(loc.id);
  } catch (err) {
    console.log("Location error:", err);
  }
  let src = (info && info.photo_url) ? info.photo_url : "assets/placeholder.svg";
  if (src.startsWith("/")) src = API.BASE_URL + src;
  dirPhoto.onerror = () => {
    dirPhoto.onerror = null;
    dirPhoto.src = "assets/placeholder.svg";
  };
  dirPhoto.src = src;
  dirPhoto.hidden = false;
  const desc = (info && info.description) ? info.description : "";
  dirDesc.textContent = desc;
  dirDesc.hidden = !desc;
  dirHint.textContent = "Showing you the way to " + loc.name;
  await speakAsync("Showing you the way to " + loc.name + ".");
  await wait(3000);
  dirPhoto.hidden = true;
  dirDesc.hidden = true;
}

async function pickPlace(loc) {
  if (state !== "dir_place") return;
  state = "dir_route";
  busy = true;
  speakId++;
  Voice.stop();
  dirList.innerHTML = "";
  dirTitle.textContent = loc.name;
  dirHint.textContent = "Finding the way...";
  await showBuilding(loc);
  if (state !== "dir_route") return;

  let route;
  try {
    route = await API.getDirections(loc.id);
  } catch (err) {
    console.log("Directions error:", err);
    dirHint.textContent = "Sorry, I cannot find the route right now";
    speakThenListen("Sorry, I cannot find the route right now.", () => backToIdle(false));
    return;
  }

  dirMeta.textContent = route.distance_m + " metres, about " + route.time_min + " minutes";
  drawMap(route.path, "Start", loc.name);
  dirSteps.innerHTML = "";
  route.steps.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    dirSteps.appendChild(li);
  });
  dirResult.hidden = false;
  dirHint.textContent = "Tap Home when you are done";

  const spoken = "Directions to " + loc.name + ". " +
    route.steps.map((s) => s.replace(/\.?\s*$/, ".")).join(" ");
  speakAsync(spoken);
  await waitForDone(ROUTE_SECONDS * 1000);
  backToIdle();
}

function handleListChoice(text, what, onPick) {
  dirHint.textContent = 'Heard: "' + text + '"';
  const found = matchName(text, dirItems);
  if (found) {
    onPick(found);
    return;
  }
  dirTries++;
  if (dirTries >= MAX_TRIES) {
    dirHint.textContent = "Sorry, going back";
    speakThenListen("Sorry, I could not understand. Please try again later.", () => backToIdle(false));
  } else {
    dirHint.textContent = "Say a " + what + ", or tap one";
    speakThenListen("Sorry, I did not catch that. Please say " + dirItems.map((i) => i.name).join(", ") + ".");
  }
}

function wake() {
  if (state !== "idle") return;
  state = "menu";
  menu.hidden = false;
  hint.textContent = "Say 1 for Photo, say 2 for Directions";
  speakThenListen("Hello! Say one for Photo, or two for Directions.");
}

function choose(what) {
  if (state !== "menu") return;
  if (what === "photo") startPhoto();
  else startDirections();
}

function onHeard(text) {
  if (!text) return;
  if (busy) return;
  hint.textContent = 'Heard: "' + text + '"';
  if (state === "idle") {
    if (WAKE.test(text)) wake();
  } else if (state === "menu") {
    const wantsPhoto = PHOTO.test(text);
    const wantsDirections = DIRECTIONS.test(text);
    if (wantsPhoto && wantsDirections) return;
    if (wantsPhoto) choose("photo");
    else if (wantsDirections) choose("directions");
  } else if (state === "dir_cat") {
    handleListChoice(text, "category", pickCategory);
  } else if (state === "dir_place") {
    handleListChoice(text, "place", pickPlace);
  }
}

const INACTIVE_MS = 20000;
document.addEventListener("click", () => { lastActivity = Date.now(); });
setInterval(() => {
  if (busy) { lastActivity = Date.now(); return; }
  if (!["menu", "dir_cat", "dir_place"].includes(state)) return;
  if (Date.now() - lastActivity > INACTIVE_MS) {
    console.log("Inactive, going back to idle");
    speakThenListen("Okay, I will be here if you need me.", () => backToIdle(false));
  }
}, 1000);

document.getElementById("eyes").addEventListener("click", wake);
document.getElementById("btn-photo").addEventListener("click", () => choose("photo"));
document.getElementById("btn-directions").addEventListener("click", () => choose("directions"));
document.getElementById("btn-done").addEventListener("click", () => {
  if (doneResolve) doneResolve();
});
document.getElementById("btn-dir-home").addEventListener("click", () => {
  if (doneResolve) doneResolve();
  else backToIdle();
});

document.addEventListener("click", () => {
  if (started) return;
  started = true;
  if (!busy) {
    hint.textContent = 'Listening... say "Hello Robo", or tap my eyes';
    Voice.start(onHeard);
  }
});





