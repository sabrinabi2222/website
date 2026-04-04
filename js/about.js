(function () {
  function clampCropY(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 35;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  function resolveCropY(photo) {
    if (photo && photo.crop_y !== undefined && photo.crop_y !== null && String(photo.crop_y).trim() !== "") {
      return clampCropY(photo.crop_y);
    }
    if (photo && photo.cropY !== undefined && photo.cropY !== null && String(photo.cropY).trim() !== "") {
      return clampCropY(photo.cropY);
    }
    const focus = String((photo && photo.focus) || "").toLowerCase();
    if (focus === "bottom") return 75;
    if (focus === "center" || focus === "middle") return 50;
    return 35;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function loadAbout() {
    const linesEl = document.getElementById("aboutLines");

    try {
      const res = await fetch("about.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("Could not load about.json");
      const data = await res.json();

      linesEl.innerHTML = "";

      (data.sections || []).forEach((section, index) => {
        const isIntro = index === 0;
        const story = document.createElement("article");
        story.className = "story-line";
        if (isIntro) story.classList.add("story-line-intro");

        const p = document.createElement("p");
        p.innerHTML = escapeHtml(section.text || "");
        story.appendChild(p);

        const photos = document.createElement("div");
        photos.className = "photo-line";
        if (isIntro) photos.classList.add("photo-line-intro");
        for (const photo of section.photos || []) {
          const fig = document.createElement("figure");
          fig.className = "about-photo-card";
          if (isIntro) fig.classList.add("about-photo-card-intro");

          const media = document.createElement("div");
          media.className = "about-photo-media";
          media.role = "img";
          media.setAttribute("aria-label", photo.alt || photo.caption || "About photo");
          media.style.backgroundImage = `url("${photo.src || ""}")`;
          media.style.backgroundPosition = `50% ${resolveCropY(photo)}%`;

          fig.appendChild(media);
          photos.appendChild(fig);
        }

        if (isIntro) {
          const intro = document.createElement("section");
          intro.className = "about-intro";
          intro.appendChild(photos);
          intro.appendChild(story);
          linesEl.appendChild(intro);
        } else {
          linesEl.appendChild(story);
          linesEl.appendChild(photos);
        }
      });

    } catch (err) {
      linesEl.innerHTML = '<article class="story-line"><p>Could not load About content yet.</p></article>';
      console.error(err);
    }
  }

  void loadAbout();
})();
