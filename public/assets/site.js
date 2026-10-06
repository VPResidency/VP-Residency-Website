/* VP Residency — public site behaviour. No dependencies. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var cfg = {};
  try { cfg = JSON.parse(($('#site-config') || {}).textContent || '{}'); } catch (e) {}
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ---------------------------------------------------------------- intro */
  function endIntro() {
    var intro = $('[data-intro]');
    if (!intro || !root.classList.contains('show-intro')) return;
    intro.classList.add('is-done');
    try { sessionStorage.setItem('vp_intro', '1'); } catch (e) {}
    setTimeout(function () { root.classList.remove('show-intro'); }, 900);
  }
  if (root.classList.contains('show-intro')) {
    window.addEventListener('load', function () { setTimeout(endIntro, 650); });
    setTimeout(endIntro, 2600);
  }

  /* ---------------------------------------------------------------- header */
  var lastScrolled = null;
  function onScroll() {
    var scrolled = window.scrollY > 24;
    if (scrolled !== lastScrolled) {
      root.classList.toggle('is-scrolled', scrolled);
      lastScrolled = scrolled;
    }
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = $('[data-nav-toggle]');
  function setNav(open) {
    root.classList.toggle('nav-open', open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setNav(!root.classList.contains('nav-open')); });
    $$('#main-nav a').forEach(function (a) { a.addEventListener('click', function () { setNav(false); }); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
    doc.addEventListener('click', function (e) {
      if (root.classList.contains('nav-open') && !e.target.closest('#main-nav') && !e.target.closest('[data-nav-toggle]')) setNav(false);
    });
  }

  var ann = $('[data-announcement]');
  if (ann) {
    var annKey = 'vp_ann_' + (ann.textContent || '').trim().length + '_' + (ann.textContent || '').trim().slice(0, 24);
    if (store.get('vp_ann') === annKey) ann.classList.add('is-hidden');
    var close = $('[data-dismiss-announcement]', ann);
    if (close) close.addEventListener('click', function () { ann.classList.add('is-hidden'); store.set('vp_ann', annKey); });
  }

  /* ---------------------------------------------------------------- hero slideshow */
  var hero = $('[data-hero]');
  if (hero) {
    var slides = $$('.hero-slide', hero);
    var dots = $$('.hero-dots span', hero);
    var video = $('[data-hero-video]', hero);
    if (video) {
      if (window.innerWidth < 768 || reduced) { video.pause(); video.remove(); }
      else slides.forEach(function (s) { s.style.display = 'none'; });
    }
    if (slides.length > 1 && !(video && video.isConnected) && !reduced) {
      var idx = 0;
      var show = function (n) {
        slides[idx].classList.remove('is-active');
        if (dots[idx]) dots[idx].classList.remove('is-active');
        idx = (n + slides.length) % slides.length;
        var next = slides[idx];
        if (next.loading === 'lazy') next.loading = 'eager';
        next.classList.add('is-active');
        if (dots[idx]) dots[idx].classList.add('is-active');
      };
      setInterval(function () { if (!doc.hidden) show(idx + 1); }, 6000);
    }
  }

  /* ---------------------------------------------------------------- dates & booking */
  function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(s) {
    if (!s) return '';
    var d = new Date(s + 'T00:00:00');
    return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear();
  }
  function inr(n) {
    var s = String(Math.round(n));
    if (s.length <= 3) return s;
    return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
  }
  function nights(a, b) { if (!a || !b) return 0; var n = Math.round((new Date(b) - new Date(a)) / 86400000); return n > 0 ? n : 0; }
  function waUrl(number, text) {
    var d = String(number || '').replace(/\D/g, '');
    if (d.length === 10) d = '91' + d;
    return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  function fill(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined && vars[k] !== '' ? vars[k] : '—'; }); }

  $$('form').forEach(function (form) {
    var cin = $('[data-checkin]', form);
    var cout = $('[data-checkout]', form);
    if (!cin || !cout) return;
    var today = iso(new Date());
    if (!cin.min) cin.min = today;
    function sync() {
      if (cin.value) {
        cout.min = addDays(cin.value, 1);
        if (!cout.value || cout.value <= cin.value) cout.value = addDays(cin.value, 1);
      }
      form.dispatchEvent(new Event('datechange'));
    }
    cin.addEventListener('change', sync);
    cout.addEventListener('change', function () { form.dispatchEvent(new Event('datechange')); });
  });

  var booking = $('[data-booking]');
  if (booking) {
    var link = $('[data-wa-link]');
    var total = $('[data-total]');
    var update = function () {
      var ci = booking.checkin.value, co = booking.checkout.value, g = booking.guests.value;
      var n = nights(ci, co);
      var price = Number(booking.dataset.price) || 0;
      if (total) {
        total.hidden = !n;
        if (n) total.innerHTML = '';
        if (n) {
          total.append(n + (n === 1 ? ' night' : ' nights') + ' × ' + booking.dataset.currency + inr(price) + ' = ');
          var b = doc.createElement('strong'); b.textContent = booking.dataset.currency + inr(n * price); total.append(b);
        }
      }
      if (link) link.href = waUrl(booking.dataset.wa, fill(booking.dataset.waTemplate || '', { room: booking.dataset.room, checkin: fmt(ci), checkout: fmt(co), guests: g, nights: n || '' }));
      if (history.replaceState && (ci || co)) {
        var u = new URL(location.href);
        if (ci) u.searchParams.set('checkin', ci);
        if (co) u.searchParams.set('checkout', co);
        u.searchParams.set('guests', g);
        history.replaceState(null, '', u);
      }
    };
    booking.addEventListener('datechange', update);
    booking.addEventListener('change', update);
    booking.addEventListener('submit', function (e) { e.preventDefault(); update(); });
  }

  $$('[data-enquiry]').forEach(function (form) {
    var ft = $('[data-ft]', form);
    if (ft) ft.value = String(Date.now());
    var btn = $('[data-wa-send]', form);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var f = form.elements;
      var text = fill(form.dataset.waTemplate || '', {
        room: f.room.value || 'a room', checkin: fmt(f.checkin.value), checkout: fmt(f.checkout.value), guests: f.guests.value, nights: nights(f.checkin.value, f.checkout.value) || '',
      });
      if (f.name.value) text += '\nName: ' + f.name.value;
      if (f.message.value) text += '\n' + f.message.value;
      window.open(waUrl(form.dataset.wa, text), '_blank', 'noopener');
    });
  });

  /* ---------------------------------------------------------------- lightbox */
  var lb = $('[data-lightbox]');
  if (lb) {
    var lbImg = $('[data-lb-img]', lb), lbCap = $('[data-lb-cap]', lb), lbCount = $('[data-lb-count]', lb);
    var group = [], pos = 0, lastFocus = null;
    var render = function () {
      var a = group[pos];
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.dataset.caption || '';
      lbCap.textContent = a.dataset.caption || '';
      lbCount.textContent = group.length > 1 ? (pos + 1) + ' / ' + group.length : '';
    };
    var open = function (a) {
      var scope = a.closest('[data-gallery]') || doc;
      group = $$('[data-lightbox-item]', scope).filter(function (x) { return !x.classList.contains('is-hidden'); });
      pos = Math.max(0, group.indexOf(a));
      lastFocus = doc.activeElement;
      render();
      lb.hidden = false;
      doc.body.style.overflow = 'hidden';
      $('[data-lb-close]', lb).focus();
    };
    var closeLb = function () { lb.hidden = true; doc.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
    var step = function (d) { if (group.length) { pos = (pos + d + group.length) % group.length; render(); } };
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('[data-lightbox-item]');
      if (a) { e.preventDefault(); open(a); }
    });
    $('[data-lb-close]', lb).addEventListener('click', closeLb);
    $('[data-lb-prev]', lb).addEventListener('click', function () { step(-1); });
    $('[data-lb-next]', lb).addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    doc.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    var tx = null;
    lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      tx = null;
    });
  }

  var filter = $('[data-gallery-filter]');
  if (filter) {
    filter.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]');
      if (!b) return;
      $$('[data-filter]', filter).forEach(function (x) { x.classList.toggle('is-active', x === b); });
      var cat = b.dataset.filter;
      $$('.masonry-item').forEach(function (it) { it.classList.toggle('is-hidden', !!cat && it.dataset.category !== cat); });
    });
  }

  /* ---------------------------------------------------------------- copy */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var done = function () { var t = b.getAttribute('aria-label'); b.setAttribute('aria-label', 'Copied!'); b.classList.add('is-copied'); setTimeout(function () { b.setAttribute('aria-label', t); b.classList.remove('is-copied'); }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(done, function () {});
  });

  /* ---------------------------------------------------------------- reveal, counters, parallax */
  if ('IntersectionObserver' in window && root.dataset.anim === 'on' && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
  }

  if ('IntersectionObserver' in window && !reduced) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        var el = en.target, target = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, t0 = null;
        if (isNaN(target)) return;
        var tick = function (t) {
          if (!t0) t0 = t;
          var p = Math.min(1, (t - t0) / 1400), eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * eased).toFixed(dec);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { co.observe(el); });
  }

  var px = cfg.parallax && !reduced ? $$('[data-parallax]') : [];
  if (px.length) {
    var ticking = false;
    var runParallax = function () {
      var vh = window.innerHeight;
      px.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var f = parseFloat(el.dataset.parallax) || 0.1;
        var off = (r.top + r.height / 2 - vh / 2) * -f;
        el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(runParallax); } }, { passive: true });
    runParallax();
  }

  /* ---------------------------------------------------------------- cookie consent */
  var CONSENT = 'vp_consent';
  function readConsent() {
    var m = doc.cookie.match(/(?:^|; )vp_consent=a([01])m([01])/);
    return m ? { analytics: m[1] === '1', media: m[2] === '1' } : null;
  }
  function writeConsent(c) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    doc.cookie = CONSENT + '=a' + (c.analytics ? 1 : 0) + 'm' + (c.media ? 1 : 0) + '; Max-Age=' + 180 * 86400 + '; Path=/; SameSite=Lax' + secure;
  }
  var gaLoaded = false;
  function loadAnalytics() {
    if (gaLoaded || !cfg.ga4) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', cfg.ga4, { anonymize_ip: true });
    var s = doc.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4);
    doc.head.appendChild(s);
  }
  function loadEmbeds() {
    $$('[data-consent-embed]').forEach(function (box) {
      if (box.dataset.loaded) return;
      box.dataset.loaded = '1';
      var f = doc.createElement('iframe');
      f.src = box.dataset.src;
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.title = 'Map';
      f.setAttribute('allowfullscreen', '');
      box.appendChild(f);
    });
  }
  function apply(c) {
    if (c.analytics) loadAnalytics();
    if (c.media) loadEmbeds();
  }
  var banner = $('[data-cookie-banner]');
  var consent = readConsent();
  if (!cfg.consent) {
    apply({ analytics: !cfg.preview, media: true });
  } else if (consent) {
    apply(consent);
  } else if (banner) {
    setTimeout(function () { banner.hidden = false; }, root.classList.contains('show-intro') ? 2400 : 900);
  }
  if (banner) {
    var prefs = $('[data-cookie-prefs]', banner);
    var save = $('[data-cookie-save]', banner);
    var choose = function (c) { writeConsent(c); apply(c); banner.hidden = true; };
    $('[data-cookie-accept]', banner).addEventListener('click', function () { choose({ analytics: true, media: true }); });
    $('[data-cookie-reject]', banner).addEventListener('click', function () { choose({ analytics: false, media: false }); });
    var showPrefs = function () {
      var c = readConsent() || { analytics: false, media: false };
      $('[data-consent="analytics"]', banner).checked = c.analytics;
      $('[data-consent="media"]', banner).checked = c.media;
      prefs.hidden = false;
      save.hidden = false;
      $('[data-cookie-customize]', banner).hidden = true;
    };
    $('[data-cookie-customize]', banner).addEventListener('click', showPrefs);
    save.addEventListener('click', function () {
      choose({ analytics: $('[data-consent="analytics"]', banner).checked, media: $('[data-consent="media"]', banner).checked });
    });
    $$('[data-cookie-settings]').forEach(function (b) {
      b.addEventListener('click', function () { banner.hidden = false; showPrefs(); });
    });
  }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-load-embed]');
    if (!b) return;
    var c = readConsent() || { analytics: false, media: false };
    c.media = true;
    if (cfg.consent) writeConsent(c);
    loadEmbeds();
  });

  /* ---------------------------------------------------------------- festival popup */
  var fest = cfg.festival;
  var popup = $('[data-festive-popup]');
  if (fest && popup && fest.popup) {
    var key = 'vp_fp_' + fest.id + '_' + new Date().getFullYear();
    if (!store.get(key) || /[?&]festival=/.test(location.search)) {
      setTimeout(function () {
        popup.hidden = false;
        var btn = $('[data-fp-close]', popup);
        if (btn) btn.focus();
      }, root.classList.contains('show-intro') ? 2800 : 1600);
    }
    var closeFp = function () { popup.hidden = true; store.set(key, '1'); };
    $$('[data-fp-close]', popup).forEach(function (b) { b.addEventListener('click', closeFp); });
    popup.addEventListener('click', function (e) { if (e.target === popup) closeFp(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !popup.hidden) closeFp(); });
    $$('a', popup).forEach(function (a) { a.addEventListener('click', function () { store.set(key, '1'); }); });
  }

  /* ---------------------------------------------------------------- festival animation */
  var canvas = $('[data-festive-canvas]');
  if (fest && canvas && fest.animation && fest.animation !== 'none' && !reduced) startFestive(canvas, fest);

  function startFestive(cv, f) {
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);
    var dens = [0, 22, 40, 70][Math.max(1, Math.min(3, f.density || 2))] * (W < 700 ? 0.55 : 1);
    var R = function (a, b) { return a + Math.random() * (b - a); };
    var pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
    var type = f.animation;
    var parts = [];
    var palettes = {
      petals: ['#F59E0B', '#FBBF24', '#EA580C', '#DC2626', '#F97316'],
      confetti: ['#CBA945', '#E11D48', '#2563EB', '#16A34A', '#F59E0B', '#9333EA'],
      tricolor: ['#FF9933', '#FFFFFF', '#138808'],
      hearts: ['#E91E63', '#F06292', '#D32F2F', '#FF8A80'],
    };
    function spawn(initial) {
      var p = { x: R(0, W), y: initial ? R(-H, H) : R(-80, -10), r: R(0, Math.PI * 2), vr: R(-0.03, 0.03), t: R(0, 1000) };
      switch (type) {
        case 'petals': p.s = R(6, 12); p.vy = R(0.6, 1.5); p.vx = R(-0.4, 0.4); p.c = pick(palettes.petals); break;
        case 'confetti':
        case 'tricolor': p.s = R(5, 9); p.vy = R(1.2, 2.6); p.vx = R(-0.8, 0.8); p.c = pick(palettes[type]); p.vr = R(-0.12, 0.12); break;
        case 'snow': p.s = R(1.5, 4.2); p.vy = R(0.4, 1.3); p.vx = R(-0.3, 0.3); break;
        case 'sparkles': p.x = R(0, W); p.y = R(0, H); p.s = R(3, 8); p.life = R(60, 160); p.age = initial ? R(0, p.life) : 0; p.vy = R(-0.4, -0.1); break;
        case 'diyas': p.y = initial ? R(0, H) : H + R(10, 60); p.s = R(5, 14); p.vy = R(-1.1, -0.4); p.vx = R(-0.2, 0.2); break;
        case 'lanterns': p.y = initial ? R(H * 0.2, H) : H + R(20, 80); p.s = R(12, 24); p.vy = R(-0.7, -0.3); p.vx = R(-0.15, 0.15); break;
        case 'hearts': p.y = initial ? R(0, H) : H + R(10, 60); p.s = R(8, 18); p.vy = R(-1.2, -0.5); p.vx = R(-0.3, 0.3); p.c = pick(palettes.hearts); break;
      }
      return p;
    }
    var rockets = [], sparks = [], nextRocket = 0;
    if (type !== 'fireworks') for (var i = 0; i < dens; i++) parts.push(spawn(true));

    function heart(x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.25);
      ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x, y + s * 0.75, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.25);
      ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.3);
      ctx.fill();
    }
    function star(x, y, s, a) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
      ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s);
      ctx.fill();
    }
    function glow(x, y, r, inner, outer) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, inner); g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    function frame(now) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      if (type === 'fireworks') {
        if (now > nextRocket && rockets.length < 3) {
          rockets.push({ x: R(W * 0.15, W * 0.85), y: H + 10, vy: R(-11, -8), vx: R(-1, 1), c: pick(['#FFD166', '#FF6B9A', '#4CC9F0', '#CBA945', '#F25F5C', '#B5E48C']) });
          nextRocket = now + R(500, 1300) / (f.density || 2);
        }
        rockets = rockets.filter(function (r) {
          r.x += r.vx; r.y += r.vy; r.vy += 0.16;
          glow(r.x, r.y, 6, 'rgba(255,240,200,1)', 'rgba(255,200,120,0)');
          if (r.vy >= -1) {
            var n = 46 + ((Math.random() * 30) | 0);
            for (var k = 0; k < n; k++) {
              var a = (k / n) * Math.PI * 2, sp = R(1.5, 4.8);
              sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(50, 90), age: 0, c: r.c });
            }
            return false;
          }
          return true;
        });
        sparks = sparks.filter(function (p) {
          p.age++; p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.985; p.vy *= 0.985;
          var a = 1 - p.age / p.life;
          if (a <= 0) return false;
          ctx.globalAlpha = a; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
          return true;
        });
      } else {
        for (var j = 0; j < parts.length; j++) {
          var p = parts[j];
          p.t += 1;
          switch (type) {
            case 'petals':
              p.x += p.vx + Math.sin(p.t / 40) * 0.6; p.y += p.vy; p.r += p.vr;
              ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, 0.55 + Math.sin(p.t / 20) * 0.25);
              ctx.fillStyle = p.c; ctx.globalAlpha = 0.9;
              ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
              break;
            case 'confetti':
            case 'tricolor':
              p.x += p.vx + Math.sin(p.t / 25); p.y += p.vy; p.r += p.vr;
              ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.t / 10));
              ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
              if (p.c === '#FFFFFF') { ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.strokeRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
              ctx.restore();
              break;
            case 'snow':
              p.x += p.vx + Math.sin(p.t / 50) * 0.4; p.y += p.vy;
              ctx.globalAlpha = 0.85; ctx.fillStyle = '#FFFFFF';
              ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 2;
              ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
              ctx.shadowBlur = 0;
              break;
            case 'sparkles':
              p.age++; p.y += p.vy;
              var lifeA = Math.sin((p.age / p.life) * Math.PI);
              ctx.fillStyle = '#F6D57A';
              star(p.x, p.y, p.s * (0.6 + lifeA * 0.6), Math.max(0, lifeA));
              if (p.age > p.life) parts[j] = spawn(true), parts[j].age = 0;
              break;
            case 'diyas':
              p.x += p.vx + Math.sin(p.t / 30) * 0.3; p.y += p.vy;
              var fl = 0.75 + Math.sin(p.t / 4 + p.s) * 0.12;
              ctx.globalAlpha = Math.min(1, (p.y / H) * 1.4);
              glow(p.x, p.y, p.s * 2.4 * fl, 'rgba(255,214,120,0.55)', 'rgba(255,150,40,0)');
              glow(p.x, p.y, p.s * 0.6, 'rgba(255,250,230,1)', 'rgba(255,190,80,0.2)');
              break;
            case 'lanterns':
              p.x += p.vx + Math.sin(p.t / 60) * 0.25; p.y += p.vy;
              ctx.globalAlpha = Math.min(1, (p.y / H) * 1.6);
              glow(p.x, p.y, p.s * 2, 'rgba(255,200,110,0.45)', 'rgba(255,140,40,0)');
              ctx.fillStyle = 'rgba(255,190,90,0.95)';
              ctx.beginPath();
              ctx.moveTo(p.x - p.s * 0.45, p.y - p.s * 0.6); ctx.lineTo(p.x + p.s * 0.45, p.y - p.s * 0.6);
              ctx.lineTo(p.x + p.s * 0.32, p.y + p.s * 0.6); ctx.lineTo(p.x - p.s * 0.32, p.y + p.s * 0.6); ctx.closePath(); ctx.fill();
              ctx.fillStyle = 'rgba(255,245,210,0.9)'; ctx.fillRect(p.x - p.s * 0.12, p.y + p.s * 0.2, p.s * 0.24, p.s * 0.3);
              break;
            case 'hearts':
              p.x += p.vx + Math.sin(p.t / 30) * 0.5; p.y += p.vy;
              ctx.globalAlpha = Math.min(0.9, (p.y / H) * 1.5);
              ctx.fillStyle = p.c; heart(p.x, p.y, p.s);
              break;
          }
          var out = type === 'diyas' || type === 'lanterns' || type === 'hearts' ? p.y < -60 : p.y > H + 30;
          if (out || p.x < -60 || p.x > W + 60) parts[j] = spawn(false);
        }
      }
      if (running) raf = requestAnimationFrame(frame);
    }
    var running = true, raf = 0;
    raf = requestAnimationFrame(frame);
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!stopped) { running = true; raf = requestAnimationFrame(frame); }
    });
    var stopped = false;
    var secs = Number(f.seconds);
    if (secs > 0) {
      setTimeout(function () {
        cv.classList.add('is-done');
        setTimeout(function () { stopped = true; running = false; cancelAnimationFrame(raf); ctx.clearRect(0, 0, W, H); }, 1500);
      }, secs * 1000);
    }
  }
})();
