// Cloudflare Pages advanced worker, with a D1 binding named DB.
const CATEGORIES=new Set(["grocery","clinic","medicine","gear","outing","preschool","fruit","living","prep"]);
const LISTING_SUBCATEGORIES={"grocery":["치즈","요거트","분유","버터","떡뻥·간식","이유식 재료","생선·단백질","이유식·간편식","기타"],"gear":["기저귀","유모차","보습 로션·크림","이유식용품","목욕용품","위생·건강","기타"],"outing":["관람·체험","실내 놀이터","야외","식당"],"clinic":["소아과·병원","치과","기타 의료기관"],"medicine":["상비약","기타"],"preschool":["유치원 후기","Infant Care","Childcare","기타 교육"],"living":["예방접종","건강 가이드","어린이집","비자","도우미","기타 생활 정보"]};
const LISTING_REGIONS=new Set(["West","North","Central","East","South","Unknown"]);
const CURATED_LISTINGS=new Set(["grocery:Organic Valley Baby Swiss","grocery:Arla Natural Mozzarella Block 200g","grocery:Tamar Valley Greek Style Yoghurt","grocery:Jalna Greek Yoghurt","grocery:Lurpak Unsalted Butter 250g","grocery:질마재 유기농 현미귀리 스틱","gear:Nosiboo Pro 콧물흡입기","gear:MamyPoko Air Fit Marshmallow 팬티","gear:하기스 네이처메이드","gear:하기스 네이처메이드 오버나이트","gear:Pampers Premium Care","gear:Rascal + Friends 밤기저귀","gear:Merries Premium","gear:Doona","gear:Bugaboo Dragonfly","gear:Stokke YOYO3","gear:Silver Cross Dune","outing:Singapore Oceanarium","outing:Curiosity Cove","outing:Exploria","outing:National Gallery Singapore","outing:Children’s Museum Singapore","outing:Jacob Ballas Children’s Garden","outing:Kiztopia @ Jewel Changi","outing:Kiztopia @ New Bahru","outing:Paragon 실내 미끄럼틀 (Paragon Junior)","outing:HomeTeamNS T-Play @ Bukit Batok","outing:Marché @ 313 Somerset","outing:Marché @ VivoCity","outing:Amazonia @ Great World","outing:T-Play · 지점 미확인 후기","grocery:Fassler Sashimi Grade Salmon Portion Skinless (3pcs)","gear:Cetaphil Baby Daily Lotion","gear:Mustela Hydra Bébé Body Lotion","gear:ATOPALM MLE Cream","gear:Physiogel Calming Relief A.I. Cream","gear:Aveeno Baby Daily Moisture Lotion","gear:Richell Hinyari Shinai Bath Chair R","gear:Sudocrem Antiseptic Healing Cream","gear:Konny Bib Muslin Bandana","grocery:맘마밀 실온 이유식","gear:ATOPALM MLE Lotion","gear:Physiogel Soothing Care A.I. Cream","gear:ZEROID Intensive Oint-Cream","gear:Richell Soft Baby Chair","gear:Shnuggle Baby Bath","grocery:Aptamil Gold+ Infant Milk Formula Stage 1 900g","grocery:Nestlé NAN OPTIPRO Stage 1 800g","grocery:Abbott Similac Infant Milk Formula Stage 1 850g","clinic:KKH","clinic:NUH","clinic:Aglow @ United Square","clinic:Kinder Clinic (Paragon / Mount E Novena)"]);
const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:H});
const norm=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const helpfulCookieName="sgbg_helpful";
const helpfulTokenPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
function helpfulBrowserToken(req,cookieName=helpfulCookieName){
  const cookie=(req.headers.get("cookie")||"").split(";").map(value=>value.trim()).find(value=>value.startsWith(cookieName+"="));
  const token=cookie?.slice(cookieName.length+1);
  return helpfulTokenPattern.test(token)?token:null;
}
async function helpfulBrowserHash(token){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,"0")).join("");
}
async function prepareHelpful(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS review_helpful_votes (review_id TEXT NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE, browser_hash TEXT NOT NULL, PRIMARY KEY(review_id,browser_hash))").run();
}
async function ensureColumn(db,table,column,definition,columns){
  if(columns.some(item=>item.name===column))return;
  try{await db.prepare("ALTER TABLE "+table+" ADD COLUMN "+column+" "+definition).run()}
  catch(err){if(!/duplicate column/i.test(String(err)))throw err}
}
async function prepareListingRatings(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS listing_ratings (place_key TEXT NOT NULL, browser_hash TEXT NOT NULL, stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), PRIMARY KEY(place_key,browser_hash))").run();
}
function helpfulCookieHeaders(token,cookieName=helpfulCookieName){
  const headers=new Headers(H);
  if(token)headers.append("set-cookie",cookieName+"="+token+"; Max-Age=31536000; Path=/api; HttpOnly; Secure; SameSite=Lax");
  return headers;
}
async function authorHash(req){
  const token=req.headers.get("x-sgbg-author")||"";
  return helpfulTokenPattern.test(token)?helpfulBrowserHash(token):null;
}
async function adminAuthorized(req,env){
  const supplied=req.headers.get("x-admin-secret")||"";
  if(!supplied||!env.ADMIN_DELETE_SECRET||env.ADMIN_DELETE_SECRET.length<8)return false;
  const [expected,actual]=await Promise.all([helpfulBrowserHash(env.ADMIN_DELETE_SECRET),helpfulBrowserHash(supplied)]);
  let mismatch=0;
  for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^actual.charCodeAt(i);
  return mismatch===0;
}
function listingPhotoError(photo,consent){
  if(consent!==true)return reply({error:"사진 공개에 동의해 주세요."},400);
  if(typeof photo!=="string"||photo.length>230000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo))
    return reply({error:"사진은 170KB 이하의 JPEG로 올려 주세요."},413);
  try{
    const raw=atob(photo.slice("data:image/jpeg;base64,".length));
    if(raw.length<=170000&&raw.startsWith("\xff\xd8\xff"))return null;
  }catch{}
  return reply({error:"지원하지 않는 사진입니다."},415);
}
async function prepare(db){
  await db.prepare("CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, url TEXT, reason TEXT NOT NULL, created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1, nickname TEXT NOT NULL DEFAULT '익명')").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS product_reviews (id TEXT PRIMARY KEY, category TEXT NOT NULL, product_title TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '익명', body TEXT NOT NULL, sentiment TEXT NOT NULL DEFAULT 'good', created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS playdates (id TEXT PRIMARY KEY, nickname TEXT NOT NULL, place TEXT NOT NULL, starts_at TEXT NOT NULL, min_month INTEGER NOT NULL, max_month INTEGER NOT NULL, capacity INTEGER NOT NULL, details TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT 'Central', created_at TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 1)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS playdate_participants (playdate_id TEXT NOT NULL, nickname TEXT NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY(playdate_id,nickname))").run();
  const photoColumns=await db.prepare("PRAGMA table_info(product_reviews)").all();
  if(!(photoColumns.results||[]).some(c=>c.name==="photo_data")){
    try{await db.prepare("ALTER TABLE product_reviews ADD COLUMN photo_data TEXT").run()}
    catch(err){if(!/duplicate column/i.test(String(err)))throw err}
  }
  const info=await db.prepare("PRAGMA table_info(recommendations)").all();
  await ensureColumn(db,"recommendations","nickname","TEXT NOT NULL DEFAULT '익명'",info.results||[]);
  await ensureColumn(db,"recommendations","listing_subcategory","TEXT",info.results||[]);
  await ensureColumn(db,"recommendations","listing_region","TEXT",info.results||[]);
  await ensureColumn(db,"recommendations","author_hash","TEXT",info.results||[]);
  await ensureColumn(db,"recommendations","photo_data","TEXT",info.results||[]);
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
  const playdateJoin=url.pathname.match(/^\/api\/playdates\/([0-9a-fA-F-]{36})\/join$/);
  const summaryPath=url.pathname==="/api/review-summary";
  const recentPath=url.pathname==="/api/recent-reviews";
  const listingRatingsPath=url.pathname==="/api/listing-ratings";
  const helpfulPath=url.pathname.match(/^\/api\/product-reviews\/([0-9a-fA-F-]{36})\/helpful$/);
  const searchPath=url.pathname==="/api/search";
  const photoGet=url.pathname.match(/^\/api\/review-photos\/([0-9a-fA-F-]{36})$/);
  const listingPhoto=url.pathname.match(/^\/api\/listing-photos\/([0-9a-fA-F-]{36})$/);
  const playdateEdit=playdateDelete&&req.method==="PATCH";
  const recommendationEdit=deleteMatch&&req.method==="PATCH";
  if(!deleteMatch&&!productDelete&&!productPath&&!visitorPath&&!playdatePath&&!playdateDelete&&!playdateJoin&&!summaryPath&&!recentPath&&!listingRatingsPath&&!helpfulPath&&!searchPath&&!photoGet&&!listingPhoto&&url.pathname!=="/api/recommendations"&&!isHealth)return env.ASSETS.fetch(req);
  if((deleteMatch||productDelete||playdateDelete)&&req.method!=="DELETE"&&!playdateEdit&&!recommendationEdit)
    return reply({error:"허용되지 않은 요청입니다."},405);
  const adminAction=productDelete||(playdateDelete&&!playdateEdit)||
    ((deleteMatch&&!recommendationEdit||playdateEdit)&&req.headers.has("x-admin-secret"));
  if(adminAction){
    if(!env.ADMIN_DELETE_SECRET||env.ADMIN_DELETE_SECRET.length<8)return reply({error:"관리자 비밀번호가 설정되지 않았습니다."},503);
    if(!await adminAuthorized(req,env))return reply({error:"관리자 비밀번호가 올바르지 않습니다."},403);
  }
  if((deleteMatch||playdateEdit||playdatePath)&&req.method!=="GET"&&req.headers.get("origin")&&req.headers.get("origin")!==url.origin)
    return reply({error:"허용되지 않은 출처입니다."},403);
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
    if((playdatePath&&req.method==="GET")||playdateJoin){
      const columns=await env.DB.prepare("PRAGMA table_info(playdate_participants)").all();
      await ensureColumn(env.DB,"playdate_participants","child_month","INTEGER",columns.results||[]);
      await ensureColumn(env.DB,"playdate_participants","cancel_token_hash","TEXT",columns.results||[]);
    }
    const author=await authorHash(req);
    if(playdatePath||playdateEdit){
      const columns=await env.DB.prepare("PRAGMA table_info(playdates)").all();
      await ensureColumn(env.DB,"playdates","author_hash","TEXT",columns.results||[]);
    }
    if(deleteMatch&&!recommendationEdit){
      const itemId=deleteMatch[1];
      if(!adminAction&&!author)return reply({error:"작성자만 삭제할 수 있습니다."},403);
      const result=await env.DB.prepare("DELETE FROM recommendations WHERE id=? AND (?=1 OR author_hash=?)").bind(itemId,adminAction?1:0,author).run();
      if((result.meta?.changes||0)===0)return reply({error:"삭제할 글을 찾을 수 없습니다."},404);
      return reply({ok:true,deleted:itemId});
    }


    if(playdateJoin){
      if(req.method!=="POST"&&req.method!=="DELETE")return reply({error:"허용되지 않은 요청입니다."},405);
      if(req.headers.get("origin")&&req.headers.get("origin")!==url.origin)return reply({error:"허용되지 않은 출처입니다."},403);
      if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"닉네임을 입력해 주세요."},415);
      const raw=await req.text();if(raw.length>500)return reply({error:"입력이 너무 깁니다."},413);
      let data;try{data=JSON.parse(raw)}catch{return reply({error:"형식이 올바르지 않습니다."},400)}
      const token=data?.cancel_token;
      if((req.method==="DELETE"||token!==undefined)&&!helpfulTokenPattern.test(token)){
        return reply({error:"신청을 확인할 수 없습니다."},400);
      }
      const cancelHash=token?await helpfulBrowserHash(token):null;
      if(req.method==="DELETE"){
        const removed=await env.DB.prepare("DELETE FROM playdate_participants WHERE playdate_id=? AND cancel_token_hash=?").bind(playdateJoin[1],cancelHash).run();
        if(!removed.meta?.changes)return reply({error:"이 브라우저에서 신청한 내역을 찾을 수 없습니다."},404);
        return reply({ok:true});
      }
      const nickname=norm(data?.nickname,24).replace(/\s+/g," ");
      if(nickname.length<2||/[<>\u0000-\u001f]/.test(nickname))return reply({error:"닉네임을 2~24자로 입력해 주세요."},400);
      const childMonth=data?.child_month??null;
      if(childMonth!==null&&(!Number.isInteger(childMonth)||childMonth<0||childMonth>120)){
        return reply({error:"아기 월령을 0~120개월 사이의 정수로 입력해 주세요."},400);
      }
      const id=playdateJoin[1],localNow=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).replace(" ","T");
      const insert=await env.DB.prepare("INSERT OR IGNORE INTO playdate_participants(playdate_id,nickname,joined_at,child_month,cancel_token_hash) SELECT p.id,?,?,?,? FROM playdates p WHERE p.id=? AND p.approved=1 AND p.starts_at>? AND LOWER(p.nickname)<>LOWER(?) AND (SELECT COUNT(*) FROM playdate_participants pp WHERE pp.playdate_id=p.id) < p.capacity-1 AND NOT EXISTS(SELECT 1 FROM playdate_participants pp WHERE pp.playdate_id=p.id AND LOWER(pp.nickname)=LOWER(?))").bind(nickname,new Date().toISOString(),childMonth,cancelHash,id,localNow,nickname,nickname).run();
      if((insert.meta?.changes||0)===0){
        const meeting=await env.DB.prepare("SELECT nickname,capacity,starts_at FROM playdates WHERE id=? AND approved=1").bind(id).first();
        if(!meeting)return reply({error:"모집글을 찾을 수 없습니다."},404);
        if(meeting.starts_at<=localNow)return reply({error:"이미 시작했거나 지난 모임입니다."},409);
        if(meeting.nickname.toLowerCase()===nickname.toLowerCase())return reply({error:"모임 작성자는 이미 참여 인원에 포함됩니다."},409);
        const match=await env.DB.prepare("SELECT cancel_token_hash FROM playdate_participants WHERE playdate_id=? AND LOWER(nickname)=LOWER(?)").bind(id,nickname).first();
        if(match&&cancelHash&&match.cancel_token_hash===cancelHash)return reply({ok:true},200);
        if(match)return reply({error:"이미 신청한 닉네임입니다."},409);
        return reply({error:"모집이 마감되었습니다."},409);
      }
      return reply({ok:true,message:"참여 신청이 등록되었습니다."},201);
    }
    if(playdateDelete&&!playdateEdit){
      await env.DB.prepare("DELETE FROM playdate_participants WHERE playdate_id=?").bind(playdateDelete[1]).run();
      const result=await env.DB.prepare("DELETE FROM playdates WHERE id=?").bind(playdateDelete[1]).run();
      return (result.meta?.changes||0)>0?reply({ok:true}):reply({error:"삭제할 모임이 없습니다."},404);
    }
    if(playdatePath||playdateEdit){
      if(req.method!=="GET"&&req.method!=="POST"&&!playdateEdit)return reply({error:"허용되지 않은 요청입니다."},405);
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS playdate_numbers (number INTEGER PRIMARY KEY AUTOINCREMENT, playdate_id TEXT NOT NULL UNIQUE)").run();
      await env.DB.prepare(`
        INSERT INTO playdate_numbers(playdate_id)
        SELECT p.id FROM playdates p
        WHERE NOT EXISTS (SELECT 1 FROM playdate_numbers n WHERE n.playdate_id=p.id)
        ORDER BY p.created_at,p.id
      `).run();
      if(req.method==="GET"){
        const rows=await env.DB.prepare(`
          SELECT p.id,p.nickname,p.place,p.starts_at,p.min_month,p.max_month,p.capacity,
            p.details,p.notes,p.region,p.created_at,n.number AS edition,
            COALESCE(p.author_hash=?,0) AS owned
          FROM playdates p JOIN playdate_numbers n ON n.playdate_id=p.id
          WHERE p.approved=1 ORDER BY p.starts_at ASC LIMIT 120
        `).bind(author).all();
        const participants=await env.DB.prepare("SELECT playdate_id,nickname,child_month FROM playdate_participants ORDER BY joined_at ASC LIMIT 3000").all();
        const byId=new Map();
        for(const p of participants.results||[]){
          if(!byId.has(p.playdate_id))byId.set(p.playdate_id,[]);
          byId.get(p.playdate_id).push({nickname:p.nickname,child_month:p.child_month});
        }
        return reply({items:(rows.results||[]).map(p=>{
          const all=byId.get(p.id)||[];
          const participant_details=all.slice(0,Math.max(0,p.capacity-1));
          return {...p,participants:participant_details.map(person=>person.nickname),participant_details,joined_count:1+all.length};
        })});
      }
      if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"입력 형식을 확인해 주세요."},415);
      const raw=await req.text();if(raw.length>4500)return reply({error:"내용이 너무 깁니다."},413);
      let d;try{d=JSON.parse(raw)}catch{return reply({error:"입력 형식이 올바르지 않습니다."},400)}
      if(!d||typeof d!=="object")return reply({error:"입력 형식을 확인해 주세요."},400);
      if(d.website)return reply({ok:true});
      const nickname=norm(d.nickname,24),place=norm(d.place,110),starts_at=norm(d.starts_at,40),region=norm(d.region,24),
      details=norm(d.details,500),notes=norm(d.notes,450),capacity=Number(d.capacity),min=Number(d.min_month),max=Number(d.max_month);
      if((!playdateEdit&&nickname.length<2)||place.length<2||details.length<4||!["Central","East","West","North","South","Unknown"].includes(region)
         ||!Number.isInteger(capacity)||capacity<2||capacity>50||!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>120||min>max)
        return reply({error:"장소·월령·정원·내용을 확인해 주세요."},400);
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(starts_at)||!Number.isFinite(Date.parse(starts_at)))
        return reply({error:"날짜와 시간을 선택해 주세요."},400);
      const meetingAt=Date.parse(starts_at+"+08:00");
      if(!Number.isFinite(meetingAt)||meetingAt<Date.now()-3600000||meetingAt>Date.now()+365*86400000)
        return reply({error:"모임은 앞으로 1년 이내 날짜로 등록해 주세요."},400);
      if(playdateEdit){
        if(!adminAction&&!author)return reply({error:"작성자만 수정할 수 있습니다."},403);
        const id=playdateDelete[1];
        const result=await env.DB.prepare(`
          UPDATE playdates SET place=?,starts_at=?,min_month=?,max_month=?,capacity=?,details=?,notes=?,region=?
          WHERE id=? AND approved=1 AND (?=1 OR author_hash=?)
            AND ?>=(SELECT COUNT(*)+1 FROM playdate_participants WHERE playdate_id=playdates.id)
        `).bind(place,starts_at,min,max,capacity,details,notes,region,id,adminAction?1:0,author,capacity).run();
        if(!result.meta?.changes){
          const permitted=await env.DB.prepare("SELECT id FROM playdates WHERE id=? AND approved=1 AND (?=1 OR author_hash=?)").bind(id,adminAction?1:0,author).first();
          return permitted?reply({error:"정원은 이미 신청한 인원보다 작게 변경할 수 없습니다."},409):reply({error:"이 모임을 수정할 권한이 없습니다."},403);
        }
        return reply({ok:true,id});
      }
      const id=crypto.randomUUID(),now=new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO playdates(id,nickname,place,starts_at,min_month,max_month,capacity,details,notes,region,created_at,approved,author_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?)").bind(id,nickname,place,starts_at,min,max,capacity,details,notes,region,now,author),
        env.DB.prepare("INSERT INTO playdate_numbers(playdate_id) VALUES(?)").bind(id)
      ]);
      return reply({ok:true,id},201);
    }

    if(searchPath){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const q=norm(url.searchParams.get("q"),65);
      if(q.length<2)return reply({items:[]});
      const pattern="%"+q.replace(/[\\%_]/g, v=>"\\"+v)+"%";
      const rec=await env.DB.prepare("SELECT CASE WHEN listing_subcategory IS NULL THEN 'recommendation' ELSE 'listing' END AS kind,category,title,reason AS snippet,id FROM recommendations WHERE approved=1 AND (title LIKE ? ESCAPE '\\' OR reason LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 6").bind(pattern,pattern).all();
      const rev=await env.DB.prepare("SELECT 'review' AS kind,category,product_title AS title,body AS snippet,id FROM product_reviews WHERE approved=1 AND (product_title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 6").bind(pattern,pattern).all();
      const plays=await env.DB.prepare("SELECT 'playdate' AS kind,'playdate' AS category,place AS title,details AS snippet,id FROM playdates WHERE approved=1 AND (place LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\') ORDER BY starts_at DESC LIMIT 5").bind(pattern,pattern).all();
      return reply({items:[...(rec.results||[]),...(rev.results||[]),...(plays.results||[])]});
    }
    if(summaryPath){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const rows=await env.DB.prepare("SELECT category,product_title,COUNT(*) AS total,SUM(CASE WHEN sentiment='good' THEN 1 ELSE 0 END) AS good,SUM(CASE WHEN sentiment='neutral' THEN 1 ELSE 0 END) AS neutral,SUM(CASE WHEN sentiment='bad' THEN 1 ELSE 0 END) AS bad FROM product_reviews WHERE approved=1 GROUP BY category,product_title").all();
      return reply({items:rows.results||[]});
    }
    if(recentPath){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const existingToken=helpfulBrowserToken(req);
      const token=existingToken||crypto.randomUUID();
      const hash=await helpfulBrowserHash(token);
      await prepareHelpful(env.DB);
      const rows=await env.DB.prepare(`
        SELECT r.id,r.nickname,r.body,r.sentiment,r.created_at,r.category,r.product_title,
          r.photo_data IS NOT NULL AS has_photo,
          (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id=r.id) AS helpful_count,
          EXISTS(SELECT 1 FROM review_helpful_votes v WHERE v.review_id=r.id AND v.browser_hash=?) AS helped
        FROM product_reviews r WHERE r.approved=1 ORDER BY r.created_at DESC LIMIT 6
      `).bind(hash).all();
      const headers=helpfulCookieHeaders(!existingToken&&(rows.results||[]).length?token:null);
      return new Response(JSON.stringify({items:rows.results||[]}),{headers});
    }
    if(listingRatingsPath){
      if(req.method!=="GET"&&req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
      const ratingCookie="sgbg_rating";
      const existingToken=helpfulBrowserToken(req,ratingCookie);
      if(req.method==="GET"){
        const token=existingToken||crypto.randomUUID();
        const hash=await helpfulBrowserHash(token);
        await prepareListingRatings(env.DB);
        const rows=await env.DB.prepare(`
          SELECT place_key,COUNT(*) AS total,AVG(stars) AS average,
            MAX(CASE WHEN browser_hash=? THEN stars ELSE 0 END) AS my_rating
          FROM listing_ratings
          WHERE place_key LIKE 'curated:%' OR EXISTS (
            SELECT 1 FROM recommendations r
            WHERE r.id=substr(place_key,11) AND r.approved=1 AND r.category IN ('grocery','gear','outing','clinic') AND r.listing_subcategory IS NOT NULL
          )
          GROUP BY place_key
        `).bind(hash).all();
        return new Response(JSON.stringify({items:rows.results||[]}),{headers:helpfulCookieHeaders(existingToken?null:token,ratingCookie)});
      }
      if(req.headers.get("origin")&&req.headers.get("origin")!==url.origin)return reply({error:"허용되지 않은 사이트입니다."},403);
      if(!existingToken)return reply({error:"페이지를 새로고침한 뒤 별점을 다시 눌러 주세요."},409);
      const raw=await req.text();
      if(raw.length>1000)return reply({error:"입력이 너무 깁니다."},413);
      let data;try{data=JSON.parse(raw)}catch{return reply({error:"입력 형식을 확인해 주세요."},400)}
      const placeKey=norm(data?.place_key,150),stars=data?.stars;
      if(!Number.isInteger(stars)||stars<1||stars>5)return reply({error:"1점부터 5점까지 선택해 주세요."},400);
      const hash=await helpfulBrowserHash(existingToken);
      await prepareListingRatings(env.DB);
      if(placeKey.startsWith("curated:")&&CURATED_LISTINGS.has(placeKey.slice(8))){
        await env.DB.prepare("INSERT INTO listing_ratings(place_key,browser_hash,stars) VALUES(?,?,?) ON CONFLICT(place_key,browser_hash) DO UPDATE SET stars=excluded.stars").bind(placeKey,hash,stars).run();
      }else if(/^community:[0-9a-f-]{36}$/.test(placeKey)){
        const saved=await env.DB.prepare(`
          INSERT INTO listing_ratings(place_key,browser_hash,stars)
          SELECT ?,?,? FROM recommendations
          WHERE id=? AND approved=1 AND category IN ('grocery','gear','outing','clinic') AND listing_subcategory IS NOT NULL
          ON CONFLICT(place_key,browser_hash) DO UPDATE SET stars=excluded.stars
        `).bind(placeKey,hash,stars,placeKey.slice(10)).run();
        if(!saved.meta?.changes)return reply({error:"항목을 찾을 수 없습니다."},404);
      }else{return reply({error:"항목을 찾을 수 없습니다."},404)}
      const rating=await env.DB.prepare("SELECT COUNT(*) AS total,AVG(stars) AS average FROM listing_ratings WHERE place_key=?").bind(placeKey).first();
      return reply({...rating,place_key:placeKey,my_rating:stars});
    }
    if(helpfulPath){
      if(req.method!=="POST")return reply({error:"허용되지 않은 요청입니다."},405);
      if(req.headers.get("origin")&&req.headers.get("origin")!==url.origin)return reply({error:"허용되지 않은 사이트입니다."},403);
      const token=helpfulBrowserToken(req);
      if(!token)return reply({error:"페이지를 새로고침한 뒤 다시 눌러 주세요."},409);
      const id=helpfulPath[1];
      const hash=await helpfulBrowserHash(token);
      await prepareHelpful(env.DB);
      await env.DB.prepare(`
        INSERT OR IGNORE INTO review_helpful_votes (review_id,browser_hash)
        SELECT id,? FROM product_reviews WHERE id=? AND approved=1
      `).bind(hash,id).run();
      const review=await env.DB.prepare(`
        SELECT (SELECT COUNT(*) FROM review_helpful_votes v WHERE v.review_id=r.id) AS helpful_count
        FROM product_reviews r WHERE r.id=? AND r.approved=1
      `).bind(id).first();
      if(!review)return reply({error:"후기를 찾을 수 없습니다."},404);
      return reply({helpful_count:review.helpful_count,helped:true});
    }
    if(listingPhoto){
      if(req.method!=="GET")return reply({error:"허용되지 않은 요청입니다."},405);
      const data=await env.DB.prepare("SELECT photo_data FROM recommendations WHERE id=? AND approved=1").bind(listingPhoto[1]).first();
      const payload=data?.photo_data;
      if(!payload)return reply({error:"등록된 사진이 없습니다."},404);
      const bytes=Uint8Array.from(atob(payload.slice("data:image/jpeg;base64,".length)),c=>c.charCodeAt(0));
      return new Response(bytes,{headers:{"content-type":"image/jpeg","cache-control":"no-store","x-content-type-options":"nosniff"}});
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
      const raw=await req.text();if(raw.length>243000)return reply({error:"내용 또는 사진이 너무 큽니다."},413);
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
      if(!["grocery","gear","medicine","clinic"].includes(category)||title.length<2||body.length<8||!["good","neutral","bad"].includes(sentiment))return reply({error:"제품명·후기(8자 이상)·평가를 확인해 주세요."},400);
      const id=crypto.randomUUID(),createdAt=new Date().toISOString();
      await env.DB.prepare("INSERT INTO product_reviews (id,category,product_title,nickname,body,sentiment,created_at,approved,photo_data) VALUES (?,?,?,?,?,?,?,1,?)").bind(id,category,title,nickname,body,sentiment,createdAt,photo).run();
      return reply({ok:true,id},201);
    }
    if(isHealth)return reply({database:"connected",table:"ready",admin_delete_password:(env.ADMIN_DELETE_SECRET&&env.ADMIN_DELETE_SECRET.length>=8)?"configured":"not_configured"});
    if(req.method==="GET"&&!deleteMatch){
      const listings=url.searchParams.get("listings")==="1";
      const columns="id,category,title,url,reason,nickname,created_at,listing_subcategory,listing_region,photo_data IS NOT NULL AS has_photo,COALESCE(author_hash=?,0) AS owned";
      const rows=await env.DB.prepare(listings
        ?"SELECT "+columns+" FROM recommendations WHERE approved=1 AND listing_subcategory IS NOT NULL ORDER BY created_at DESC"
        :"SELECT "+columns+" FROM recommendations WHERE approved=1 ORDER BY created_at DESC LIMIT 150").bind(author).all();
      return reply({items:rows.results||[]});
    }
    if(req.method!=="POST"&&!recommendationEdit)return reply({error:"허용되지 않은 요청입니다."},405);
    if(recommendationEdit&&!author)return reply({error:"작성자만 수정할 수 있습니다."},403);
    if(req.headers.get("origin")&&req.headers.get("origin")!==url.origin)return reply({error:"허용되지 않은 출처입니다."},403);
    if(!(req.headers.get("content-type")||"").startsWith("application/json"))return reply({error:"JSON 형식으로 입력해 주세요."},415);
    const body=await req.text();
    if(body.length>235000)return reply({error:"내용 또는 사진이 너무 큽니다."},413);
    let d;try{d=JSON.parse(body)}catch{return reply({error:"입력 형식을 확인해 주세요."},400)}
    if(!d||typeof d!=="object")return reply({error:"입력 형식을 확인해 주세요."},400);
    if(d.website)return reply({ok:true});
    if(d.photo!==undefined&&d.photo!==null){
      const error=listingPhotoError(d.photo,d.photo_consent);
      if(error)return error;
    }
    const category=norm(d.category,30),title=norm(d.title,90),reason=norm(d.reason,400);
    const nickname=norm(d.nickname,24)||"익명",link=norm(d.url,600);
    const listingSubcategory=norm(d.listing_subcategory,40),listingRegion=norm(d.listing_region,24);
    if(listingSubcategory&&(!Object.hasOwn(LISTING_SUBCATEGORIES,category)||!LISTING_SUBCATEGORIES[category].includes(listingSubcategory))){
      return reply({error:"등록할 세부 분류를 선택해 주세요."},400);
    }
    if(listingSubcategory&&(category==="outing"||category==="clinic"&&listingRegion)&&!LISTING_REGIONS.has(listingRegion)){
      return reply({error:"장소가 있는 지역을 선택해 주세요."},400);
    }
    if(!CATEGORIES.has(category)||title.length<2||reason.length<8||nickname.length<2)return reply({error:"카테고리·닉네임·제목·추천 이유를 확인해 주세요."},400);
    if(link){try{const u=new URL(link);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)throw Error("URL")}catch{return reply({error:"정확한 웹사이트 링크를 입력해 주세요."},400)}}
    const sub=listingSubcategory||null,region=sub&&["outing","clinic"].includes(category)?listingRegion||"Unknown":null;
    if(recommendationEdit){
      const id=deleteMatch[1];
      const updated=await env.DB.prepare(`
        UPDATE recommendations SET category=?,title=?,url=?,reason=?,nickname=?,listing_subcategory=?,listing_region=?,
          photo_data=CASE WHEN ? THEN ? ELSE photo_data END
        WHERE id=? AND approved=1 AND author_hash=?
      `).bind(category,title,link,reason,nickname,sub,region,d.photo!==undefined?1:0,d.photo??null,id,author).run();
      if(!updated.meta?.changes)return reply({error:"이 추천 글을 수정할 권한이 없습니다."},403);
      const item=await env.DB.prepare("SELECT photo_data IS NOT NULL AS has_photo FROM recommendations WHERE id=?").bind(id).first();
      return reply({ok:true,id,has_photo:item?.has_photo||0});
    }
    const id=crypto.randomUUID(),created_at=new Date().toISOString();
    await env.DB.prepare("INSERT INTO recommendations (id,category,title,url,reason,created_at,approved,nickname,listing_subcategory,listing_region,photo_data,author_hash) VALUES (?,?,?,?,?,?,1,?,?,?,?,?)")
      .bind(id,category,title,link,reason,created_at,nickname,sub,region,d.photo??null,author).run();
    return reply({ok:true,id,has_photo:d.photo?1:0},201);
  }catch(err){return reply({error:"데이터베이스 처리 중 오류가 발생했습니다. 배포 및 D1 설정을 확인해 주세요."},500)}
}};
