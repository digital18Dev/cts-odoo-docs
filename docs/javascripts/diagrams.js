(() => {
  let seq = 0;

  const isDark = () =>
    document.body.getAttribute("data-md-color-scheme") === "slate";

  const configure = () =>
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: isDark() ? "dark" : "default",
    });

  async function renderSvg(source) {
    const { svg } = await mermaid.render(`diagram-${seq++}`, source);
    return svg;
  }

  async function draw(wrap) {
    try {
      wrap.innerHTML = await renderSvg(wrap.dataset.source);
      wrap.title = "Click para ampliar";
    } catch (err) {
      wrap.classList.add("diagram--error");
      wrap.textContent = `Error al renderizar el diagrama: ${err.message}`;
    }
  }

  // Hand-drawn diagrams live as standalone .html pages; only their <svg> is embedded.
  async function loadStatic(wrap) {
    const src = wrap.dataset.diagramSrc;
    try {
      const res = await fetch(new URL(src, location.href));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const svg = doc.querySelector("svg");
      if (!svg) throw new Error("el archivo no contiene un <svg>");
      wrap.innerHTML = svg.outerHTML;
      wrap.classList.add("diagram--static");
      wrap.title = "Click para ampliar";
    } catch (err) {
      wrap.classList.add("diagram--error");
      wrap.textContent = `No se pudo cargar el diagrama (${src}): ${err.message}`;
    }
  }

  async function renderAll() {
    configure();
    for (const pre of document.querySelectorAll("pre.diagram")) {
      const wrap = document.createElement("div");
      wrap.className = "diagram";
      wrap.dataset.source = pre.textContent;
      pre.replaceWith(wrap);
    }
    for (const wrap of document.querySelectorAll("div.diagram[data-source]")) {
      await draw(wrap);
    }
    await Promise.all(
      [...document.querySelectorAll("div.diagram[data-diagram-src]")].map(loadStatic)
    );
  }

  async function openZoom(wrap) {
    const overlay = document.createElement("div");
    overlay.className = "diagram-zoom";
    overlay.innerHTML = `
      <div class="diagram-zoom__stage"></div>
      <div class="diagram-zoom__bar">
        <span>Rueda: zoom · Arrastrar: mover · Esc: cerrar</span>
        <button type="button" data-act="out" aria-label="Alejar">&minus;</button>
        <button type="button" data-act="in" aria-label="Acercar">+</button>
        <button type="button" data-act="fit">Ajustar</button>
        <button type="button" data-act="close" aria-label="Cerrar">&times;</button>
      </div>`;
    const stage = overlay.querySelector(".diagram-zoom__stage");
    // Mermaid: fresh render, since a clone would duplicate the ids its styles are scoped to.
    // Static SVGs are cloned; duplicated marker ids resolve to identical definitions.
    stage.innerHTML = wrap.dataset.source
      ? await renderSvg(wrap.dataset.source)
      : wrap.querySelector("svg").outerHTML;
    const svg = stage.querySelector("svg");
    const [, , vbW, vbH] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    svg.removeAttribute("style");
    svg.setAttribute("width", vbW);
    svg.setAttribute("height", vbH);

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    let scale = 1, x = 0, y = 0;
    const apply = () => {
      svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const fit = () => {
      const { width, height } = stage.getBoundingClientRect();
      scale = Math.min(width / vbW, height / vbH, 2);
      x = (width - vbW * scale) / 2;
      y = (height - vbH * scale) / 2;
      apply();
    };
    const zoomAt = (factor, cx, cy) => {
      const next = Math.min(Math.max(scale * factor, 0.2), 20);
      x = cx - (cx - x) * (next / scale);
      y = cy - (cy - y) * (next / scale);
      scale = next;
      apply();
    };
    const zoomCenter = (factor) => {
      const { width, height } = stage.getBoundingClientRect();
      zoomAt(factor, width / 2, height / 2);
    };
    fit();

    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      drag = { px: e.clientX, py: e.clientY, x, y };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      x = drag.x + e.clientX - drag.px;
      y = drag.y + e.clientY - drag.py;
      apply();
    });
    const endDrag = () => {
      drag = null;
      stage.classList.remove("is-dragging");
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);

    const onKey = (e) => e.key === "Escape" && close();
    function close() {
      overlay.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    }
    const actions = {
      in: () => zoomCenter(1.25),
      out: () => zoomCenter(1 / 1.25),
      fit,
      close,
    };
    overlay.querySelector(".diagram-zoom__bar").addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act) actions[act]();
    });
    document.addEventListener("keydown", onKey);
  }

  document.addEventListener("click", (e) => {
    const wrap = e.target.closest(".md-typeset div.diagram");
    if (wrap && wrap.querySelector("svg")) openZoom(wrap);
  });

  new MutationObserver(() => {
    configure();
    document.querySelectorAll("div.diagram[data-source]").forEach(draw);
  }).observe(document.body, { attributeFilter: ["data-md-color-scheme"] });

  if (typeof document$ !== "undefined") {
    document$.subscribe(renderAll);
  } else {
    renderAll();
  }
})();
