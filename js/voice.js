const Voice = {
  rec: null,
  running: false,
  label: null,
  delay: 300,

  status(msg) {
    console.log("Voice:", msg);
    if (!this.label) {
      this.label = document.createElement("div");
      this.label.style.cssText = "position:fixed;left:8px;bottom:8px;font:14px system-ui;opacity:.7;color:#9fb4cc;z-index:99;";
      document.body.appendChild(this.label);
    }
    this.label.textContent = "mic: " + msg;
  },

  start(onText) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.status("not supported in this browser");
      return false;
    }
    this.running = true;
    this.delay = 300;
    const rec = new SR();
    this.rec = rec;
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onstart = () => this.status("listening");
    rec.onspeechstart = () => this.status("hearing speech");
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      if (r.isFinal) {
        this.delay = 300;
        this.status("heard: " + r[0].transcript.trim());
        onText(r[0].transcript.trim().toLowerCase());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "network") {
        this.delay = 2000;
        this.status("no internet for voice, retrying...");
      } else {
        this.status("error: " + e.error);
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") this.running = false;
    };
    rec.onend = () => {
      if (this.running && this.rec === rec) {
        setTimeout(() => { try { rec.start(); } catch (err) {} }, this.delay);
      }
    };
    try { rec.start(); } catch (err) { this.status("start failed: " + err.message); }
    return true;
  },

  stop() {
    this.running = false;
    if (this.rec) {
      try { this.rec.stop(); } catch (err) {}
    }
    this.status("off");
  }
};
