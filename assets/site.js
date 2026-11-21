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

  /* sideways timeline. The section is as tall as the timeline is wide; while it is pinned in view, the page's
     ordinary vertical scroll moves the timeline sideways, so there is no separate scrollbar to find. */
  Array.prototype.forEach.call(document.querySelectorAll("[data-hz]"), function (hz) {
    var stick = hz.querySelector(".hz-stick"), view = hz.querySelector(".hz-view"), track = hz.querySelector(".hz-track");
    var pop = hz.querySelector(".hz-pop");
    if (!stick || !view || !track || !pop) return;
    var nodes = Array.prototype.slice.call(hz.querySelectorAll(".hz-n, .hz-e"));
    var jumps = Array.prototype.slice.call(hz.querySelectorAll("[data-x]"));
    var canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
    var W = 0, H = 0, k = 1, lead = 0, shift = 0, cur = 0, raf = 0;

    var layout = function () {
      W = parseFloat(getComputedStyle(track).getPropertyValue("--W")) || 0;
      H = parseFloat(getComputedStyle(track).getPropertyValue("--H")) || 400;
      hz.style.height = "";
      /* scale the drawing so the pinned view fits the window height */
      var head = stick.querySelector(".hz-head");
      var avail = stick.clientHeight - (head ? head.offsetHeight : 0) - 24;
      k = Math.max(0.55, Math.min(window.innerWidth < 700 ? 0.82 : 1, avail / H));
      hz.style.setProperty("--k", k.toFixed(3));
      lead = parseFloat(getComputedStyle(track).marginLeft) || 0;
      shift = Math.max(0, W * k + lead * 2 - view.clientWidth);
      hz.style.height = (stick.offsetHeight + shift) + "px";
      tick(true);
    };
    var progress = function () {
      return Math.max(0, Math.min(shift, -hz.getBoundingClientRect().top));
    };
    var apply = function () { track.style.transform = "translate3d(" + (-cur).toFixed(1) + "px,0,0)"; };
    var tick = function (now) {
      var target = progress();
      if (now || reduce) { cur = target; apply(); markYear(); return; }
      if (!raf) raf = requestAnimationFrame(step);
    };
    /* a little easing on top of the scroll, so wheel steps glide instead of jump */
    var step = function () {
      var target = progress(), d = target - cur;
      if (Math.abs(d) < 0.4) { cur = target; raf = 0; apply(); markYear(); return; }
      cur += d * 0.22;
      apply();
      raf = requestAnimationFrame(step);
    };
    var markYear = function () {
      var x = (cur + view.clientWidth * 0.35) / k - lead / k, on = null;
      jumps.forEach(function (b) { if (Number(b.getAttribute("data-x")) <= x) on = b; });
      jumps.forEach(function (b) { b.classList.toggle("on", b === on); });
    };
    /* the page scroll position that shows timeline x at the left */
    var scrollFor = function (x) {
      var top = hz.getBoundingClientRect().top + window.pageYOffset;
      return top + Math.max(0, Math.min(shift, x * k - 24));
    };
    window.addEventListener("scroll", function () { tick(false); hide(); }, { passive: true });
    window.addEventListener("resize", function () { hide(); layout(); });
    window.addEventListener("load", layout);
    layout();

    jumps.forEach(function (b) {
      b.addEventListener("click", function () {
        window.scrollTo({ top: scrollFor(Number(b.getAttribute("data-x"))), behavior: reduce ? "auto" : "smooth" });
      });
    });

    /* sideways gestures (trackpad swipes, shift+wheel, drag, arrow keys) move the page scroll too */
    view.addEventListener("wheel", function (e) {
      var dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      if (!dx || Math.abs(dx) < Math.abs(e.deltaY) && !e.shiftKey) return;
      e.preventDefault();
      window.scrollBy(0, dx * (e.deltaMode === 1 ? 32 : 1));
    }, { passive: false });
    view.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      window.scrollBy({ top: d * view.clientWidth * 0.5, behavior: reduce ? "auto" : "smooth" });
    });
    var drag = null, moved = false;
    view.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      drag = { x: e.clientX, y: window.pageYOffset }; moved = false;
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) < 6) return;
      if (!moved) { moved = true; view.classList.add("drag"); hide(); }
      window.scrollTo(0, drag.y - dx);
    });
    window.addEventListener("pointerup", function () {
      if (!drag) return;
      drag = null; view.classList.remove("drag");
      setTimeout(function () { moved = false; }, 0);
    });
    view.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    view.addEventListener("dragstart", function (e) { e.preventDefault(); });

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
    var on = null, tShow = 0, tHide = 0;
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
    function hide() {
      clearTimeout(tShow); clearTimeout(tHide);
      if (!on) return;
      on = null; pop.classList.remove("on"); pop.hidden = true; stopVideo();
    }
    var place = function (n) {
      var sr = stick.getBoundingClientRect(), vr = view.getBoundingClientRect(), nr = n.getBoundingClientRect();
      var w = pop.offsetWidth, hh = pop.offsetHeight;
      var left = nr.left + nr.width / 2 - sr.left - w / 2;
      left = Math.max(12, Math.min(left, sr.width - w - 12));
      var top = n.classList.contains("dn") ? nr.top - sr.top - 8 : nr.bottom - sr.top + 8 - hh;
      top = Math.max(vr.top - sr.top - 40, Math.min(top, sr.height - hh - 8));
      pop.style.left = left + "px"; pop.style.top = Math.max(8, top) + "px";
    };
    var show = function (n) {
      clearTimeout(tShow); clearTimeout(tHide);
      if (on === n) return;
      stopVideo();
      on = n;
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
      else requestAnimationFrame(function () { if (on === n) pop.classList.add("on"); });
    };
    nodes.forEach(function (n) {
      n.addEventListener("mouseenter", function () {
        if (!canHover || drag) return;
        clearTimeout(tHide); clearTimeout(tShow);
        tShow = setTimeout(function () { show(n); }, on ? 80 : 160);
      });
      n.addEventListener("mouseleave", function (e) {
        clearTimeout(tShow);
        if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
        tHide = setTimeout(hide, 140);
      });
      n.addEventListener("focus", function () {
        if (!n.matches(":focus-visible")) return;
        var r = n.getBoundingClientRect();
        if (r.left < 0 || r.right > window.innerWidth) window.scrollTo(0, scrollFor(parseFloat(n.style.getPropertyValue("--x")) - 120));
        show(n);
      });
      n.addEventListener("blur", function () { tHide = setTimeout(hide, 120); });
      n.addEventListener("click", function (e) {
        if (canHover || on === n) return;
        e.preventDefault(); show(n);
      });
    });
    pop.addEventListener("mouseenter", function () { clearTimeout(tHide); });
    pop.addEventListener("mouseleave", function (e) {
      if (on && e.relatedTarget && on.contains(e.relatedTarget)) return;
      tHide = setTimeout(hide, 140);
    });
    document.addEventListener("click", function (e) { if (on && !hz.contains(e.target)) hide(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
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

  /* Point clouds: a still poster until scrolled to, then a WebGL view the reader can drag to turn.
     Data file: int16 xyz (centred, scaled to +-32767, z up) for every point, then uint8 rgb for every point. */
  Array.prototype.forEach.call(document.querySelectorAll(".pc3d-box[data-src]"), function (box) {
    var started = false;
    function start() {
      if (started) return; started = true;
      var cv = document.createElement("canvas");
      var gl = cv.getContext("webgl", { antialias: true, alpha: false });
      if (!gl) return;  // keep the poster
      fetch(box.getAttribute("data-src")).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); }).then(function (buf) {
        var n = buf.byteLength / 9;
        var pos = new Int16Array(buf, 0, n * 3), col = new Uint8Array(buf, n * 6, n * 3);
        function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
        var pr = gl.createProgram();
        gl.attachShader(pr, sh(gl.VERTEX_SHADER,
          "attribute vec3 p;attribute vec3 c;uniform mat4 m;uniform float ps;varying vec3 vc;" +
          "void main(){vec4 q=m*vec4(p/32767.0,1.0);gl_Position=q;gl_PointSize=clamp(ps/q.w,1.0,6.0);vc=c*1.15;}"));
        gl.attachShader(pr, sh(gl.FRAGMENT_SHADER,
          "precision mediump float;varying vec3 vc;void main(){vec2 d=gl_PointCoord-0.5;if(dot(d,d)>0.25)discard;gl_FragColor=vec4(vc,1.0);}"));
        gl.linkProgram(pr); gl.useProgram(pr);
        function attr(name, data, size, type, norm) {
          var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
          var l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, norm, 0, 0);
        }
        attr("p", pos, 3, gl.SHORT, false); attr("c", col, 3, gl.UNSIGNED_BYTE, true);
        var um = gl.getUniformLocation(pr, "m"), ups = gl.getUniformLocation(pr, "ps");
        gl.enable(gl.DEPTH_TEST); gl.clearColor(0.067, 0.067, 0.075, 1);
        var yaw0 = 0.6, pitch0 = 0.42, yaw = yaw0, pitch = pitch0, drag = null, last = 0, idle = 0, visible = true;
        function frame(t) {
          var dt = last ? Math.min(t - last, 50) : 16; last = t;
          if (!drag && !reduce && t > idle) yaw += dt * 0.00012;
          var w = box.clientWidth, h = box.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
          gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
          var f = 2.2, a = cv.width / cv.height, D = 1.9, nr = 0.05, fr = 10;
          // view = rotate about z (yaw), tilt about x (pitch), push back D; columns for gl (column-major)
          var r0 = [cy, -sy, 0], r1 = [cp * sy, cp * cy, -sp], r2 = [sp * sy, sp * cy, cp];  // rows: x, depth, up
          var A = (fr + nr) / (nr - fr), B = 2 * fr * nr / (nr - fr);
          var m = new Float32Array([
            f / a * r0[0], f * r2[0], -A * r1[0], r1[0],
            f / a * r0[1], f * r2[1], -A * r1[1], r1[1],
            f / a * r0[2], f * r2[2], -A * r1[2], r1[2],
            0, 0, -A * D + B, D]);
          gl.uniformMatrix4fv(um, false, m); gl.uniform1f(ups, 2.2 * dpr);
          gl.drawArrays(gl.POINTS, 0, n);
          if (visible) requestAnimationFrame(frame);
        }
        box.appendChild(cv); box.classList.add("live");
        cv.addEventListener("pointerdown", function (e) { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); box.classList.add("used"); });
        cv.addEventListener("pointermove", function (e) {
          if (!drag) return;
          yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
          pitch = Math.max(-0.1, Math.min(1.3, drag[3] + (e.clientY - drag[1]) * 0.006));
        });
        function up() { drag = null; idle = performance.now() + 2500; }
        cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
        cv.addEventListener("dblclick", function () { yaw = yaw0; pitch = pitch0; });
        if ("IntersectionObserver" in window) {
          new IntersectionObserver(function (es) {
            var was = visible; visible = es[0].isIntersecting;
            if (visible && !was) { last = 0; requestAnimationFrame(frame); }
          }).observe(box);
        }
        requestAnimationFrame(frame);
      }).catch(function () {});
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { rootMargin: "200px" });
      io.observe(box);
    } else { start(); }
  });

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
