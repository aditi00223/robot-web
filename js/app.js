const WAKE = /(hello|hallo|helo)\s*(robo|robot|rowbo|roboto)/;
const PHOTO = /\b(1|one|won|wan|ek|photo|photos|foto)\b/;
const DIRECTIONS = /\b(2|two|to|too|tu|do|direction|directions)\b/;
const IDLE_HINT = 'Say "Hello Robo" to wake me';

const hint = document.querySelector(".hint");
const menu = document.getElementById("menu");
const idleScreen = document.getElementById("screen-idle");
const photoScreen = document.getElementById("screen-photo");
const photoHint = document.getElementById("photo-hint");
const cam = document.getElementById("cam");
const snap = document.getElementById("snap");
const countdownEl = document.getElementById("countdown");

let state = "idle";
let busy = false;
let started = false;
let speakId = 0;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const speakAsync = (text) => new Promise((resolve) => {
  Speak.say(text, resolve);
  setTimeout(resolve, 8000);
});

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

function backToIdle() {
  Camera.stop(cam);
  photoScreen.hidden = true;
  idleScreen.hidden = false;
  cam.hidden = false;
  snap.hidden = true;
  countdownEl.hidden = true;
  menu.hidden = true;
  hint.textContent = IDLE_HINT;
  state = "idle";
  busy = false;
  Voice.start(onHeard);
}

async function startPhoto() {
  state = "photo";
  busy = true;
  speakId++;
  Voice.stop();
  menu.hidden = true;
  idleScreen.hidden = true;
  photoScreen.hidden = false;
  cam.hidden = false;
  snap.hidden = true;
  photoHint.textContent = "Please look at the camera";

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

  photoHint.textContent = "Please stand in front of me and pose"; await speakAsync("Please stand in front of me and pose. I will take your photo in a moment."); await wait(2000); photoHint.textContent = "Get ready!"; await speakAsync("Get ready.");
  photoHint.textContent = "Smile!"; await Camera.countdown(countdownEl, 3, (n) => Speak.say(String(n)));

  const blob = await Camera.capture(cam, snap);
  console.log("Photo captured, size:", blob.size);
  cam.hidden = true;
  snap.hidden = false;
  photoHint.textContent = "Nice photo!";
  await speakAsync("Photo taken.");
  await wait(3000);
  backToIdle();
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
  if (what === "photo") {
    startPhoto();
    return;
  }
  state = "idle";
  menu.hidden = true;
  hint.textContent = "Directions selected";
  speakThenListen("Okay, directions. This is coming soon.", () => {
    hint.textContent = IDLE_HINT;
  });
}

function onHeard(text) {
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
  }
}

document.getElementById("eyes").addEventListener("click", wake);
document.getElementById("btn-photo").addEventListener("click", () => choose("photo"));
document.getElementById("btn-directions").addEventListener("click", () => choose("directions"));

document.addEventListener("click", () => {
  if (started) return;
  started = true;
  if (!busy) {
    hint.textContent = 'Listening... say "Hello Robo", or tap my eyes';
    Voice.start(onHeard);
  }
});

