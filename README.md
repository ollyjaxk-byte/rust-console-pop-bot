# test

A free neon-purple Discord bot for Rust Console population monitoring. Built for clean live dashboards, private staff tools, RCON checks, player search, and polished rules/terms panels.

## Commands
- `/pop view` — live population and roster
- `/pop status` — connection state and last update
- `/pop test` — staff-only RCON/player-list test
- `/pop setup` — staff setup panel
- `/searchplayer username` — private, read-only player lookup
- `/rules` and `/terms` — private guide panels or staff-posted channel panels

The bot is read-only. It does not kick, ban, warn, or perform destructive server actions. Server connection details and credentials are never shown in public embeds.

## Railway
Set the private `DISCORD_TOKEN` and numeric `CLIENT_ID`. Set `GUILD_ID` for fast test-server command registration. Deploy with `npm start`. Configure the Rust server and RCON password inside Discord; never commit credentials.

## Permissions
Public: `/pop view`, `/pop status`, `/rules`, `/terms`.
Staff: server owner, Administrator, Manage Server, or Manage Messages.

MIT licensed.
