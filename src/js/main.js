/* Blue Computer Services landing page interactions. No dependencies. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobile = window.matchMedia('(max-width: 767px)');
  var NS = 'http://www.w3.org/2000/svg';
  // One failing feature must not take the rest of the page down with it.
  var safe = function (name, fn) { try { fn(); } catch (e) { if (window.console) console.warn('[bcs] ' + name, e); } };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var restart = function (el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  var inView = function (el, margin) { var r = el.getBoundingClientRect(), h = window.innerHeight; return r.bottom > -(margin || 0) && r.top < h + (margin || 0); };

  // Runs a function at most once per animation frame.
  var perFrame = function (fn) {
    var queued = false, last;
    return function (e) {
      last = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn(last); });
    };
  };

  // Number tween. The timeout lands on the real value when rAF is throttled.
  var tween = function (from, to, dur, paint) {
    if (reduce || from === to) { paint(to); return function () {}; }
    var start = null, stopped = false;
    var step = function (now) {
      if (stopped) return;
      if (start === null) start = now;
      var p = clamp((now - start) / dur, 0, 1);
      paint(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    var t = setTimeout(function () { if (!stopped) paint(to); }, dur + 300);
    return function () { stopped = true; clearTimeout(t); };
  };

  // Text scramble: random characters settle into the real text, left to right.
  var GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#/<>_';
  var scramble = function (el, text, dur, glyphs) {
    if (reduce) { el.textContent = text; return; }
    var set = glyphs || GLYPHS, start = Date.now();
    clearInterval(el._scr);
    el._scr = setInterval(function () {
      var p = clamp((Date.now() - start) / dur, 0, 1), n = Math.floor(p * text.length), out = '';
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        out += (i < n || c === ' ') ? c : set.charAt(Math.floor(Math.random() * set.length));
      }
      el.textContent = out;
      if (p >= 1) { clearInterval(el._scr); el.textContent = text; }
    }, 32);
  };

  /* ---------- Scroll-driven pieces share one frame-throttled handler ---------- */
  var onScroll = [];
  var runScroll = function () { onScroll.forEach(function (f) { f(); }); };
  var scrollDepth = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? clamp(window.pageYOffset / max, 0, 1) : 0;
  };
  // "Run once when this scrolls into view". Position checks catch instant anchor jumps.
  var whenSeen = function (el, fn, ratio) {
    var done = false;
    var go = function () { if (!done) { done = true; fn(); } };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); go(); } }); }, { threshold: ratio || 0.25 });
      io.observe(el);
    }
    onScroll.push(function () { if (!done && el.getBoundingClientRect().top < window.innerHeight * 0.8) go(); });
  };
  var toast = (function () {
    var t = null;
    return function (msg) {
      var n = $('#toast');
      n.textContent = msg;
      n.classList.add('is-on');
      clearTimeout(t);
      t = setTimeout(function () { n.classList.remove('is-on'); }, 2400);
    };
  })();

  /* ---------- Boot intro (first visit in a session; the inline script decides) ---------- */
  safe('boot', function () {
    var root = document.documentElement, boot = $('#boot');
    if (!root.classList.contains('is-booting')) { boot.hidden = true; return; }
    setTimeout(function () { boot.hidden = true; root.classList.remove('is-booting'); }, 1000);
  });

  /* ---------- Year, years since 2002, Pacific clocks and office hours ---------- */
  safe('time', function () {
    var y = new Date().getFullYear();
    $$('[data-year]').forEach(function (n) { n.textContent = String(y); });
    $$('[data-since]').forEach(function (n) {
      var v = y - Number(n.getAttribute('data-since'));
      if (v > 0) { n.setAttribute('data-count', String(v)); n.textContent = String(v); }
    });
    var clocks = $$('#clock-pt, #clock-ft'), hours = $('#hours-status');
    var fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' });
    var tick = function () {
      var parts = {};
      fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      var hh = parts.hour === '24' ? '00' : parts.hour;
      clocks.forEach(function (c) { c.textContent = hh + ':' + parts.minute + ':' + parts.second; });
      // Placeholder hours until the client confirms them (see the CONFIRM chip next to it).
      var open = Number(hours.getAttribute('data-open')), close = Number(hours.getAttribute('data-close'));
      var h = Number(hh), weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].indexOf(parts.weekday) !== -1;
      var isOpen = weekday && h >= open && h < close;
      hours.classList.toggle('is-open', isOpen);
      hours.classList.toggle('is-closed', !isOpen);
      $('b', hours).textContent = isOpen ? 'Open now' : 'After hours';
    };
    tick();
    setInterval(tick, 1000);
  });

  /* ---------- HUD corner brackets and hover glow, added to every .hud ---------- */
  safe('hud', function () {
    $$('.hud').forEach(function (el) {
      var glow = document.createElement('span'); glow.className = 'hud__glow'; glow.setAttribute('aria-hidden', 'true');
      var br = document.createElement('span'); br.className = 'hud__br'; br.setAttribute('aria-hidden', 'true'); br.innerHTML = '<i></i><i></i><i></i><i></i>';
      el.insertBefore(glow, el.firstChild);
      el.appendChild(br);
    });
  });

  /* ---------- Circuit traces with light pulses on dark sections ---------- */
  var TRACES = [
    'M0 120 H220 L260 160 H520 L560 120 H760', 'M1200 80 H980 L940 120 H760 V200', 'M0 460 H180 L220 420 H420 V340 H600',
    'M1200 500 H1020 L980 460 H820 L780 500 H640', 'M300 0 V60 L340 100 H440', 'M900 600 V540 L860 500 H760'
  ];
  var PADS = [[760, 120], [760, 200], [600, 340], [640, 500], [440, 100], [760, 500]];
  safe('traces', function () {
    $$('.on-navy.sec, .mq, .ft').forEach(function (host, h) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'traces'); svg.setAttribute('viewBox', '0 0 1200 600');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('aria-hidden', 'true');
      TRACES.forEach(function (d, k) {
        var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.id = 'tr-' + h + '-' + k; svg.appendChild(p);
        var pad = document.createElementNS(NS, 'rect'); pad.setAttribute('x', PADS[k][0] - 3); pad.setAttribute('y', PADS[k][1] - 3); pad.setAttribute('width', 6); pad.setAttribute('height', 6); svg.appendChild(pad);
        if (reduce || k % 2) return;
        // A pulse runs the trace in the first half of a 6s cycle, then rests.
        var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '2.500'); c.setAttribute('opacity', '0');
        var begin = ((h * 1.3 + k * 1.7) % 6).toFixed(2) + 's';
        var m = document.createElementNS(NS, 'animateMotion');
        m.setAttribute('dur', '6s'); m.setAttribute('repeatCount', 'indefinite'); m.setAttribute('begin', begin);
        m.setAttribute('keyPoints', '0;1;1'); m.setAttribute('keyTimes', '0;0.5;1'); m.setAttribute('calcMode', 'linear');
        var mp = document.createElementNS(NS, 'mpath'); mp.setAttribute('href', '#' + p.id); mp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + p.id);
        m.appendChild(mp);
        var o = document.createElementNS(NS, 'animate');
        o.setAttribute('attributeName', 'opacity'); o.setAttribute('values', '0;1;1;0;0'); o.setAttribute('keyTimes', '0;0.05;0.45;0.5;1');
        o.setAttribute('dur', '6s'); o.setAttribute('repeatCount', 'indefinite'); o.setAttribute('begin', begin);
        c.appendChild(m); c.appendChild(o); svg.appendChild(c);
      });
      host.insertBefore(svg, host.firstChild);
    });
  });

  /* ---------- Pause loops in sections that are off screen ---------- */
  safe('offscreen', function () {
    var hosts = $$('main > section, .ft');
    onScroll.push(function () {
      hosts.forEach(function (s) {
        var off = !inView(s, 200);
        if (off === s.classList.contains('is-off')) return;
        s.classList.toggle('is-off', off);
        $$('svg', s).forEach(function (svg) { if (svg.pauseAnimations && svg.ownerSVGElement === null) { if (off) svg.pauseAnimations(); else svg.unpauseAnimations(); } });
      });
    });
  });

  /* ---------- Header, progress bar, current section (nav + rail) ---------- */
  safe('header', function () {
    var hd = $('#hd'), bar = $('#progress');
    onScroll.push(function () {
      hd.classList.toggle('is-scrolled', window.pageYOffset > 24);
      bar.style.transform = 'scaleX(' + scrollDepth() + ')';
    });
  });

  safe('sections', function () {
    var rail = $$('.rail__list a'), navs = $$('.nav__a'), count = $('#rail-n');
    var ids = rail.map(function (a) { return a.getAttribute('href').slice(1); });
    var targets = ids.map(function (id) { return document.getElementById(id); });
    var last = -1;
    onScroll.push(function () {
      var line = window.innerHeight * 0.4, cur = 0;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) cur = i; });
      if (cur === last) return;
      last = cur;
      rail.forEach(function (a, i) { a.classList.toggle('is-current', i === cur); if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      count.textContent = (cur + 1 < 10 ? '0' : '') + (cur + 1);
      navs.forEach(function (a) {
        var on = a.getAttribute('href').slice(1) === ids[cur];
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    });
  });

  /* ---------- Full-screen menu ---------- */
  safe('menu', function () {
    var menu = $('#menu'), openBtn = $('#menu-open'), closeBtn = $('#menu-close'), timer = null;
    var open = function () {
      clearTimeout(timer);
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      openBtn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { menu.classList.add('is-open'); closeBtn.focus({ preventScroll: true }); }, 20);
    };
    var close = function (keepFocus) {
      menu.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      timer = setTimeout(function () { menu.hidden = true; }, 280);
      if (keepFocus !== false) openBtn.focus({ preventScroll: true });
    };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { close(false); }); });
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button', menu);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    window.addEventListener('resize', perFrame(function () { if (window.innerWidth >= 1280 && !menu.hidden) close(false); }));
  });

  /* ---------- Command palette (Ctrl/Cmd + K) ---------- */
  safe('palette', function () {
    var box = $('#cmdk'), input = $('#cmdk-q'), list = $('#cmdk-list'), opener = $('#cmdk-open');
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $('#kbd-hint').textContent = mac ? '⌘K' : 'Ctrl K';
    opener.setAttribute('aria-label', 'Open quick jump (' + (mac ? 'Command' : 'Control') + ' K)');
    var items = $$('.rail__list a').map(function (a) { return { label: a.textContent.trim(), hint: 'section', href: a.getAttribute('href') }; });
    items.push({ label: 'Call the office', hint: '(925) 605-5605', href: 'tel:+19256055605' });
    items.push({ label: 'Call direct', hint: '(925) 887-0812', href: 'tel:+19258870812' });
    items.push({ label: 'Request a Network Audit', hint: 'contact form', href: '#contact', service: 'Network audit' });
    var shown = [], active = 0, last = null;
    var render = function () {
      var q = input.value.trim().toLowerCase();
      shown = items.filter(function (it) { return !q || (it.label + ' ' + it.hint).toLowerCase().indexOf(q) !== -1; });
      active = clamp(active, 0, Math.max(0, shown.length - 1));
      list.innerHTML = '';
      if (!shown.length) { var none = document.createElement('li'); none.className = 'cmdk__none'; none.textContent = 'No matches. Try "audit" or "call".'; list.appendChild(none); input.removeAttribute('aria-activedescendant'); return; }
      shown.forEach(function (it, i) {
        var li = document.createElement('li');
        li.id = 'cmdk-o' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === active));
        li.innerHTML = '<span></span><small></small>';
        li.firstChild.textContent = it.label; li.lastChild.textContent = it.hint;
        li.addEventListener('mousemove', function () { if (active !== i) { active = i; mark(); } });
        li.addEventListener('click', function () { go(it); });
        list.appendChild(li);
      });
      input.setAttribute('aria-activedescendant', 'cmdk-o' + active);
    };
    var mark = function () {
      $$('li[role="option"]', list).forEach(function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
      input.setAttribute('aria-activedescendant', 'cmdk-o' + active);
      var el = $('#cmdk-o' + active); if (el) el.scrollIntoView({ block: 'nearest' });
    };
    var open = function () { last = document.activeElement; box.hidden = false; input.value = ''; active = 0; render(); input.focus(); };
    var close = function () { box.hidden = true; if (last && last.focus) last.focus({ preventScroll: true }); };
    var go = function (it) {
      close();
      if (it.service) { var sel = $('#f-service'); $$('option', sel).forEach(function (o) { if (o.textContent === it.service) sel.value = o.textContent; }); }
      if (it.href.charAt(0) === '#') {
        var t = document.getElementById(it.href.slice(1));
        if (t) { t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); history.replaceState(null, '', it.href); }
      } else window.location.href = it.href;
    };
    opener.addEventListener('click', open);
    input.addEventListener('input', function () { active = 0; render(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) { active = (active + 1) % shown.length; mark(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { active = (active - 1 + shown.length) % shown.length; mark(); } }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) go(shown[active]); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
    $('[data-close]', box).addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (box.hidden) open(); else close(); }
    });
  });

  /* ---------- Hero diagram ---------- */
  safe('network', function () {
    var net = $('#net'), wrap = $('#net-wrap'), tip = $('#net-tip'), help = $('#net-help');
    var nodes = $$('.node', net), lines = $('.net__lines', net), sticky = null;
    var place = function (btn) {
      if (mobile.matches) { tip.style.transform = ''; return; }
      var W = net.clientWidth, H = net.clientHeight, w = tip.offsetWidth, h = tip.offsetHeight;
      var x = btn.offsetLeft, y = btn.offsetTop;
      var left = clamp(x - w / 2, -20, W - w + 20);
      var top = y < H / 2 ? y + 62 : y - h - 62;
      tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(clamp(top, -10, H - h + 10)) + 'px)';
    };
    var show = function (btn) {
      var key = btn.getAttribute('data-node');
      nodes.forEach(function (n) { var on = n === btn; n.classList.toggle('is-on', on); n.setAttribute('aria-pressed', String(on)); });
      $$('path', lines).forEach(function (p) { p.classList.toggle('is-on', p.id === 'ln-' + key); });
      net.classList.add('has-active');
      var changed = tip.getAttribute('data-key') !== key;
      tip.innerHTML = $('[data-tip="' + key + '"]').innerHTML;
      tip.setAttribute('data-key', key);
      tip.hidden = false;
      if (changed) restart(tip, 'is-in');
      help.hidden = mobile.matches;
      place(btn);
    };
    var hide = function () {
      nodes.forEach(function (n) { n.classList.remove('is-on'); n.setAttribute('aria-pressed', 'false'); });
      $$('path', lines).forEach(function (p) { p.classList.remove('is-on'); });
      net.classList.remove('has-active');
      tip.hidden = true; tip.removeAttribute('data-key'); help.hidden = false;
    };
    nodes.forEach(function (btn) {
      btn.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(btn); });
      btn.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { if (sticky) show(sticky); else hide(); } });
      btn.addEventListener('focus', function () { if (btn.matches(':focus-visible')) show(btn); });
      btn.addEventListener('blur', function () { if (!sticky) hide(); });
      btn.addEventListener('click', function () { if (sticky === btn) { sticky = null; hide(); return; } sticky = btn; show(btn); });
    });
    document.addEventListener('click', function (e) { if (sticky && !e.target.closest('.node')) { sticky = null; hide(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tip.hidden) { sticky = null; hide(); } });
    if (reduce) return;

    // Data pulses: two per line, staggered, from node to center.
    $$('path', lines).forEach(function (path, i) {
      for (var k = 0; k < 2; k++) {
        var c = document.createElementNS(NS, 'circle'); c.setAttribute('r', k ? '0.6' : '0.9');
        var a = document.createElementNS(NS, 'animateMotion'), dur = 2.2 + (i % 4) * 0.45 + k * 0.6;
        a.setAttribute('dur', dur.toFixed(2) + 's'); a.setAttribute('begin', (i * 0.37 + k * dur / 2).toFixed(2) + 's'); a.setAttribute('repeatCount', 'indefinite');
        var m = document.createElementNS(NS, 'mpath'); m.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + path.id); m.setAttribute('href', '#' + path.id);
        a.appendChild(m); c.appendChild(a); lines.appendChild(c);
      }
    });
    if (finePointer) {
      var hero = $('.hero'), tx = 0, ty = 0, cx = 0, cy = 0, running = false;
      var loop = function () {
        cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
        net.style.setProperty('--tx', cx.toFixed(2) + 'deg'); net.style.setProperty('--ty', cy.toFixed(2) + 'deg');
        if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.02) requestAnimationFrame(loop); else running = false;
      };
      var kick = function () { if (!running) { running = true; requestAnimationFrame(loop); } };
      hero.addEventListener('pointermove', perFrame(function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = wrap.getBoundingClientRect();
        ty = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1) * 6;
        tx = clamp(-(e.clientY - (r.top + r.height / 2)) / r.height, -1, 1) * 5;
        kick();
      }));
      hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    }
    // Illustrative status card: type the event, then tick it off.
    var events = [['Unpatched PC found', 'Patched remotely'], ['Failed login spike', 'Blocked'], ['Backup job missed', 'Re-run and checked'], ['Unknown device on Wi-Fi', 'Flagged for review'], ['Firewall rule left open', 'Closed']];
    var card = $('.status'), ev = $('#status-event'), res = $('#status-result'), idx = 0, typing = null;
    var play = function () {
      var e = events[idx], n = 0;
      card.classList.remove('is-done'); ev.textContent = ''; res.textContent = e[1];
      clearInterval(typing);
      typing = setInterval(function () {
        n++; ev.textContent = e[0].slice(0, n);
        if (n >= e[0].length) { clearInterval(typing); setTimeout(function () { card.classList.add('is-done'); }, 250); }
      }, 38);
    };
    play();
    setInterval(function () { if (document.hidden || window.pageYOffset > window.innerHeight) return; idx = (idx + 1) % events.length; play(); }, 4200);
  });

  /* ---------- Looping strips ---------- */
  safe('loops', function () {
    if (reduce) return;
    $$('[data-loop]').forEach(function (track) {
      var items = $$('li', track);
      for (var k = 0; k < 3; k++) items.forEach(function (li) { var c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
    });
  });

  /* ---------- Scroll entrances ---------- */
  safe('reveal', function () {
    var items = $$('[data-reveal]');
    if (reduce) return;
    document.documentElement.classList.add('js-reveal');
    var groups = new Map();
    items.forEach(function (n) { var c = groups.get(n.parentNode) || 0; n.style.setProperty('--i', String(Math.min(c, 6))); groups.set(n.parentNode, c + 1); });
    var show = function (n) {
      if (n.classList.contains('is-in')) return;
      n.classList.add('is-in');
      // Hand the element back to its own hover transitions once it has landed.
      setTimeout(function () { n.removeAttribute('data-reveal'); n.classList.remove('is-in'); }, 1000 + Number(n.style.getPropertyValue('--i') || 0) * 80);
    };
    var pending = items.slice();
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      pending.forEach(function (n) { io.observe(n); });
    }
    var sweep = function () { var line = window.innerHeight * 0.95; pending = pending.filter(function (n) { if (n.getBoundingClientRect().top < line) { show(n); return false; } return true; }); };
    onScroll.push(sweep);
    var poll = setInterval(function () { sweep(); if (!pending.length) clearInterval(poll); }, 800);
    sweep();
  });

  /* ---------- Section headings resolve from noise, once ---------- */
  safe('headings', function () {
    $$('[data-scramble]').forEach(function (h) {
      var text = h.textContent;
      h.setAttribute('aria-label', text);
      whenSeen(h, function () { scramble(h, text, 520); setTimeout(function () { h.removeAttribute('aria-label'); }, 700); }, 0.6);
    });
  });

  /* ---------- Telemetry: numbers decrypt, visuals start ---------- */
  safe('telemetry', function () {
    $$('.stat').forEach(function (stat) {
      var el = $('[data-count]', stat);
      whenSeen(stat, function () {
        stat.classList.add('is-seen');
        var end = el.getAttribute('data-count');
        scramble(el, end, 650, '0123456789');
      }, 0.4);
    });
  });

  /* ---------- Tabs: shared keyboard model ---------- */
  var tabKeys = function (tabs, select) {
    tabs.forEach(function (t, i) {
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = i + 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = i - 1;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        n = (n + tabs.length) % tabs.length;
        select(n); tabs[n].focus();
      });
    });
  };

  /* ---------- Services explorer: console with auto-advance; accordion on phones ---------- */
  safe('explorer', function () {
    var root = $('#explorer'), stage = $('#ex-stage'), panelsBox = $('#ex-panels'), path = $('#con-path');
    var list = $('.ex__list', root), bar = $('.ex__bar', root);
    var tabs = $$('.ex__tab', root), items = $$('.ex__item', root), panels = $$('.ex__panel', root);
    var labels = tabs.map(function (t) { var l = $('.ex__lbl', t); t.setAttribute('aria-label', l.textContent); return l; });
    var drawers = items.map(function (item) { var d = document.createElement('div'); d.className = 'ex__drawer'; d.appendChild(document.createElement('div')); item.appendChild(d); return d; });
    var current = 0, hover = false, focusIn = false, visible = false, elapsed = 0, STEP = 100, HOLD = 6000;
    var moveBar = function () { var it = items[current]; bar.style.setProperty('--y', it.offsetTop + 'px'); bar.style.setProperty('--s', String(it.offsetHeight / 100)); };
    var syncAuto = function () {
      root.classList.toggle('is-auto', !reduce && !mobile.matches);
      root.classList.toggle('is-paused', hover || focusIn || !visible || document.hidden);
    };
    var select = function (i, quiet) {
      var changed = i !== current;
      current = i; elapsed = 0;
      tabs.forEach(function (t, n) { var on = n === i; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[n].classList.toggle('is-active', on); });
      path.textContent = 'svc/' + tabs[i].getAttribute('data-slug') + ' · active';
      moveBar();
      if (changed && !quiet) { restart(panelsBox, 'is-swap'); scramble(labels[i], tabs[i].getAttribute('aria-label'), 380); }
      root.classList.remove('is-auto'); void root.offsetWidth; syncAuto();
    };
    var toggle = function (i) {
      var open = tabs[i].getAttribute('aria-expanded') === 'true';
      tabs.forEach(function (t, n) { var on = n === i && !open; t.setAttribute('aria-expanded', String(on)); drawers[n].classList.toggle('is-open', on); });
      if (!open) current = i;
    };
    var applyMode = function () {
      if (mobile.matches) {
        list.removeAttribute('role'); list.removeAttribute('aria-orientation');
        tabs.forEach(function (t, n) {
          t.removeAttribute('role'); t.removeAttribute('aria-selected'); t.removeAttribute('tabindex');
          items[n].removeAttribute('role');
          panels[n].setAttribute('role', 'region'); panels[n].removeAttribute('tabindex'); panels[n].classList.add('is-active');
          drawers[n].firstChild.appendChild(panels[n]);
          var on = n === current; t.setAttribute('aria-expanded', String(on)); drawers[n].classList.toggle('is-open', on);
        });
      } else {
        list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical');
        tabs.forEach(function (t, n) {
          t.setAttribute('role', 'tab'); t.removeAttribute('aria-expanded');
          items[n].setAttribute('role', 'presentation');
          panels[n].setAttribute('role', 'tabpanel'); panels[n].tabIndex = 0;
          panelsBox.appendChild(panels[n]);
        });
        select(current, true);
      }
      syncAuto();
    };
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { if (mobile.matches) toggle(i); else select(i); }); });
    tabKeys(tabs, function (i) { if (!mobile.matches) select(i); });
    // A plain timer drives the advance; the CSS fill only shows progress.
    setInterval(function () {
      if (!root.classList.contains('is-auto') || root.classList.contains('is-paused')) return;
      elapsed += STEP;
      if (elapsed >= HOLD) select((current + 1) % tabs.length);
    }, STEP);
    root.addEventListener('pointerenter', function () { hover = true; syncAuto(); });
    root.addEventListener('pointerleave', function () { hover = false; syncAuto(); });
    root.addEventListener('focusin', function () { focusIn = true; syncAuto(); });
    root.addEventListener('focusout', function () { setTimeout(function () { focusIn = root.contains(document.activeElement); syncAuto(); }, 0); });
    document.addEventListener('visibilitychange', syncAuto);
    onScroll.push(function () {
      var r = root.getBoundingClientRect(), h = window.innerHeight, v = r.top < h * 0.75 && r.bottom > h * 0.25;
      if (v !== visible) { visible = v; syncAuto(); }
    });
    if (finePointer && !reduce) {
      stage.addEventListener('pointermove', perFrame(function (e) {
        var r = stage.getBoundingClientRect();
        stage.style.setProperty('--gx', (e.clientX - r.left) + 'px'); stage.style.setProperty('--gy', (e.clientY - r.top) + 'px');
      }));
    }
    mobile.addEventListener('change', applyMode);
    window.addEventListener('resize', perFrame(function () { if (!mobile.matches) moveBar(); }));
    window.addEventListener('load', function () { if (!mobile.matches) moveBar(); });
    applyMode();
  });

  /* ---------- Owner: access badge, quote, changelog ---------- */
  safe('owner', function () {
    var card = $('#owner-card');
    if (finePointer && !reduce) {
      card.addEventListener('pointermove', perFrame(function (e) {
        var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-(y - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      }));
      card.addEventListener('pointerleave', function () { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    }
    var quote = $('#quote'), i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--i', String(i++)); s.textContent = part; frag.appendChild(s);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    };
    walk($('p', quote));
    whenSeen(quote, function () { quote.classList.add('is-in'); }, 0.5);
    var log = $('#changelog');
    whenSeen(log, function () { log.classList.add('is-typed'); }, 0.4);
  });

  /* ---------- Audit tabs with a sliding underline ---------- */
  safe('audit-tabs', function () {
    var root = $('#audit-tabs'), ink = $('.at__ink', root);
    var tabs = $$('.at__tab', root), panels = $$('.at__panel', root), current = 0;
    var moveInk = function () { var t = tabs[current]; ink.style.setProperty('--x', t.offsetLeft + 'px'); ink.style.setProperty('--w', String(t.offsetWidth / 100)); };
    var select = function (i) {
      var dir = i > current ? '40px' : '-40px';
      current = i;
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        panels[n].style.setProperty('--from', on ? dir : (n < i ? '-40px' : '40px'));
        panels[n].classList.toggle('is-active', on);
      });
      moveInk();
    };
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { select(i); }); });
    tabKeys(tabs, select);
    window.addEventListener('resize', perFrame(moveInk));
    window.addEventListener('load', moveInk);
    moveInk();
  });

  /* ---------- Sample scanner: scan, findings, score ---------- */
  safe('scanner', function () {
    var report = $('#report'), phase = $('#scan-phase'), pct = $('#scan-pct'), bar = $('#scan-bar'), log = $('#scan-log');
    var list = $$('#findings li'), count = $('#f-count'), ring = $('#risk-ring'), riskN = $('#risk-n');
    var fixText = $('#report-fix-text'), rest = fixText.textContent, timers = [], RISK = 64;
    var devices = ['Front desk PC', 'Office printer', 'Guest Wi-Fi', 'File server', 'Accounting laptop', 'Firewall', 'Backup drive', 'Conference room screen'];
    var flagged = { 'Front desk PC': 1, 'Office printer': 1, 'Guest Wi-Fi': 1, 'Backup drive': 1 };
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var setPhase = function (t) { phase.textContent = t; };
    var finish = function () {
      list.forEach(function (li) { li.classList.add('is-shown'); });
      count.textContent = String(list.length);
      ring.style.strokeDashoffset = String(100 - RISK); riskN.textContent = String(RISK);
      pct.textContent = '100'; bar.style.transform = 'scaleX(1)'; setPhase('complete');
    };
    var run = function () {
      timers.forEach(clearTimeout); timers = [];
      if (reduce) { finish(); return; }
      report.classList.add('js-scan');
      list.forEach(function (li) { li.classList.remove('is-shown'); });
      count.textContent = '0'; riskN.textContent = '0'; ring.style.strokeDashoffset = '100';
      log.innerHTML = ''; setPhase('scanning');
      var SCAN = 2400;
      // Phase 1: percentage climbs while devices tick past.
      for (var s = 0; s <= 40; s++) (function (s) { later(function () { var p = Math.round(s / 40 * 100); pct.textContent = String(p); bar.style.transform = 'scaleX(' + (p / 100) + ')'; }, s * SCAN / 40); })(s);
      devices.forEach(function (d, i) {
        later(function () {
          var li = document.createElement('li');
          li.innerHTML = '&gt; checking <span></span> &middot; <b></b>';
          li.querySelector('span').textContent = d;
          li.querySelector('b').textContent = flagged[d] ? 'flag' : 'ok';
          if (flagged[d]) li.querySelector('b').style.color = 'var(--amber)';
          log.appendChild(li);
          while (log.children.length > 3) log.removeChild(log.firstChild);
        }, i * SCAN / devices.length);
      });
      // Phase 2: findings populate.
      list.forEach(function (li, i) { later(function () { setPhase('findings'); li.classList.add('is-shown'); count.textContent = String(i + 1); restart(count, 'is-bump'); }, SCAN + 200 + i * 260); });
      // Phase 3: risk score.
      later(function () {
        setPhase('scoring');
        ring.style.strokeDashoffset = String(100 - RISK);
        tween(0, RISK, 900, function (v) { riskN.textContent = String(Math.round(v)); });
      }, SCAN + 200 + list.length * 260 + 200);
      later(finish, SCAN + list.length * 260 + 1500);
    };
    var say = function (li) {
      list.forEach(function (x) { x.classList.toggle('is-on', x === li); });
      fixText.textContent = li ? li.getAttribute('data-fix') : rest;
      restart(fixText, 'is-swap');
    };
    list.forEach(function (li) {
      li.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') say(li); });
      li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') say(null); });
      li.addEventListener('focus', function () { say(li); });
      li.addEventListener('click', function () { say(li); });
    });
    // Severity filter chips.
    var chips = $$('.chips button');
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        var sev = b.getAttribute('data-sev');
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        list.forEach(function (li) {
          var on = sev === 'all' || li.getAttribute('data-sev') === sev;
          if (on) { li.hidden = false; requestAnimationFrame(function () { li.classList.remove('is-out'); }); setTimeout(function () { li.classList.remove('is-out'); }, 30); }
          else { li.classList.add('is-out'); setTimeout(function () { if (li.classList.contains('is-out')) li.hidden = true; }, reduce ? 0 : 260); }
        });
      });
    });
    if (!reduce) report.classList.add('js-scan'); else finish();
    whenSeen(report, run, 0.35);
    $('#run-scan').addEventListener('click', run);
  });

  /* ---------- Comparison: switch, rows, bad-Tuesday simulation ---------- */
  safe('compare', function () {
    var wrap = $('#cmp-wrap'), rows = $$('#cmp tbody tr'), text = $('#cmp-text'), rest = text.textContent;
    var set = function (msg) { if (text.textContent === msg) return; text.textContent = msg; restart(text, 'is-typing'); };
    var on = function (r) { rows.forEach(function (x) { x.classList.toggle('is-on', x === r); }); set(r.getAttribute('data-sum')); };
    var off = function () { rows.forEach(function (x) { x.classList.remove('is-on'); }); set(rest); };
    rows.forEach(function (r) {
      r.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') on(r); });
      r.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') off(); });
      r.addEventListener('focus', function () { on(r); });
      r.addEventListener('blur', off);
      r.addEventListener('click', function () { on(r); });
    });
    var seg = $('#seg'), opts = $$('button', seg);
    var pick = function (b, toggle) {
      var was = b.getAttribute('aria-checked') === 'true';
      opts.forEach(function (x) { x.setAttribute('aria-checked', 'false'); x.tabIndex = -1; });
      if (was && toggle) { seg.removeAttribute('data-on'); wrap.removeAttribute('data-spot'); opts[0].tabIndex = 0; return; }
      b.setAttribute('aria-checked', 'true'); b.tabIndex = 0;
      seg.setAttribute('data-on', b.getAttribute('data-col')); wrap.setAttribute('data-spot', b.getAttribute('data-col'));
    };
    opts.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(b, true); });
      b.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
        e.preventDefault(); var n = opts[(i + 1) % 2]; pick(n, false); n.focus();
      });
    });
    // Illustrative simulation: both timelines step forward together.
    var a = $$('#sim-a li'), bf = $$('#sim-b li'), play = $('#sim-play'), timer = null;
    play.addEventListener('click', function () {
      clearInterval(timer);
      a.concat(bf).forEach(function (li) { li.classList.remove('is-on'); });
      if (reduce) { a.concat(bf).forEach(function (li) { li.classList.add('is-on'); }); return; }
      var t = 0;
      play.disabled = true;
      var stepOnce = function () {
        if (a[t]) a[t].classList.add('is-on');
        if (bf[t]) bf[t].classList.add('is-on');
        t++;
        if (t >= bf.length) { clearInterval(timer); play.disabled = false; }
      };
      stepOnce();
      timer = setInterval(stepOnce, 800);
    });
  });

  /* ---------- Coverage map: pick a zone, the panel explains it ---------- */
  safe('coverage', function () {
    var map = $('.map'), zones = $$('.zone'), box = $('#cov-in'), panel = $('#cov-panel'), def = box.innerHTML, sticky = null, key = null;
    var swap = function (html, k) { if (key === k) return; key = k; box.innerHTML = html; if (!reduce) restart(box, 'is-swap'); };
    var show = function (z) {
      zones.forEach(function (x) { var on = x === z; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      map.classList.add('has-active');
      var k = z.getAttribute('data-zone');
      swap($('[data-info="' + k + '"]').innerHTML, k);
    };
    var clear = function () {
      zones.forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
      map.classList.remove('has-active');
      swap(def, null);
    };
    var pick = function (z) { if (sticky === z) { sticky = null; clear(); return; } sticky = z; show(z); };
    zones.forEach(function (z) {
      z.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(z); });
      z.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { if (sticky) show(sticky); else clear(); } });
      z.addEventListener('focus', function () { show(z); });
      // Leaving the map returns the panel to the picked zone, or to the default.
      z.addEventListener('blur', function () { setTimeout(function () { if (map.contains(document.activeElement)) return; if (sticky) show(sticky); else clear(); }, 0); });
      z.addEventListener('click', function () { pick(z); });
      z.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(z); } });
    });
    document.addEventListener('click', function (e) { if (sticky && !e.target.closest('.map') && !e.target.closest('#cov-panel')) { sticky = null; clear(); } });
    // Each zone links to its service: open that service in the explorer as we scroll there.
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-tab]');
      if (!a) return;
      var tab = document.getElementById(a.getAttribute('data-tab'));
      if (tab && tab.getAttribute('aria-expanded') !== 'true') setTimeout(function () { tab.click(); }, 50);
    });
  });

  /* ---------- How we work: circuit trace, travelling packet, loop ---------- */
  safe('process', function () {
    var track = $('#track'), svg = $('#circuit'), base = $('#c-path'), loop = $('#c-loop');
    var steps = $$('.step', track), marks = $$('.step__mark', track), pts = [], DUR = 4;
    var build = function () {
      var tr = track.getBoundingClientRect(), W = svg.clientWidth, H = svg.clientHeight, vertical = mobile.matches;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      pts = marks.map(function (m) { var r = m.getBoundingClientRect(); return [r.left + r.width / 2 - tr.left, r.top + r.height / 2 - tr.top]; });
      var d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (vertical) { var my = (a[1] + b[1]) / 2; d += ' V' + (my - 14) + ' L' + (a[0] + 9) + ' ' + (my - 6) + ' V' + (my + 6) + ' L' + a[0] + ' ' + (my + 14) + ' V' + b[1]; }
        else { var mx = (a[0] + b[0]) / 2; d += ' H' + (mx - 22) + ' L' + (mx - 12) + ' ' + (a[1] - 12) + ' H' + (mx + 12) + ' L' + (mx + 22) + ' ' + a[1] + ' H' + b[0]; }
      }
      base.setAttribute('d', d);
      var c = pts[pts.length - 1];
      loop.setAttribute('d', 'M' + (c[0] - 18) + ' ' + c[1] + ' a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0');
      if (reduce) { steps.forEach(function (s) { s.classList.add('is-lit'); }); return; }
      $$('.c-pkt', svg).forEach(function (n) { n.remove(); });
      [['c-path', DUR, 'c-pkt'], ['c-loop', 1.6, 'c-pkt c-pkt--loop']].forEach(function (cfg) {
        var p = document.createElementNS(NS, 'circle'); p.setAttribute('r', '5'); p.setAttribute('class', cfg[2]);
        var m = document.createElementNS(NS, 'animateMotion'); m.setAttribute('dur', cfg[1] + 's'); m.setAttribute('repeatCount', 'indefinite');
        var mp = document.createElementNS(NS, 'mpath'); mp.setAttribute('href', '#' + cfg[0]); mp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + cfg[0]);
        m.appendChild(mp); p.appendChild(m); svg.appendChild(p);
      });
    };
    build();
    window.addEventListener('load', build);
    window.addEventListener('resize', perFrame(build));
    mobile.addEventListener('change', build);
    if (!reduce) {
      // Light each step as the packet reaches it.
      setInterval(function () {
        if (!inView(track) || !svg.getCurrentTime) return;
        var len = base.getTotalLength(); if (!len) return;
        var pt = base.getPointAtLength(((svg.getCurrentTime() % DUR) / DUR) * len), vertical = mobile.matches;
        steps.forEach(function (s, i) { s.classList.toggle('is-lit', vertical ? pt.y >= pts[i][1] - 2 : pt.x >= pts[i][0] - 2); });
      }, 100);
    }
    steps.forEach(function (s) {
      var b = $('.step__h button', s);
      b.addEventListener('click', function () { var open = !s.classList.contains('is-open'); s.classList.toggle('is-open', open); b.setAttribute('aria-expanded', String(open)); });
    });
  });

  /* ---------- Symptom picker: chips build a plain-language diagnosis ---------- */
  safe('symptoms', function () {
    var chips = $$('.chip'), list = $('#diag-list'), empty = $('#diag-empty'), foot = $('#diag-foot');
    var sync = function () { var any = list.children.length > 0; empty.hidden = any; foot.hidden = !any; };
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var on = c.getAttribute('aria-pressed') !== 'true', k = c.getAttribute('data-sym');
        c.setAttribute('aria-pressed', String(on));
        c.classList.toggle('is-hot', on);
        if (on) {
          var li = document.createElement('li');
          li.setAttribute('data-sym', k);
          li.innerHTML = $('[data-diag="' + k + '"]').innerHTML;
          if (!reduce) li.classList.add('is-new');
          list.appendChild(li);
        } else {
          var old = $('li[data-sym="' + k + '"]', list);
          if (old) old.remove();
        }
        sync();
      });
    });
    $('#diag-clear').addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); c.classList.remove('is-hot'); });
      list.innerHTML = '';
      sync();
      chips[0].focus();
    });
    // Carry the picks into the contact form's message box.
    $('#diag-cta').addEventListener('click', function () {
      var picked = chips.filter(function (c) { return c.getAttribute('aria-pressed') === 'true'; }).map(function (c) { return '- ' + $('svg + span', c).textContent; });
      var box = $('#f-message'), note = 'Things we have noticed:\n' + picked.join('\n');
      box.value = box.value.trim() ? box.value.trim() + '\n\n' + note : note;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  /* ---------- Bento: cursor glow and spotlight border ---------- */
  safe('tiles', function () {
    if (reduce || !finePointer) return;
    $$('.tile').forEach(function (t) {
      t.addEventListener('pointermove', perFrame(function (e) {
        var r = t.getBoundingClientRect();
        t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }));
    });
  });

  /* ---------- FAQ: accordion, live search with highlights ---------- */
  safe('faq', function () {
    var input = $('#faq-q'), count = $('#faq-count'), empty = $('#faq-empty'), term = $('#faq-term');
    var qas = $$('.qa').map(function (q, i) {
      var b = $('button', q), p = $('.qa__p', q), ans = $('p', p);
      b.id = 'q-' + i; p.id = 'a-' + i;
      b.setAttribute('aria-controls', p.id); p.setAttribute('role', 'region'); p.setAttribute('aria-labelledby', b.id);
      var label = document.createElement('span'); label.textContent = b.firstChild.nodeValue; b.replaceChild(label, b.firstChild);
      b.addEventListener('click', function () { var open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); q.classList.toggle('is-open', open); });
      return { el: q, label: label, text: label.textContent, ans: ans, html: ans.innerHTML };
    });
    var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    // Wrap matches in text nodes only, so links and placeholder chips survive.
    var highlight = function (root, re) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), hits = [], n;
      while ((n = walker.nextNode())) { re.lastIndex = 0; if (re.test(n.nodeValue)) hits.push(n); }
      hits.forEach(function (t) {
        var frag = document.createDocumentFragment(), last = 0, m;
        re.lastIndex = 0;
        while ((m = re.exec(t.nodeValue))) {
          frag.appendChild(document.createTextNode(t.nodeValue.slice(last, m.index)));
          var mk = document.createElement('mark'); mk.className = 'hl'; mk.textContent = m[0]; frag.appendChild(mk);
          last = m.index + m[0].length;
        }
        frag.appendChild(document.createTextNode(t.nodeValue.slice(last)));
        t.parentNode.replaceChild(frag, t);
      });
    };
    var filter = function () {
      var raw = input.value.trim(), shown = 0, re = raw ? new RegExp(esc(raw), 'gi') : null;
      qas.forEach(function (q) {
        q.label.textContent = q.text; q.ans.innerHTML = q.html;
        var hit = !raw || q.el.textContent.toLowerCase().indexOf(raw.toLowerCase()) !== -1;
        q.el.hidden = !hit;
        if (hit) { shown++; if (re) { highlight(q.label, re); highlight(q.ans, re); } }
      });
      term.textContent = raw; empty.hidden = shown !== 0;
      count.textContent = shown + (shown === 1 ? ' question' : ' questions');
    };
    input.addEventListener('input', filter);
    $('#faq-reset').addEventListener('click', function () { input.value = ''; filter(); input.focus(); });
  });

  /* ---------- Service links pre-select the form topic ---------- */
  safe('service-links', function () {
    var sel = $('#f-service');
    $$('[data-service]').forEach(function (a) {
      a.addEventListener('click', function () { var want = a.getAttribute('data-service'); $$('option', sel).forEach(function (o) { if (o.textContent === want) sel.value = o.textContent; }); });
    });
  });

  /* ---------- Call me back: front-end only, handed to the visitor's email app ---------- */
  safe('callback', function () {
    var form = $('#cb'), input = $('#cb-phone'), msg = $('#cb-msg'), btn = $('.cb__btn', form), label = $('.cb__label', btn);
    input.addEventListener('input', function () { if (input.getAttribute('aria-invalid') === 'true' && input.value.replace(/\D/g, '').length >= 10) { input.removeAttribute('aria-invalid'); msg.textContent = ''; } });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var digits = input.value.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) { msg.textContent = 'That doesn’t look like a full phone number. Include the area code.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      input.removeAttribute('aria-invalid');
      btn.classList.add('is-connecting'); label.textContent = 'Connecting';
      setTimeout(function () {
        window.location.href = 'mailto:' + form.getAttribute('data-to') + '?subject=' + encodeURIComponent('Please call me back') + '&body=' + encodeURIComponent('Please call me back at ' + input.value.trim());
        btn.classList.remove('is-connecting'); btn.classList.add('is-done');
        label.textContent = 'We’ll call you shortly';
        msg.textContent = 'Your email app opened with your number in it. Press send so it reaches us.';
      }, reduce ? 0 : 900);
    });
  });

  /* ---------- Contact: copy buttons, next steps ---------- */
  safe('contact', function () {
    $$('.copy').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-copy');
        var t = document.createElement('textarea'); t.value = v; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        document.body.removeChild(t); b.focus({ preventScroll: true });
        if (ok) { toast('Copied ' + v); return; }
        var fail = function () { toast('Couldn’t copy. Select the text instead.'); };
        if (!navigator.clipboard) { fail(); return; }
        var settled = false, guard = setTimeout(function () { if (!settled) { settled = true; fail(); } }, 1500);
        navigator.clipboard.writeText(v).then(function () { if (!settled) { settled = true; clearTimeout(guard); toast('Copied ' + v); } }, function () { if (!settled) { settled = true; clearTimeout(guard); fail(); } });
      });
    });
    var steps = $$('#next li');
    whenSeen($('#next'), function () { steps.forEach(function (li, i) { setTimeout(function () { li.classList.add('is-lit'); }, reduce ? 0 : 350 + i * 450); }); }, 0.5);
  });

  safe('form', function () {
    var form = $('#contact-form'), done = $('#form-done'), btn = $('.form__btn', form), tx = $('#form-tx');
    var mode = form.getAttribute('data-mode'), status = $('#form-status');
    var success = function (line, title, text) {
      tx.textContent = line; $('#form-done-title').textContent = title; $('#form-done-text').textContent = text;
      form.hidden = true; done.hidden = false; done.focus();
    };
    // WordPress lands back here after sending: show the received state.
    if (status && status.classList.contains('is-ok')) { success('> transmitting… received', 'Received.', status.textContent); return; }
    var rules = {
      name: function (v) { return v.length >= 2 ? '' : 'Add your name so we know who to reply to.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email doesn’t look right. Try name@company.com.'; },
      message: function (v) { return v.length >= 10 ? '' : 'Tell us a little more, even just a line or two.'; }
    };
    var check = function (name) {
      var input = form.elements[name], err = rules[name](input.value.trim());
      input.closest('.fl').classList.toggle('is-bad', !!err);
      $('#f-' + name + '-err').textContent = err;
      if (err) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      input.setAttribute('aria-describedby', 'f-' + name + '-err');
      return !err;
    };
    Object.keys(rules).forEach(function (n) {
      var input = form.elements[n];
      input.addEventListener('blur', function () { if (input.value.trim()) check(n); });
      input.addEventListener('input', function () { if (input.closest('.fl').classList.contains('is-bad')) check(n); });
    });
    form.addEventListener('submit', function (e) {
      var bad = Object.keys(rules).filter(function (n) { return !check(n); });
      if (bad.length) { e.preventDefault(); form.elements[bad[0]].focus(); return; }
      if (form.elements.website.value) { e.preventDefault(); return; }
      btn.disabled = true; btn.classList.add('is-loading');
      $('.form__btn-label', btn).textContent = 'Transmitting…';
      if (mode !== 'mailto') return; // WordPress: the browser posts to admin-post.php.
      e.preventDefault();
      var v = function (n) { return (form.elements[n].value || '').trim(); };
      var body = ['Name: ' + v('name'), 'Email: ' + v('email'), 'Phone: ' + (v('phone') || 'Not given'), 'Company: ' + (v('company') || 'Not given'), 'Topic: ' + (v('service') || 'Not given'), '', v('message')].join('\n');
      var to = (form.getAttribute('action') || '').replace(/^mailto:/, '');
      setTimeout(function () {
        window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Website enquiry from ' + v('name') + (v('service') ? ' (' + v('service') + ')' : '')) + '&body=' + encodeURIComponent(body);
        success('> transmitting… handed to your email app', 'Almost there, ' + v('name').split(' ')[0] + '.', 'Your email app opened with the message filled in. Press send and it reaches us.');
      }, reduce ? 0 : 800);
    });
  });

  /* ---------- Footer wordmark parallax ---------- */
  safe('footer', function () {
    if (reduce) return;
    var mark = $('#ft-mark'), ft = $('.ft');
    onScroll.push(function () { var r = ft.getBoundingClientRect(); if (r.top > window.innerHeight) return; mark.style.setProperty('--py', ((window.innerHeight - r.top) * 0.22 - 120).toFixed(1) + 'px'); });
  });

  /* ---------- Back to top ---------- */
  safe('totop', function () {
    var btn = $('#totop'), ring = $('#totop-ring'), hero = $('.hero'), C = 144.51;
    onScroll.push(function () { btn.classList.toggle('is-on', hero.getBoundingClientRect().bottom < 0); ring.style.strokeDashoffset = String(C * (1 - scrollDepth())); });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'instant' }); });
  });

  /* ---------- Cursor: fixed wrapper, placed on first mousemove, eased ring ---------- */
  safe('cursor', function () {
    if (reduce || !finePointer) return;
    var root = document.documentElement;
    var cur = document.createElement('div'); cur.className = 'cur'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span class="cur__dot"></span><span class="cur__ring"><span class="cur__circle"></span><span class="cur__ret"></span><span class="cur__lbl"></span></span>';
    document.body.appendChild(cur);
    var dot = $('.cur__dot', cur), ring = $('.cur__ring', cur), lbl = $('.cur__lbl', cur);
    var mx = 0, my = 0, rx = 0, ry = 0, placed = false, visible = false, raf = 0, lastTouch = 0, lastFrame = 0;
    var HOT = 'a, button, label, input[type="range"], [role="tab"], [data-cursor], .tile, .stat, .report__list li, #cmp tbody tr';
    var paint = function () {
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    };
    var step = function () { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2; paint(); };
    var loop = function () {
      lastFrame = Date.now();
      step();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    // Some embedded previews and power-saving modes stall animation frames.
    // If no frame has run for a while, ease the ring on a timer so it never sticks.
    setInterval(function () { if (visible && Date.now() - lastFrame > 120) step(); }, 30);
    var show = function () { if (!placed) return; visible = true; cur.classList.add('is-on'); root.classList.add('has-cursor'); if (!raf) raf = requestAnimationFrame(loop); };
    var hide = function () { visible = false; cur.classList.remove('is-on'); root.classList.remove('has-cursor'); };
    document.addEventListener('touchstart', function () { lastTouch = Date.now(); hide(); }, { passive: true });
    window.addEventListener('mousemove', function (e) {
      if (Date.now() - lastTouch < 800) return; // ignore mouse events synthesised from touch
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      if (!placed) { placed = true; rx = mx; ry = my; paint(); }
      if (!visible) show();
    }, { passive: true });
    root.addEventListener('mouseleave', hide);
    root.addEventListener('mouseenter', function () { if (placed) { rx = mx; ry = my; } });
    window.addEventListener('blur', hide);
    document.addEventListener('mouseover', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var text = !!t.closest('input:not([type="range"]):not([type="radio"]), textarea, select');
      cur.classList.toggle('is-text', text);
      var hot = t.closest(HOT), labelled = t.closest('[data-cursor]');
      cur.classList.toggle('is-target', !!hot);
      cur.classList.toggle('is-label', !!labelled);
      lbl.textContent = labelled ? labelled.getAttribute('data-cursor') : '';
    }, { passive: true });

    $$('[data-magnetic]').forEach(function (b) {
      b.addEventListener('pointermove', perFrame(function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1) + 'px ' + ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + 'px';
      }));
      b.addEventListener('pointerleave', function () { b.style.translate = ''; });
    });
  });

  window.addEventListener('scroll', perFrame(runScroll), { passive: true });
  window.addEventListener('resize', perFrame(runScroll));
  // rAF stalls in some embeds and background tabs, so scroll state also refreshes slowly by timer.
  setInterval(runScroll, 1000);
  runScroll();
})();
