(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* theme toggle */
  var tb = document.querySelector(".theme");
  function current() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function label() {
    if (!tb) return;
    var dark = current() === "dark";
    tb.setAttribute("aria-pressed", dark ? "true" : "false");
    tb.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    tb.title = tb.getAttribute("aria-label");
  }
  if (tb) {
    label();
    tb.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
    });
  }

  /* rotating "I build ___" on the home page */
  var rot = document.querySelector("[data-rot]");
  if (rot && !reduce) {
    var items = rot.querySelectorAll("a");
    if (items.length > 1) {
      var i = 0, paused = false;
      rot.classList.add("rot");
      var show = function (n) {
        for (var k = 0; k < items.length; k++) {
          var on = k === n;
          items[k].classList.toggle("on", on);
          items[k].tabIndex = on ? 0 : -1;
          items[k].setAttribute("aria-hidden", on ? "false" : "true");
        }
      };
      show(0);
      ["mouseenter", "focusin"].forEach(function (ev) { rot.addEventListener(ev, function () { paused = true; }); });
      ["mouseleave", "focusout"].forEach(function (ev) { rot.addEventListener(ev, function () { paused = false; }); });
      setInterval(function () {
        if (paused || document.hidden) return;
        i = (i + 1) % items.length;
        show(i);
      }, 2600);
    }
  }

  /* sideways timeline: drag, wheel, year jumps, thread filter and the hover preview */
  Array.prototype.forEach.call(document.querySelectorAll("[data-hz]"), function (hz) {
    var view = hz.querySelector(".hz-view"), pop = hz.querySelector(".hz-pop");
    if (!view || !pop) return;
    var nodes = Array.prototype.slice.call(hz.querySelectorAll(".hz-n, .hz-e"));
    var canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
    var smooth = reduce ? "auto" : "smooth";
    var scale = function () { return parseFloat(getComputedStyle(hz).getPropertyValue("--k")) || 1; };
    /* timeline page: on a short window, scale the wave down a little so its whole height is on screen */
    if (hz.hasAttribute("data-wheel")) {
      var track = hz.querySelector(".hz-track");
      var fit = function () {
        if (window.innerWidth <= 700) { hz.style.removeProperty("--k"); return; }
        var top = view.getBoundingClientRect().top + window.pageYOffset;
        var full = parseFloat(getComputedStyle(track).getPropertyValue("--H")) || 556;
        var k = Math.max(0.74, Math.min(1, (window.innerHeight - top - 24) / full));
        hz.style.setProperty("--k", k.toFixed(3));
      };
      fit();
      window.addEventListener("resize", fit);
      window.addEventListener("load", fit);
    }
    if (hz.getAttribute("data-start") === "end") view.scrollLeft = view.scrollWidth;

    Array.prototype.forEach.call(hz.querySelectorAll("[data-go]"), function (b) {
      b.addEventListener("click", function () {
        view.scrollBy({ left: Number(b.getAttribute("data-go")) * view.clientWidth * 0.7, behavior: smooth });
      });
    });
    Array.prototype.forEach.call(hz.querySelectorAll("[data-x]"), function (b) {
      b.addEventListener("click", function () {
        view.scrollTo({ left: Math.max(0, Number(b.getAttribute("data-x")) * scale() - 24), behavior: smooth });
      });
    });

    /* thread filter (timeline page): dim what is outside the thread, keep every position */
    var btns = Array.prototype.slice.call(hz.querySelectorAll(".filters button"));
    var applyFilter = function (f) {
      nodes.forEach(function (n) { n.classList.toggle("dim", f !== "all" && n.getAttribute("data-thread") !== f); });
      btns.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-f") === f ? "true" : "false"); });
    };
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var f = b.getAttribute("data-f");
        applyFilter(f);
        try { history.replaceState(null, "", f === "all" ? location.pathname : "#" + f); } catch (e) {}
      });
    });
    if (btns.length) {
      var h = (location.hash || "").replace("#", "");
      if (h && h !== "all" && btns.some(function (b) { return b.getAttribute("data-f") === h; })) applyFilter(h);
    }

    /* preview card */
    var cur = null, tShow = 0, tHide = 0;
    var media = pop.querySelector(".hz-pm"), pimg = media.querySelector("img"), pdraw = media.querySelector(".hz-pdraw");
    var vid = media.querySelector("video"), open = pop.querySelector(".hz-po");
    var pmeta = pop.querySelector(".meta"), pdate = pmeta.querySelector(".dim"), pchip = pmeta.querySelector(".chip");
    var ptitle = pop.querySelector("h3"), ptext = pop.querySelector(".hz-pc");
    vid.addEventListener("ended", function () {
      vid.currentTime = 0;
      var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {});
    });
    var stopVideo = function () {
      try { vid.pause(); } catch (e) {}
      if (vid.getAttribute("src")) { vid.removeAttribute("src"); try { vid.load(); } catch (e) {} }
      vid.hidden = true;
    };
    var hide = function () {
      clearTimeout(tShow); clearTimeout(tHide);
      if (!cur) return;
      cur = null; pop.classList.remove("on"); pop.hidden = true; stopVideo();
    };
    var place = function (n) {
      var hr = hz.getBoundingClientRect(), vr = view.getBoundingClientRect(), nr = n.getBoundingClientRect();
      var w = pop.offsetWidth, hh = pop.offsetHeight;
      var left = nr.left + nr.width / 2 - hr.left - w / 2;
      left = Math.max(12, Math.min(left, hr.width - w - 12));
      var top = n.classList.contains("up") ? nr.top - hr.top - 10 : nr.bottom - hr.top + 10 - hh;
      top = Math.max(vr.top - hr.top + 8, Math.min(top, vr.bottom - hr.top - hh - 8));
      pop.style.left = left + "px"; pop.style.top = top + "px";
    };
    var show = function (n) {
      clearTimeout(tShow); clearTimeout(tHide);
      if (cur === n) return;
      stopVideo();
      cur = n;
      var isEvent = n.classList.contains("hz-e"), href = n.getAttribute("href");
      var v = n.getAttribute("data-v"), p = n.getAttribute("data-p"), drawn = n.querySelector(".hz-th svg");
      media.hidden = isEvent;
      pimg.hidden = true; pdraw.hidden = true; pdraw.textContent = "";
      if (!isEvent) {
        media.setAttribute("href", href);
        if (p) { pimg.src = p; pimg.hidden = false; }
        else if (drawn) { pdraw.appendChild(drawn.cloneNode(true)); pdraw.hidden = false; }
        if (v) {
          vid.poster = p || ""; vid.src = v; vid.hidden = false;
          var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {});
        }
      }
      var hook = n.getAttribute("data-h");
      pdate.textContent = isEvent || !hook ? (n.getAttribute("data-d") || "") : (n.getAttribute("data-t") || "") + " · " + (n.getAttribute("data-d") || "");
      pchip.hidden = isEvent;
      if (!isEvent) { pchip.textContent = n.getAttribute("data-th") || ""; pchip.setAttribute("data-thread", n.getAttribute("data-thread")); }
      ptitle.textContent = (!isEvent && hook) || n.getAttribute("data-t") || "";
      ptext.textContent = n.getAttribute("data-c") || "";
      open.hidden = !href;
      if (href) { open.setAttribute("href", href); open.textContent = (isEvent ? n.getAttribute("data-go") : "Open the page") + " "; }
      pop.classList.remove("on");
      pop.hidden = false;
      place(n);
      if (reduce) pop.classList.add("on");
      else requestAnimationFrame(function () { if (cur === n) pop.classList.add("on"); });
    };
    nodes.forEach(function (n) {
      n.addEventListener("mouseenter", function () {
        if (!canHover || drag) return;
        clearTimeout(tHide); clearTimeout(tShow);
        tShow = setTimeout(function () { show(n); }, cur ? 80 : 180);
      });
      n.addEventListener("mouseleave", function (e) {
        clearTimeout(tShow);
        if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
        tHide = setTimeout(hide, 140);
      });
      n.addEventListener("focus", function () { if (n.matches(":focus-visible")) show(n); });
      n.addEventListener("blur", function () { tHide = setTimeout(hide, 120); });
      n.addEventListener("click", function (e) {
        if (canHover || cur === n) return;
        e.preventDefault(); show(n);
      });
    });
    pop.addEventListener("mouseenter", function () { clearTimeout(tHide); });
    pop.addEventListener("mouseleave", function (e) {
      if (cur && e.relatedTarget && cur.contains(e.relatedTarget)) return;
      tHide = setTimeout(hide, 140);
    });
    view.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("click", function (e) { if (cur && !hz.contains(e.target)) hide(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    window.addEventListener("resize", hide);

    /* eased sideways motion: the wheel and drag inertia both move the view from here */
    var target = view.scrollLeft, raf = 0, coast = 0, vel = 0;
    var maxLeft = function () { return Math.max(0, view.scrollWidth - view.clientWidth); };
    var stopMotion = function () {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (coast) { cancelAnimationFrame(coast); coast = 0; }
      target = view.scrollLeft;
    };
    var ease = function () {
      var diff = target - view.scrollLeft;
      if (Math.abs(diff) < 0.5) { view.scrollLeft = target; raf = 0; return; }
      var step = diff * 0.2;
      if (Math.abs(step) < 1) step = diff > 0 ? Math.min(1, diff) : Math.max(-1, diff);
      view.scrollLeft += step;
      raf = requestAnimationFrame(ease);
    };
    view.addEventListener("scroll", function () { if (!raf && !coast) target = view.scrollLeft; }, { passive: true });
    view.addEventListener("touchstart", stopMotion, { passive: true });

    /* the wheel moves the timeline sideways (timeline page only), until it reaches an end */
    if (hz.hasAttribute("data-wheel")) {
      hz.addEventListener("wheel", function (e) {
        if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        var d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? view.clientHeight : 1);
        var max = maxLeft();
        if (coast) { cancelAnimationFrame(coast); coast = 0; }
        if (!raf) target = view.scrollLeft;
        if ((d < 0 && target <= 0) || (d > 0 && target >= max - 1)) return;
        e.preventDefault();
        if (reduce) { view.scrollLeft += d; target = view.scrollLeft; return; }
        target = Math.max(0, Math.min(max, target + d));
        if (!raf) raf = requestAnimationFrame(ease);
      }, { passive: false });
    }

    /* drag to pan with the mouse, with a little inertia on release */
    var drag = null, moved = false, samples = [];
    var glide = function () {
      view.scrollLeft += vel;
      vel *= 0.94;
      var at = view.scrollLeft;
      if (Math.abs(vel) < 0.3 || at <= 0 || at >= maxLeft() - 1) { coast = 0; target = view.scrollLeft; return; }
      coast = requestAnimationFrame(glide);
    };
    view.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      stopMotion();
      drag = { x: e.clientX, s: view.scrollLeft }; moved = false;
      samples = [{ x: e.clientX, t: performance.now() }];
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) { moved = true; view.classList.add("drag"); hide(); }
      view.scrollLeft = drag.s - dx;
      var now = performance.now();
      samples.push({ x: e.clientX, t: now });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
    });
    window.addEventListener("pointerup", function () {
      if (!drag) return;
      var wasMoved = moved;
      drag = null; view.classList.remove("drag");
      setTimeout(function () { moved = false; }, 0);
      if (!wasMoved || reduce || samples.length < 2) return;
      var first = samples[0], last = samples[samples.length - 1];
      var dt = last.t - first.t;
      if (dt <= 0 || performance.now() - last.t > 80) return;
      vel = -((last.x - first.x) / dt) * 16.7;
      if (Math.abs(vel) >= 0.3) coast = requestAnimationFrame(glide);
    });
    view.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    view.addEventListener("dragstart", function (e) { e.preventDefault(); });
  });

  /* home page feature cards: a short clip plays on hover, the thumbnail returns afterwards */
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".feat[data-v]"), function (card) {
      var v = card.querySelector("video");
      if (!v) return;
      v.addEventListener("ended", function () {
        v.currentTime = 0;
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      });
      var start = function () {
        v.src = card.getAttribute("data-v");
        card.classList.add("on");
        var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      };
      var stop = function () {
        try { v.pause(); } catch (e) {}
        card.classList.remove("on");
        if (v.getAttribute("src")) { v.removeAttribute("src"); try { v.load(); } catch (e) {} }
      };
      card.addEventListener("mouseenter", start);
      card.addEventListener("focusin", start);
      card.addEventListener("mouseleave", stop);
      card.addEventListener("focusout", stop);
    });
  }

  /* BibTeX: show and copy */
  Array.prototype.forEach.call(document.querySelectorAll("[data-bib]"), function (b) {
    b.addEventListener("click", function () {
      var pre = document.getElementById(b.getAttribute("data-bib"));
      if (!pre) return;
      pre.hidden = false;
      var done = function () { var t = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = t; }, 1400); };
      var select = function () {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pre.textContent).then(done, select);
      } else { select(); }
    });
  });
})();
