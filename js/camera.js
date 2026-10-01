const Camera = {
  stream: null,
  MIRROR_SAVED: false,

  async pickDeviceId() {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    console.log("Cameras found:", cams.map((c, i) => i + ": " + c.label));
    if (cams.length === 0) return null;

    const forced = new URLSearchParams(location.search).get("cam");
    if (forced !== null && cams[Number(forced)]) return cams[Number(forced)].deviceId;

    const external = cams.filter((c) => !/facing|integrated|front|back|rear/i.test(c.label));
    if (external.length > 0) return external[0].deviceId;
    return cams[cams.length - 1].deviceId;
  },

  async start(video) {
    const id = await this.pickDeviceId();
    const constraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (id) constraints.deviceId = { exact: id };
    this.stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
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
    if (this.MIRROR_SAVED) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  }
};
