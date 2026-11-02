# NoteSMP Website

Public website for the NoteSMP Minecraft Java server: **https://notesmp.de** and **https://www.notesmp.de**.

## Features

- Server status and join address.
- Public content/news and events.
- Gallery sections and published community posts.
- Creator/stream listings.
- Public player profiles and statistics pages.
- Discord links and site navigation.

## Hosting and deployment

The site is static content deployed as a Cloudflare Worker with Workers Static Assets. The configuration is in `wrangler.jsonc`; the asset directory is the repository root.

Cloudflare Git integration can deploy changes pushed to the connected branch. To deploy manually:

```bash
npm install --save-dev wrangler
npx wrangler login
npx wrangler dev
npx wrangler deploy
```

## API integration

The frontend calls the NoteSMP API for dynamic data. Configure the API base URL in the site's frontend configuration where applicable. Do not put the Minecraft API secret or bot token in frontend code; browser-visible data must be public.

## Main files

| File | Role |
|---|---|
| `index.html` | Website entry page and markup. |
| `script.js` | Frontend behavior and API-driven content. |
| `styles.css` | Main site styling. |
| `portal.css` | Portal/page styling. |
| `api/` | Site API-related assets or handlers. |
| `wrangler.jsonc` | Cloudflare Worker/static assets deployment settings. |

## Development

Edit the static assets, preview locally with Wrangler, and check both desktop and mobile layouts before deploying. Keep secrets out of this repository.
