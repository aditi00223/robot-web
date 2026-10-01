const Voice = {
  rec: null,
  running: false,
  start(onText) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.log("Speech recognition not supported in this browser");
      return false;
    }
    this.running = true;
    this.rec = new SR();
    this.rec.lang = "en-IN";
    this.rec.continuous = true;
    this.rec.interimResults = false;
    this.rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      if (r.isFinal) onText(r[0].transcript.trim().toLowerCase());
    };
    this.rec.onerror = (e) => {
      console.log("Voice error:", e.error);
      if (e.error === "not-allowed") this.running = false;
    };
    this.rec.onend = () => {
      if (this.running) setTimeout(() => { try { this.rec.start(); } catch (err) {} }, 300);
    };
    this.rec.start();
    return true;
  },
  stop() {
    this.running = false;
    if (this.rec) this.rec.stop();
  }
};
