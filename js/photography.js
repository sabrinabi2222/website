(function () {
  const USE_LOCAL = true;

  function safeKey(u) {
    if (!u || !u.includes('/upload/')) return '';
    let tail = u.split('/upload/')[1].split('?')[0];
    tail = tail.replace(/\.[^.]+$/, '');
    return tail.replace(/[\/\\]/g, '-');
  }

  function localPaths(u, type) {
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

  function cdnImage(u, kind) {
    return u.includes('/image/upload/')
      ? u.replace('/image/upload/', '/image/upload/f_auto,q_auto,' + (kind === 'large' ? 'w_1600' : 'w_900') + '/')
      : u;
  }

  function cdnVideo(u, kind) {
    if (!u.includes('/video/upload/')) return u;
    const tx = kind === 'large'
      ? 'e_volume:mute,c_limit,w_1280,fps_30,br_2m,q_auto:good,vc_h264,f_mp4'
      : 'e_volume:mute,c_limit,w_720,fps_30,br_1m,q_auto:good,vc_h264,f_mp4';
    return u.replace('/video/upload/', '/video/upload/' + tx + '/');
  }

  function cdnPoster(u) {
    if (!u.includes('/video/upload/')) return '';
    const [left, right] = u.split('/video/upload/');
    const base = right.split('?')[0].replace(/\.[^.]+$/, '');
    return `${left}/video/upload/so_1,c_limit,w_720,f_jpg,q_auto/${base}.jpg`;
  }

  function imgGridSrc(u) { return USE_LOCAL ? localPaths(u, 'image').grid : cdnImage(u, 'grid'); }
  function imgLargeSrc(u) { return USE_LOCAL ? localPaths(u, 'image').large : cdnImage(u, 'large'); }
  function vidGridSrc(u) { return USE_LOCAL ? localPaths(u, 'video').grid : cdnVideo(u, 'grid'); }
  function vidLargeSrc(u) { return USE_LOCAL ? localPaths(u, 'video').large : cdnVideo(u, 'large'); }
  function vidPoster(u) { return USE_LOCAL ? localPaths(u, 'video').poster : cdnPoster(u); }

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

          v.onerror = () => {
            if (USE_LOCAL) {
              v.src = cdnVideo(item.url, 'grid');
              v.dataset.large = cdnVideo(item.url, 'large');
              v.poster = cdnPoster(item.url);
            }
          };

          v.addEventListener('loadedmetadata', () => {
            if (v.videoWidth > v.videoHeight) card.classList.add('landscape');
          });

          card.appendChild(v);
          videoObserver.observe(v);
        } else {
          const img = document.createElement('img');
          img.loading = 'lazy';
          img.src = imgGridSrc(item.url);
          img.alt = projectKey;
          img.dataset.large = imgLargeSrc(item.url);

          img.onerror = () => {
            if (USE_LOCAL) {
              img.src = cdnImage(item.url, 'grid');
              img.dataset.large = cdnImage(item.url, 'large');
            }
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
