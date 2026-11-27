// Cloudflare Pages advanced mode. Bind a D1 database as DB in Cloudflare Pages settings.
const cats=new Set(["grocery","clinic","medicine","gear","outing","preschool","fruit","living","prep"]);
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
const clean=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/api/recommendations") return env.ASSETS.fetch(request);
  if(!env.DB) return json({error:"추천 게시판 데이터베이스 연결이 아직 완료되지 않았습니다."},503);
  try{
    if(request.method==="GET"){
      const rows=await env.DB.prepare("SELECT id,category,title,url,reason,created_at FROM recommendations WHERE approved=1 ORDER BY created_at DESC LIMIT 150").all();
      return json({items:rows.results||[]});
    }
    if(request.method!=="POST") return json({error:"Method not allowed"},405);
    if((request.headers.get("content-type")||"").split(";")[0]!=="application/json")return json({error:"JSON 형식으로 보내 주세요."},415);
    const body=await request.text();if(body.length>3500)return json({error:"글이 너무 깁니다."},413);
    let data;try{data=JSON.parse(body)}catch{return json({error:"입력 형식을 확인해 주세요."},400)}
    if(data.website)return json({ok:true});
    const category=clean(data.category,30),title=clean(data.title,90),reason=clean(data.reason,400),link=clean(data.url,600);
    if(!cats.has(category)||title.length<2||reason.length<8)return json({error:"카테고리·추천 대상·추천 이유를 확인해 주세요."},400);
    if(link){try{const u=new URL(link);if(u.protocol!=="https:"&&u.protocol!=="http:")throw 1;if(u.username||u.password)throw 1}catch{return json({error:"유효한 웹사이트 링크를 입력해 주세요."},400)}}
    const id=crypto.randomUUID(),created_at=new Date().toISOString();
    await env.DB.prepare("INSERT INTO recommendations(id,category,title,url,reason,created_at,approved) VALUES(?,?,?,?,?,?,1)").bind(id,category,title,link,reason,created_at).run();
    return json({ok:true,id},201);
  }catch(err){return json({error:"게시판에 일시적인 오류가 발생했습니다."},500)}
}};
