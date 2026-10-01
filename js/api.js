const API = {
  MOCK: true,
  BASE_URL: "http://localhost:4000",
  START: "main_gate",

  _cats: [
    { id: 1, name: "Academic Blocks" },
    { id: 2, name: "Hostels" },
    { id: 3, name: "Food" }
  ],

  _locs: [
    { id: 10, name: "CSE Block", category_id: 1, description: "Computer Science labs and classrooms. 4 floors.", photo_url: null,
      steps: ["Go straight for 100 metres", "Turn left at the library", "CSE Block is on your right"], distance_m: 350, time_min: 5 },
    { id: 11, name: "Admin Block", category_id: 1, description: "Administration offices.", photo_url: null,
      steps: ["Go straight for 50 metres", "Admin Block is on your left"], distance_m: 120, time_min: 2 },
    { id: 20, name: "Boys Hostel 1", category_id: 2, description: "Boys hostel with mess and common room.", photo_url: null,
      steps: ["Go straight for 200 metres", "Turn right at the playground", "Boys Hostel 1 is ahead"], distance_m: 500, time_min: 7 },
    { id: 21, name: "Girls Hostel", category_id: 2, description: "Girls hostel.", photo_url: null,
      steps: ["Turn left from the gate", "Walk 150 metres", "Girls Hostel is on your right"], distance_m: 260, time_min: 4 },
    { id: 30, name: "Canteen", category_id: 3, description: "Main canteen.", photo_url: null,
      steps: ["Go straight for 80 metres", "Turn right", "Canteen is ahead"], distance_m: 180, time_min: 3 },
    { id: 31, name: "Juice Corner", category_id: 3, description: "Juice and snacks.", photo_url: null,
      steps: ["Go straight for 60 metres", "Juice Corner is on your left"], distance_m: 90, time_min: 2 }
  ],

  async _get(path) {
    const res = await fetch(this.BASE_URL + path);
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return await res.json();
  },

  async getCategories() {
    if (this.MOCK) return this._cats.map((c) => ({ id: c.id, name: c.name }));
    return await this._get("/api/categories");
  },

  async getLocations(categoryId) {
    if (this.MOCK) {
      return this._locs
        .filter((l) => l.category_id === categoryId)
        .map((l) => ({ id: l.id, name: l.name, category_id: l.category_id, thumb_url: l.photo_url }));
    }
    return await this._get("/api/locations?category_id=" + categoryId);
  },

  async getLocation(id) {
    if (this.MOCK) {
      const l = this._locs.find((x) => x.id === id);
      return { id: l.id, name: l.name, description: l.description, photo_url: l.photo_url, photos: [] };
    }
    return await this._get("/api/locations/" + id);
  },

  async getDirections(locationId) {
    if (this.MOCK) {
      const l = this._locs.find((x) => x.id === locationId);
      return { to: l.name, distance_m: l.distance_m, time_min: l.time_min, steps: l.steps, path: [] };
    }
    return await this._get("/api/directions?from=" + this.START + "&to=" + locationId);
  },

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
