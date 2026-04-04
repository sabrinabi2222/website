(function () {
  const videoObserver = window.MBG.createVideoObserver();

  async function render() {
    const res = await fetch('sewing.json', { cache: 'no-store' });
    const data = await res.json();

    const projectsData = data.projects || {};
    const order = data.order || Object.keys(projectsData).sort((a, b) => a.localeCompare(b));
    const container = document.getElementById('projects');
    container.innerHTML = '';

    for (const projectKey of order) {
      const meta = projectsData[projectKey] || {};
      const items = meta.items || [];
      const caption = meta.caption || '';

      const section = document.createElement('section');
      section.className = 'project';

      const wrap = document.createElement('div');
      wrap.className = 'project-wrap';

      const aside = document.createElement('aside');
      aside.className = 'project-aside caption-only';
      const p = document.createElement('p');
      p.className = 'project-caption';
      const captionText = caption || projectKey.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      p.innerHTML = window.MBG.captionToHTML(captionText);
      aside.appendChild(p);

      const grid = document.createElement('div');
      grid.className = 'gallery gallery--retro';

      for (const item of items) {
        const card = document.createElement('figure');
        card.className = 'card retro-card';

        if (item.type === 'video') {
          const v = document.createElement('video');
          v.className = 'hover-video';
          v.muted = true;
          v.playsInline = true;
          v.loop = true;
          v.preload = 'metadata';
          v.controls = false;
          v.src = item.url;

          v.addEventListener('loadedmetadata', () => {
            if (v.videoWidth && v.videoHeight) {
              v.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
            }
          });

          card.appendChild(v);
          videoObserver.observe(v);
        } else {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.src = item.url;
          img.alt = projectKey;
          card.appendChild(img);
        }

        grid.appendChild(card);
      }

      wrap.appendChild(aside);
      wrap.appendChild(grid);
      section.appendChild(wrap);
      container.appendChild(section);
    }
  }

  window.MBG.setupCursorSparkles();
  render();
})();
