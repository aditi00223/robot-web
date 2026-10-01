const Speak = {
  say(text) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  },
  stop() {
    window.speechSynthesis.cancel();
  }
};
