(function () {
  function safeKey(u) {
    if (!u || !u.includes('/upload/')) return '';
    let tail = u.split('/upload/')[1].split('?')[0];
    tail = tail.replace(/\.[^.]+$/, '');
    return tail.replace(/[\/\\]/g, '-');
  }

  function localPathsFromUpload(u, type) {
    const k = safeKey(u);
    if (!k) return {};
    if (type === 'image') {
      return {
        grid: `media/photos/grid/${k}.jpg`,
        large: `media/photos/large/${k}.jpg`,
      };
    }
    if (type === 'video') {
      return {
        grid: `media/videos/grid/${k}.mp4`,
        large: `media/videos/large/${k}.mp4`,
        poster: `media/videos/posters/${k}.jpg`,
      };
    }
    return {};
  }

  function isRemote(u) {
    return typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'));
  }

  function imgGridSrc(u) {
    if (!u) return '';
    if (isRemote(u)) return localPathsFromUpload(u, 'image').grid;
    return u;
  }

  function imgLargeSrc(u) {
    if (!u) return '';
    if (isRemote(u)) return localPathsFromUpload(u, 'image').large;
    if (u.startsWith('media/photos/grid/')) {
      return u.replace('media/photos/grid/', 'media/photos/large/');
    }
    return u;
  }

  function vidGridSrc(u) {
    if (!u) return '';
    if (isRemote(u)) return localPathsFromUpload(u, 'video').grid;
    return u;
  }

  function vidLargeSrc(u) {
    if (!u) return '';
    if (isRemote(u)) return localPathsFromUpload(u, 'video').large;
    return u;
  }

  function vidPoster(u) {
    if (!u) return '';
    if (isRemote(u)) return localPathsFromUpload(u, 'video').poster;
    if (u.startsWith('media/videos/grid/')) {
      const name = u.split('/').pop().replace(/\.[^.]+$/, '');
      return `media/videos/posters/${name}.jpg`;
    }
    return '';
  }

  const videoObserver = window.MBG.createVideoObserver();

  async function render() {
    const res = await fetch('photography.json', { cache: 'no-store' });
    const data = await res.json();

    const projectsData = data.projects || {};
    const order = data.order || Object.keys(projectsData);

    const container = document.getElementById('projects');
    container.innerHTML = '';

    for (const projectKey of order) {
      const meta = projectsData[projectKey] || {};
      const items = meta.items || [];
      const title = meta.title || projectKey;
      const caption = meta.caption || '';

      const section = document.createElement('section');
      section.className = 'project';

      const header = document.createElement('header');
      header.className = 'project-header';

      const h2 = document.createElement('h2');
      h2.textContent = title;
      header.appendChild(h2);

      if (caption) {
        const p = document.createElement('p');
        p.className = 'project-caption';
        p.textContent = caption;
        header.appendChild(p);
      }
      section.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'gallery gallery--photography';

      for (const item of items) {
        const card = document.createElement('figure');
        card.className = 'card';
        card.setAttribute('data-label', title);

        if (item.type === 'video') {
          const v = document.createElement('video');
          v.className = 'hover-video';
          v.muted = true;
          v.playsInline = true;
          v.loop = true;
          v.preload = 'metadata';
          v.controls = false;

          v.poster = vidPoster(item.url);
          v.src = vidGridSrc(item.url);
          v.dataset.large = vidLargeSrc(item.url);

          v.addEventListener('loadedmetadata', () => {
            if (v.videoWidth > v.videoHeight) card.classList.add('landscape');
          });

          card.appendChild(v);
          videoObserver.observe(v);
        } else {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.src = imgLargeSrc(item.url);
          img.alt = projectKey;
          img.dataset.large = imgLargeSrc(item.url);

          img.onerror = () => {
            const grid = imgGridSrc(item.url);
            img.src = grid;
            img.dataset.large = grid;
          };

          img.onload = () => {
            if (img.naturalWidth > img.naturalHeight) card.classList.add('landscape');
          };

          card.appendChild(img);
        }

        grid.appendChild(card);
      }

      section.appendChild(grid);
      container.appendChild(section);
    }
  }

  const lb = document.getElementById('lightbox');
  const lbBody = lb.querySelector('.lightbox-body');
  const lbClose = lb.querySelector('.lightbox-close');

  function openLightboxFrom(el) {
    lbBody.innerHTML = '';
    document.querySelectorAll('.gallery video').forEach((v) => v.pause());

    if (el.tagName === 'IMG') {
      const big = new Image();
      big.className = 'lightbox-media';
      big.alt = el.alt || '';
      big.src = el.dataset.large || el.src;
      lbBody.appendChild(big);
    } else if (el.tagName === 'VIDEO') {
      const v = document.createElement('video');
      v.className = 'lightbox-media';
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.muted = false;
      v.loop = false;
      v.preload = 'metadata';
      v.src = el.dataset.large || el.currentSrc || el.src;
      lbBody.appendChild(v);
    }

    lb.hidden = false;
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    lbClose.focus();
  }

  function closeLightbox() {
    const v = lbBody.querySelector('video');
    if (v) {
      try {
        v.pause();
      } catch {
        // ignore
      }
    }
    lbBody.innerHTML = '';
    lb.hidden = true;
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
  }

  document.addEventListener('click', (e) => {
    const media = e.target.closest('.gallery img, .gallery video');
    if (media) {
      e.preventDefault();
      openLightboxFrom(media);
    }
  });

  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', (e) => {
    if (e.target.classList.contains('lightbox-backdrop')) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!lb.hidden && (e.key === 'Escape' || e.key === 'Esc')) closeLightbox();
  });

  render();
})();
