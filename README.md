# NoteSMP Website

Public website for the NoteSMP Minecraft Java server: [notesmp.de](https://notesmp.de).

## What the site provides

- Server information, connection address, live server status and online-player list.
- Public events, announcements, gallery posts and website links.
- Creator and Twitch live information.
- Player directory and public player profiles, including statistics and advancement history.
- Responsive navigation and pages for Info, Events, Gallery, Players, Commands, Rules and Updates.

## Architecture

This repository contains the static frontend. It is deployed as the `notesmp-website` Cloudflare Worker using Workers Static Assets.

The frontend reads dynamic information from the separate [NoteSMP API repository](https://github.com/NoteSMP/notesmp-api), deployed at:

`https://notesmp-api.notesmp-de.workers.dev/v1`

The Paper plugin signals the API when player/server information changes. The API performs the public Minecraft server-status check; the website does not need a continuously running game-server process.

Player directory records are stored in D1. A player is registered when they join. Player profiles can request fresh statistics and advancements from the online plugin; scheduled snapshots are stored separately in D1.

## Main files

| File | Purpose |
|---|---|
| `index.html` | Frontend entry point and page shell. |
| `script.js` | Routing, rendering, API requests and interactive behavior. |
| `styles.css`, `portal.css` | Global and portal/page styling. |
| `wrangler.jsonc` | Cloudflare Worker and static-asset configuration. |
| `api/README.md` | Pointer to the separately maintained API project. |

## Local development

Requirements: Node.js and npm.

```bash
npm install
npx wrangler dev
```

Preview the static site locally, test the main routes and player profiles, and check both desktop and mobile layouts.

## Deploy

The production Worker is named `notesmp-website`. Deploy from this repository with:

```bash
npx wrangler deploy
```

If using Cloudflare Workers Builds, verify the configured repository and production branch before relying on an automatic deployment.

## Security and contributions

- Never put `MINECRAFT_API_KEY`, Discord bot tokens, or other secrets in frontend code.
- Treat all API responses and user-provided content as untrusted; escape text before inserting it into HTML.
- Keep public pages usable when optional API integrations are temporarily unavailable.
