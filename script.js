/* ==========================================================================
   PLAYBOOK — PROYECTO LEYENDAS
   Lógica JS del sitio (sin frameworks, vanilla JS)

   Bloques:
   A. Base            — hero, --nav-h, puntos del logo, insignias
   B. Hero paginado   — 3 capítulos navegados por scroll / teclado / swipe
   C. Scroll suave    — interpolación con inercia (solo puntero fino)
   D. Cursor          — bracket HUD con estados contextuales
   E. Menú            — preview por hover
   F. Galería         — arrastre horizontal
   G. Split text      — revelado por palabra al entrar en pantalla
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer  = window.matchMedia('(pointer: fine)').matches;

  /* ==========================================================
     A. BASE
     ========================================================== */

  var hero    = document.getElementById('hero');
  var heroBtn = document.getElementById('hero-enter');
  var heroSlides = hero ? Array.prototype.slice.call(hero.querySelectorAll('.hero-slide')) : [];
  var heroPips   = hero ? Array.prototype.slice.call(hero.querySelectorAll('.hero-pip')) : [];
  var heroIndex  = document.getElementById('hero-index');

  var heroIsOpen = !!(hero && document.body.classList.contains('intro-active'));

  /* ---- Sincroniza --nav-h con el alto REAL del menú ---- */
  var topNav = document.querySelector('.top-nav');

  function syncNavHeight() {
    if (!topNav) return;
    var h = topNav.getBoundingClientRect().height;
    root.style.setProperty('--nav-h', h + 'px');
  }
  syncNavHeight();
  window.addEventListener('resize', syncNavHeight);
  window.addEventListener('load', syncNavHeight);

  /* ---- Puntos interactivos en Construcción del Logo ---- */
  var logoConstruction = document.querySelector('.logo-construction');

  if (logoConstruction) {
    logoConstruction.addEventListener('pointermove', function (e) {
      var rect = logoConstruction.getBoundingClientRect();
      logoConstruction.style.setProperty('--dmx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
      logoConstruction.style.setProperty('--dmy', ((e.clientY - rect.top) / rect.height) * 100 + '%');
    });
  }

  /* ---- Línea inferior naranja que sigue al cursor (premios y galería) ---- */
  var lineCards = document.querySelectorAll('.experiencia-card, .gallery-item');

  lineCards.forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--ex', ((e.clientX - rect.left) / rect.width) * 100 + '%');
    });
  });

  /* ---- Liquid glass: el brillo especular de .glass-panel sigue al cursor ---- */
  var glassPanels = document.querySelectorAll('.glass-panel');

  glassPanels.forEach(function (panel) {
    panel.addEventListener('pointermove', function (e) {
      var rect = panel.getBoundingClientRect();
      panel.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width) * 100 + '%');
      panel.style.setProperty('--my', ((e.clientY - rect.top) / rect.height) * 100 + '%');
    });
    panel.addEventListener('pointerleave', function () {
      panel.style.setProperty('--mx', '50%');
      panel.style.setProperty('--my', '32%');
    });
  });

  /* ==========================================================
     INSIGNIAS / FEATURED PRODUCTS — carrusel por tarjeta
     ----------------------------------------------------------
     · En reposo cada tarjeta muestra su primera imagen, limpia.
     · Al pasar el cursor (o al enfocarla / tocarla) arranca el carrusel:
       los slides rotan cada data-interval ms (3000 por defecto) con el
       mismo barrido lineal vertical, y las flechas < > los pasan a mano.
     · Al salir el cursor, al hacer clic fuera o al perder el foco, la
       tarjeta vuelve sola a la imagen inicial.
     ========================================================== */
  var insigniaCards = Array.prototype.slice.call(document.querySelectorAll('.insignia-card'));
  var insigniaAll   = [];

  insigniaCards.forEach(function (card) {
    var stack = card.querySelector('.insignia-bg-stack');
    if (!stack) return;

    var slides = Array.prototype.slice.call(stack.querySelectorAll('.insignia-bg'));
    if (!slides.length) return;

    var prevBtn = card.querySelector('.insignia-arrow--prev');
    var nextBtn = card.querySelector('.insignia-arrow--next');

    /* Recortes: dentro / entra desde abajo / entra desde arriba */
    var IN   = 'inset(0 0 0 0)';
    var FROM_BOTTOM = 'inset(100% 0 0 0)';
    var FROM_TOP    = 'inset(0 0 100% 0)';

    /* Una imagen rota se saca del carrusel para que no deje la tarjeta en blanco */
    slides.forEach(function (img) {
      function drop() {
        img.setAttribute('data-broken', '1');
        var i = slides.indexOf(img);
        if (i > 0) { slides.splice(i, 1); sync(); }
      }
      img.addEventListener('error', drop);
      if (img.complete && img.naturalWidth === 0) drop();
    });

    var index = 0;      // slide visible ahora mismo
    var zTop  = 3;      // el slide entrante siempre queda por encima
    var timer = null;
    var backTimer = null;
    var live = false;

    var interval = parseInt(card.getAttribute('data-interval'), 10);
    if (!isFinite(interval) || interval < 1200) interval = 3000;

    function sync() {
      card.classList.toggle('is-single', slides.length < 2);
    }

    /* Coloca un slide sin animar (para armar el punto de partida del barrido) */
    function set(img, clip) {
      img.style.transition = 'none';
      img.style.clipPath = clip;
      void img.offsetWidth;          // fuerza el reflow: corta la transición
      img.style.transition = '';
    }

    /* Vuelve la pila al estado inicial, sin movimiento */
    function reset() {
      index = 0;
      zTop = 3;
      slides.forEach(function (img, i) {
        img.style.zIndex = i === 0 ? '2' : '1';
        set(img, i === 0 ? IN : FROM_BOTTOM);
      });
    }

    /* dir > 0 : el slide entra subiendo   ·   dir < 0 : entra bajando */
    function go(next, dir) {
      if (slides.length < 2) return;
      var total = slides.length;
      next = ((next % total) + total) % total;
      if (next === index) return;

      var img = slides[next];
      set(img, dir < 0 ? FROM_TOP : FROM_BOTTOM);
      img.style.zIndex = String(++zTop);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { img.style.clipPath = IN; });
      });

      index = next;
    }

    function play() {
      stop();
      if (slides.length < 2 || reduceMotion) return;
      timer = window.setInterval(function () { go(index + 1, 1); }, interval);
    }
    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }

    function activate() {
      if (backTimer) { window.clearTimeout(backTimer); backTimer = null; }
      card.classList.remove('is-returning');
      if (live) return;
      live = true;
      play();
    }

    /* Al salir: la imagen inicial vuelve con el mismo barrido, un poco más
       rápido, y después la pila se rearma en silencio. */
    function deactivate() {
      if (!live) return;
      live = false;
      stop();

      if (index === 0) { reset(); return; }

      card.classList.add('is-returning');
      go(0, 1);
      backTimer = window.setTimeout(function () {
        card.classList.remove('is-returning');
        reset();
        backTimer = null;
      }, 560);
    }

    card.addEventListener('pointerenter', activate);
    card.addEventListener('pointerdown',  activate);
    card.addEventListener('focusin',      activate);
    card.addEventListener('pointerleave', deactivate);
    card.addEventListener('focusout', function (e) {
      if (!card.contains(e.relatedTarget)) deactivate();
    });

    /* Flechas: pasan el slide y reinician la cuenta de los 3 s */
    function step(dir) {
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        activate();
        go(index + dir, dir);
        play();
      };
    }
    if (prevBtn) prevBtn.addEventListener('click', step(-1));
    if (nextBtn) nextBtn.addEventListener('click', step(1));

    /* Teclado: flechas izquierda / derecha cuando la tarjeta tiene foco */
    card.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); activate(); go(index + 1, 1); play(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); activate(); go(index - 1, -1); play(); }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (live) play();
    });

    sync();
    reset();
    insigniaAll.push({ card: card, deactivate: deactivate });
  });

  /* Clic por fuera (o toque en otra parte): todas vuelven a su imagen inicial */
  if (insigniaAll.length) {
    document.addEventListener('pointerdown', function (e) {
      insigniaAll.forEach(function (item) {
        if (!item.card.contains(e.target)) item.deactivate();
      });
    }, true);
  }

  /* ==========================================================
     B. HERO PAGINADO — 3 capítulos
     El scroll dentro del hero NO mueve la página: avanza de capítulo.
     Este es el único punto del playbook con scroll-jacking.
     ========================================================== */

  var slideIndex = 0;
  var slideLock  = false;

  function setSlide(next) {
    if (!heroSlides.length) return;
    next = Math.max(0, Math.min(heroSlides.length - 1, next));
    if (next === slideIndex) return;

    slideIndex = next;

    heroSlides.forEach(function (s, i) { s.classList.toggle('is-active', i === next); });
    heroPips.forEach(function (p, i) { p.classList.toggle('is-active', i === next); });

    if (heroIndex) {
      heroIndex.innerHTML = ('0' + (next + 1)).slice(-2) + ' <span>/ 0' + heroSlides.length + '</span>';
    }
    hero.classList.toggle('is-last', next === heroSlides.length - 1);
  }

  function advanceSlide(dir) {
    if (slideLock) return;

    /* Pasado el último capítulo, seguir bajando entra al playbook */
    if (dir > 0 && slideIndex === heroSlides.length - 1) {
      enterPlaybook();
      return;
    }
    slideLock = true;
    setSlide(slideIndex + dir);
    window.setTimeout(function () { slideLock = false; }, 620);
  }

  function enterPlaybook(targetSelector) {
    if (!hero || !heroIsOpen) {
      if (targetSelector) scrollToSelector(targetSelector);
      return;
    }
    heroIsOpen = false;
    hero.classList.add('hero--exit');
    document.body.classList.remove('intro-active');

    window.setTimeout(function () {
      hero.style.display = 'none';
      syncScrollState();
      if (targetSelector) scrollToSelector(targetSelector);
    }, 750);
  }

  function reopenHero() {
    if (!hero) return;
    heroIsOpen = true;
    hero.style.display = '';
    void hero.offsetWidth; /* fuerza reflow para que la transición vuelva a jugar */
    hero.classList.remove('hero--exit');
    document.body.classList.add('intro-active');
    window.scrollTo(0, 0);
    syncScrollState();
    setSlide(0);

    var heroVideo = hero.querySelector('.hero-bg-video');
    if (heroVideo) {
      heroVideo.currentTime = 0;
      var p = heroVideo.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  if (heroBtn) {
    heroBtn.addEventListener('click', function () { enterPlaybook(); });
  }

  heroPips.forEach(function (pip) {
    pip.addEventListener('click', function () {
      setSlide(parseInt(pip.getAttribute('data-index'), 10) || 0);
    });
  });

  heroSlides.forEach(function (slide) {
    var cta = slide.querySelector('.hero-slide-cta');
    if (!cta) return;
    cta.addEventListener('click', function () {
      enterPlaybook(slide.getAttribute('data-target'));
    });
  });

  /* Teclado: flechas y Escape */
  document.addEventListener('keydown', function (e) {
    if (!heroIsOpen) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); advanceSlide(1); }
    if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); advanceSlide(-1); }
    if (e.key === 'Escape') enterPlaybook();
  });

  /* Swipe vertical en táctil */
  (function heroTouch() {
    if (!hero) return;
    var startY = 0;

    hero.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
    }, { passive: true });

    hero.addEventListener('touchend', function (e) {
      if (!heroIsOpen) return;
      var dy = startY - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 45) advanceSlide(dy > 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* Logo del menú: vuelve a la intro */
  var logoHomeLink = document.querySelector('.top-nav a[href="#hero"]');

  if (logoHomeLink && hero) {
    logoHomeLink.addEventListener('click', function (e) {
      e.preventDefault();
      reopenHero();
    });
  }

  /* ==========================================================
     C. SCROLL SUAVE CON INERCIA
     Se interpola window.scrollY, no se transforma un contenedor:
     así siguen funcionando position:fixed, los anchors y las
     scroll-driven animations del CSS.
     ========================================================== */

  var SMOOTH = finePointer && !reduceMotion;
  var EASE   = 0.11;   /* 0.06 = muy pesado · 0.2 = casi nativo */

  var target = window.scrollY;
  var current = window.scrollY;
  var running = false;
  var programmatic = false;

  if (SMOOTH) root.classList.add('js-smooth');

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function syncScrollState() {
    current = target = window.scrollY;
  }

  function loop() {
    var diff = target - current;

    if (Math.abs(diff) < 0.35) {
      current = target;
      running = false;
      programmatic = true;
      window.scrollTo(0, Math.round(current));
      programmatic = false;
      return;
    }
    current += diff * EASE;
    programmatic = true;
    window.scrollTo(0, Math.round(current));
    programmatic = false;
    window.requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    window.requestAnimationFrame(loop);
  }

  function scrollToY(y) {
    if (!SMOOTH) { window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
    target = Math.max(0, Math.min(maxScroll(), y));
    start();
  }

  function scrollToSelector(selector) {
    if (!selector) return;
    var el = document.querySelector(selector);
    if (!el) return;
    var navH = parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 0;
    scrollToY(el.getBoundingClientRect().top + window.scrollY - navH - 8);
  }

  if (SMOOTH) {
    window.addEventListener('wheel', function (e) {
      /* En la intro el scroll pagina capítulos */
      if (heroIsOpen) {
        e.preventDefault();
        if (Math.abs(e.deltaY) > 12) advanceSlide(e.deltaY > 0 ? 1 : -1);
        return;
      }
      /* Zonas con scroll propio (galería, menús) conservan el comportamiento nativo */
      if (e.target.closest && e.target.closest('[data-native-scroll]')) return;

      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaY;
      target = Math.max(0, Math.min(maxScroll(), target + delta));
      start();
    }, { passive: false });

    /* Si el scroll lo mueve otra cosa (barra, teclado, táctil), resincronizamos */
    window.addEventListener('scroll', function () {
      if (!programmatic && !running) syncScrollState();
    }, { passive: true });

    window.addEventListener('resize', syncScrollState);
  } else if (hero) {
    /* Sin smooth-scroll (táctil o reduced-motion) el hero sigue paginando por rueda */
    window.addEventListener('wheel', function (e) {
      if (!heroIsOpen) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 12) advanceSlide(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  }

  /* Anchors internos: con inercia, sin salto brusco y respetando el alto del menú */
  document.addEventListener('click', function (e) {
    var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!link || e.defaultPrevented) return;

    var href = link.getAttribute('href');
    if (!href || href === '#' || href === '#hero') return;

    var dest = document.querySelector(href);
    if (!dest) return;

    e.preventDefault();

    /* Si la intro está abierta, primero se entra y luego se navega */
    if (heroIsOpen) { enterPlaybook(href); return; }
    scrollToSelector(href);

    /* Cierra el menú flotante móvil si estaba abierto */
    var toggle = document.getElementById('nav-toggle');
    if (toggle) toggle.checked = false;
  });

  /* ==========================================================
     D. CURSOR CONTEXTUAL
     Cualquier elemento con data-cursor="Texto" cambia la etiqueta.
     ========================================================== */

  (function customCursor() {
    var cursor = document.getElementById('cursor');
    if (!cursor || !finePointer) return;

    var label = cursor.querySelector('.cursor-label');
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var tx = cx, ty = cy;

    root.classList.add('js-cursor');

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;

      if (!e.target.closest) return;

      /* Zona con etiqueta explícita: data-cursor="Arrastrar" / "Revelar" / ... */
      var zone = e.target.closest('[data-cursor]');
      if (zone) {
        label.textContent = zone.getAttribute('data-cursor');
        cursor.classList.add('is-label');
      } else {
        cursor.classList.remove('is-label');
      }

      /* Mano cerrada en reposo sobre lo que se arrastra */
      var grabbable = e.target.closest('[data-marquee], .gallery-track, [data-cursor="Arrastrar"]');
      cursor.classList.toggle('is-grab', !!grabbable);

      /* Índice extendido sobre cualquier cosa clickeable o con pop-up */
      var hot = e.target.closest('a, button, label, [data-pop], .insignia-card, .insignia-arrow, .hero-pip, .footer-brand');
      cursor.classList.toggle('is-hot', !!hot && !grabbable);
    }, { passive: true });

    window.addEventListener('pointerdown', function () { cursor.classList.add('is-down'); });
    window.addEventListener('pointerup',   function () { cursor.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function () { cursor.style.opacity = '0'; });
    document.addEventListener('mouseenter', function () { cursor.style.opacity = ''; });

    /* ---- Inclinación según la dirección del movimiento ----
       La mano pivota sobre la punta del dedo (transform-origin en el CSS).
       El giro se calcula con la velocidad del cursor y vuelve al reposo con
       un resorte apenas sub-amortiguado: eso produce el rebotecito final.
       Sube TILT_MAX o TILT_GAIN si lo quieres más marcado. */
    var TILT_MAX  = 11;    /* grados máximos de giro */
    var TILT_GAIN = 0.55;  /* cuánto pesa la velocidad horizontal */
    var STIFF     = 0.14;  /* resorte: más alto = vuelve más rápido */
    var DAMP      = 0.80;  /* amortiguación: más bajo = más rebote */

    var tilt = 0, tiltVel = 0;
    var prevX = cx, prevY = cy;

    (function render() {
      var k = reduceMotion ? 1 : 0.2;
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';

      if (!reduceMotion) {
        var vx = cx - prevX;
        var vy = cy - prevY;
        prevX = cx; prevY = cy;

        var target = (vx * TILT_GAIN) + (vy * 0.12);
        if (target >  TILT_MAX) target =  TILT_MAX;
        if (target < -TILT_MAX) target = -TILT_MAX;

        tiltVel += (target - tilt) * STIFF;
        tiltVel *= DAMP;
        tilt    += tiltVel;

        cursor.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      }

      window.requestAnimationFrame(render);
    })();
  })();

  /* ==========================================================
     D-bis. CARRUSEL DE COMUNIDAD
     Flechas laterales: recorren los textos (.comunidad-text) y actualizan
     el nombre, la descripción y el enlace del bloque de la izquierda.
     La imagen de la sección es una sola y no cambia.
     ========================================================== */

  (function comunidadCarousel() {
    var carousels = Array.prototype.slice.call(document.querySelectorAll('[data-comunidad-carousel]'));
    if (!carousels.length) return;

    /* Cada seccion .comunidad lleva su propio carrusel: los textos se buscan
       dentro de la misma seccion, nunca en todo el documento. */
    carousels.forEach(initComunidadCarousel);

    function initComunidadCarousel(carousel) {
    var scope = carousel.closest('.comunidad') || document;

    /* La imagen es fija: hay una sola .comunidad-slide por seccion.
       Los pasos del carrusel son los .comunidad-text (solo texto). Si alguna
       seccion todavia tiene varias imagenes, se usan esas como pasos. */
    var imageSlides = Array.prototype.slice.call(carousel.querySelectorAll('.comunidad-slide'));
    var textSlides  = Array.prototype.slice.call(carousel.querySelectorAll('.comunidad-text'));
    var slides = textSlides.length ? textSlides : imageSlides;
    if (slides.length < 2) return;

    var nameEl = scope.querySelector('[data-com-name]');
    var descEl = scope.querySelector('[data-com-desc]');
    var linkEl = scope.querySelector('[data-com-link]');
    var curEl  = scope.querySelector('[data-com-current]');
    var totEl  = scope.querySelector('[data-com-total]');
    var prevBtn = carousel.querySelector('[data-com-prev]');
    var nextBtn = carousel.querySelector('[data-com-next]');

    var index = 0;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    if (totEl) totEl.textContent = pad(slides.length);

    function go(next) {
      index = ((next % slides.length) + slides.length) % slides.length;
      var slide = slides[index];

      /* Solo se cruzan imagenes cuando de verdad hay mas de una */
      if (imageSlides.length > 1) {
        imageSlides.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
      }

      /* El texto cambia con un fundido corto para que no salte */
      var copy = scope.querySelector('.comunidad-copy');
      if (copy) {
        copy.classList.add('is-swapping');
        window.setTimeout(function () { copy.classList.remove('is-swapping'); }, 260);
      }

      window.setTimeout(function () {
        if (nameEl) nameEl.textContent = slide.getAttribute('data-name') || '';
        if (descEl) descEl.textContent = slide.getAttribute('data-desc') || '';
        if (linkEl && slide.getAttribute('data-link')) linkEl.href = slide.getAttribute('data-link');
        if (curEl)  curEl.textContent = pad(index + 1);
      }, 130);
    }

    /* ---- Rotación automática cada 3 s ----
       Se frena con el cursor encima, con foco dentro, cuando la sección no
       está en pantalla, con la pestaña oculta, y unos segundos después de
       una interacción manual (flechas, teclado o swipe). */
    var AUTO_MS = parseInt(carousel.getAttribute('data-interval'), 10);
    if (!isFinite(AUTO_MS) || AUTO_MS < 1200) AUTO_MS = 3000;

    var hovering  = false;
    var visible   = true;
    var holdUntil = 0;
    var timer     = null;

    function tick() {
      if (!hovering && visible && Date.now() >= holdUntil) go(index + 1);
    }
    function play() {
      if (timer || reduceMotion) return;
      timer = window.setInterval(tick, AUTO_MS);
    }
    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    }
    /* Tras un gesto manual, la rotación espera antes de retomar */
    function hold() { holdUntil = Date.now() + AUTO_MS * 2; }

    carousel.addEventListener('pointerenter', function () { hovering = true; });
    carousel.addEventListener('pointerleave', function () { hovering = false; });
    carousel.addEventListener('focusin',  function () { hovering = true; });
    carousel.addEventListener('focusout', function () { hovering = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) play(); else stop();
      }, { threshold: 0.15 }).observe(carousel);
    } else {
      play();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else play();
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { hold(); go(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { hold(); go(index + 1); });

    /* Flechas del teclado cuando el carrusel tiene el foco o el cursor encima */
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); hold(); go(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); hold(); go(index + 1); }
    });

    /* Swipe en móvil */
    var sx = 0, sy = 0;
    carousel.addEventListener('touchstart', function (e) {
      sx = e.changedTouches[0].clientX;
      sy = e.changedTouches[0].clientY;
    }, { passive: true });
    carousel.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) { hold(); go(index + (dx < 0 ? 1 : -1)); }
    }, { passive: true });

    go(0);
    play();
    }
  })();

  /* ==========================================================
     E. MENÚ — PREVIEW POR HOVER
     Los links con data-preview muestran una miniatura que sigue
     al cursor. Si la imagen no carga, el link queda como estaba.
     ========================================================== */

  (function navPreview() {
    var box = document.getElementById('nav-preview');
    if (!box || !finePointer) return;

    var links = document.querySelectorAll('.top-nav-links a[data-preview]');
    if (!links.length) { box.remove(); return; }

    var imgs = {};

    links.forEach(function (link) {
      var src = link.getAttribute('data-preview');
      if (imgs[src]) return;

      var img = new Image();
      img.alt = '';
      img.onerror = function () {
        img.remove();
        delete imgs[src];
        link.removeAttribute('data-preview');
      };
      img.src = src;
      box.appendChild(img);
      imgs[src] = img;
    });

    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () {
        var src = link.getAttribute('data-preview');
        if (!src || !imgs[src]) return;

        var rect = link.getBoundingClientRect();
        box.style.setProperty('--px', (rect.left + rect.width / 2) + 'px');
        box.setAttribute('data-label', link.textContent.trim());

        Object.keys(imgs).forEach(function (key) {
          imgs[key].classList.toggle('is-on', key === src);
        });
        box.classList.add('is-on');
      });

      link.addEventListener('pointerleave', function () {
        box.classList.remove('is-on');
      });
    });
  })();

  /* ==========================================================
     F. GALERÍA — ARRASTRE HORIZONTAL
     Sin JS la tira sigue funcionando: overflow-x + scroll-snap.
     ========================================================== */

  (function galleryDrag() {
    var track = document.getElementById('gallery-track');
    if (!track) return;

    var counter = document.getElementById('gallery-current');
    var items = Array.prototype.slice.call(track.querySelectorAll('.gallery-item'));
    var down = false, moved = false, startX = 0, startLeft = 0;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });

    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        track.classList.add('is-dragging');
        try { track.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (moved) track.scrollLeft = startLeft - dx;
    });

    function release() {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('pointerleave', release);

    /* La rueda vertical NO se secuestra aquí: sobre la galería, la página sigue bajando.
       El recorrido horizontal se hace arrastrando, con trackpad o con Shift + rueda. */
    track.addEventListener('wheel', function (e) {
      if (!e.shiftKey) return;
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }, { passive: false });

    /* Contador: qué pieza está al frente */
    track.addEventListener('scroll', function () {
      if (!counter || !items.length) return;
      var trackLeft = track.getBoundingClientRect().left;
      var best = 0, bestDist = Infinity;

      items.forEach(function (item, i) {
        var d = Math.abs(item.getBoundingClientRect().left - trackLeft);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      counter.textContent = ('0' + (best + 1)).slice(-2);
    }, { passive: true });
  })();

  /* ==========================================================
     G. SPLIT TEXT — revelado por palabra
     Solo sobre nodos de texto: los <br> y <em> se conservan.
     ========================================================== */

  (function splitText() {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-split]'));
    if (!targets.length) return;

    if (reduceMotion) {
      targets.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    targets.forEach(function (el) {
      var i = 0;

      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType !== 3 || !node.textContent.trim()) return;

        var frag = document.createDocumentFragment();

        node.textContent.split(/(\s+)/).forEach(function (chunk) {
          if (!chunk.trim()) { frag.appendChild(document.createTextNode(chunk)); return; }

          var line = document.createElement('span');
          line.className = 'split-line';

          var word = document.createElement('span');
          word.className = 'split-word';
          word.style.setProperty('--i', i++);
          word.textContent = chunk;

          line.appendChild(word);
          frag.appendChild(line);
        });

        node.parentNode.replaceChild(frag, node);
      });
    });

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.25 });

    targets.forEach(function (el) { io.observe(el); });
  })();

  /* ==========================================================
     H. CARRUSELES DE MOVIMIENTO CONTINUO (MARQUEE)
     La cinta no "salta": se clona el contenido las veces que
     haga falta y el desplazamiento se envuelve con módulo, así
     el bucle es invisible. Hover frena, arrastre mueve a mano.
     ========================================================== */

  (function marquees() {
    var roots = Array.prototype.slice.call(document.querySelectorAll('[data-marquee]'));
    if (!roots.length) return;

    roots.forEach(function (root) {
      var track = root.querySelector('[data-marquee-track]');
      if (!track) return;

      var speed = parseFloat(root.getAttribute('data-speed')) || 40;   /* px por segundo */
      var dir   = parseFloat(root.getAttribute('data-direction')) || 1; /* 1 = izquierda, -1 = derecha */

      var originals = Array.prototype.slice.call(track.children);
      if (!originals.length) return;

      var setSize  = originals.length;
      var baseWidth = 0;
      var offset = 0;
      var vel = 0;              /* velocidad actual, interpolada hacia la deseada */
      var dragging = false, moved = false, lastX = 0, lastT = 0, throwVel = 0;
      var hovering = false;

      /* --- Clonado: al menos el doble del ancho visible, con tope de seguridad --- */
      function fill() {
        var guard = 0;
        while (track.scrollWidth < root.clientWidth * 2 + 200 && guard < 8) {
          originals.forEach(function (node) { track.appendChild(node.cloneNode(true)); });
          guard++;
        }
        /* Una copia extra garantiza que siempre haya material entrando por el borde */
        originals.forEach(function (node) { track.appendChild(node.cloneNode(true)); });
        measure();
      }

      function measure() {
        var kids = track.children;
        if (kids.length > setSize) {
          baseWidth = kids[setSize].offsetLeft - kids[0].offsetLeft;
        }
        if (!baseWidth || baseWidth < 10) baseWidth = track.scrollWidth / 2;
      }

      fill();
      window.addEventListener('resize', measure);
      window.addEventListener('load', measure);

      /* --- Hover: la cinta frena en lugar de cortarse en seco --- */
      root.addEventListener('pointerenter', function () { hovering = true;  root.classList.add('is-paused'); });
      root.addEventListener('pointerleave', function () { hovering = false; root.classList.remove('is-paused'); });

      /* --- Arrastre para recorrerla a mano --- */
      root.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true; moved = false;
        lastX = e.clientX; lastT = e.timeStamp || performance.now();
        throwVel = 0;
        track.classList.add('is-dragging');
        try { root.setPointerCapture(e.pointerId); } catch (err) {}
      });

      root.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX;
        var now = e.timeStamp || performance.now();
        var dt = Math.max(1, now - lastT);

        if (!moved && Math.abs(dx) > 3) moved = true;
        offset -= dx;
        throwVel = -dx / dt * 1000;   /* px/s para la inercia posterior */
        lastX = e.clientX; lastT = now;
        apply();
      });

      function release() {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        /* La inercia del arrastre se hereda y se disuelve sola en el bucle */
        vel = Math.max(-2200, Math.min(2200, throwVel));
      }
      root.addEventListener('pointerup', release);
      root.addEventListener('pointercancel', release);

      /* Un arrastre no debe disparar el link que hay debajo */
      root.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);

      function apply() {
        if (baseWidth > 0) offset = ((offset % baseWidth) + baseWidth) % baseWidth;
        track.style.transform = 'translate3d(' + (-offset) + 'px,0,0)';
      }

      /* --- Bucle --- */
      var prev = performance.now();

      function tick(now) {
        var dt = Math.min(64, now - prev) / 1000;
        prev = now;

        if (!reduceMotion && !dragging) {
          var wanted = hovering ? 0 : speed * dir;
          /* Interpolación: frenar y arrancar son transiciones, no interruptores */
          vel += (wanted - vel) * Math.min(1, dt * 3.4);
          offset += vel * dt;
          apply();
        }
        window.requestAnimationFrame(tick);
      }

      if (!reduceMotion) window.requestAnimationFrame(tick);
      else apply();

      /* Contador de la cinta de premios: qué pieza está al centro */
      var counter = document.getElementById('premios-count');
      if (counter && root.classList.contains('marquee--media')) {
        window.setInterval(function () {
          var mid = root.getBoundingClientRect().left + root.clientWidth / 2;
          var best = 0, bestDist = Infinity;
          Array.prototype.slice.call(track.children).forEach(function (item, i) {
            var r = item.getBoundingClientRect();
            var d = Math.abs(r.left + r.width / 2 - mid);
            if (d < bestDist) { bestDist = d; best = i % setSize; }
          });
          counter.textContent = ('0' + (best + 1)).slice(-2);
        }, 220);
      }
    });
  })();

  /* ==========================================================
     I. POP-UPS SALIENTES SOBRE TEXTOS
     Los elementos con data-pop abren una ficha que persigue al
     cursor con inercia y se voltea sola si se sale de pantalla.
     ========================================================== */

  (function textPop() {
    var pop = document.getElementById('textpop');
    if (!pop || !finePointer) return;

    var targets = document.querySelectorAll('[data-pop]');
    if (!targets.length) { pop.remove(); return; }

    var eyebrow = pop.querySelector('.textpop-eyebrow');
    var text    = pop.querySelector('.textpop-text');
    var media   = pop.querySelector('.textpop-media');
    var img     = pop.querySelector('.textpop-media img');

    var open = false;
    var tx = 0, ty = 0, px = 0, py = 0, primed = false;

    targets.forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        text.textContent = el.getAttribute('data-pop') || '';
        var eb = el.getAttribute('data-pop-eyebrow');
        eyebrow.textContent = eb || 'Nota';

        var src = el.getAttribute('data-pop-img');
        if (src) {
          img.onerror = function () { pop.classList.remove('has-media'); };
          img.src = src;
          pop.classList.add('has-media');
        } else {
          pop.classList.remove('has-media');
          img.removeAttribute('src');
        }

        open = true;
        pop.classList.add('is-on');
      });

      el.addEventListener('pointerleave', function () {
        open = false;
        pop.classList.remove('is-on');
      });
    });

    window.addEventListener('pointermove', function (e) {
      var w = pop.offsetWidth  || 300;
      var h = pop.offsetHeight || 120;
      var pad = 18;

      /* Se coloca abajo-derecha del cursor y se voltea contra los bordes */
      tx = e.clientX + 22;
      ty = e.clientY + 22;
      if (tx + w + pad > window.innerWidth)  tx = e.clientX - w - 22;
      if (ty + h + pad > window.innerHeight) ty = e.clientY - h - 22;
      if (tx < pad) tx = pad;
      if (ty < pad) ty = pad;

      if (!primed) { px = tx; py = ty; primed = true; }
    }, { passive: true });

    (function render() {
      var k = reduceMotion ? 1 : 0.22;
      px += (tx - px) * k;
      py += (ty - py) * k;
      if (open || pop.classList.contains('is-on')) {
        pop.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      }
      window.requestAnimationFrame(render);
    })();
  })();

  /* Estado inicial coherente */
  if (hero && heroSlides.length === 1) {
    hero.classList.add('is-last');
  }

})();

/* ==========================================================================
   CAPA FLOTANTE / REACTIVA — bloque aditivo e independiente
   H. Parallax inverso con flotación ([data-float])
   I. Statement reactivo al mouse (.concepto-statement[data-reactive-lines])
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer  = window.matchMedia('(pointer: fine)').matches;

  var pointerX = -9999;
  var pointerY = -9999;
  var hasPointer = false;

  window.addEventListener('pointermove', function (e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
    hasPointer = true;
  }, { passive: true });

  /* ==========================================================
     H. PARALLAX INVERSO + FLOTACIÓN
     La imagen se mueve al lado CONTRARIO del cursor y, en reposo,
     deriva con una onda lenta. El zoom base garantiza que el
     recorrido nunca descubra un borde del contenedor.
     ========================================================== */
  var floaters = Array.prototype.slice.call(document.querySelectorAll('[data-float]')).map(function (el) {
    var strength = parseFloat(el.getAttribute('data-float-strength'));
    if (!isFinite(strength)) strength = 2.6;

    /* data-float-tilt = grados máximos de rotación 3D con el mouse.
       Sin el atributo (o en 0) el elemento se comporta igual que antes. */
    var tilt = parseFloat(el.getAttribute('data-float-tilt'));
    if (!isFinite(tilt)) tilt = 0;

    var scale = parseFloat(el.getAttribute('data-float-scale'));
    /* Margen de seguridad: el zoom debe cubrir el recorrido en ambos ejes.
       Con rotación 3D el borde lejano se mete hacia dentro, así que el zoom
       mínimo sube un poco por cada grado de inclinación. */
    var minScale = 1 + (strength * 2.2) / 100 + (Math.abs(tilt) * 1.4) / 100;
    if (!isFinite(scale) || scale < minScale) scale = minScale;

    el.style.setProperty('--fl-scale', scale);

    return {
      el: el,
      host: el.parentElement || el,
      strength: strength,
      tilt: tilt,
      seed: Math.random() * 1000,
      tx: 0, ty: 0,
      cx: 0, cy: 0,
      trx: 0, try_: 0,
      crx: 0, cry: 0
    };
  });

  /* ==========================================================
     I. STATEMENT REACTIVO (RUN MORE ADS)
     Cada .statement-line se desplaza según su data-depth, con una
     micro-rotación y una escala mínima. El color de la cursiva se
     "calienta" a medida que el cursor se acerca al bloque.
     ========================================================== */
  var statements = Array.prototype.slice.call(document.querySelectorAll('[data-reactive-lines]')).map(function (el) {
    var lines = Array.prototype.slice.call(el.querySelectorAll('.statement-line')).map(function (line) {
      var depth = parseFloat(line.getAttribute('data-depth'));
      if (!isFinite(depth)) depth = 1;
      return { el: line, depth: depth, cx: 0, cy: 0, cr: 0, cs: 1 };
    });

    return {
      el: el,
      zone: el.closest('section') || el.parentElement || el,
      lines: lines,
      tx: 0, ty: 0,
      heat: 0, cheat: 0
    };
  });

  if ((!floaters.length && !statements.length) || reduceMotion || !finePointer) return;

  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }

  function measure() {
    var i;

    for (i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      var r = f.host.getBoundingClientRect();

      if (!hasPointer || !r.width || !r.height || r.bottom < -200 || r.top > window.innerHeight + 200) {
        f.tx = 0; f.ty = 0;
        f.trx = 0; f.try_ = 0;
        continue;
      }

      var nx = clamp((pointerX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      var ny = clamp((pointerY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);

      /* Signo negativo = movimiento contrario al cursor */
      f.tx = -nx * f.strength;
      f.ty = -ny * f.strength;

      /* Inclinación 3D: el plano gira siguiendo al cursor */
      f.trx = ny * f.tilt;
      f.try_ = nx * f.tilt;
    }

    for (i = 0; i < statements.length; i++) {
      var s = statements[i];
      var zr = s.zone.getBoundingClientRect();

      if (!hasPointer || !zr.width || zr.bottom < 0 || zr.top > window.innerHeight) {
        s.tx = 0; s.ty = 0; s.heat = 0;
        continue;
      }

      var zx = clamp((pointerX - (zr.left + zr.width / 2)) / (zr.width / 2), -1, 1);
      var zy = clamp((pointerY - (zr.top + zr.height / 2)) / (zr.height / 2), -1, 1);

      s.tx = zx;
      s.ty = zy;

      /* Calor: 1 cuando el cursor está sobre el bloque de texto, 0 lejos */
      var br = s.el.getBoundingClientRect();
      var dx = Math.max(br.left - pointerX, 0, pointerX - br.right);
      var dy = Math.max(br.top - pointerY, 0, pointerY - br.bottom);
      var dist = Math.sqrt(dx * dx + dy * dy);
      s.heat = clamp(1 - dist / 340, 0, 1);
    }
  }

  var t = 0;

  (function render() {
    t += 0.006;
    measure();

    var i, j;

    for (i = 0; i < floaters.length; i++) {
      var f = floaters[i];
      /* Deriva en reposo: onda lenta, amplitud mínima */
      var idleX = Math.sin(t + f.seed) * (f.strength * 0.18);
      var idleY = Math.cos(t * 0.78 + f.seed) * (f.strength * 0.18);

      f.cx += ((f.tx + idleX) - f.cx) * 0.06;
      f.cy += ((f.ty + idleY) - f.cy) * 0.06;

      f.el.style.setProperty('--fl-x', f.cx.toFixed(3) + '%');
      f.el.style.setProperty('--fl-y', f.cy.toFixed(3) + '%');

      if (f.tilt) {
        /* Micro-deriva en reposo, para que nunca quede totalmente plano */
        var idleRX = Math.sin(t * 0.62 + f.seed) * (f.tilt * 0.12);
        var idleRY = Math.cos(t * 0.5 + f.seed) * (f.tilt * 0.12);

        f.crx += ((f.trx + idleRX) - f.crx) * 0.05;
        f.cry += ((f.try_ + idleRY) - f.cry) * 0.05;

        f.el.style.setProperty('--fl-rx', f.crx.toFixed(3) + 'deg');
        f.el.style.setProperty('--fl-ry', f.cry.toFixed(3) + 'deg');
      }
    }

    for (i = 0; i < statements.length; i++) {
      var s = statements[i];
      /* Antes 0.07: la interpolación del color ahora es mucho más ágil.
         Sube este valor (máx. 1) si lo querés aún más inmediato. */
      s.cheat += (s.heat - s.cheat) * 0.32;
      s.el.style.setProperty('--heat', s.cheat.toFixed(3));

      for (j = 0; j < s.lines.length; j++) {
        var ln = s.lines[j];
        var d = ln.depth;

        var targetX = s.tx * d * 7;          /* px — deriva horizontal por línea */
        var targetY = s.ty * d * 3.2;        /* px — deriva vertical, más contenida */
        var targetR = s.tx * d * 0.26;       /* deg — micro-rotación */
        var targetS = 1 + s.cheat * d * 0.006;

        ln.cx += (targetX - ln.cx) * 0.07;
        ln.cy += (targetY - ln.cy) * 0.07;
        ln.cr += (targetR - ln.cr) * 0.07;
        ln.cs += (targetS - ln.cs) * 0.07;

        ln.el.style.setProperty('--sx', ln.cx.toFixed(2) + 'px');
        ln.el.style.setProperty('--sy', ln.cy.toFixed(2) + 'px');
        ln.el.style.setProperty('--sr', ln.cr.toFixed(3) + 'deg');
        ln.el.style.setProperty('--sc', ln.cs.toFixed(4));
      }
    }

    window.requestAnimationFrame(render);
  })();

})();


/* ==========================================================================
   CAPA MERCH — bloque aditivo e independiente
   J. Ciclo de color del logo principal (7 variaciones, 2 s cada una)
   K. Logo de dropi con color aleatorio de la paleta al pasar el cursor

   El parallax inverso de la máscara en M no necesita JS propio: la capa
   recortada usa [data-float] con strength NEGATIVO, así el motor de
   parallax existente la mueve al contrario de la imagen de fondo.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Paleta: única fuente de verdad = las variables --mc-1..N del CSS ---- */
  function readPalette() {
    var cs = window.getComputedStyle(document.documentElement);
    var out = [];
    for (var i = 1; i <= 12; i++) {
      var v = cs.getPropertyValue('--mc-' + i).trim();
      if (!v) break;
      out.push(v);
    }
    return out;
  }
  var palette = readPalette();

  /* ==========================================================
     J. CICLO DE COLOR DEL LOGO PRINCIPAL
     Las variaciones se leen de los .logo-pip del HTML (data-ink /
     data-paper / data-name / data-code): agregar o quitar un pip
     cambia el ciclo sin tocar el JS.
     ========================================================== */
  var cycleHosts = Array.prototype.slice.call(document.querySelectorAll('[data-logo-cycle]'));

  cycleHosts.forEach(function (host) {
    var pips = Array.prototype.slice.call(host.querySelectorAll('.logo-pip'));
    if (!pips.length) return;

    var nameEl = host.querySelector('[data-cycle-name]');
    var codeEl = host.querySelector('[data-cycle-code]');

    var delay = parseInt(host.getAttribute('data-cycle-ms'), 10);
    if (!isFinite(delay) || delay < 200) delay = 2000;

    var index = 0;
    var timer = null;

    function paint(i) {
      index = (i + pips.length) % pips.length;
      var pip = pips[index];

      host.style.setProperty('--logo-ink',   pip.getAttribute('data-ink')   || 'currentColor');
      host.style.setProperty('--logo-paper', pip.getAttribute('data-paper') || '#151515');

      if (nameEl) nameEl.textContent = pip.getAttribute('data-name') || '';
      if (codeEl) codeEl.textContent = pip.getAttribute('data-code') || '';

      pips.forEach(function (p, n) {
        p.classList.toggle('is-active', n === index);
        p.setAttribute('aria-selected', n === index ? 'true' : 'false');
      });
    }

    function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (reduceMotion || pips.length < 2) return;
      timer = window.setInterval(function () { paint(index + 1); }, delay);
    }

    /* Clic en un pip: fija esa variación y reinicia el conteo */
    pips.forEach(function (pip, n) {
      pip.addEventListener('click', function () { paint(n); start(); });
    });

    paint(0);
    start();

    /* Fuera de pantalla el ciclo se detiene: no gasta cuadros de más */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0.05 }).observe(host);
    }

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
  });

  /* ==========================================================
     K. LOGO DE DROPI REACTIVO
     Cada vez que el cursor entra, toma un color al azar de la
     paleta (nunca repite el que ya tenía). Al salir vuelve al
     color heredado.
     ========================================================== */
  var randomMarks = Array.prototype.slice.call(document.querySelectorAll('[data-dropi-random]'));

  /* Luminancia relativa (WCAG) para descartar los tonos que quedarían
     ilegibles sobre el fondo donde vive el logo: sobre el footer claro,
     el Lino y el Rosa desaparecen. Con data-dropi-contrast="off" se
     sortean los 7 colores sin filtrar. */
  function luminance(rgb) {
    var ch = rgb.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  function toRgb(color) {
    var m = color.match(/-?\d+\.?\d*/g);
    if (color.charAt(0) === '#') {
      var hex = color.slice(1);
      if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    return m ? [+m[0], +m[1], +m[2]] : null;
  }

  function surfaceOf(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var bg = window.getComputedStyle(node).backgroundColor;
      var rgb = toRgb(bg || '');
      var alpha = (bg.match(/-?\d+\.?\d*/g) || [])[3];
      if (rgb && (alpha === undefined || parseFloat(alpha) > 0.5)) return rgb;
      node = node.parentElement;
    }
    return [255, 255, 255];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  if (palette.length) {
    randomMarks.forEach(function (mark) {
      var pool = palette;

      if (mark.getAttribute('data-dropi-contrast') !== 'off') {
        var surface = surfaceOf(mark);
        var legible = palette.filter(function (col) {
          var rgb = toRgb(col);
          return rgb && contrast(rgb, surface) >= 1.8;
        });
        if (legible.length) pool = legible;
      }

      var last = -1;

      function roll() {
        var i = Math.floor(Math.random() * pool.length);
        if (pool.length > 1 && i === last) i = (i + 1) % pool.length;
        last = i;
        mark.style.setProperty('--dropi-ink', pool[i]);
      }

      mark.addEventListener('pointerenter', roll);
      mark.addEventListener('focusin', roll);
      mark.addEventListener('pointerleave', function () {
        mark.style.removeProperty('--dropi-ink');
      });
    });
  }

})();
