(() => {
  const API = "https://notesmp-api.notesmp-de.workers.dev/v1";
  const app = document.querySelector("#app");
  if (!app) return;
  let lastKey = "";
  let timer = null;

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function empty(title, message) {
    const box = element("div", "empty-state");
    box.append(element("strong", "", title), document.createTextNode(message));
    return box;
  }
  function makeCard(post) {
    const card = element("article", "post-card panel");
    const imageUrl = safeUrl(post.images && post.images[0]);
    if (imageUrl) {
      const image = element("img", "post-card-image");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      card.append(image);
    }
    const content = element("div", "post-card-content");
    const meta = element("div", "post-card-meta");
    meta.append(element("span", "", post.category || "update"));
    const date = post.event && post.event.scheduledStartTime ? post.event.scheduledStartTime : post.publishedAt;
    meta.append(element("span", "", date && !Number.isNaN(Date.parse(date)) ? new Date(date).toLocaleString() : ""));
    content.append(meta);
    content.append(element("h3", "", post.title || (post.body || "NoteSMP post").split("\n")[0].slice(0, 120)));
    if (post.subtitle || post.body) content.append(element("p", "", (post.subtitle || post.body || "").slice(0, 900)));
    if (post.event && post.event.location) content.append(element("p", "post-card-location", post.event.location));
    const footer = element("div", "post-card-footer");
    footer.append(element("span", "", "POST ID · " + post.id));
    if (post.authorMinecraftName) footer.append(element("span", "", "By " + post.authorMinecraftName));
    content.append(footer);
    card.append(content);
    return card;
  }
  async function getPosts(category) {
    const response = await fetch(API + "/content/posts?category=" + encodeURIComponent(category) + "&limit=100");
    if (!response.ok) throw new Error("Feed request failed");
    const data = await response.json();
    return data.posts || [];
  }
  function replaceFeed(target, posts, title, message) {
    if (!target) return;
    const old = target.querySelector(".empty-state, .post-feed");
    if (old) old.remove();
    if (!posts.length) {
      target.append(empty(title, message));
      return;
    }
    const feed = element("div", "post-feed");
    posts.forEach(post => feed.append(makeCard(post)));
    target.append(feed);
  }
  async function loadPage() {
    const path = location.pathname.replace(/\/$/, "") || "/";
    let key = path;
    if (path === "/gallery") {
      const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
      key += ":" + (active ? active.dataset.galleryGroup : "Events");
    }
    if (path === "/events") {
      const active = app.querySelector("[data-event-period][aria-pressed='true']");
      key += ":" + (active ? active.dataset.eventPeriod : "upcoming");
    }
    if (key === lastKey) return;
    lastKey = key;
    try {
      if (path === "/gallery") {
        const active = app.querySelector("[data-gallery-group][aria-pressed='true']");
        const label = active ? active.dataset.galleryGroup : "Events";
        const category = ({Events:"events",Buildings:"buildings",Places:"places","In Progress":"inprogress"})[label] || "events";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts(category), label + " gallery is empty", "Published Discord posts will appear here.");
      } else if (path === "/events") {
        const active = app.querySelector("[data-event-period][aria-pressed='true']");
        const period = active ? active.dataset.eventPeriod : "upcoming";
        const target = app.querySelector(".page-content");
        const posts = await getPosts("events");
        const now = Date.now();
        const filtered = posts.filter(post => {
          const date = post.event && post.event.scheduledStartTime ? Date.parse(post.event.scheduledStartTime) : Date.parse(post.publishedAt);
          return period === "past" ? date < now : date >= now;
        });
        replaceFeed(target, filtered, "No events in this period", "New Discord events will appear here automatically.");
      } else if (path === "/devlog" || path === "/rules") {
        const category = path === "/rules" ? "rules" : "updates";
        const target = app.querySelector(".page-content");
        replaceFeed(target, await getPosts(category), category === "rules" ? "Rules have not been published yet" : "No updates yet", "Publish messages from the configured Discord channel to show them here.");
      } else if (path === "/") {
        const panels = app.querySelectorAll(".main-column .panel");
        if (panels[1]) replaceFeed(panels[1], await getPosts("updates").then(items => items.slice(0,3)), "No announcements yet", "New NoteSMP announcements will appear here.");
        const eventPanel = app.querySelector(".main-column > section .panel");
        if (eventPanel) {
          const events = await getPosts("events");
          replaceFeed(eventPanel, events.filter(post => !post.event || !post.event.scheduledStartTime || Date.parse(post.event.scheduledStartTime) >= Date.now()).slice(0,3), "No upcoming events", "New Discord events will appear here automatically.");
        }
        const sideLists = app.querySelectorAll(".side-column .link-list");
        if (sideLists[0]) {
          const response = await fetch(API + "/content/links");
          const data = response.ok ? await response.json() : {links:[]};
          const links = Object.fromEntries((data.links || []).map(item => [item.link_key, item.url]));
          sideLists[0].replaceChildren();
          ["discord","youtube","modpack","bluemap"].forEach(key => {
            const url = safeUrl(links[key]);
            const item = url ? element("a","resource-link") : element("div","resource-link is-disabled");
            item.append(element("span","",key[0].toUpperCase()+key.slice(1)),element("span","",url ? "↗" : "Link not set"));
            if (url) { item.href=url; item.target="_blank"; item.rel="noreferrer"; } else item.setAttribute("aria-disabled","true");
            sideLists[0].append(item);
          });
        }
        if (sideLists[1]) {
          const response = await fetch(API + "/creators");
          const data = response.ok ? await response.json() : {creators:[]};
          const live = (data.creators || []).filter(item => item.live && safeUrl(item.live_url));
          sideLists[1].replaceChildren();
          if (!live.length) sideLists[1].append(element("div","resource-link is-disabled","No live NoteSMP streams"));
          live.forEach(item => {
            const link=element("a","resource-link");
            link.href=safeUrl(item.live_url); link.target="_blank"; link.rel="noreferrer";
            link.append(element("span","",item.twitch_login+" · "+item.live_title),element("span","","LIVE ↗"));
            sideLists[1].append(link);
          });
        }
      }
    } catch (error) {
      console.error("NoteSMP content feed failed", error);
      const target = app.querySelector(".page-content");
      if (target && (path === "/events" || path === "/gallery" || path === "/devlog" || path === "/rules")) {
        const old = target.querySelector(".empty-state, .post-feed");
        if (old) old.replaceWith(empty("Content unavailable","Could not load this NoteSMP feed. Please try again later."));
      }
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(loadPage, 80);
  }
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  document.addEventListener("click", event => {
    if (event.target.closest("[data-event-period]") || event.target.closest("[data-gallery-group]")) {
      lastKey = "";
      setTimeout(loadPage,120);
    }
  });
  schedule();
})();
