(function () {
  const figures = Array.from(document.querySelectorAll(".diagram"));
  if (!figures.length) return;

  const lightbox = document.createElement("div");
  lightbox.className = "diagram-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="diagram-lightbox__panel" role="document">
      <div class="diagram-lightbox__head">
        <div class="diagram-lightbox__title" id="diagram-lightbox-title"></div>
        <button type="button" class="diagram-lightbox__close" aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="diagram-lightbox__body"></div>
      <div class="diagram-lightbox__foot">
        <span class="diagram-lightbox__hint">Esc to close · click outside to dismiss</span>
        <button type="button" class="diagram__btn diagram-lightbox__done">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const titleEl = lightbox.querySelector(".diagram-lightbox__title");
  const bodyEl = lightbox.querySelector(".diagram-lightbox__body");
  const closeBtn = lightbox.querySelector(".diagram-lightbox__close");
  const doneBtn = lightbox.querySelector(".diagram-lightbox__done");
  const panel = lightbox.querySelector(".diagram-lightbox__panel");

  let lastFocus = null;

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    bodyEl.innerHTML = "";
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    lastFocus = null;
  }

  function openLightbox(figure, trigger) {
    const label = figure.dataset.title || "Diagram";
    const stage = figure.querySelector(".diagram__stage");
    if (!stage) return;

    lastFocus = trigger || document.activeElement;
    titleEl.textContent = label;
    bodyEl.innerHTML = stage.innerHTML;

    // Prefer a larger SVG clone when available
    const svg = bodyEl.querySelector("svg");
    if (svg) {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.maxWidth = "100%";
      svg.style.width = "100%";
      svg.style.height = "auto";
    }

    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    closeBtn.focus();
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

    const expandBtn = toolbar.querySelector('[data-action="expand"]');

    function openFrom(el) {
      openLightbox(figure, el);
    }

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

  closeBtn.addEventListener("click", closeLightbox);
  doneBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  panel.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
})();
