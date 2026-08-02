(function () {
  const figures = Array.from(document.querySelectorAll(".diagram"));
  if (!figures.length) return;

  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 3.5;
  const ZOOM_STEP = 0.2;

  const lightbox = document.createElement("div");
  lightbox.className = "diagram-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="diagram-lightbox__panel" role="document">
      <div class="diagram-lightbox__head">
        <div class="diagram-lightbox__title"></div>
        <div class="diagram-lightbox__zoom">
          <button type="button" class="diagram__btn" data-zoom="out" aria-label="Zoom out">−</button>
          <span class="diagram-lightbox__zoom-label">100%</span>
          <button type="button" class="diagram__btn" data-zoom="in" aria-label="Zoom in">+</button>
          <button type="button" class="diagram__btn" data-zoom="reset" aria-label="Reset zoom">Reset</button>
          <button type="button" class="diagram-lightbox__close" aria-label="Close"><span aria-hidden="true">×</span></button>
        </div>
      </div>
      <div class="diagram-lightbox__body">
        <div class="diagram-lightbox__viewport">
          <div class="diagram-lightbox__canvas"></div>
        </div>
      </div>
      <div class="diagram-lightbox__foot">
        <span class="diagram-lightbox__hint">Scroll to zoom · drag to pan · Esc to close</span>
        <button type="button" class="diagram__btn diagram-lightbox__done">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const titleEl = lightbox.querySelector(".diagram-lightbox__title");
  const canvasEl = lightbox.querySelector(".diagram-lightbox__canvas");
  const viewportEl = lightbox.querySelector(".diagram-lightbox__viewport");
  const zoomLabel = lightbox.querySelector(".diagram-lightbox__zoom-label");
  const closeBtn = lightbox.querySelector(".diagram-lightbox__close");
  const doneBtn = lightbox.querySelector(".diagram-lightbox__done");
  const panel = lightbox.querySelector(".diagram-lightbox__panel");

  let lastFocus = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function applyTransform() {
    canvasEl.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(next, originX, originY) {
    const prev = zoom;
    zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);

    if (originX != null && originY != null && prev !== 0) {
      const rect = viewportEl.getBoundingClientRect();
      const cx = originX - rect.left - rect.width / 2;
      const cy = originY - rect.top - rect.height / 2;
      const ratio = zoom / prev;
      panX = cx - (cx - panX) * ratio;
      panY = cy - (cy - panY) * ratio;
    }

    applyTransform();
  }

  function fitAndCenter() {
    const svg = canvasEl.querySelector("svg");
    if (!svg) {
      zoom = 1.35;
      panX = 0;
      panY = 0;
      applyTransform();
      return;
    }

    // Force measurable intrinsic size from viewBox
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const naturalW = (vb && vb.width) || svg.getBBox?.().width || svg.clientWidth || 800;
    const naturalH = (vb && vb.height) || svg.getBBox?.().height || svg.clientHeight || 500;

    svg.setAttribute("width", String(naturalW));
    svg.setAttribute("height", String(naturalH));
    svg.style.width = `${naturalW}px`;
    svg.style.height = `${naturalH}px`;
    svg.style.maxWidth = "none";

    const availW = Math.max(viewportEl.clientWidth - 48, 200);
    const availH = Math.max(viewportEl.clientHeight - 48, 200);
    const fit = Math.min(availW / naturalW, availH / naturalH);
    // Prefer a readable size: at least 1.15x, up to fit*0.92 if that is larger
    zoom = clamp(Math.max(fit * 0.92, 1.15), MIN_ZOOM, MAX_ZOOM);
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    canvasEl.innerHTML = "";
    zoom = 1;
    panX = 0;
    panY = 0;
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  function openLightbox(figure, trigger) {
    const label = figure.dataset.title || "Diagram";
    const stage = figure.querySelector(".diagram__stage");
    if (!stage) return;

    lastFocus = trigger || document.activeElement;
    titleEl.textContent = label;
    canvasEl.innerHTML = stage.innerHTML;

    const svg = canvasEl.querySelector("svg");
    if (svg) {
      svg.removeAttribute("style");
    }

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");

    requestAnimationFrame(() => {
      fitAndCenter();
      closeBtn.focus();
    });
  }

  figures.forEach((figure, index) => {
    const title = figure.dataset.title || `Figure ${index + 1}`;
    figure.dataset.title = title;

    const toolbar = document.createElement("div");
    toolbar.className = "diagram__toolbar";
    toolbar.innerHTML = `
      <span class="diagram__label">${title}</span>
      <div class="diagram__actions">
        <button type="button" class="diagram__btn diagram__btn--primary" data-action="expand">Expand</button>
      </div>
    `;

    const stage = document.createElement("div");
    stage.className = "diagram__stage";
    stage.setAttribute("role", "button");
    stage.setAttribute("tabindex", "0");
    stage.setAttribute("aria-label", `Expand ${title}`);
    while (figure.firstChild) stage.appendChild(figure.firstChild);

    figure.appendChild(toolbar);
    figure.appendChild(stage);

    // Make inline preview SVG a bit larger / sharper
    const previewSvg = stage.querySelector("svg");
    if (previewSvg) {
      previewSvg.style.maxWidth = "100%";
      previewSvg.style.height = "auto";
      previewSvg.style.transformOrigin = "top center";
    }

    const expandBtn = toolbar.querySelector('[data-action="expand"]');
    const openFrom = (el) => openLightbox(figure, el);

    expandBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openFrom(expandBtn);
    });
    stage.addEventListener("click", () => openFrom(stage));
    stage.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFrom(stage);
      }
    });
  });

  lightbox.querySelectorAll("[data-zoom]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = btn.getAttribute("data-zoom");
      if (action === "in") setZoom(zoom + ZOOM_STEP);
      if (action === "out") setZoom(zoom - ZOOM_STEP);
      if (action === "reset") fitAndCenter();
    });
  });

  viewportEl.addEventListener(
    "wheel",
    (event) => {
      if (!lightbox.classList.contains("is-open")) return;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(zoom + delta, event.clientX, event.clientY);
    },
    { passive: false },
  );

  viewportEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    panStartX = panX;
    panStartY = panY;
    viewportEl.setPointerCapture(event.pointerId);
    viewportEl.classList.add("is-dragging");
  });

  viewportEl.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    panX = panStartX + (event.clientX - dragStartX);
    panY = panStartY + (event.clientY - dragStartY);
    applyTransform();
  });

  const endDrag = (event) => {
    dragging = false;
    viewportEl.classList.remove("is-dragging");
    if (viewportEl.hasPointerCapture?.(event.pointerId)) {
      viewportEl.releasePointerCapture(event.pointerId);
    }
  };
  viewportEl.addEventListener("pointerup", endDrag);
  viewportEl.addEventListener("pointercancel", endDrag);

  closeBtn.addEventListener("click", closeLightbox);
  doneBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "+" || event.key === "=") setZoom(zoom + ZOOM_STEP);
    if (event.key === "-") setZoom(zoom - ZOOM_STEP);
    if (event.key === "0") fitAndCenter();
  });
})();
