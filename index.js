import 'dotenv/config';
import WebSocket from 'ws';
import {Client,GatewayIntentBits,REST,Routes,SlashCommandBuilder,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle} from 'discord.js';
for (const k of ['DISCORD_TOKEN','CLIENT_ID']) if (!process.env[k]?.trim()) throw new Error('Missing '+k);
if (!/^\d+$/.test(process.env.CLIENT_ID.trim())) throw new Error('CLIENT_ID must be numeric');
const PURPLE=0xb026ff, RED=0xed4245, refreshMs=Math.max(30,Number(process.env.RUST_REFRESH_SECONDS||60))*1000;
const config=new Map(), cache={data:null,at:0,error:null};
const rconCache=new Map();
const serverProfiles=new Map();
const command=new SlashCommandBuilder().setName('pop').setDescription('Rust Console live population dashboard').addSubcommand(s=>s.setName('view').setDescription('Show live population and available player details')).addSubcommand(s=>s.setName('status').setDescription('Show source connection health')).addSubcommand(s=>s.setName('test').setDescription('Test Rust WebRCON and player-list access; owner only')).addSubcommand(s=>s.setName('setup').setDescription('Configure automatic updates; server owner only'));
const rest=new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
const register=async()=>{const guildRoute=process.env.GUILD_ID?Routes.applicationGuildCommands(process.env.CLIENT_ID,process.env.GUILD_ID):null;try{if(guildRoute){await rest.put(guildRoute,{body:[command.toJSON()]});console.log('Registered commands for GUILD_ID '+process.env.GUILD_ID);}else{await rest.put(Routes.applicationCommands(process.env.CLIENT_ID),{body:[command.toJSON()]});console.log('Registered global commands.');}}catch(error){if(error?.code===50001&&guildRoute){console.error('Discord denied access to GUILD_ID '+process.env.GUILD_ID+'. Check that this exact application is installed in that server and that GUILD_ID is correct. Falling back to global registration.');await rest.put(Routes.applicationCommands(process.env.CLIENT_ID),{body:[command.toJSON()]});console.log('Registered global commands; Discord propagation can take up to an hour.');}else throw error;}};
await register();
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const val=(x,f='Unavailable')=>x===undefined||x===null||x===''?f:String(x);
function normalize(raw){const rows=Array.isArray(raw.players)?raw.players.map((p,i)=>typeof p==='string'?{name:p}:({name:p.name||p.username||'Unnamed survivor',platform:p.platform||p.device||'Platform unavailable',playing:p.playing||p.activity||'Rust Console'})):[];const n=raw.currentPlayers??raw.playersOnline??raw.online??raw.population??(Array.isArray(raw.players)?raw.players.length:null);return {serverName:raw.serverName||raw.name||process.env.RUST_SERVER_NAME||'Rust Console Server',current:Number.isFinite(Number(n))?Number(n):null,max:raw.maxPlayers??raw.capacity??null,rows};}
function parseEndpoint(p){const raw=(p.ip||p.host||'').trim();const m=raw.match(/^([^:]+)(?::(\\d+))?$/);if(!m)throw Error('Server host/IP must look like 203.0.113.10:28016');const host=p.host?.trim()||m[1];const port=Number(m[2]||p.rconPort||28016);if(!p.rconPassword)throw Error('RCON password is not configured');return {host,port};}
function parsePlayers(message){let text=typeof message==='string'?message:JSON.stringify(message);let parsed;try{parsed=JSON.parse(text);}catch{}const list=Array.isArray(parsed)?parsed:(parsed?.players||parsed?.Players||parsed?.data?.players);if(Array.isArray(list))return list.map((p,i)=>typeof p==='string'?{name:p,platform:'Console'}:{name:p.displayName||p.username||p.name||'Unnamed survivor',platform:p.platform||p.device||'Console',playing:p.playing||'Rust Console'});return text.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean).filter(x=>!/^players?\\s*$/i.test(x)).map((x,i)=>({name:x.replace(/^[-*]\\s*/, '').slice(0,80),platform:'Console',playing:'Rust Console'}));}
function rconRequest(profile,command='global.playerlist'){const {host,port}=parseEndpoint(profile);const scheme=String(process.env.RCON_TLS||'').toLowerCase()==='true'?'wss':'ws';const url=scheme+'://'+host+':'+port+'/'+encodeURIComponent(profile.rcoPassword);return new Promise((resolve,reject)=>{const ws=new WebSocket(url);let done=false;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);try{ws.close()}catch{};fn(v);};const timer=setTimeout(()=>finish(reject,Error('WebRCON timed out after 10 seconds')),10000);ws.on('open',()=>ws.send(JSON.stringify({Identifier:1,Message:command,Name:'WebRcon',Type:'Generic'})));ws.on('message',raw=>{try{const packet=JSON.parse(raw.toString());if(packet.Identifier===1||packet.Message!==undefined)finish(resolve,packet.Message??packet);}catch{finish(reject,Error('WebRCON returned invalid JSON'));}});ws.on('error',err=>finish(reject,Error('WebRCON connection failed: '+err.message)));ws.on('close',()=>{if(!done)finish(reject,Error('WebRCON closed before replying'));});});}
async function fetchRcon(guildId){const p=serverProfiles.get(guildId);if(!p)throw Error('Run /pop setup and configure the Rust server first');const message=await rconRequest(p,'global.playerlist');const rows=parsePlayers(message);const d={serverName:p.name,current:rows.length,max:null,rows};rconCache.set(guildId,{data:d,at:Date.now(),error:null});return d;}
async function getPop(guildId){const hit=rconCache.get(guildId);if(hit&&Date.now()-hit.at<refreshMs)return hit.data;try{return await fetchRcon(guildId)}catch(e){if(hit){hit.error=e.message;return hit.data}throw e;}}
async function testRcon(guildId){const p=serverProfiles.get(guildId);if(!p)throw Error('Configure the Rust server in /pop setup first');const message=await rconRequest(p,'global.playerlist');const rows=parsePlayers(message);const d={serverName:p.name,current:rows.length,max:null,rows};rconCache.set(guildId,{data:d,at:Date.now(),error:null});return d;}
const brand=t=>new EmbedBuilder().setColor(PURPLE).setTitle('☢️ '+t).setFooter({text:'RUST CONSOLE POP • Free • approved live source only'}).setTimestamp();
function dashboard(d,meta={}){const e=brand('NEON POP // '+val(d.serverName)).setDescription('**🟣 LIVE RUST CONSOLE POPULATION**\\n'+(d.current===null?'Population unavailable':'**'+d.current+'** survivors online')+(d.max?' / '+d.max:'')+(cache.error?'\\n⚠️ Last successful snapshot':'')).addFields({name:'📡 Feed',value:cache.error?'Stale':'Connected',inline:true},{name:'🕒 Updated',value:cache.at?'<t:'+Math.floor(cache.at/1000)+':R>':'Unavailable',inline:true},{name:'🧑‍🚀 Player rows',value:String(d.rows.length),inline:true});if(d.rows.length)e.addFields({name:'SURVIVOR SIGNALS',value:d.rows.slice(0,20).map((p,i)=>'**'+(i+1)+'. '+val(p.name,'Survivor')+'**\\n🎮 '+val(p.platform)+' • '+val(p.playing)).join('\\n\\n').slice(0,3900)});else e.addFields({name:'SURVIVOR SIGNALS',value:'The approved source did not provide individual player rows. No names, platforms, avatars, or activities are invented.'});return e;}
const controls=()=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('refresh').setLabel('Refresh signal').setEmoji('🔄').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('status').setLabel('Connection status').setEmoji('📡').setStyle(ButtonStyle.Secondary));
const setupButtons=()=>new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('server_add').setLabel('Server details').setEmoji('🛠️').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('server_view').setLabel('View configuration').setEmoji('📋').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('server_clear').setLabel('Remove server').setEmoji('🗑️').setStyle(ButtonStyle.Danger));
const updateSetup=()=>new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('setup').setPlaceholder('Automatic updates').addOptions({label:'Off',value:'off',emoji:'⏸️'},{label:'Bot status',value:'bio',emoji:'🟣'},{label:'Channel embed',value:'channel',emoji:'📣'},{label:'Both',value:'both',emoji:'⚡'}));
const serverModal=()=>new ModalBuilder().setCustomId('server_modal').setTitle('🛠️ Server configuration').addComponents(
 new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_name').setLabel('Server name').setPlaceholder('My Rust Console server').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
 new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ip').setLabel('Server IP address').setPlaceholder('203.0.113.10').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
 new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rcon_port').setLabel('WebRCON port').setPlaceholder('28016').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
 new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setPlaceholder('EU, US, AU, etc.').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
 new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setPlaceholder('A short description for this server').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))
);
const credentialModal=()=>new ModalBuilder().setCustomId('credential_modal').setTitle('🔐 WebRCON credentials').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rco_password').setLabel('WebRCON password').setPlaceholder('Never share this in chat').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)));
const profileCard=(p)=>brand('RUST SERVER PROFILE').setDescription('Connection details for this server. The password is never shown here.').addFields({name:'🧱 Name',value:p.name,inline:true},{name:'📍 Address',value:p.ip+':'+(p.rconPort||'—'),inline:true},{name:'🌎 Region',value:p.region,inline:true},{name:'📝 Description',value:p.description||'No description'}, {name:'🔐 Password',value:'Stored privately • hidden',inline:true});
async function status(){const e=brand('POP STATUS').addFields({name:'Source configured',value:process.env.RUST_STATUS_URL?'✅ Yes':'❌ No',inline:true},{name:'Connection',value:cache.error?'🔴 Error':cache.data?'🟢 Healthy':'⚪ Not checked',inline:true},{name:'Last update',value:cache.at?'<t:'+Math.floor(cache.at/1000)+':R>':'Never',inline:true});if(cache.error)e.addFields({name:'Safe error',value:cache.error.slice(0,900)});return e;}
client.on('interactionCreate', async (i) => {
  try {
    if (i.isChatInputCommand()) {
      const sub = i.options.getSubcommand();
      if (sub === 'setup') {
        if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Only the Discord server owner can use /pop setup.', ephemeral: true });
        return i.reply({ embeds: [brand('SERVER CONTROL').setDescription('Manage the server connected to this Discord server. Changes are limited to the server owner.').addFields({ name: 'Connection', value: serverProfiles.has(i.guild.id) ? '🟢 Configured' : '⚪ Not configured', inline: true }, { name: 'Bot activity', value: config.get(i.guild.id) || 'off', inline: true }, { name: 'Next step', value: serverProfiles.has(i.guild.id) ? 'Run /pop test to check WebRCON.' : 'Add the server details below.' })], components: [setupButtons(), updateSetup()], ephemeral: true });
      }
      if (sub === 'test') {
        if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Only the Discord server owner can run the RCON test.', ephemeral: true });
        await i.deferReply({ ephemeral: true });
        try { const d = await testRcon(i.guild.id); return i.editReply({ embeds: [brand('RCON TEST PASSED').setDescription('✅ WebRCON connected and returned a player list.').addFields({ name: 'Server', value: d.serverName, inline: true }, { name: 'Players returned', value: String(d.current), inline: true }, { name: 'Next', value: 'Run /pop view.' })] }); }
        catch (error) { return i.editReply({ embeds: [brand('RCON TEST FAILED').setColor(RED).setDescription('❌ The bot could not connect or read the player list.').addFields({ name: 'Reason', value: String(error.message).slice(0, 900) }, { name: 'Check', value: 'Verify host/IP, WebRCON port, password, and provider settings.' })] }); }
      }
      if (sub === 'status') return i.reply({ embeds: [await status()], ephemeral: true });
      await i.deferReply();
      try { const d = await getPop(i.guild.id); return i.editReply({ embeds: [dashboard(d, rconCache.get(i.guild.id) || {})], components: [controls()] }); }
      catch (error) { return i.editReply({ embeds: [brand('POP FEED OFFLINE').setColor(RED).setDescription('No live population was displayed.').addFields({ name: 'Reason', value: String(error.message).slice(0, 900) })] }); }
    }
    if (i.isButton()) {
      if (i.customId === 'server_add') { if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Owner only.', ephemeral: true }); return i.showModal(serverModal()); }
      if (i.customId === 'rco_add') { if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Owner only.', ephemeral: true }); return i.showModal(credentialModal()); }
      if (i.customId === 'server_view') { if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Owner only.', ephemeral: true }); const p = serverProfiles.get(i.guild.id); return i.reply({ embeds: [p ? profileCard(p) : brand('NO SERVER PROFILE').setDescription('Configure a server first.')], ephemeral: true }); }
      if (i.customId === 'server_clear') { if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Owner only.', ephemeral: true }); serverProfiles.delete(i.guild.id); return i.reply({ content: '🗑️ Rust server profile cleared from memory.', ephemeral: true }); }
      if (i.customId === 'status') return i.reply({ embeds: [await status()], ephemeral: true });
      if (i.customId === 'refresh') { await i.deferUpdate(); try { const d = await fetchRcon(i.guild.id); return i.editReply({ embeds: [dashboard(d, rconCache.get(i.guild.id) || {})], components: [controls()] }); } catch (error) { return i.followUp({ content: '⚠️ Live refresh failed: ' + String(error.message).slice(0, 900), ephemeral: true }); } }
    }
    if (i.isModalSubmit()) {
      if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Only the Discord server owner can change setup.', ephemeral: true });
      if (i.customId === 'server_modal') {
        const p = { name: i.fields.getTextInputValue('server_name').trim(), ip: i.fields.getTextInputValue('ip').trim(), rconPort: i.fields.getTextInputValue('rcon_port').trim(), region: i.fields.getTextInputValue('region').trim(), description: i.fields.getTextInputValue('description').trim() };
        if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(p.ip)) return i.reply({ content: '⚠️ Enter the Rust server IPv4 address only, for example 203.0.113.10.', ephemeral: true }); if (!/^\d{1,5}$/.test(p.rconPort) || Number(p.rconPort) < 1 || Number(p.rconPort) > 65535) return i.reply({ content: '⚠️ Enter a valid WebRCON port.', ephemeral: true });
        serverProfiles.set(i.guild.id, p);
        return i.reply({ content: '✅ Server details saved. Add the private WebRCON password to finish.', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rco_add').setLabel('Add WebRCON password').setEmoji('🔐').setStyle(ButtonStyle.Primary))], ephemeral: true });
      }
      if (i.customId === 'credential_modal') { const p = serverProfiles.get(i.guild.id); if (!p) return i.reply({ content: 'Configure server details first.', ephemeral: true }); p.rcoPassword = i.fields.getTextInputValue('rco_password').trim(); serverProfiles.set(i.guild.id, p); return i.reply({ content: '✅ WebRCON setup complete. Password stored privately in memory and never displayed.', ephemeral: true }); }
    }
    if (i.isStringSelectMenu() && i.customId === 'setup') { if (i.guild?.ownerId !== i.user.id) return i.reply({ content: '🔒 Owner only.', ephemeral: true }); config.set(i.guild.id, i.values[0]); return i.update({ embeds: [brand('SETUP SAVED').setDescription('Automatic updates: **' + i.values[0] + '**')], components: [] }); }
  } catch (error) { console.error('[interaction]', error); if (!i.replied && !i.deferred) await i.reply({ content: '⚠️ Unexpected error. Check hosting logs.', ephemeral: true }); }
});
client.once('ready', () => {
  console.log('Rust Console Pop online as ' + client.user.tag);
  setInterval(async () => {
    for (const [guildId, mode] of config) {
      if (mode !== 'bio' && mode !== 'both') continue;
      try {
        const d = await getPop(guildId);
        client.user.setPresence({ activities: [{ name: (d.current ?? '—') + ' online • /pop' }], status: 'online' });
      } catch (error) {
        console.error('[bio]', error.message);
      }
    }
  }, refreshMs);
});
await client.login(process.env.DISCORD_TOKEN);
