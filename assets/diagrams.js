(function () {
  const figures = Array.from(document.querySelectorAll(".diagram"));
  if (!figures.length) return;

  const lightbox = document.createElement("div");
  lightbox.className = "diagram-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.innerHTML = `
    <div class="diagram-lightbox__panel">
      <div class="diagram-lightbox__head">
        <div class="diagram-lightbox__title"></div>
        <button type="button" class="diagram-lightbox__close" aria-label="Close diagram">×</button>
      </div>
      <div class="diagram-lightbox__body"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const titleEl = lightbox.querySelector(".diagram-lightbox__title");
  const bodyEl = lightbox.querySelector(".diagram-lightbox__body");
  const closeBtn = lightbox.querySelector(".diagram-lightbox__close");

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    bodyEl.innerHTML = "";
  }

  function openLightbox(figure) {
    const label = figure.dataset.title || "Diagram";
    const stage = figure.querySelector(".diagram__stage");
    if (!stage) return;
    titleEl.textContent = label;
    bodyEl.innerHTML = stage.innerHTML;
    lightbox.classList.add("is-open");
    document.body.classList.add("lightbox-open");
    closeBtn.focus();
  }

  function setExpanded(figure, expanded) {
    figure.classList.toggle("is-expanded", expanded);
    const btn = figure.querySelector('[data-action="toggle"]');
    if (btn) {
      btn.setAttribute("aria-pressed", expanded ? "true" : "false");
      btn.textContent = expanded ? "Collapse" : "Expand";
    }
  }

  figures.forEach((figure, index) => {
    const title = figure.dataset.title || `Figure ${index + 1}`;
    figure.dataset.title = title;

    const toolbar = document.createElement("div");
    toolbar.className = "diagram__toolbar";
    toolbar.innerHTML = `
      <span class="diagram__label">${title}</span>
      <div class="diagram__actions">
        <button type="button" class="diagram__btn" data-action="toggle" aria-pressed="false">Expand</button>
        <button type="button" class="diagram__btn" data-action="lightbox">Fullscreen</button>
      </div>
    `;

    const stage = document.createElement("div");
    stage.className = "diagram__stage";
    while (figure.firstChild) stage.appendChild(figure.firstChild);

    figure.appendChild(toolbar);
    figure.appendChild(stage);

    toolbar.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      event.stopPropagation();
      const action = btn.getAttribute("data-action");
      if (action === "toggle") {
        setExpanded(figure, !figure.classList.contains("is-expanded"));
      } else if (action === "lightbox") {
        openLightbox(figure);
      }
    });

    stage.addEventListener("click", () => {
      if (figure.classList.contains("is-expanded")) {
        openLightbox(figure);
      } else {
        setExpanded(figure, true);
      }
    });
  });

  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });
})();
