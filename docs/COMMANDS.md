# RustPulse Pop command guide

## Public commands

- `/pop view` — premium live dashboard with population, capacity, telemetry, and roster.
- `/pop players` — connected player roster returned by RCON.
- `/pop info` — public server metadata such as map, queue, FPS, region, and capacity when returned.
- `/pop status` — connection/cache health and last successful check.
- `/ping` — Discord round-trip latency, WebSocket latency, and bot uptime.
- `/about` — what RustPulse Pop does and does not do.
- `/help` — interactive command guide.
- `/rules` — community rules panel.
- `/terms` — terms of use panel.

## Staff commands

Staff means the server owner, Administrator, Manage Server, or Manage Messages.

- `/pop setup` — configure the server profile and update mode.
- `/pop test` — verify WebRCON access and the required `playerlist` response.
- `/pop refresh` — bypass the normal cache and request a fresh snapshot.
- `/searchplayer username:<name>` — private, read-only connected-player lookup.

## Privacy

Public views hide IP address, RCON port, credentials, Discord tokens, webhook URLs, and private setup. The bot never invents missing fields and never performs kick, ban, warning, or other destructive actions.

## Source files

- `index.js` — production entrypoint and Discord interaction handlers.
- `src/branding.js` — visual identity helpers.
- `src/permissions.js` — staff access policy.
- `src/rcon.js` — reusable WebRCON helper for future extraction.
- `docs/` — operator and privacy documentation.
