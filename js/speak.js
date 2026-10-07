const Speak = {
  n: 0,
  caption(text) {
    const el = document.getElementById("caption");
    if (!el) return;
    if (/^\d+$/.test(text) || text.length > 70) text = "";
    el.textContent = text;
    el.hidden = !text;
  },
  say(text, onEnd) {
    window.speechSynthesis.cancel();
    const id = ++Speak.n;
    Speak.caption(text);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1;
    u.onend = () => { if (id === Speak.n) Speak.caption(""); if (onEnd) onEnd(); };
    u.onerror = (e) => { if (id === Speak.n) Speak.caption(""); if (e.error !== "interrupted" && onEnd) onEnd(); };
    window.speechSynthesis.speak(u);
  },
  stop() {
    Speak.n++;
    Speak.caption("");
    window.speechSynthesis.cancel();
  }
};


