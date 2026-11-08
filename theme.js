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
    "--theme-hero-background-image", "--theme-hero-position", "--theme-hero-size", "--theme-hero-min-height", "--theme-hero-overlay-color", "--theme-hero-overlay-opacity", "--theme-frame-width", "--theme-frame-slice", "--theme-frame-panel-image", "--theme-frame-hero-image", "--theme-frame-hover-image", "--font", "--display", "--mono", "--brand-font", "--ui-font",
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
    Oxanium: "'Oxanium', sans-serif",
    Rajdhani: "'Rajdhani', sans-serif",
    Cinzel: "'Cinzel', serif",
    "Press Start 2P": "'Press Start 2P', cursive",
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
    delete document.documentElement.dataset.frameHero;
    delete document.documentElement.dataset.framePanels;
    delete document.documentElement.dataset.frameCards;
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
    const hero = backgrounds && backgrounds.heroSettings;
    const frames = data.frames && typeof data.frames === "object" ? data.frames : {};
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
    for (const key of ["body", "display", "mono"]) {
      if (typeof typography[key] !== "string" || !Object.hasOwn(fonts, typography[key])) {
        throw new Error("Invalid theme typography font: " + key + " (" + String(typography[key]) + ")");
      }
    }
    for (const key of ["brand", "ui"]) {
      if (typography[key] !== undefined && (typeof typography[key] !== "string" || !Object.hasOwn(fonts, typography[key]))) {
        throw new Error("Invalid theme typography font: " + key + " (" + String(typography[key]) + ")");
      }
    }
    for (const key of ["bodyWeight", "displayWeight", "smallWeight"]) {
      if (!weights.includes(typography[key])) {
        throw new Error("Invalid theme typography weight: " + key + " (" + String(typography[key]) + ")");
      }
    }
    const typographyRanges = {
      bodySize: [12, 20],
      headingScale: [0.75, 1.5],
      smallScale: [0.75, 1.5],
      bodyLineHeight: [1.2, 2],
      headingLineHeight: [0.85, 1.4],
      letterSpacing: [-0.05, 0.1],
      headingLetterSpacing: [-0.1, 0.05]
    };
    for (const [key, [min, max]] of Object.entries(typographyRanges)) {
      if (!validNumber(typography[key], min, max)) {
        throw new Error("Invalid theme typography value: " + key + " (" + String(typography[key]) + ")");
      }
    }
    const heroSettings = hero && typeof hero === "object" ? hero : {};
    const heroPositions = ["center", "center top", "center center", "center bottom", "left center", "right center", "58% center", "center 42%", "center 53%", "center 60%"];
    const heroSizes = ["cover", "contain"];
    if (heroSettings.position !== undefined && !heroPositions.includes(heroSettings.position)) throw new Error("Invalid hero image position");
    if (heroSettings.size !== undefined && !heroSizes.includes(heroSettings.size)) throw new Error("Invalid hero image size");
    if (heroSettings.minHeight !== undefined && !validNumber(heroSettings.minHeight, 240, 720)) throw new Error("Invalid hero minimum height");
    if (heroSettings.overlayColor !== undefined && !validColor(heroSettings.overlayColor)) throw new Error("Invalid hero overlay color");
    if (heroSettings.overlayOpacity !== undefined && !validNumber(heroSettings.overlayOpacity, 0, 0.95)) throw new Error("Invalid hero overlay opacity");
    const frameStyles = ["pixel-ornate", "off"];
    const frameVariants = ["none", "muted", "bright"];
    const frameTargets = frames.targets && typeof frames.targets === "object" ? frames.targets : {};
    if (frames.enabled !== undefined && typeof frames.enabled !== "boolean") throw new Error("Invalid frame enabled setting");
    if (frames.style !== undefined && !frameStyles.includes(frames.style)) throw new Error("Invalid frame style");
    if (frames.width !== undefined && !validNumber(frames.width, 0, 24)) throw new Error("Invalid frame width");
    if (frames.slice !== undefined && !validNumber(frames.slice, 8, 48)) throw new Error("Invalid frame slice");
    for (const key of ["hero", "panel", "hover"]) {
      if (frames[key] !== undefined && !frameVariants.includes(frames[key])) throw new Error("Invalid frame variant: " + key);
    }
    for (const key of ["hero", "panels", "cards"]) {
      if (frameTargets[key] !== undefined && typeof frameTargets[key] !== "boolean") throw new Error("Invalid frame target: " + key);
    }
    return {
      colors,
      shape,
      effects,
      frames: {
        enabled: frames.enabled === true && (frames.style || "pixel-ornate") !== "off",
        targets: {
          hero: frameTargets.hero === true,
          panels: frameTargets.panels === true,
          cards: frameTargets.cards === true
        },
        width: frames.width === undefined ? 12 : frames.width,
        slice: frames.slice === undefined ? 32 : frames.slice,
        hero: frames.hero || "bright",
        panel: frames.panel || "muted",
        hover: frames.hover || "bright"
      },
      backgrounds: {
        page: allowedImage(backgrounds.page),
        hero: allowedImage(backgrounds.hero),
        heroSettings: {
          position: heroSettings.position || "center 53%",
          size: heroSettings.size || "cover",
          minHeight: heroSettings.minHeight || 380,
          overlayColor: heroSettings.overlayColor || "#0E1511",
          overlayOpacity: heroSettings.overlayOpacity === undefined ? 0.55 : heroSettings.overlayOpacity
        }
      },
      typography
    };
  }

  function applyValidatedTheme(data) {
    const root = document.documentElement;
    const style = root.style;
    const { colors, shape, effects, backgrounds, typography, frames } = data;
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
    style.setProperty("--brand-font", fonts[typography.brand] || fonts[typography.display]);
    style.setProperty("--ui-font", fonts[typography.ui] || fonts[typography.body]);
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
    style.setProperty("--theme-hero-position", backgrounds.heroSettings.position);
    style.setProperty("--theme-hero-size", backgrounds.heroSettings.size);
    style.setProperty("--theme-hero-min-height", backgrounds.heroSettings.minHeight + "px");
    const overlayHex = backgrounds.heroSettings.overlayColor.slice(1);
    style.setProperty("--theme-hero-overlay-rgb", [0, 2, 4].map(index => parseInt(overlayHex.slice(index, index + 2), 16)).join(", "));
    style.setProperty("--theme-hero-overlay-opacity", backgrounds.heroSettings.overlayOpacity);
    const frameAssets = {
      bright: "https://raw.githubusercontent.com/NoteSMP/notesmp-ressources/main/ui/theme-2/frame-border.svg",
      muted: "https://raw.githubusercontent.com/NoteSMP/notesmp-ressources/main/ui/theme-2/frame-border-muted.svg",
      none: "none"
    };
    style.setProperty("--theme-frame-width", frames.enabled ? frames.width + "px" : "0px");
    style.setProperty("--theme-frame-slice", frames.slice);
    const frameSource = variant => !frames.enabled || variant === "none" ? "none" : 'url("' + frameAssets[variant] + '")';
    style.setProperty("--theme-frame-panel-image", frameSource(frames.panel));
    style.setProperty("--theme-frame-hero-image", frameSource(frames.hero));
    style.setProperty("--theme-frame-hover-image", frameSource(frames.hover));
    root.dataset.frameHero = String(frames.enabled && frames.targets.hero);
    root.dataset.framePanels = String(frames.enabled && frames.targets.panels);
    root.dataset.frameCards = String(frames.enabled && frames.targets.cards);
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
          const response = await fetch(baseUrl + theme.file + "?v=20261108-7", { cache: "reload", credentials: "omit" });
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
