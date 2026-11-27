const categories = [
  ['all','All','전체'],['res','Residential','주거'],['public','Public Housing','공공주택'],
  ['edu','Education','교육'],['civic','Civic & Community','공공·커뮤니티'],
  ['technical','Technical Design','기술 설계'],['academic','Academic','학부 작품'],['other','Other Design','기타 디자인']
];
const projects = [
  {id:'reuse',title:['Remodeling an Abandoned Building','유휴 건축물 리모델링'], tags:['academic','civic'], type:['Academic · Adaptive reuse','학부 · 리모델링'], description:['An academic proposal to turn an unused building into a public destination. The design develops the relationship between the existing structure, the street and a new multi-level library interior.','쓰이지 않던 건물을 시민을 위한 공간으로 바꾸는 학부 설계입니다. 기존 구조와 가로, 여러 층을 잇는 도서관 내부의 관계를 풀었습니다.'], images:[['reuse.webp','Street elevation at dusk','해질녘 가로 투시도'],['library.webp','Library and interior perspectives','도서관과 실내 투시도'],['reuse-study.webp','Site and existing building analysis','대지 및 기존 건물 분석']]},
  {id:'yesullo',title:['Seongpo Yesullo Revival Project','성포 예술로 재생 프로젝트'], tags:['academic','civic'],type:['Academic · Public realm','학부 · 공공 공간'],description:['A study of how public space and cultural programmes can reconnect the Seongpo Yesullo area. The section and perspectives show how the proposal links street level, shared outdoor space and indoor programmes.','공공 공간과 문화 프로그램으로 성포 예술로 일대를 연결하는 학부 설계입니다. 단면과 투시도에서 가로와 공유 외부 공간, 실내 프로그램의 관계를 볼 수 있습니다.'],images:[['yesullo.webp','Section and public space perspectives','단면 및 공공 공간 투시도'],['yesullo-diagrams.webp','Public realm design diagrams','공공 공간 설계 다이어그램']]},
  {id:'hanam',title:['Hanam Gyosan A5BL','하남 교산 A5BL'],tags:['res','public'],type:['2023 · First Prize','2023 · 1등'],description:['A public housing design competition in Hanam, South Korea. Portfolio pp. 3–5 document the housing ensemble and the composition of its skyline.','경기도 하남의 공공주택 설계공모입니다. 포트폴리오 3–5쪽에 단지 구성과 스카이라인 계획이 실려 있습니다.']},
  {id:'ansan',title:['Ansan Jangsang A4BL','안산 장상 A4BL'],tags:['res','public'],type:['2023 · First Prize','2023 · 1등'],description:['A winning proposal for 1,433 homes in Ansan, South Korea. My competition work covered concept development, unit and community planning, and design presentation.','경기도 안산의 1,433세대 공공주택 공모 당선작입니다. 기본 콘셉트, 단위세대와 커뮤니티 시설 계획, 설계 제안 작업에 참여했습니다.']},
  {id:'yangjeong',title:['Namyangju Yangjeong S10BL','남양주 양정 S10BL'],tags:['res','public','technical'],type:['Technical design · Public housing','기술 설계 · 공공주택'],description:['Technical work on public housing in Namyangju, including underground parking and schedules for ancillary facilities. The project team had 78 of 83 value engineering proposals accepted.','경기도 남양주의 공공주택 기술 설계에 참여해 지하주차장과 부대시설 면적표 등을 작업했습니다. 프로젝트팀의 VE 제안 83건 중 78건이 채택됐습니다.']},
  {id:'goyang',title:['Goyang Tanhyeon A1BL','고양 탄현 A1BL'],tags:['res','public'],type:['2022 · Second Prize','2022 · 2등'],description:['A public housing proposal in Goyang, South Korea, documented through site studies and unit layouts in the portfolio.','경기도 고양의 공공주택 공모안입니다. 대지 분석과 단위세대 계획으로 설계안을 발전시켰습니다.']},
  {id:'barun',title:['Barun Kindergarten / Elementary School','바른유치원·초등학교'],tags:['edu'],type:['2021 · First Prize','2021 · 1등'],description:['An education competition proposal in Sejong, South Korea. The campus plan brings kindergarten and elementary school facilities together on one site.','세종시의 교육시설 설계공모 당선작입니다. 한 대지에 유치원과 초등학교를 함께 배치하는 캠퍼스 계획입니다.']},
  {id:'other',title:['Additional Design Works','기타 디자인 작업'],tags:['other'],type:['Graphic & visual design','그래픽 및 시각 디자인'],description:['Selected graphic and visual design work appears on the last page of the original portfolio. My graphic design experience includes work at SUNSAVE in 2016–2017.','원본 포트폴리오 마지막 쪽에는 그래픽과 시각 디자인 작업을 정리했습니다. 2016–2017년 SUNSAVE에서도 그래픽 디자인을 했습니다.']}
];
const timeline = [
 ['2013','Started playing League of Legends','리그 오브 레전드 시작'],
 ['2016–2017','Visual Designer at SUNSAVE','SUNSAVE 시각 디자이너'],
 ['2017–2018','Streaming and community management','방송 및 커뮤니티 운영'],
 ['2018','Architecture exchange at NUS, Singapore','싱가포르 NUS 건축학 교환학생'],
 ['2019','Architecture internship at Espacegroup','Espacegroup 건축 인턴'],
 ['2019','Ladies League main event, Top Lane','레이디스 리그 본선 진출, 탑 라이너'],
 ['2019–2020','Twitch content creation, 420+ live hours','트위치 콘텐츠 제작, 420시간 이상 생방송'],
 ['2021–2024','Architectural Manager at Kangnam Architects & Planners','강남종합건축사사무소 건축 실무'],
 ['Sep 2021','Started figure skating','피겨스케이팅 시작'],
 ['2023','Five competition entries, five First Prizes','설계공모 5건 참여, 모두 1등'],
 ['2024','Relocated to Singapore','싱가포르 이주'],
 ['Sep 2026','Started ballet','발레 시작'],
 ['Current','Independent creative project, momoog','독립 창작 프로젝트 momoog.']
];
const champions = [
 ['Caitlyn','The Sheriff of Piltover','필트오버의 보안관','Caitlyn.jpg','#9278e0'],
 ['Ezreal','The Prodigal Explorer','무모한 탐험가','Ezreal.jpg','#70bfe8'],
 ['Miss Fortune','The Bounty Hunter','현상금 사냥꾼','MissFortune.jpg','#e27d93']
];
// Add verified media as {src:'assets/file.webp', kind:'image', alt:['English','한국어']}
// or {src:'assets/clip.mp4', kind:'video', alt:['English','한국어']}.
const media = {ice:[],ballet:[],creative:[]};

const portfolioBoards = {
  hanam: [3,[
    ['Aerial rendering and masterplan concept','조감도와 단지 계획'],
    ['Street perspectives and façade studies','가로 투시도와 입면 디자인'],
    ['Skyline alternatives and massing studies','스카이라인 대안과 매스 스터디']
  ]],
  ansan: [6,[
    ['Aerial rendering and cluster concept','조감도와 클러스터 계획'],
    ['Site plan and pedestrian connections','배치도와 보행 동선'],
    ['Community facilities and unit planning','커뮤니티 시설과 단위세대 계획']
  ]],
  yangjeong: [9,[
    ['Aerial rendering and project overview','조감도와 프로젝트 개요'],
    ['Community facility and amenity drawings','부대시설 및 커뮤니티 공간 도면']
  ]],
  goyang: [11,[
    ['Aerial rendering and site strategy','조감도와 배치 전략'],
    ['Housing research and design responses','주거 수요 분석과 설계 방향'],
    ['Unit plans and layouts','단위세대 평면과 유형별 배치']
  ]],
  barun: [14,[
    ['Campus aerial rendering and open-school concept','학교 조감도와 열린 학교 콘셉트'],
    ['Campus site plan and shared facilities','캠퍼스 배치도와 공유 시설'],
    ['Campus floor plan and programme layout','학교 평면과 프로그램 배치']
  ]],
  reuse: [17,[
    ['Reuse proposal and exterior perspective','리모델링 제안과 외부 투시도'],
    ['Site and existing structure analysis','대지와 기존 구조 분석'],
    ['Building section and floor plans','건물 단면과 층별 평면도'],
    ['Library and interior perspectives','도서관과 실내 투시도']
  ]],
  yesullo: [21,[
    ['Urban context and interview research','도시 맥락과 인터뷰 조사'],
    ['Public space strategies and design diagrams','공공 공간 전략과 설계 다이어그램'],
    ['Section and public space perspectives','단면과 공공 공간 투시도']
  ]],
  other: [24,[['Competition concepts and community facility visuals','공모 콘셉트와 커뮤니티 시설 시각화']]]
};
const covers = {hanam:'cover-03.webp',ansan:'cover-06.webp',yangjeong:'cover-09.webp',
  goyang:'cover-11.webp',barun:'cover-14.webp',reuse:'reuse.webp',
  yesullo:'cover-23.webp',other:'cover-24.webp'};
const roles = {
  hanam:['I proposed the masterplan concept, developed façade strategies and prepared elevations for the submission.','마스터플랜 콘셉트를 제안하고 주동과 부대시설의 입면 방향을 발전시켜 제출 도면을 정리했습니다.'],
  ansan:['The proposal links three housing clusters with a circular pedestrian route. I developed the site concept and plans for the welfare and education clusters, and directed CG visual planning.','세 개 주거 클러스터를 순환 보행로로 연결하는 계획입니다. 배치 콘셉트를 제안하고 복지·교육 클러스터의 계획안을 발전시켰으며 CG 연출 방향을 잡았습니다.'],
  yangjeong:['I prepared detailed drawings for shared amenities and coordinated revisions with MEP engineers.','공용 편의시설의 상세 도면을 작성하고 설비 엔지니어와 협의해 도면을 수정했습니다.'],
  goyang:['I researched changing household needs, developed schematic unit layouts and proposed site-planning strategies.','가구별 생활 방식의 변화를 조사하고 단위세대 계획안과 단지 배치 방향을 제안했습니다.'],
  barun:['I proposed site layout options, planned shared facilities and prepared the project report and drawing set.','캠퍼스 배치 대안을 제안하고 공유 시설을 계획했으며 설계설명서와 제출 도면을 정리했습니다.'],
  reuse:['Graduation studio, 2021 · Anyang · Bus terminal, library, shared office and restaurant','2021 졸업설계 · 안양 · 버스터미널, 도서관, 공유 오피스, 식당'],
  yesullo:['Undergraduate studio, 2020 · Ansan · Individual design based on group research','2020 학부 설계 · 안산 · 팀 조사에 기반한 개인 설계']
};
for (const project of projects) {
  const [start,captions] = portfolioBoards[project.id];
  project.cover = covers[project.id];
  project.images = captions.map(([english,korean],offset) =>
    ['board-'+String(start+offset).padStart(2,'0')+'.webp',english,korean]);
  project.role = roles[project.id];
}
const professionalTimeline = [
  ['2018','NUS exchange','NUS 교환학생','Education','학업'],
  ['2019','Espacegroup','에스파스건축','Architecture internship','건축 인턴'],
  ['2021–24','Kangnam Architects','강남종합건축','Architectural Manager','건축 실무'],
  ['2023','5 first prizes','공모 5건 1등','Design competitions','설계공모'],
  ['2024','Singapore','싱가포르','Relocation','이주']
];
const personalTimeline = [
  ['2013','League of Legends','리그 오브 레전드','Gaming','게임'],
  ['2019','Ladies League','레이디스 리그','Main event · Top Lane','본선 · 탑 라이너'],
  ['2019–20','Twitch','트위치','420+ live hours','420시간 이상 방송'],
  ['2021','Figure skating','피겨스케이팅','Started in September','9월 시작'],
  ['2026','Ballet','발레','Started in September','9월 시작'],
  ['Now','momoog.','momoog.','Independent creative project','독립 창작 프로젝트']
];

const projectOrder = ['ansan','hanam','yangjeong','goyang','barun','reuse','yesullo','other'];
projects.sort((a,b) => projectOrder.indexOf(a.id) - projectOrder.indexOf(b.id));
