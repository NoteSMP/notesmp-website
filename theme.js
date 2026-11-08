(() => {
  "use strict";

  const STORAGE_KEY = "notesmp-theme";
  const THEME_BASE_URLS = [
    "https://raw.githubusercontent.com/NoteSMP/notesmp-theme/main/themes/",
    "https://cdn.jsdelivr.net/gh/NoteSMP/notesmp-theme@main/themes/"
  ];
  const themes = [
    { id: "default", label: "Default", url: null },
    { id: "theme-1", label: "Theme 1", file: "theme-1.json" },
    { id: "theme-2", label: "Theme 2", file: "theme-2.json" },
    { id: "theme-3", label: "Theme 3", file: "theme-3.json" },
    { id: "theme-4", label: "Theme 4", file: "theme-4.json" }
  ];

  const colorKeys = {
    background: "--bg",
    surface: "--surface",
    surfaceRaised: "--surface-raised",
    text: "--text",
    muted: "--muted",
    border: "--line",
    accent: "--lime",
    accentSecondary: "--green2",
    warning: "--orange",
    danger: "--red"
  };
  const resetProperties = [
    ...Object.values(colorKeys), "--panel", "--panel2", "--green",
    "--theme-card-radius", "--theme-control-radius", "--theme-hero-radius",
    "--theme-border-width", "--theme-card-shadow", "--theme-hover-lift",
    "--theme-motion-duration", "--theme-page-background-image",
    "--theme-hero-background-image", "--font", "--display", "--mono",
    "--theme-body-size", "--theme-heading-scale", "--theme-small-scale",
    "--theme-body-line-height", "--theme-heading-line-height",
    "--theme-body-letter-spacing", "--theme-heading-letter-spacing",
    "--theme-body-weight", "--theme-display-weight", "--theme-small-weight"
  ];
  const shadows = {
    none: "none",
    soft: "0 10px 28px rgba(0, 0, 0, .22)",
    medium: "0 14px 34px rgba(0, 0, 0, .32)",
    strong: "0 16px 42px rgba(0, 0, 0, .42)"
  };
  const fonts = {
    Manrope: "'Manrope', sans-serif",
    "DM Mono": "'DM Mono', monospace",
    "DM Sans": "'DM Sans', sans-serif",
    "Space Grotesk": "'Space Grotesk', sans-serif",
    "System UI": "system-ui, sans-serif",
    Georgia: "Georgia, serif"
  };

  const savedTheme = (() => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return themes.some(theme => theme.id === value) ? value : "default";
    } catch {
      return "default";
    }
  })();

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
  let requestSequence = 0;

  function updateButtons(activeId) {
    for (const [id, button] of buttons) {
      const active = id === activeId;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    }
  }

  function resetThemeProperties() {
    const rootStyle = document.documentElement.style;
    resetProperties.forEach(property => rootStyle.removeProperty(property));
    document.documentElement.dataset.theme = "default";
  }

  function validColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function validNumber(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  }

  function allowedImage(value) {
    if (value === null) return null;
    if (typeof value !== "string" || value.length > 500) throw new Error("Invalid theme image URL");
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Theme images must use HTTPS");
    const allowed =
      (url.hostname === "minecraft.wiki" && url.pathname.startsWith("/images/")) ||
      (url.hostname === "raw.githubusercontent.com" && /^\/NoteSMP\/(notesmp-ressources|notesmp-theme)\//.test(url.pathname)) ||
      (url.hostname === "cdn.jsdelivr.net" && /^\/gh\/NoteSMP\/(notesmp-ressources|notesmp-theme)@main\//.test(url.pathname));
    if (!allowed) throw new Error("Theme image host is not approved");
    return url.href;
  }

  function validateTheme(data, theme) {
    if (!data || typeof data !== "object" || data.name !== theme.label) throw new Error("Theme name does not match its slot");
    const colors = data.colors;
    const shape = data.shape;
    const effects = data.effects;
    const backgrounds = data.backgrounds;
    const typography = data.typography;
    if (![colors, shape, effects, backgrounds, typography].every(value => value && typeof value === "object")) {
      throw new Error("Theme settings are incomplete");
    }
    for (const key of Object.keys(colorKeys)) {
      if (!validColor(colors[key])) throw new Error("Invalid theme color: " + key);
    }
    if (!validNumber(shape.cardRadius, 0, 28) ||
        !validNumber(shape.controlRadius, 0, 28) ||
        !validNumber(shape.heroRadius, 0, 40) ||
        !validNumber(shape.borderWidth, 0, 4)) throw new Error("Invalid theme shape settings");
    if (!Object.hasOwn(shadows, effects.shadow) ||
        !validNumber(effects.hoverLift, 0, 4) ||
        !validNumber(effects.motionMs, 0, 600)) throw new Error("Invalid theme effect settings");
    const weights = [400, 500, 600, 700, 800];
    if (![typography.body, typography.display, typography.mono].every(font => Object.hasOwn(fonts, font)) ||
        ![typography.bodyWeight, typography.displayWeight, typography.smallWeight].every(weight => weights.includes(weight)) ||
        !validNumber(typography.bodySize, 12, 20) ||
        !validNumber(typography.headingScale, 0.75, 1.5) ||
        !validNumber(typography.smallScale, 0.75, 1.5) ||
        !validNumber(typography.bodyLineHeight, 1.2, 2) ||
        !validNumber(typography.headingLineHeight, 0.85, 1.4) ||
        !validNumber(typography.letterSpacing, -0.05, 0.1) ||
        !validNumber(typography.headingLetterSpacing, -0.1, 0.05)) {
      throw new Error("Invalid theme typography settings");
    }
    return {
      colors,
      shape,
      effects,
      backgrounds: {
        page: allowedImage(backgrounds.page),
        hero: allowedImage(backgrounds.hero)
      },
      typography
    };
  }

  function applyValidatedTheme(data) {
    const root = document.documentElement;
    const style = root.style;
    const { colors, shape, effects, backgrounds, typography } = data;
    for (const [key, property] of Object.entries(colorKeys)) {
      style.setProperty(property, colors[key]);
    }
    style.setProperty("--panel", colors.surface);
    style.setProperty("--panel2", colors.surfaceRaised);
    style.setProperty("--green", colors.accent);
    style.setProperty("--theme-card-radius", shape.cardRadius + "px");
    style.setProperty("--theme-control-radius", shape.controlRadius + "px");
    style.setProperty("--theme-hero-radius", shape.heroRadius + "px");
    style.setProperty("--theme-border-width", shape.borderWidth + "px");
    style.setProperty("--theme-card-shadow", shadows[effects.shadow]);
    style.setProperty("--theme-hover-lift", -effects.hoverLift + "px");
    style.setProperty("--theme-motion-duration", effects.motionMs + "ms");
    style.setProperty("--font", fonts[typography.body]);
    style.setProperty("--display", fonts[typography.display]);
    style.setProperty("--mono", fonts[typography.mono]);
    style.setProperty("--theme-body-size", typography.bodySize + "px");
    style.setProperty("--theme-heading-scale", typography.headingScale);
    style.setProperty("--theme-small-scale", typography.smallScale);
    style.setProperty("--theme-body-line-height", typography.bodyLineHeight);
    style.setProperty("--theme-heading-line-height", typography.headingLineHeight);
    style.setProperty("--theme-body-letter-spacing", typography.letterSpacing + "em");
    style.setProperty("--theme-heading-letter-spacing", typography.headingLetterSpacing + "em");
    style.setProperty("--theme-body-weight", typography.bodyWeight);
    style.setProperty("--theme-display-weight", typography.displayWeight);
    style.setProperty("--theme-small-weight", typography.smallWeight);
    if (backgrounds.page) style.setProperty("--theme-page-background-image", 'url("' + backgrounds.page + '")');
    if (backgrounds.hero) style.setProperty("--theme-hero-background-image", 'url("' + backgrounds.hero + '")');
  }

  async function applyTheme(themeId, persist = true) {
    const theme = themes.find(item => item.id === themeId) || themes[0];
    const requestId = ++requestSequence;
    if (theme.id === "default") {
      resetThemeProperties();
      updateButtons("default");
      status.textContent = "Default theme";
      switcher.removeAttribute("aria-busy");
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, "default"); } catch {}
      }
      return;
    }

    status.textContent = "Loading " + theme.label + "…";
    switcher.setAttribute("aria-busy", "true");
    try {
      let data = null;
      let lastError = null;
      for (const baseUrl of THEME_BASE_URLS) {
        try {
          const response = await fetch(baseUrl + theme.file + "?v=20261108-2", { cache: "reload", credentials: "omit" });
          if (!response.ok) throw new Error("Theme source returned HTTP " + response.status);
          data = validateTheme(await response.json(), theme);
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!data) throw lastError || new Error("Theme file could not be loaded");
      if (requestId !== requestSequence) return;
      resetThemeProperties();
      applyValidatedTheme(data);
      document.documentElement.dataset.theme = theme.id;
      updateButtons(theme.id);
      status.textContent = theme.label + " active";
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, theme.id); } catch {}
      }
    } catch (error) {
      if (requestId !== requestSequence) return;
      resetThemeProperties();
      updateButtons("default");
      status.textContent = "Theme unavailable (" + (error && error.message ? error.message : "load failed") + "); using Default";
      try { localStorage.setItem(STORAGE_KEY, "default"); } catch {}
      console.warn("NoteSMP theme could not be applied", error);
    } finally {
      if (requestId === requestSequence) switcher.removeAttribute("aria-busy");
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

  switcher.append(heading, options, status);
  footer.insertAdjacentElement("afterend", switcher);
  applyTheme(savedTheme, false);
})();
