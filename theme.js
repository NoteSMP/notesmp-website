(() => {
  "use strict";

  const STORAGE_KEY = "notesmp-theme";
  const THEME_BASE_URL = "https://cdn.jsdelivr.net/gh/NoteSMP/notesmp-theme@main/themes/";
  const themes = [
    { id: "default", label: "Default", url: null },
    { id: "theme-1", label: "Theme 1", url: THEME_BASE_URL + "theme-1.css" },
    { id: "theme-2", label: "Theme 2", url: THEME_BASE_URL + "theme-2.css" },
    { id: "theme-3", label: "Theme 3", url: THEME_BASE_URL + "theme-3.css" },
    { id: "theme-4", label: "Theme 4", url: THEME_BASE_URL + "theme-4.css" }
  ];

  const savedTheme = (() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return themes.some(theme => theme.id === value) ? value : "default";
    } catch {
      return "default";
    }
  })();

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.id = "notesmp-active-theme";
  document.head.append(stylesheet);

  const footer = document.querySelector(".portal-footer");
  if (!footer) return;

  const switcher = document.createElement("section");
  switcher.className = "theme-switcher";
  switcher.setAttribute("aria-label", "Website appearance");

  const heading = document.createElement("span");
  heading.className = "theme-switcher-label";
  heading.textContent = "Website theme";

  const options = document.createElement("div");
  options.className = "theme-switcher-options";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "Choose a website theme");

  const status = document.createElement("span");
  status.className = "theme-switcher-status";
  status.setAttribute("aria-live", "polite");

  const buttons = new Map();

  function updateButtons(activeId) {
    for (const [id, button] of buttons) {
      const active = id === activeId;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    }
  }

  function applyTheme(themeId, persist = true) {
    const theme = themes.find(item => item.id === themeId) || themes[0];
    document.documentElement.dataset.theme = theme.id;
    if (theme.url) {
      stylesheet.href = theme.url;
      status.textContent = theme.label + " selected";
    } else {
      stylesheet.removeAttribute("href");
      status.textContent = "Default theme";
    }
    updateButtons(theme.id);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme.id); } catch {}
    }
  }

  for (const theme of themes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-switcher-option";
    button.textContent = theme.label;
    button.setAttribute("aria-label", "Use " + theme.label + " theme");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => applyTheme(theme.id));
    buttons.set(theme.id, button);
    options.append(button);
  }

  stylesheet.addEventListener("error", () => {
    document.documentElement.dataset.theme = "default";
    stylesheet.removeAttribute("href");
    updateButtons("default");
    status.textContent = "Theme could not load; using Default";
    try { localStorage.setItem(STORAGE_KEY, "default"); } catch {}
  });

  switcher.append(heading, options, status);
  footer.insertAdjacentElement("afterend", switcher);
  applyTheme(savedTheme, false);
})();
