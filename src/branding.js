export const BRAND=Object.freeze({name:'RustPulse Pop',shortName:'RustPulse',purple:0xb026ff,magenta:0xff3bd4,red:0xed4245,green:0x57f287,footer:'RustPulse Pop • Free • read-only'});
export const EMBLEMS=Object.freeze({live:'🟢',delayed:'🟠',offline:'🔴',signal:'📡',roster:'🧑‍🚀',setup:'🛠️',privacy:'🛡️',rules:'📜',rcon:'🧰'});
export function clampText(value,max=1024,fallback='Unavailable'){const text=String(value??'').trim();return (text||fallback).slice(0,max);}
export function relativeDiscordTime(timestamp=Date.now()){return '<t:'+Math.floor(Number(timestamp)/1000)+':R>';}
