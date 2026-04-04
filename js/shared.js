(function () {
  function createVideoObserver() {
    return new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      }
    }, { threshold: 0.6 });
  }

  function captionToHTML(s) {
    let html = (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return html;
  }

  function setupCursorSparkles() {
    const canHover = matchMedia('(hover:hover)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || reduced) return;

    const SHAPES = ['✧', '✦', '★', '✺'];
    let last = 0;
    const MIN_MS = 40;

    document.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - last < MIN_MS) return;
      last = now;

      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = SHAPES[Math.floor(Math.random() * SHAPES.length)];

      const rot = (Math.random() * 20 - 10).toFixed(1);
      const scale = 0.9 + Math.random() * 0.3;
      s.style.left = e.clientX + 'px';
      s.style.top = e.clientY + 'px';
      s.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`;

      document.body.appendChild(s);
      setTimeout(() => s.remove(), 750);
    }, { passive: true });
  }

  window.MBG = {
    createVideoObserver,
    captionToHTML,
    setupCursorSparkles,
  };
})();
