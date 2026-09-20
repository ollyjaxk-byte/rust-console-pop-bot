# Setup guide

Railway variables: DISCORD_TOKEN, numeric CLIENT_ID, and optional GUILD_ID. Start with npm start. Never commit credentials.

In Discord, the server owner or approved staff runs /pop setup, chooses Setup server, enters the server name, IPv4 address, RCON port, region, and description, then adds the password through the private modal. Run /pop test, then /pop view.

If the current deployment stores profiles in memory, a restart clears them; do not claim durable configuration until a secure persistent store is used.
