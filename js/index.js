(function () {
  window.MBG.setupCursorSparkles();

  document.querySelectorAll('a[href="#contact"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.getElementById('contact');
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      target.classList.remove('flash');
      void target.offsetWidth;
      target.classList.add('flash');
    });
  });
})();
