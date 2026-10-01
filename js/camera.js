const Camera = {
  stream: null,

  async start(video) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    video.srcObject = this.stream;
    await video.play();
  },

  stop(video) {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (video) video.srcObject = null;
  },

  async countdown(el, from, onTick) {
    el.hidden = false;
    for (let n = from; n >= 1; n--) {
      el.textContent = n;
      if (onTick) onTick(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    el.hidden = true;
  },

  capture(video, canvas) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  }
};
