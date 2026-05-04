/* ─── Scroll-triggered animations ─── */
const animEls = document.querySelectorAll('.animate');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

animEls.forEach(el => {
  if (el.closest('#hero')) {
    setTimeout(() => el.classList.add('visible'), 80 + (parseInt(el.className.match(/delay-(\d)/)?.[1] || '0') * 120));
  } else {
    revealObserver.observe(el);
  }
});

/* ─── Nav: scroll shrink ─── */
const nav = document.getElementById('nav');
const onScroll = () => {
  nav?.classList.toggle('scrolled', window.scrollY > 60);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ─── Nav: active link on scroll ─── */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

if (sections.length && navLinks.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => sectionObserver.observe(s));
}

/* ─── Mobile nav toggle ─── */
const navToggle = document.querySelector('.nav-toggle');
const navLinksList = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  const open = navLinksList.classList.toggle('nav-open');
  navToggle.setAttribute('aria-expanded', open);
  document.body.style.overflow = open ? 'hidden' : '';
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinksList?.classList.remove('nav-open');
    document.body.style.overflow = '';
  });
});

/* ─── Work card: cursor intent hint ─── */
document.querySelectorAll('.work-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    card.style.transform = `translateY(-7px) perspective(600px) rotateX(${-y}deg) rotateY(${x}deg)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

/* ─── Interaction trace: doc-space trail, scroll-synced, smooth + fade ─── */
(function initInteractionTrace() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const FADE_MS = 5200;
  const MIN_DIST = 1.8;
  const CHAIKIN_ITERS = 2;
  const LINE_W = 1.55;
  const RED = 255;
  const RED_G = 26;
  const RED_B = 26;

  const canvas = document.createElement('canvas');
  canvas.id = 'interaction-trace-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '99',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let dpr = 1;
  /** @type {{ x: number, y: number, t: number }[]} */
  const points = [];
  /** @type {{ x: number, y: number, t: number }[]} */
  const clicks = [];
  let rafId = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function alphaAt(now, t) {
    return Math.max(0, 1 - (now - t) / FADE_MS);
  }

  function toScreen(px, py) {
    return {
      x: px - window.scrollX,
      y: py - window.scrollY,
    };
  }

  /** Chaikin corner cutting — smoother polyline in document space */
  function chaikinSmooth(pts, iterations) {
    if (pts.length < 3) return pts.slice();
    let out = pts.slice();
    for (let it = 0; it < iterations; it++) {
      if (out.length < 2) break;
      const next = [];
      next.push({ x: out[0].x, y: out[0].y, t: out[0].t });
      for (let i = 0; i < out.length - 1; i++) {
        const p = out[i];
        const q = out[i + 1];
        next.push({
          x: 0.75 * p.x + 0.25 * q.x,
          y: 0.75 * p.y + 0.25 * q.y,
          t: p.t,
        });
        next.push({
          x: 0.25 * p.x + 0.75 * q.x,
          y: 0.25 * p.y + 0.75 * q.y,
          t: q.t,
        });
      }
      next.push({
        x: out[out.length - 1].x,
        y: out[out.length - 1].y,
        t: out[out.length - 1].t,
      });
      out = next;
    }
    return out;
  }

  function prune(now) {
    while (points.length && alphaAt(now, points[0].t) <= 0) points.shift();
    while (clicks.length && alphaAt(now, clicks[0].t) <= 0) clicks.shift();
  }

  function drawTrail(now) {
    if (points.length < 2) return;
    const smoothed = chaikinSmooth(points, CHAIKIN_ITERS);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = LINE_W;

    for (let i = 0; i < smoothed.length - 1; i++) {
      const p0 = smoothed[i];
      const p1 = smoothed[i + 1];
      const a0 = alphaAt(now, p0.t);
      const a1 = alphaAt(now, p1.t);
      const alpha = Math.min(a0, a1) * 0.55 + Math.max(a0, a1) * 0.45;
      if (alpha <= 0.01) continue;

      const s0 = toScreen(p0.x, p0.y);
      const s1 = toScreen(p1.x, p1.y);
      if (s1.x < -80 || s1.x > window.innerWidth + 80 || s1.y < -80 || s1.y > window.innerHeight + 80) {
        if (s0.x < -80 || s0.x > window.innerWidth + 80 || s0.y < -80 || s0.y > window.innerHeight + 80) continue;
      }

      ctx.strokeStyle = `rgba(${RED},${RED_G},${RED_B},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
    }
  }

  function drawClicks(now) {
    const rays = 8;
    const r = 20;
    const c = 12;
    ctx.lineCap = 'round';
    ctx.lineWidth = LINE_W;

    for (const ck of clicks) {
      const base = alphaAt(now, ck.t);
      if (base <= 0.01) continue;
      const cx = ck.x - window.scrollX;
      const cy = ck.y - window.scrollY;

      ctx.strokeStyle = `rgba(${RED},${RED_G},${RED_B},${base})`;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - c, cy);
      ctx.lineTo(cx + c, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - c);
      ctx.lineTo(cx, cy + c);
      ctx.stroke();
    }
  }

  function render() {
    const now = performance.now();
    prune(now);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawTrail(now);
    drawClicks(now);

    const still =
      points.some(p => alphaAt(now, p.t) > 0) ||
      clicks.some(c => alphaAt(now, c.t) > 0);
    if (still) rafId = requestAnimationFrame(render);
    else rafId = 0;
  }

  function ensureLoop() {
    if (!rafId) rafId = requestAnimationFrame(render);
  }

  function addPoint(pageX, pageY) {
    const t = performance.now();
    const last = points[points.length - 1];
    if (last) {
      const dx = pageX - last.x;
      const dy = pageY - last.y;
      if (Math.hypot(dx, dy) < MIN_DIST) return;
    }
    points.push({ x: pageX, y: pageY, t });
    ensureLoop();
  }

  window.addEventListener('mousemove', e => {
    addPoint(e.pageX, e.pageY);
  }, { passive: true });

  window.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    clicks.push({ x: e.pageX, y: e.pageY, t: performance.now() });
    addPoint(e.pageX, e.pageY);
    ensureLoop();
  }, { passive: true });

  window.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    if (!touch) return;
    clicks.push({ x: touch.pageX, y: touch.pageY, t: performance.now() });
    addPoint(touch.pageX, touch.pageY);
    ensureLoop();
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    const touch = e.touches[0];
    if (!touch) return;
    addPoint(touch.pageX, touch.pageY);
  }, { passive: true });

  window.addEventListener('scroll', ensureLoop, { passive: true });
})();
