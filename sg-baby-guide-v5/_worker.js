// Cloudflare Pages advanced worker, with a D1 binding named DB.
const CATEGORIES=new Set(["grocery","clinic","medicine","gear","outing","preschool","fruit","living","prep"]);
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:H});
const norm=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
async function prepare(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, url TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1, nickname TEXT NOT NULL DEFAULT '익명')").run();
  const info=await db.prepare("PRAGMA table_info(recommendations)").all();
  if(!(info.results||[]).some(c=>c.name==="nickname")){
    try{await db.prepare("ALTER TABLE recommendations ADD COLUMN nickname TEXT NOT NULL DEFAULT '익명'").run()}
    catch(e){if(!/duplicate column/i.test(String(e)))throw e}
  }
}
export default {async fetch(req,env){
  const url=new URL(req.url);
  const isHealth=url.pathname==="/api/status";
  const deleteMatch=url.pathname.match(/^\/api\/recommendations\/([0-9a-fA-F-]{36})$/);
  if(!deleteMatch&&url.pathname!=="/api/recommendations"&&!isHealth)return env.ASSETS.fetch(req);
  if(deleteMatch&&req.method!=="DELETE")return reply({error:"허용되지 않은 요청입니다."},405);
  if(deleteMatch){
    if(!env.ADMIN_DELETE_SECRET||env.ADMIN_DELETE_SECRET.length<16)return reply({error:"관리자 삭제 비밀번호가 아직 설정되지 않았습니다."},503);
    const supplied=req.headers.get("x-admin-secret")||"";
    const encoder=new TextEncoder();
    const digest=async x=>new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(x)));
    const expected=await digest(env.ADMIN_DELETE_SECRET),actual=await digest(supplied);
    let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected[i]^actual[i];
    if(mismatch!==0)return reply({error:"관리자 비밀번호가 올바르지 않습니다."},403);
  }
  if(!env.DB)return reply(isHealth?{database:"not_connected",note:"Cloudflare Pages에서 DB 바인딩을 저장한 뒤 새 배포를 시작하세요."}:{error:"현재 배포에 DB 연결이 적용되지 않았습니다. Cloudflare Settings → Bindings에서 DB를 저장하고 Deployments에서 새로 배포해 주세요."},503);
  try{
    await prepare(env.DB);
    if(deleteMatch){
      const itemId=deleteMatch[1];
      const result=await env.DB.prepare("DELETE FROM recommendations WHERE id=?").bind(itemId).run();
      if((result.meta?.changes||0)===0)return reply({error:"삭제할 글을 찾을 수 없습니다."},404);
      return reply({ok:true,deleted:itemId});
    }
    if(isHealth)return reply({database:"connected",table:"ready"});
    if(req.method==="GET"){
      const rows=await env.DB.prepare("SELECT id,category,title,url,reason,created_at,nickname FROM recommendations WHERE approved=1 ORDER BY created_at DESC LIMIT 150").all();
      return reply({items:rows.results||[]});
    }
    if(req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
    if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"JSON 형식으로 입력해 주세요."},415);
    const body=await req.text();
    if(body.length>3500)return reply({error:"내용이 너무 깁니다."},413);
    let d;try{d=JSON.parse(body)}catch{return reply({error:"입력 형식을 확인해 주세요."},400)}
    if(d.website)return reply({ok:true});
    const category=norm(d.category,30),title=norm(d.title,90),reason=norm(d.reason,400);
    const nickname=norm(d.nickname,24)||"익명",link=norm(d.url,600);
    if(!CATEGORIES.has(category)||title.length<2||reason.length<8||nickname.length<2)return reply({error:"카테고리·닉네임·제목·추천 이유를 확인해 주세요."},400);
    if(link){try{const u=new URL(link);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)throw Error("URL")}catch{return reply({error:"정확한 웹사이트 링크를 입력해 주세요."},400)}}
    const id=crypto.randomUUID(),created_at=new Date().toISOString();
    await env.DB.prepare("INSERT INTO recommendations (id,category,title,url,reason,created_at,approved,nickname) VALUES (?,?,?,?,?,?,1,?)").bind(id,category,title,link,reason,created_at,nickname).run();
    return reply({ok:true,id},201);
  }catch(err){return reply({error:"데이터베이스 처리 중 오류가 발생했습니다. 배포 및 D1 설정을 확인해 주세요."},500)}
}};
