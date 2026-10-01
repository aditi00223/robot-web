const API = {
  MOCK: true,
  BASE_URL: "http://localhost:4000",

  async uploadPhoto(blob) {
    if (this.MOCK) {
      await new Promise((r) => setTimeout(r, 1200));
      return { id: "demo123", url: "https://example.com/photo/demo123" };
    }
    const form = new FormData();
    form.append("photo", blob, "photo.jpg");
    const res = await fetch(this.BASE_URL + "/api/photos", {
      method: "POST",
      body: form
    });
    if (!res.ok) throw new Error("Upload failed: " + res.status);
    return await res.json();
  }
};
