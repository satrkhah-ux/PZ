import fs from "node:fs";
const REF = "bmxwwoeqcngvtbdvsofa";
const env = fs.readFileSync("C:/Users/al3r1/OneDrive/Desktop/pizzara.iq/.env.local","utf8");
const TOKEN = (env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)||[])[1]?.trim();
if(!TOKEN){ console.error("لا يوجد توكن"); process.exit(1); }
const sql = fs.readFileSync(0,"utf8");
const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{
  method:"POST", headers:{Authorization:`Bearer ${TOKEN}`,"Content-Type":"application/json"},
  body: JSON.stringify({query: sql})
});
const t = await r.text();
if(!r.ok){ console.error("HTTP",r.status,t.slice(0,600)); process.exit(1); }
try{ console.log(JSON.stringify(JSON.parse(t),null,1)); }catch{ console.log(t.slice(0,2000)); }
