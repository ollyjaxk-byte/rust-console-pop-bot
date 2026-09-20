# Rust Console Pop

Free neon-purple Discord bot for approved live Rust Console population sources.

Commands: `/pop view`, `/pop status`, `/pop setup`. No leaderboard command. Setup is Discord-server-owner-only. Player names, platforms, and activities appear only when the configured source provides them; the bot never fabricates live data.

Railway: set `DISCORD_TOKEN`, numeric `CLIENT_ID`, and approved public JSON `RUST_STATUS_URL`, then run `npm start`. Never commit credentials.
