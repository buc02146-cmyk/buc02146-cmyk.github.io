// Cloudflare Pages advanced worker, with a D1 binding named DB.
const CATEGORIES=new Set(["grocery","clinic","medicine","gear","outing","preschool","fruit","living","prep"]);
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:H});
const norm=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
async function prepare(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, url TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1, nickname TEXT NOT NULL DEFAULT '익명')").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS product_reviews (id TEXT PRIMARY KEY, category TEXT NOT NULL, product_title TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '익명', body TEXT NOT NULL, sentiment TEXT NOT NULL DEFAULT 'good', created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS playdates (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, place TEXT NOT NULL, starts_at TEXT NOT NULL, min_month INTEGER NOT NULL, max_month INTEGER NOT NULL, capacity INTEGER NOT NULL, details TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT 'Central', created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1)").run();
  const photoColumns=await db.prepare("PRAGMA table_info(product_reviews)").all();
  if(!(photoColumns.results||[]).some(c=>c.name==="photo_data")){
    try{await db.prepare("ALTER TABLE product_reviews ADD COLUMN photo_data TEXT").run()}
    catch(err){if(!/duplicate column/i.test(String(err)))throw err}
  }
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
  const productDelete=url.pathname.match(/^\/api\/product-reviews\/([0-9a-fA-F-]{36})$/);
  const productPath=url.pathname==="/api/product-reviews";
  const visitorPath=url.pathname==="/api/visitors/today";
  const playdatePath=url.pathname==="/api/playdates";
  const playdateDelete=url.pathname.match(/^\/api\/playdates\/([0-9a-fA-F-]{36})$/);
  const summaryPath=url.pathname==="/api/review-summary";
  const recentPath=url.pathname==="/api/recent-reviews";
  const photoGet=url.pathname.match(/^\/api\/review-photos\/([0-9a-fA-F-]{36})$/);
  if(!deleteMatch&&!productDelete&&!productPath&&!visitorPath&&!playdatePath&&!playdateDelete&&!summaryPath&&!recentPath&&!photoGet&&url.pathname!=="/api/recommendations"&&!isHealth)return env.ASSETS.fetch(req);
  if((deleteMatch||productDelete||playdateDelete)&&req.method!=="DELETE")return reply({error:"허용되지 않은 요청입니다."},405);
  if(deleteMatch||productDelete||playdateDelete){
    if(!env.ADMIN_DELETE_SECRET||env.ADMIN_DELETE_SECRET.length<8)return reply({error:"관리자 삭제 비밀번호가 설정되지 않았습니다."},503);
    const supplied=req.headers.get("x-admin-secret")||"";
    const encoder=new TextEncoder();
    const digest=async x=>new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(x)));
    const expected=await digest(env.ADMIN_DELETE_SECRET),actual=await digest(supplied);
    let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected[i]^actual[i];
    if(mismatch!==0)return reply({error:"관리자 비밀번호가 올바르지 않습니다."},403);
  }
  if(!env.DB)return reply(isHealth?{database:"not_connected",admin_delete_password:(env.ADMIN_DELETE_SECRET&&env.ADMIN_DELETE_SECRET.length>=8)?"configured":"not_configured",note:"Cloudflare Pages에서 DB 바인딩을 저장한 뒤 새 배포를 시작하세요."}:{error:"현재 배포에 DB 연결이 적용되지 않았습니다. Cloudflare Settings → Bindings에서 DB를 저장하고 Deployments에서 새로 배포해 주세요."},503);
  try{

    if(visitorPath){
      if(req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
      if(req.headers.get("origin")&&req.headers.get("origin")!==url.origin)return reply({error:"허용되지 않은 사이트입니다."},403);
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS daily_visitors (day TEXT NOT NULL, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(day,visitor_hash))").run();
      const fmt=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit"});
      const parts=Object.fromEntries(fmt.formatToParts(new Date()).map(x=>[x.type,x.value]));
      const day=parts.year+"-"+parts.month+"-"+parts.day;
      const cookie=(req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("sgbg_vid="));
      const token=cookie?cookie.slice("sgbg_vid=".length):"";
      const valid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(token);
      const id=valid?token:crypto.randomUUID();
      const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(id));
      const hash=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
      await env.DB.prepare("INSERT OR IGNORE INTO daily_visitors(day,visitor_hash,created_at) VALUES(?,?,?)").bind(day,hash,new Date().toISOString()).run();
      const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM daily_visitors WHERE day=?").bind(day).first();
      const headers=new Headers(H);
      if(!valid)headers.append("set-cookie","sgbg_vid="+id+"; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax");
      return new Response(JSON.stringify({day,timezone:"Asia/Singapore",visitors:Number(count?.total||0)}),{status:200,headers});
    }
    await prepare(env.DB);
    if(deleteMatch){
      const itemId=deleteMatch[1];
      const result=await env.DB.prepare("DELETE FROM recommendations WHERE id=?").bind(itemId).run();
      if((result.meta?.changes||0)===0)return reply({error:"삭제할 글을 찾을 수 없습니다."},404);
      return reply({ok:true,deleted:itemId});
    }


    if(playdateDelete){
      const result=await env.DB.prepare("DELETE FROM playdates WHERE id=?").bind(playdateDelete[1]).run();
      return (result.meta?.changes||0)>0?reply({ok:true}):reply({error:"삭제할 모임이 없습니다."},404);
    }
    if(playdatePath){
      if(req.method==="GET"){
        const rows=await env.DB.prepare("SELECT id,nickname,place,starts_at,min_month,max_month,capacity,details,notes,region,created_at FROM playdates WHERE approved=1 ORDER BY starts_at ASC LIMIT 120").all();
        return reply({items:rows.results||[]});
      }
      if(req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
      if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"입력 형식을 확인해 주세요."},415);
      const raw=await req.text();if(raw.length>4500)return reply({error:"내용이 너무 깁니다."},413);
      let d;try{d=JSON.parse(raw)}catch{return reply({error:"입력 형식이 올바르지 않습니다."},400)}
      if(d.website)return reply({ok:true});
      const nickname=norm(d.nickname,24),place=norm(d.place,110),starts_at=norm(d.starts_at,40),region=norm(d.region,24),
      details=norm(d.details,500),notes=norm(d.notes,450),capacity=Number(d.capacity),min=Number(d.min_month),max=Number(d.max_month);
      if(nickname.length<2||place.length<2||details.length<4||!["Central","East","West","North","South","Unknown"].includes(region)
         ||!Number.isInteger(capacity)||capacity<2||capacity>50||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>120||min>max)
        return reply({error:"장소·월령·정원·내용을 확인해 주세요."},400);
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(starts_at)||!Number.isFinite(Date.parse(starts_at)))
        return reply({error:"날짜와 시간을 선택해 주세요."},400);
      const meetingAt=Date.parse(starts_at+"+08:00");
      if(!Number.isFinite(meetingAt)||meetingAt<Date.now()-3600000||meetingAt>Date.now()+365*86400000)
        return reply({error:"모임은 앞으로 1년 이내 날짜로 등록해 주세요."},400);
      const id=crypto.randomUUID(),now=new Date().toISOString();
      await env.DB.prepare("INSERT INTO playdates(id,nickname,place,starts_at,min_month,max_month,capacity,details,notes,region,created_at,approved) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)").bind(id,nickname,place,starts_at,min,max,capacity,details,notes,region,now).run();
      return reply({ok:true,id},201);
    }
    if(summaryPath){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const rows=await env.DB.prepare("SELECT category,product_title,COUNT(*) AS total,SUM(CASE WHEN sentiment='good' THEN 1 ELSE 0 END) AS good,SUM(CASE WHEN sentiment='neutral' THEN 1 ELSE 0 END) AS neutral,SUM(CASE WHEN sentiment='bad' THEN 1 ELSE 0 END) AS bad FROM product_reviews WHERE approved=1 GROUP BY category,product_title").all();
      return reply({items:rows.results||[]});
    }
    if(recentPath){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const rows=await env.DB.prepare("SELECT id,nickname,body,sentiment,created_at,category,product_title FROM product_reviews WHERE approved=1 ORDER BY created_at DESC LIMIT 6").all();
      return reply({items:rows.results||[]});
    }
    if(photoGet){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const data=await env.DB.prepare("SELECT photo_data FROM product_reviews WHERE id=? AND approved=1").bind(photoGet[1]).first();
      const payload=data?.photo_data;
      if(!payload||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload))return reply({error:"등록된 사진이 없습니다."},404);
      const binary=atob(payload.slice("data:image/jpeg;base64,".length));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      return new Response(bytes,{headers:{"content-type":"image/jpeg","cache-control":"public, max-age=3600","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'"}});
    }
    if(productDelete){
      const id=productDelete[1];
      const result=await env.DB.prepare("DELETE FROM product_reviews WHERE id=?").bind(id).run();
      return (result.meta?.changes||0)>0?reply({ok:true}):reply({error:"삭제할 후기를 찾지 못했습니다."},404);
    }
    if(productPath){
      if(req.method==="GET"){
        const category=norm(url.searchParams.get("category"),30);
        const title=norm(url.searchParams.get("title"),130);
        if(!CATEGORIES.has(category)||!title)return reply({error:"상품 정보를 확인해 주세요."},400);
        const rows=await env.DB.prepare("SELECT id,nickname,body,sentiment,created_at,CASE WHEN photo_data IS NULL THEN 0 ELSE 1 END AS has_photo FROM product_reviews WHERE approved=1 AND category=? AND product_title=? ORDER BY created_at DESC LIMIT 80").bind(category,title).all();
        return reply({items:rows.results||[]});
      }
      if(req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
      if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"JSON 형식으로 입력해 주세요."},415);
      const raw=await req.text();if(raw.length>3000)return reply({error:"내용이 너무 깁니다."},413);
      let d;try{d=JSON.parse(raw)}catch{return reply({error:"입력 형식이 올바르지 않습니다."},400)}
      if(d.website)return reply({ok:true});
      const category=norm(d.category,30),title=norm(d.title,130),nickname=norm(d.nickname,24)||"익명",body=norm(d.body,600),sentiment=norm(d.sentiment,12)||"good";
      let photo=null;
      if(d.photo){
        if(d.photo_consent!==true)return reply({error:"사진 공개 및 개인정보 확인에 동의해 주세요."},400);
        if(typeof d.photo!=="string"||d.photo.length>240000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(d.photo))
          return reply({error:"사진은 170KB 이하의 JPEG로 올려주세요."},413);
        try{const rawImage=atob(d.photo.slice("data:image/jpeg;base64,".length));if(rawImage.length>170000||rawImage.charCodeAt(0)!==255||rawImage.charCodeAt(1)!==216||rawImage.charCodeAt(2)!==255)throw Error();}catch{return reply({error:"지원하지 않는 이미지입니다."},415)}
        photo=d.photo;
      }
      if(!["grocery","gear","medicine"].includes(category)||title.length<2||body.length<8||!["good","neutral","bad"].includes(sentiment))return reply({error:"제품명·후기(8자 이상)·평가를 확인해 주세요."},400);
      const id=crypto.randomUUID(),createdAt=new Date().toISOString();
      await env.DB.prepare("INSERT INTO product_reviews (id,category,product_title,nickname,body,sentiment,created_at,approved,photo_data) VALUES (?,?,?,?,?,?,?,1,?)").bind(id,category,title,nickname,body,sentiment,createdAt,photo).run();
      return reply({ok:true,id},201);
    }
    if(isHealth)return reply({database:"connected",table:"ready",admin_delete_password:(env.ADMIN_DELETE_SECRET&&env.ADMIN_DELETE_SECRET.length>=8)?"configured":"not_configured"});
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
