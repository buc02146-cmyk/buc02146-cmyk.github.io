const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const detail = $('#detail');
const lightbox = $('#lightbox');
const imageView = $('#image-view');
let language = 0;
let category = 'all';
let selected = 0;
let currentProject = null;
let gallery = [];
let imageIndex = 0;
const en = new Map($$('[data-ko]').map(element => [element, element.innerHTML]));
const local = (english, korean) => language ? korean : english;
const asset = (file) => 'assets/' + file;

function node(tag, attributes = {}, content = '') {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.textContent = content;
  return element;
}
function renderWork() {
  $('#filters').replaceChildren(...categories.map(([key, english, korean]) => {
    const button = node('button', {'aria-pressed':String(key===category)},local(english,korean));
    button.onclick = () => {
      category = key;
      renderWork();
      $('#filters [aria-pressed=true]').focus({preventScroll:true});
    };
    return button;
  }));
  $('#projects').replaceChildren(...projects.filter(project => category==='all' || project.tags.includes(category)).map(project => {
    const image = project.cover;
    const button = node('button',{class:'project '+'illustrated','aria-haspopup':'dialog'});
    button.onclick = () => openProject(project);
    if (image) button.append(node('img',{src:asset(image),alt:'',loading:'lazy',decoding:'async'}));
    const label = node('span',{class:'project-line'});
    label.append(node('span',{},project.title[language]),node('small',{},project.type[language]));
    button.append(label);
    return button;
  }));
}
function renderTimeline() {
  for (const [id, entries] of [
    ['professional-timeline', professionalTimeline], ['personal-timeline', personalTimeline]
  ]) {
    $('#'+id).replaceChildren(...entries.map(([date, english, korean, detailEn, detailKo]) => {
      const item = node('li');
      item.append(node('span',{class:'track-year'},date),node('strong',{},local(english,korean)),
        node('span',{class:'track-context'},local(detailEn,detailKo)));
      return item;
    }));
  }
}
function showChampion(index, animate) {
  selected = index;
  const [name, english, korean, file, color] = champions[index];
  $('#champ-name').textContent = name;
  $('#champ-title').textContent = local(english,korean);
  $('#champ').style.setProperty('--champ-color',color);
  $$('#champ-tabs button').forEach((button,i) => button.setAttribute('aria-pressed',String(i===index)));
  const image = $('#splash');
  image.alt = local(name+' official splash art',name+' 공식 스플래시 아트');
  const next = asset(file);
  if (image.getAttribute('src') !== next) {
    image.src = next;
    if (animate && !reduced.matches) image.animate([{opacity:.2},{opacity:1}],{duration:430});
  }
}
function renderMedia() {
  for (const [key, files] of Object.entries(media)) {
    const container = $('#'+key+'-media');
    container.classList.toggle('media-set', files.length > 0);
    container.replaceChildren(...files.map(file => file.kind==='video'
      ? node('video',{src:file.src,controls:'',preload:'metadata','aria-label':file.alt[language]})
      : node('img',{src:file.src,alt:file.alt[language],loading:'lazy'})));
  }
}
function setLanguage(index) {
  language = index;
  root.lang = local('en','ko');
  $('#lang').textContent = local('KR','EN');
  $('#lang').setAttribute('aria-label',local('한국어로 보기','View in English'));
  for (const [element, english] of en) {
    if (language) element.textContent = element.dataset.ko;
    else element.innerHTML = english;
  }
  renderWork();
  renderTimeline();
  showChampion(selected,false);
  renderMedia();
}
function openProject(project) {
  currentProject = project;
  const wrapper = $('#detail-body');
  wrapper.replaceChildren(node('p',{class:'eyebrow'},project.type[language]),node('h3',{id:'detail-title'},project.title[language]),node('p',{},project.description[language]));
  if (project.role) wrapper.append(node('p',{class:'project-role'},project.role[language]));
  if (['hanam','ansan','yangjeong','goyang','barun'].includes(project.id)) {
    wrapper.append(node('p',{class:'eyebrow'},local('Team project · Kangnam Architects & Planners','팀 프로젝트 · 강남종합건축사사무소')));
  }
  if (project.images) {
    wrapper.append(node('h4',{},local('Portfolio boards','포트폴리오 보드')));
    const grid = node('div',{class:'detail-media'});
    project.images.forEach(([file,english,korean],index) => {
      const button = node('button',{'aria-haspopup':'dialog'});
      button.append(node('img',{src:asset(file),alt:local(english,korean),loading:'lazy'}),node('span',{},local(english,korean)));
      button.onclick = () => {
        gallery = currentProject.images;
        showImage(index);
        lightbox.showModal();
      };
      grid.append(button);
    });
    wrapper.append(grid);
  }
  detail.showModal();
  detail.scrollTop = 0;
}
function showImage(index) {
  imageIndex = (index + gallery.length) % gallery.length;
  const [file,english,korean] = gallery[imageIndex];
  const image = $('#large-image');
  image.src = asset(file);
  image.alt = local(english,korean);
  $('#image-count').textContent = (imageIndex+1)+' / '+gallery.length;
  imageView.classList.remove('zoomed');
  $('#zoom').setAttribute('aria-pressed','false');
  imageView.scrollTo(0,0);
}
$('#feature-project').onclick = () => openProject(projects.find(project => project.id==='ansan'));
$('#close').onclick = () => detail.close();
$('#exit-gallery').onclick = () => lightbox.close();
$('#prev').onclick = () => showImage(imageIndex-1);
$('#next').onclick = () => showImage(imageIndex+1);
$('#zoom').onclick = () => $('#zoom').setAttribute('aria-pressed',String(imageView.classList.toggle('zoomed')));
$('#full').hidden = !lightbox.requestFullscreen;
$('#full').onclick = async () => {
  if (document.fullscreenElement === lightbox) await document.exitFullscreen();
  else await lightbox.requestFullscreen().catch(() => {});
};
lightbox.addEventListener('close', () => {
  if (document.fullscreenElement===lightbox) document.exitFullscreen().catch(() => {});
});
for (const dialog of [detail,lightbox]) dialog.addEventListener('click',event => {
  if (event.target===dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
  }
});
let swipeStart;
imageView.addEventListener('pointerdown',event => {swipeStart=event.clientX;});
imageView.addEventListener('pointerup',event => {
  if (event.pointerType==='touch' && !imageView.classList.contains('zoomed') && Math.abs(event.clientX-swipeStart)>45) {
    showImage(imageIndex+(event.clientX<swipeStart?1:-1));
  }
});
const menu = $('#menu');
const nav = $('#nav');
function closeMenu() {
  nav.classList.remove('open');
  menu.setAttribute('aria-expanded','false');
}
menu.onclick = () => menu.setAttribute('aria-expanded',String(nav.classList.toggle('open')));
nav.onclick = event => {if(event.target.matches('a')) closeMenu();};
$('#lang').onclick = () => {
  setLanguage(1-language);
  try {localStorage.setItem('language',root.lang);} catch {}
};
function setTheme(theme) {
  root.dataset.theme = theme;
  $('#theme').setAttribute('aria-pressed',String(theme==='dark'));
}
$('#theme').onclick = () => {
  setTheme(root.dataset.theme==='dark'?'light':'dark');
  try {localStorage.setItem('theme',root.dataset.theme);} catch {}
};
let savedLang = 'en';
try {
  savedLang = localStorage.getItem('language') || 'en';
  setTheme(localStorage.getItem('theme') || 'light');
} catch {}
setLanguage(savedLang==='ko'?1:0);
$('#filters').hidden = false;
$$('#champ-tabs button').forEach((button,index) => {button.onclick = () => showChampion(index,true);});
const keys = new Map($$('#keys button').map(button => [button.dataset.key,button]));
const keyTimers = new Map();
function hit(key) {
  const button = keys.get(key);
  const output = button.querySelector('output');
  output.value = Number(output.value) + 1;
  button.classList.add('active');
  clearTimeout(keyTimers.get(key));
  keyTimers.set(key,setTimeout(() => button.classList.remove('active'),150));
}
for (const [key,button] of keys) button.onclick = () => hit(key);
$('#reset').onclick = () => keys.forEach(button => {button.querySelector('output').value=0;});
let labVisible = false;
document.addEventListener('keydown',event => {
  if (lightbox.open) {
    if (event.key==='ArrowRight') showImage(imageIndex+1);
    if (event.key==='ArrowLeft') showImage(imageIndex-1);
    return;
  }
  if (event.key==='Escape' && nav.classList.contains('open')) {
    closeMenu();
    menu.focus();
  }
  const key = event.key.toLowerCase();
  if (!detail.open && labVisible && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && keys.has(key)) hit(key);
});
new IntersectionObserver(([entry]) => {labVisible=entry.isIntersecting;}).observe($('.terminal'));
const headings = $$('#nav a').map(link => $(link.getAttribute('href')));
function scrollState() {
  const max = root.scrollHeight - innerHeight;
  $('#progress').style.transform = 'scaleX('+(max>0?scrollY/max:0)+')';
  const active = headings.findLast(section => section.getBoundingClientRect().top < innerHeight*.52);
  $$('#nav a').forEach(link => {
    if (link.hash === '#'+active?.id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  });
  for (const track of $$('.track')) {
    const rect = track.getBoundingClientRect();
    const line = Math.min(1,Math.max(0,(innerHeight*.88-rect.top)/Math.max(130,rect.height)));
    track.style.setProperty('--line',reduced.matches?1:line);
  }
  const feature = $('.feature-frame');
  const rect = feature.getBoundingClientRect();
  const displacement = Math.max(-36, Math.min(36,(innerHeight*.5-rect.top-rect.height*.5)*.13));
  feature.style.setProperty('--parallax',reduced.matches?'0px':displacement+'px');
}
let scrollFrame;
addEventListener('scroll',() => {
  if (scrollFrame) return;
  scrollFrame=requestAnimationFrame(() => {scrollState();scrollFrame=0;});
},{passive:true});
addEventListener('resize',scrollState);
scrollState();
root.classList.toggle('motion',!reduced.matches);
const reveals = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('seen');
    if (entry.target.matches('.stats') && !reduced.matches) {
      const values = [...entry.target.querySelectorAll('[data-count]')];
      const started = performance.now();
      function count(now) {
        const t = Math.min(1,(now-started)/950);
        for (const item of values) item.textContent = Math.round(Number(item.dataset.count)*(1-(1-t)**3)).toLocaleString('en-SG')+(item.dataset.tail||'');
        if (t<1) requestAnimationFrame(count);
      }
      requestAnimationFrame(count);
    }
    reveals.unobserve(entry.target);
  }
},{threshold:.22});
$$('.stats,.movement-panel,.architecture-feature,.track').forEach(element => reveals.observe(element));

const canvas = $('#wire');
const ctx = canvas.getContext('2d');
const hero = $('.hero');
let pointer=0, visible=true, frame=0;
hero.addEventListener('pointermove',event => {pointer=event.clientX/innerWidth-.5;});
hero.addEventListener('pointerleave',() => {pointer=0;});
new ResizeObserver(() => {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio,2);
  canvas.width = rect.width*ratio;
  canvas.height = rect.height*ratio;
  drawWire(performance.now());
}).observe(canvas);
new IntersectionObserver(([entry]) => {
  visible=entry.isIntersecting;
  if (visible && !frame && !reduced.matches) frame=requestAnimationFrame(wireFrame);
}).observe(hero);
reduced.addEventListener('change',() => {
  root.classList.toggle('motion',!reduced.matches);
  if (reduced.matches) drawWire(0);
  else if (visible && !frame) frame=requestAnimationFrame(wireFrame);
  scrollState();
});
function drawWire(time) {
  if (!ctx) return;
  const {width,height}=canvas;
  ctx.clearRect(0,0,width,height);
  const size=Math.min(width,height)*.40;
  const angle=reduced.matches?.5:time/7600+pointer;
  const project = (u,v) => {
    const radius=.8+.28*Math.cos(v);
    const x=radius*Math.cos(u), y=radius*Math.sin(u), z=.35*Math.sin(v);
    const a=x*Math.cos(angle)-z*Math.sin(angle);
    const depth=x*Math.sin(angle)+z*Math.cos(angle);
    return [width*.64+a*size,height*.46+(y*.7+depth*.51)*size];
  };
  for (let band=0;band<16;band++) {
    ctx.beginPath();
    ctx.strokeStyle=band%4===0?'#547526aa':'#43563855';
    for(let step=0;step<=72;step++) {
      const [x,y]=project(step*Math.PI/36,band*Math.PI/8);
      if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  for(let line=0;line<30;line++) {
    ctx.beginPath();
    ctx.strokeStyle=line%5===0?'#54752699':'#43563846';
    for(let step=0;step<=32;step++) {
      const [x,y]=project(line*Math.PI/15,step*Math.PI/16);
      if(step===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
}
function wireFrame(time) {
  frame=0;
  if (!visible || reduced.matches) return;
  drawWire(time);
  frame=requestAnimationFrame(wireFrame);
}
