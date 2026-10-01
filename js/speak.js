const Speak = {
  say(text, onEnd) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1;
    u.onend = () => { if (onEnd) onEnd(); };
    u.onerror = (e) => { if (e.error !== "interrupted" && onEnd) onEnd(); };
    window.speechSynthesis.speak(u);
  },
  stop() {
    window.speechSynthesis.cancel();
  }
};
