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
function parseEndpoint(p){const host=(p.ip||'').trim();const port=Number(p.rconPort||28016);if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))throw Error('Rust server IP must be a numeric IPv4 address');if(!Number.isInteger(port)||port<1||port>65535)throw Error('WebRCON port must be between 1 and 65535');if(!p.rcoPassword)throw Error('RCON password is not configured');return {host,port};});
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
