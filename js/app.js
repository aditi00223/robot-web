const WAKE = /(hello|hallo|helo)\s*(robo|robot|rowbo|roboto)/;
const PHOTO = /\b(1|one|won|wan|ek|photo|photos|foto)\b/;
const DIRECTIONS = /\b(2|two|to|too|tu|do|direction|directions)\b/;
const IDLE_HINT = 'Say "Hello Robo" to wake me';

const hint = document.querySelector(".hint");
const menu = document.getElementById("menu");
let state = "idle";
let busy = false;
let started = false;
let speakId = 0;

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

function wake() {
  if (state !== "idle") return;
  state = "menu";
  menu.hidden = false;
  hint.textContent = "Say 1 for Photo, say 2 for Directions";
  speakThenListen("Hello! Say one for Photo, or two for Directions.");
}

function choose(what) {
  if (state !== "menu") return;
  state = "idle";
  menu.hidden = true;
  const photo = what === "photo";
  hint.textContent = photo ? "Photo selected" : "Directions selected";
  speakThenListen(
    photo ? "Okay, photo. This is coming soon." : "Okay, directions. This is coming soon.",
    () => { hint.textContent = IDLE_HINT; }
  );
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
