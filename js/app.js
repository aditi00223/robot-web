const WAKE = /(hello|hallo|helo)\s*(robo|robot|rowbo|roboto)/;
const hint = document.querySelector(".hint");

function onHeard(text) {
  hint.textContent = 'Heard: "' + text + '"';
  if (WAKE.test(text)) {
    hint.textContent = "Hello! Say 1 for Photo, say 2 for Directions";
    Speak.say("Hello! Say one for Photo, or two for Directions.");
  }
}

document.addEventListener("click", () => {
  hint.textContent = 'Listening... say "Hello Robo"';
  Voice.start(onHeard);
}, { once: true });
