document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  function openLightbox(src, alt) {
    var overlay = document.getElementById('lightbox-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lightbox-overlay';
      overlay.className = 'lightbox-overlay';
      overlay.innerHTML = '<button class="lightbox-close" aria-label="Zatvori">&times;</button><img class="lightbox-img" alt="">';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.classList.contains('lightbox-close')) closeLightbox();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
      });
    }
    overlay.querySelector('.lightbox-img').src = src;
    overlay.querySelector('.lightbox-img').alt = alt || '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    var overlay = document.getElementById('lightbox-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }
  document.querySelectorAll('.img-placeholder img').forEach(function (img) {
    img.addEventListener('click', function () {
      openLightbox(img.src, img.alt);
    });
  });
});

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.show-more-btn').forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute('data-target'));
    if (!target) return;
    btn.addEventListener('click', function () {
      var expanded = target.classList.toggle('expanded');
      var label = expanded ? btn.getAttribute('data-less') : btn.getAttribute('data-more');
      btn.querySelector('.label').textContent = label;
      btn.classList.toggle('is-open', expanded);
    });
  });
});


document.addEventListener('DOMContentLoaded', function () {
  var reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;
  if (!('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach(function (el) { obs.observe(el); });
});

document.addEventListener('DOMContentLoaded', function () {
  var nums = document.querySelectorAll('.stat-band .stat-num');
  if (!nums.length || !('IntersectionObserver' in window)) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      obs.unobserve(el);
      var match = el.textContent.trim().match(/^(\d+)(\+?)$/);
      if (!match) return;
      var target = parseInt(match[1], 10);
      var suffix = match[2];
      var duration = 900;
      var startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        el.textContent = Math.round(progress * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.4 });
  nums.forEach(function (el) { obs.observe(el); });
});

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('.carousel-slide'));
    var dotsWrap = carousel.querySelector('.carousel-dots');
    var prevBtn = carousel.querySelector('.carousel-prev');
    var nextBtn = carousel.querySelector('.carousel-next');
    if (!track || !slides.length) return;

    var index = 0;

    slides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', String(i + 1));
      dot.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(dot);
    });
    var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll('.carousel-dot'));

    function update() {
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
    }
    function goTo(i) {
      index = (i + slides.length) % slides.length;
      update();
    }

    track.classList.add('is-animating');
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1); });

    var startX = null;
    track.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 40) { goTo(diff > 0 ? index - 1 : index + 1); }
      startX = null;
    });

    update();
  });
});
