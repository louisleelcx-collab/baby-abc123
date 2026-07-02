(function(){
"use strict";

/* ============ DATA ============ */
var LETTERS = [
  {l:'A',word:'Apple',cn:'苹果',em:'🍎'},{l:'B',word:'Ball',cn:'球',em:'⚽'},
  {l:'C',word:'Cat',cn:'猫',em:'🐱'},{l:'D',word:'Dog',cn:'狗',em:'🐶'},
  {l:'E',word:'Elephant',cn:'大象',em:'🐘'},{l:'F',word:'Fish',cn:'鱼',em:'🐟'},
  {l:'G',word:'Grape',cn:'葡萄',em:'🍇'},{l:'H',word:'Hat',cn:'帽子',em:'🎩'},
  {l:'I',word:'Ice Cream',cn:'冰淇淋',em:'🍦'},{l:'J',word:'Juice',cn:'果汁',em:'🧃'},
  {l:'K',word:'Kite',cn:'风筝',em:'🪁'},{l:'L',word:'Lion',cn:'狮子',em:'🦁'},
  {l:'M',word:'Moon',cn:'月亮',em:'🌙'},{l:'N',word:'Nest',cn:'鸟窝',em:'🪺'},
  {l:'O',word:'Orange',cn:'橙子',em:'🍊'},{l:'P',word:'Panda',cn:'熊猫',em:'🐼'},
  {l:'Q',word:'Queen',cn:'女王',em:'👸'},{l:'R',word:'Rabbit',cn:'兔子',em:'🐰'},
  {l:'S',word:'Sun',cn:'太阳',em:'☀️'},{l:'T',word:'Tiger',cn:'老虎',em:'🐯'},
  {l:'U',word:'Umbrella',cn:'雨伞',em:'☂️'},{l:'V',word:'Violin',cn:'小提琴',em:'🎻'},
  {l:'W',word:'Watermelon',cn:'西瓜',em:'🍉'},{l:'X',word:'Xylophone',cn:'木琴',em:'🎹'},
  {l:'Y',word:'Yo-yo',cn:'悠悠球',em:'🪀'},{l:'Z',word:'Zebra',cn:'斑马',em:'🦓'}
];
var MASCOTS = ['🐼','🐻','🐰','🦁','🐯','🐘','🦄','🐱','🐶','🦊','🐨','🐧','🐸','🦉'];
var COUNT_EMOJI = ['🍎','🍌','🍇','⭐','🎈','🐟','🍭','🌸','🚗','🐝'];
var GRID_RANGES = [10,20,50,100];
var HAPPY_MASCOTS = ['🤩','😆','🥳','😄'];
var SAD_MASCOTS = ['😅','🙂','😊'];

/* ============ STATE / STORAGE ============ */
var STORE_KEY = 'abc123_playground_v3';
function loadState(){
  try{
    var raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {stars:0, gridCompleted:{}};
}
var state = loadState();
if(!state.gridCompleted) state.gridCompleted = {};
function saveState(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }catch(e){}
}
function addStars(n){
  state.stars += n;
  saveState();
  document.getElementById('starCount').textContent = state.stars;
  floatParticle('⭐');
}
document.getElementById('starCount').textContent = state.stars;

/* ============ SPEECH ============ */
var muted = false;
var voices = [];
function loadVoices(){ voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
if('speechSynthesis' in window){
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
/* Prefer the most natural-sounding voice available for a language. Modern
   browsers/OSes often expose several voices per language — legacy "compact"
   robotic ones alongside newer neural/"Natural"/"Online"/"Premium" ones that
   sound much closer to a real person. There's no free way to guarantee an
   actual recorded human voice in a static web page, so this picks the best
   the visitor's own browser happens to offer instead of the first match. */
var NATURAL_VOICE_HINTS = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google'];
function voiceQualityScore(v){
  var name = (v.name || '').toLowerCase();
  for(var i=0;i<NATURAL_VOICE_HINTS.length;i++){
    if(name.indexOf(NATURAL_VOICE_HINTS[i]) !== -1) return NATURAL_VOICE_HINTS.length - i;
  }
  return 0;
}
function pickVoice(lang){
  if(!voices || !voices.length) return null;
  var exact = voices.filter(function(v){ return v.lang === lang; });
  var pool = exact.length ? exact : voices.filter(function(v){
    var base = lang.split('-')[0];
    return v.lang && v.lang.indexOf(base) === 0;
  });
  if(!pool.length) return null;
  pool = pool.slice().sort(function(a,b){ return voiceQualityScore(b) - voiceQualityScore(a); });
  return pool[0];
}
function speak(text, lang, rate, pitch){
  return new Promise(function(resolve){
    if(muted || !('speechSynthesis' in window)){ resolve(); return; }
    try{
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      var v = pickVoice(lang);
      if(v) u.voice = v;
      u.rate = rate || 0.85;
      u.pitch = (pitch != null) ? pitch : 1.15;
      /* explicit volume keeps English and Chinese voices at the same
         loudness — different OS/browser voice packs otherwise default
         to noticeably different volumes for en-US vs zh-CN. */
      u.volume = 1.0;
      var done = false;
      var finish = function(){ if(done) return; done = true; resolve(); };
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      /* safety net: some browsers occasionally never fire onend/onerror
         (known speechSynthesis bug), which would otherwise stall any
         game logic chained on this promise. Force-resolve as a fallback. */
      var estMs = Math.max(1200, String(text).length * 110) + 900;
      setTimeout(finish, estMs);
    }catch(e){ resolve(); }
  });
}
function speakSeq(items){
  var p = Promise.resolve();
  items.forEach(function(it){
    p = p.then(function(){ return speak(it.text, it.lang, it.rate); });
  });
  return p;
}
document.getElementById('muteBtn').addEventListener('click', function(){
  muted = !muted;
  this.textContent = muted ? '🔇' : '🔊';
  if(muted && 'speechSynthesis' in window) speechSynthesis.cancel();
});

/* ============ BACKGROUND MUSIC (generated in-browser, no external files) ============ */
var musicEnabled = true;
var audioCtx = null;
var musicGain = null;
var musicTimer = null;
var musicStep = 0;
var MUSIC_NOTES = [523.25,587.33,659.25,783.99,880.00,783.99,659.25,587.33]; /* gentle C-pentatonic loop */
function ensureAudioCtx(){
  if(audioCtx) return audioCtx;
  try{
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    audioCtx = new Ctx();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.045;
    musicGain.connect(audioCtx.destination);
  }catch(e){ audioCtx = null; }
  return audioCtx;
}
function playMusicNote(freq){
  if(!audioCtx) return;
  var t = audioCtx.currentTime;
  var osc = audioCtx.createOscillator();
  var g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.42);
}
function musicTick(){
  if(!musicEnabled || !audioCtx){ musicTimer = null; return; }
  playMusicNote(MUSIC_NOTES[musicStep % MUSIC_NOTES.length]);
  musicStep++;
  musicTimer = setTimeout(musicTick, 420);
}
function startMusic(){
  if(!ensureAudioCtx()) return;
  if(audioCtx.state === 'suspended'){ audioCtx.resume(); }
  if(!musicTimer) musicTick();
}
function stopMusic(){
  if(musicTimer){ clearTimeout(musicTimer); musicTimer = null; }
}
document.addEventListener('click', function firstInteract(){
  if(musicEnabled) startMusic();
  document.removeEventListener('click', firstInteract);
}, {once:true});
document.getElementById('musicBtn').addEventListener('click', function(){
  musicEnabled = !musicEnabled;
  this.textContent = musicEnabled ? '🎵' : '🔕';
  if(musicEnabled){ startMusic(); } else { stopMusic(); }
});

/* ============ SKY DECORATION ============ */
(function initSky(){
  var sky = document.getElementById('sky');
  var clouds = ['☁️','☁️','⛅'];
  for(var i=0;i<4;i++){
    var c = document.createElement('div');
    c.className = 'cloud';
    c.textContent = clouds[i % clouds.length];
    c.style.top = (5 + i*18) + '%';
    c.style.left = '-10vw';
    c.style.animationDuration = (28 + i*7) + 's';
    c.style.animationDelay = (-i*8) + 's';
    sky.appendChild(c);
  }
  var spots = [[6,10],[90,15],[12,80],[85,75],[50,6]];
  spots.forEach(function(pos, i){
    var m = document.createElement('div');
    m.className = 'mascot-float';
    m.textContent = MASCOTS[i % MASCOTS.length];
    m.style.left = pos[0] + 'vw';
    m.style.top = pos[1] + 'vh';
    m.style.animationDelay = (i*0.4) + 's';
    m.style.opacity = '0.55';
    sky.appendChild(m);
  });
})();

/* ============ TOAST / FLOAT PARTICLE / MASCOT REACTION ============ */
var toastTimer;
function showToast(msg){
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 1700);
}
function floatParticle(emoji, x, y){
  var s = document.createElement('div');
  s.className = 'float-star';
  s.textContent = emoji || '⭐';
  s.style.left = (x != null ? x : (window.innerWidth/2 + (Math.random()*60-30))) + 'px';
  s.style.top = (y != null ? y : (window.innerHeight/2)) + 'px';
  document.body.appendChild(s);
  setTimeout(function(){ s.remove(); }, 1000);
}
function sparkleBurst(el){
  if(!el) return;
  var r = el.getBoundingClientRect();
  var sparkles = ['✨','🌟','⭐'];
  for(var i=0;i<4;i++){
    (function(i){
      setTimeout(function(){
        floatParticle(sparkles[i % sparkles.length], r.left + r.width/2 + (Math.random()*30-15), r.top + r.height/2);
      }, i*70);
    })(i);
  }
}
function reactMascot(id, type, bubbleId, bubbleText){
  var el = document.getElementById(id);
  if(el){
    var pool = type === 'happy' ? HAPPY_MASCOTS : SAD_MASCOTS;
    var original = el.getAttribute('data-default') || el.textContent;
    if(!el.getAttribute('data-default')) el.setAttribute('data-default', original);
    el.textContent = pool[Math.floor(Math.random()*pool.length)];
    el.classList.remove('react'); void el.offsetWidth; el.classList.add('react');
    setTimeout(function(){
      el.textContent = el.getAttribute('data-default');
    }, 900);
  }
  if(bubbleId && bubbleText){
    var b = document.getElementById(bubbleId);
    if(b) b.textContent = bubbleText;
  }
}

/* ============ CONFETTI ============ */
var confettiCanvas = document.getElementById('confetti');
var ctx = confettiCanvas.getContext('2d');
function resizeCanvas(){
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
var confettiParticles = [];
var confettiRunning = false;
function launchConfetti(count){
  var colors = ['#ff6b9d','#a685e2','#5ec8f8','#ffd166','#7bd389','#ff9a5a'];
  for(var i=0;i<(count||80);i++){
    confettiParticles.push({
      x: Math.random()*confettiCanvas.width,
      y: -20 - Math.random()*200,
      r: 4 + Math.random()*5,
      c: colors[Math.floor(Math.random()*colors.length)],
      vy: 2 + Math.random()*3,
      vx: -2 + Math.random()*4,
      rot: Math.random()*360,
      vr: -6 + Math.random()*12
    });
  }
  if(!confettiRunning){ confettiRunning = true; requestAnimationFrame(tickConfetti); }
}
function tickConfetti(){
  ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  confettiParticles.forEach(function(p){
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(p.rot*Math.PI/180);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
    ctx.restore();
  });
  confettiParticles = confettiParticles.filter(function(p){ return p.y < confettiCanvas.height + 30; });
  if(confettiParticles.length){
    requestAnimationFrame(tickConfetti);
  } else {
    confettiRunning = false;
    ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  }
}

/* ============ MODAL (next-step guidance) ============ */
var modalOverlay = document.getElementById('modalOverlay');
function hideModal(){
  modalOverlay.classList.remove('show');
}
document.getElementById('modalCloseBtn').addEventListener('click', hideModal);
modalOverlay.addEventListener('click', function(e){ if(e.target === modalOverlay) hideModal(); });
function showModal(opts){
  document.getElementById('modalMascot').textContent = opts.mascot || '🎉';
  document.getElementById('modalTitle').textContent = opts.title || '太棒了！';
  document.getElementById('modalMsg').textContent = opts.msg || '';
  var actionsWrap = document.getElementById('modalActions');
  actionsWrap.innerHTML = '';
  (opts.actions || []).forEach(function(a, idx){
    var b = document.createElement('button');
    b.className = idx === 0 ? 'primary' : (idx === 1 ? 'secondary' : 'tertiary');
    b.textContent = a.label;
    b.addEventListener('click', function(){
      hideModal();
      if(a.onClick) a.onClick();
    });
    actionsWrap.appendChild(b);
  });
  modalOverlay.classList.add('show');
  launchConfetti(110);
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(opts.speak !== false){
    speak('Great job!', 'en-US', 0.9).then(function(){ return speak('你真棒！', 'zh-CN', 0.95); });
  }
}

/* ============ REAL AI-VOICE AUDIO PLAYBACK (poems/stories/songs) ============ */
/* Pre-generated natural neural-voice mp3 files (built with a free Microsoft
   neural TTS engine, the same one behind Edge's "Read Aloud" feature) ship
   alongside this app for every poem, story, and song, along with a
   millisecond timing map for each line/paragraph so the on-screen text can
   stay in sync with playback. If a specific audio file is ever missing or
   fails to load (e.g. a hosting hiccup), playback transparently falls back
   to the browser's own speechSynthesis voice so the app keeps working. */
var AUDIO_BASE = './audio/';
/* Millisecond offset (from playback start) of each line/paragraph within the
   combined mp3 for that poem/story/song, so highlighting can stay in sync
   with the real audio. Songs store two offsets per line (primary language
   segment, then secondary language segment). */
var POEM_TIMINGS = {"minnong":[0,2390,4924,7434],"guanquelou":[0,2390,4900,7290],"hua":[0,2438,4852,7218],"yongliu":[0,2750,5692,8610],"jiangnan":[0,2558,5116],"gulangyuexing":[0,2366,4804,7218],"wanglushan":[0,2918,5860,8802],"zengwanglun":[0,2918,5788,8850],"zaofa":[0,2798,5668,8370],"xiangsi":[0,2510,4996,7554],"jiuyuejiu":[0,2774,5692,8538],"luchai":[0,2390,4708,7218],"songyuan":[0,2846,5860,8778],"chunyexiyu":[0,2438,4876,7410],"juju_huangli":[0,2774,5620,8658],"jiangpan":[0,2894,5740,8610],"shanxing":[0,2990,5764,8706],"qingming":[0,2870,5716,8586],"jiangxue":[0,2606,4972,7338],"minnong2":[0,2390,4900,7410],"wangtianmen":[0,2942,5860,8802],"chishang":[0,2438,4900,7338],"yijiangnan":[0,1982,4420,7314,10184],"fudegu":[0,2414,4828,7218],"xiaochi":[0,2966,5908,8850],"suxinshi":[0,2726,5668,8634],"xiaochujingci":[0,2846,5644,8490],"yeshusujian":[0,2918,5836,8610],"youyuanbuzhi":[0,2966,5884,8682],"cunju":[0,2942,5812,8682],"suojian":[0,2390,4804,7170],"jihaizashi":[0,2966,5740,8682],"leyouyuan":[0,2438,4900,7290],"furonglou":[0,2870,5812,8634],"chusai":[0,2870,5740,8610],"liangzhouci":[0,2918,5788,8778],"biedongda":[0,2846,5740,8610],"wangyue":[0,2438,4948,7434],"zhushi":[0,2846,5788,8658],"yuanri":[0,2942,5908,8802],"boshuangzhou":[0,2846,5812,8658],"tixilinbi":[0,2942,5692,8490],"yinhu":[0,2966,5932,8802],"huichong":[0,2870,5884,8730],"dongyedushu":[0,2702,5596,8466],"shier":[0,2870,5788,8634],"youshanxicun":[0,2846,5812,8754],"qiuxi":[0,3062,6052,9042],"qiqiao":[0,2942,5908,8778],"dalinsi":[0,2750,5788,8778],"guanshuyougan":[0,2750,5668,8586],"chunri":[0,2918,5692,8538],"chilege":[0,1958,3964,6210,8456,10462,12396],"changgexing":[0,2462,4924,7386],"huixiangoushu":[0,2846,5764,8754],"jingyesi":[0,2438,4876,7218],"chunxiao":[0,2486,4924,7314],"yong_e":[0,1814,4348,6810]};
var STORY_TIMINGS = {"guitu":[0,5150,14236,18786,24392,30190],"sanzhuxiaozhu":[0,4310,9868,14970,21872,31558],"xiaohongmao":[0,6326,13180,19986,28736],"houzilaoyueliang":[0,7190,14644,20874,28832],"langlaile":[0,6710,15220,22002,29336],"shouzhudaitu":[0,4646,11428,16938,25208],"bamiaozhuzhang":[0,6494,13252,21042,26120],"yanerdaoling":[0,5894,12556,19722,28328],"huashetianzu":[0,6014,13012,21066,29888],"wangyangbulao":[0,4814,11020,19434,27368],"kezhouqiujian":[0,6614,14092,21210,30128],"jingdizhiwa":[0,7334,14524,23250,29864],"yegonghaolong":[0,7070,15052,21666,29408],"lanyuchongshu":[0,6854,15316,21690,30920],"saiwengshima":[0,8006,16204,24210,35840],"yugongyishan":[0,7526,14932,21282,32360],"jingweitianhai":[0,6758,13060,21066,32936],"kuafuzhuiri":[0,8102,16635,24137,31447],"nvwabutian":[0,8846,15748,24978,34976],"houyisheri":[0,10334,17716,26249,33799],"tiechumochengzhen":[0,5102,13084,21402,33992],"kongrongrangli":[0,4598,11164,17658,26744],"caochongchengxiang":[0,7478,15628,25362,37088],"simaguangzagang":[0,7742,15364,21258,32048],"zhengrenmaili":[0,9734,19204,28026,38888],"zixiangmaodun":[0,6422,13084,20010,30848],"jinggongzhiniao":[0,8558,15316,24234,39248],"dongshixiaopin":[0,9542,19684,27402,34664],"handanxuebu":[0,8606,15484,23082,32408],"duiniutanqin":[0,7574,16011,26969,37327],"beigongsheying":[0,9278,17548,25290,36248],"hualongdianjing":[0,7982,13636,21714,29552],"nanyuanbeizhe":[0,6758,13276,22962,32216],"hujiahuwei":[0,6110,16876,26658,34304],"nongfuheshe":[0,6734,13612,18306,27632],"wuyaheshui":[0,6854,16420,24570,31808],"langhexiaoyang":[0,7958,18988,27162,36368],"huliheputao":[0,8030,16132,22602,31808],"mayihezhameng":[0,7718,17932,25506,34592],"beifengyutaiyang":[0,7694,16924,25170,31112],"shizihelaoshu":[0,7118,18532,25842,32240],"xiajinbadene":[0,8462,15964,24666,32624],"baixuegongzhu":[0,7406,15916,24018,35264],"huiguniang":[0,11054,21340,34962,46112],"shuimeiren":[0,12662,25636,36282,45896],"choxiaoya":[0,9854,19636,27138,37976],"huangdidexinzhuang":[0,8174,19828,30858,41984],"jiekeyuwandou":[0,7454,15460,26106,36056],"alibaba":[0,6446,18700,28818,38000],"niulangzhinv":[0,9662,18004,29634,39944],"changebenyue":[0,8894,18076,28098,38624],"tianluogunian":[0,7358,15172,25170,34040],"mulancongjun":[0,8750,18652,28794,37424],"shierszhinggushi":[0,10790,19564,31194,46448],"maiduhuanzhu":[0,6038,12652,18882,26720]};
var SONG_TIMINGS = {"twinkle":[0,3686,6364,9138,11744,14758,17316,20090,22744,26430,29108,31882],"boat":[0,3110,6124,8802,11408,15502,19116,21746],"sheep":[0,3086,5788,7986,10136,12934,15348,17762,19720,22230,24452,26794,28992,31694,34468,37122],"tigers":[0,3158,6556,9114,13016,16582,20748,23618],"star_cn":[0,2558,6460,8946,11864,14302,17484,20018],"turnip":[0,2702,6364,8898,12944,15214,18132,20642],"hickory":[0,2606,5524,8418,11192,13702,15780,18314,20464,23046],"jackjill":[0,3038,6604,9426,11624,15022,17484,20666],"humpty":[0,3062,5692,8826,11432,15382,18204,21338],"marylamb":[0,2702,5404,8370,11096,14206,16548,19274],"muffet":[0,3350,6748,9522,11792,14422,16956,19826,22000,24990],"raingo":[0,3038,5428,7962,10136,12982,15684,18722],"oldman":[0,3302,6076,9162,12104,14998,17820,20186,22696,25974],"hushbaby":[0,3638,6964,10146,12800,15934,18828,22082],"ringrosie":[0,2558,5140,8082,10928,13558,16380,18890],"itsybitsy":[0,4262,7540,11490,15056,18886,22380,26690],"diushoujuan":[0,2726,6748,9810,13112,15430,18492,20906],"zhaopengyou":[0,2438,5692,7986,11096,13702,16716,18962],"paipaizuo":[0,1814,4204,6090,8240,10222,12684,14450],"ladaju":[0,2678,6412,9066,12824,15430,18804,21506],"xiaolaoshu":[0,2750,6340,9090,12920,15526,19116,21362],"yaoayao":[0,1958,4708,6954,10040,12430,15732,18170],"xiaobaitu":[0,2894,6364,8706,11720,14158,18012,20594],"dagongji":[0,2678,6076,8922,12392,14782,18516,20666],"yueliangzou":[0,1742,4132,5946,8144,10054,12372,14330],"shanghudashan":[0,2246,5500,7818,11168,13294,16044,18218]};
var currentPlaybackAudio = null;
function stopCurrentAudio(){
  if(currentPlaybackAudio){
    try{ currentPlaybackAudio.pause(); }catch(e){}
    currentPlaybackAudio = null;
  }
}
/* Plays url with per-line/paragraph highlighting driven by a precomputed
   offsets array (ms from playback start). Falls back to fallbackFn (the
   original speechSynthesis-based implementation) if the file can't play. */
function playTimedAudio(url, offsets, myToken, highlightFn, doneFn, fallbackFn){
  var audio = new Audio(url);
  var usedFallback = false;
  var timers = [];
  function clearTimers(){ timers.forEach(function(t){ clearTimeout(t); }); timers = []; }
  function toFallback(){
    if(usedFallback) return;
    usedFallback = true;
    clearTimers();
    if(currentPlaybackAudio === audio) currentPlaybackAudio = null;
    if(fallbackFn) fallbackFn();
  }
  audio.addEventListener('error', toFallback);
  audio.addEventListener('ended', function(){
    if(myToken !== uiToken || usedFallback) return;
    clearTimers();
    if(doneFn) doneFn();
  });
  currentPlaybackAudio = audio;
  (offsets || []).forEach(function(ms, idx){
    timers.push(setTimeout(function(){
      if(myToken !== uiToken || usedFallback) return;
      highlightFn(idx);
    }, ms));
  });
  var playPromise = audio.play();
  if(playPromise && playPromise.catch) playPromise.catch(toFallback);
}

/* ============ NAVIGATION ============ */
/* uiToken invalidates any in-flight setTimeout-scheduled speech/progression
   (next-question timers, milestone-modal timers, song note ticks) the moment
   the user navigates away, so audio never "leaks" onto a screen/tab the
   child has already left. */
var uiToken = 0;
function bumpUiToken(){
  uiToken++;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  stopCurrentAudio();
  return uiToken;
}
function goScreen(name){
  var songsScreen = document.getElementById('screen-songs');
  if(songsScreen.classList.contains('active') && name !== 'songs'){
    stopSongPlayback();
    document.getElementById('songPlayer').style.display = 'none';
    document.getElementById('songGrid').style.display = '';
    currentSong = null;
  }
  var poemsScreen = document.getElementById('screen-poems');
  if(poemsScreen.classList.contains('active') && name !== 'poems'){
    document.getElementById('poemPlayer').style.display = 'none';
    document.getElementById('poemGrid').style.display = '';
    currentPoem = null;
  }
  var storiesScreen = document.getElementById('screen-stories');
  if(storiesScreen.classList.contains('active') && name !== 'stories'){
    document.getElementById('storyPlayer').style.display = 'none';
    document.getElementById('storyGrid').style.display = '';
    currentStory = null;
  }
  bumpUiToken();
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}
function switchLetterTab(tab){
  bumpUiToken();
  document.querySelectorAll('[data-lettab]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-lettab') === tab); });
  document.getElementById('letterLearn').style.display = (tab === 'learn') ? '' : 'none';
  document.getElementById('letterQuiz').style.display = (tab === 'quiz') ? '' : 'none';
  document.getElementById('letterOrder').style.display = (tab === 'order') ? '' : 'none';
  document.getElementById('letterCase').style.display = (tab === 'case') ? '' : 'none';
  if(tab === 'quiz') nextLetterQuiz();
  if(tab === 'order') renderLetterOrder();
  if(tab === 'case') nextCaseQuiz();
}
function switchNumTab(tab){
  bumpUiToken();
  document.querySelectorAll('[data-numtab]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-numtab') === tab); });
  document.getElementById('numLearn').style.display = (tab === 'learn') ? '' : 'none';
  document.getElementById('numCount').style.display = (tab === 'count') ? '' : 'none';
  document.getElementById('numGrid').style.display = (tab === 'grid') ? '' : 'none';
  document.getElementById('numHear').style.display = (tab === 'hear') ? '' : 'none';
  if(tab === 'count') nextCountQuiz();
  if(tab === 'grid') renderNumGrid(gridRangeMax);
  if(tab === 'hear') nextHearQuiz();
}
document.querySelectorAll('[data-go]').forEach(function(btn){
  btn.addEventListener('click', function(){ goScreen(btn.getAttribute('data-go')); });
});
document.getElementById('homeBtn').addEventListener('click', function(){ goScreen('home'); });
document.getElementById('resetBtn').addEventListener('click', function(){
  if(confirm('确定要清空星星和已解锁的数字范围吗？')){
    state = {stars:0, gridCompleted:{}};
    saveState();
    document.getElementById('starCount').textContent = 0;
    renderGridRangeRow();
    renderHearRangeRow();
    showToast('已重置');
  }
});

/* ============ LETTERS: LEARN TAB ============ */
function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}
function renderLetterGrid(){
  var grid = document.getElementById('letterGrid');
  grid.innerHTML = '';
  LETTERS.forEach(function(item){
    var card = document.createElement('div');
    card.className = 'letter-card';
    card.setAttribute('data-letter', item.l);
    card.innerHTML =
      '<div class="big-letter">' + item.l + item.l.toLowerCase() + '</div>' +
      '<span class="em">' + item.em + '</span>' +
      '<div class="word">' + item.word + '</div>' +
      '<div class="cn">' + item.cn + '</div>';
    card.addEventListener('click', function(){
      if('speechSynthesis' in window) speechSynthesis.cancel();
      speakSeq([
        {text:item.l, lang:'en-US', rate:0.8},
        {text:item.word, lang:'en-US', rate:0.85},
        {text:item.cn, lang:'zh-CN', rate:0.85}
      ]);
      sparkleBurst(card);
    });
    grid.appendChild(card);
  });
}
renderLetterGrid();

document.getElementById('alphabetSongBtn').addEventListener('click', function(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var cards = document.querySelectorAll('#letterGrid .letter-card');
  var p = Promise.resolve();
  LETTERS.forEach(function(item, idx){
    p = p.then(function(){
      cards.forEach(function(c){ c.style.outline = ''; });
      if(cards[idx]){
        cards[idx].style.outline = '4px solid #ffd166';
        cards[idx].scrollIntoView({behavior:'smooth', block:'center'});
      }
      return speak(item.l, 'en-US', 0.75);
    });
  });
  p.then(function(){
    cards.forEach(function(c){ c.style.outline = ''; });
    showToast('字母歌唱完啦，真棒！🎉');
  });
});

/* letter tab switching */
document.querySelectorAll('[data-lettab]').forEach(function(btn){
  btn.addEventListener('click', function(){ switchLetterTab(btn.getAttribute('data-lettab')); });
});

/* ============ LETTERS: QUIZ TAB ============ */
var letterStreak = 0;
var letterWrongCount = 0;
var currentLetterTarget = null;
var letterQuizMode = 'name';
var letterRecentWrong = []; /* session-only, not persisted: recently missed letters get asked again more often */
function pickLetterTarget(){
  if(letterRecentWrong.length && Math.random() < 0.6){
    var pick = letterRecentWrong[Math.floor(Math.random()*letterRecentWrong.length)];
    var found = LETTERS.filter(function(x){ return x.l === pick; })[0];
    if(found) return found;
  }
  return LETTERS[Math.floor(Math.random()*LETTERS.length)];
}
function nextLetterQuiz(){
  letterWrongCount = 0;
  currentLetterTarget = pickLetterTarget();
  letterQuizMode = Math.random() < 0.5 ? 'name' : 'clue';
  var distractors = shuffle(LETTERS.filter(function(x){ return x.l !== currentLetterTarget.l; })).slice(0,3);
  var options = shuffle([currentLetterTarget].concat(distractors));
  var row = document.getElementById('letterChoiceRow');
  row.innerHTML = '';
  options.forEach(function(opt){
    var b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = opt.l;
    b.setAttribute('data-letter', opt.l);
    b.addEventListener('click', function(){ handleLetterAnswer(opt, b); });
    row.appendChild(b);
  });
  var emojiEl = document.getElementById('letterQuizEmoji');
  if(letterQuizMode === 'clue'){
    document.getElementById('letterQuizPrompt').textContent = '这是什么开头的字母呢？';
    emojiEl.textContent = currentLetterTarget.em + ' ' + currentLetterTarget.word;
    emojiEl.style.display = '';
  } else {
    document.getElementById('letterQuizPrompt').textContent = '听一听，找到正确的字母吧！';
    emojiEl.style.display = 'none';
  }
  reactMascot('letterMascot', 'happy', 'letterBubble', '加油，你可以的！');
  playLetterPrompt();
}
function playLetterPrompt(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(letterQuizMode === 'clue'){
    speakSeq([
      {text:currentLetterTarget.word, lang:'en-US', rate:0.85},
      {text:currentLetterTarget.cn, lang:'zh-CN', rate:0.9},
      {text:'Which letter?', lang:'en-US', rate:0.85}
    ]);
  } else {
    speakSeq([
      {text:'Find the letter ' + currentLetterTarget.l, lang:'en-US', rate:0.85},
      {text:'请找出字母 ' + currentLetterTarget.l, lang:'zh-CN', rate:0.9}
    ]);
  }
}
document.getElementById('letterReplayBtn').addEventListener('click', playLetterPrompt);
document.getElementById('letterHintBtn').addEventListener('click', function(){
  var btn = document.querySelector('#letterChoiceRow [data-letter="' + currentLetterTarget.l + '"]');
  if(btn){
    btn.classList.add('hint-glow');
    setTimeout(function(){ btn.classList.remove('hint-glow'); }, 2000);
  }
  speak(letterQuizMode === 'clue' ? currentLetterTarget.l : currentLetterTarget.word, 'en-US', 0.7);
});
function handleLetterAnswer(opt, btn){
  if(opt.l === currentLetterTarget.l){
    btn.classList.add('correct');
    sparkleBurst(btn);
    letterStreak++;
    document.getElementById('letterStreak').textContent = '连续答对：' + letterStreak;
    addStars(1);
    reactMascot('letterMascot', 'happy', 'letterBubble', '太棒了！🎉');
    letterRecentWrong = letterRecentWrong.filter(function(x){ return x !== currentLetterTarget.l; });
    speak('Great job! ' + currentLetterTarget.word, 'en-US', 0.9);
    speak('太棒了！', 'zh-CN', 0.95);
    var isMilestone = letterStreak > 0 && letterStreak % 10 === 0;
    var letterAnswerToken = uiToken;
    if(isMilestone){
      setTimeout(function(){
        if(letterAnswerToken !== uiToken) return;
        showModal({
          mascot:'🦊', title:'连续答对 ' + letterStreak + ' 题！',
          msg:'你的字母小游戏玩得真棒！接下来想做什么？',
          actions:[
            {label:'🎯 继续挑战', onClick:function(){ nextLetterQuiz(); }},
            {label:'🧩 去玩字母排队', onClick:function(){ switchLetterTab('order'); }},
            {label:'🏠 回首页', onClick:function(){ goScreen('home'); }}
          ]
        });
      }, 700);
    } else {
      if(letterStreak % 5 === 0) launchConfetti(90);
      setTimeout(function(){
        if(letterAnswerToken !== uiToken) return;
        nextLetterQuiz();
      }, 1500);
    }
  } else {
    btn.classList.add('wrong');
    letterWrongCount++;
    reactMascot('letterMascot', 'sad', 'letterBubble', '再想想，别灰心～');
    speak('Try again', 'en-US', 0.9);
    speak('再试一次', 'zh-CN', 0.95);
    setTimeout(function(){ btn.classList.remove('wrong'); }, 500);
    letterStreak = 0;
    document.getElementById('letterStreak').textContent = '连续答对：0';
    if(letterRecentWrong.indexOf(currentLetterTarget.l) === -1){
      letterRecentWrong.push(currentLetterTarget.l);
      if(letterRecentWrong.length > 6) letterRecentWrong.shift();
    }
    if(letterWrongCount >= 2){
      var correctBtn = document.querySelector('#letterChoiceRow [data-letter="' + currentLetterTarget.l + '"]');
      if(correctBtn) correctBtn.classList.add('hint-glow');
    }
  }
}

/* ============ LETTERS: ORDER GAME (A-Z, random layout) ============ */
var letterOrderNextIdx = 0;
function renderLetterOrder(){
  letterOrderNextIdx = 0;
  var board = document.getElementById('letterOrderBoard');
  board.innerHTML = '';
  document.getElementById('letterOrderStatus').textContent = '请找到字母：A';
  var shuffled = shuffle(LETTERS);
  shuffled.forEach(function(item){
    var b = document.createElement('button');
    b.className = 'seq-cell';
    b.textContent = item.l;
    b.addEventListener('click', function(){ handleLetterOrderClick(item, b); });
    board.appendChild(b);
  });
}
function handleLetterOrderClick(item, btn){
  if(btn.classList.contains('done')) return;
  var expected = LETTERS[letterOrderNextIdx].l;
  if(item.l === expected){
    btn.classList.add('done');
    if('speechSynthesis' in window) speechSynthesis.cancel();
    speak(item.l, 'en-US', 0.8);
    letterOrderNextIdx++;
    if(letterOrderNextIdx >= LETTERS.length){
      document.getElementById('letterOrderStatus').textContent = '🎉 全部找齐啦！';
      addStars(10);
      var orderDoneToken = uiToken;
      setTimeout(function(){
        if(orderDoneToken !== uiToken) return;
        showModal({
          mascot:'🏆', title:'字母排队完成！',
          msg:'从 A 到 Z 都找齐啦，真是了不起！',
          actions:[
            {label:'🔁 再玩一次', onClick:function(){ renderLetterOrder(); }},
            {label:'🔢 去数字王国', onClick:function(){ goScreen('numbers'); switchNumTab('grid'); }},
            {label:'🏠 回首页', onClick:function(){ goScreen('home'); }}
          ]
        });
      }, 300);
    } else {
      document.getElementById('letterOrderStatus').textContent = '请找到字母：' + LETTERS[letterOrderNextIdx].l;
    }
  } else {
    btn.classList.add('wrong');
    setTimeout(function(){ btn.classList.remove('wrong'); }, 400);
  }
}

/* ============ LETTERS: UPPER/LOWER CASE MATCH ============ */
var caseStreak = 0;
var caseWrongCount = 0;
var currentCaseTarget = null;
var caseDirection = 'upper2lower';
var caseRecentWrong = []; /* session-only: recently missed pairs come back more often */
function pickCaseTarget(){
  if(caseRecentWrong.length && Math.random() < 0.6){
    var pick = caseRecentWrong[Math.floor(Math.random()*caseRecentWrong.length)];
    var found = LETTERS.filter(function(x){ return x.l === pick; })[0];
    if(found) return found;
  }
  return LETTERS[Math.floor(Math.random()*LETTERS.length)];
}
function nextCaseQuiz(){
  caseWrongCount = 0;
  currentCaseTarget = pickCaseTarget();
  caseDirection = Math.random() < 0.5 ? 'upper2lower' : 'lower2upper';
  var targetDisplay = caseDirection === 'upper2lower' ? currentCaseTarget.l : currentCaseTarget.l.toLowerCase();
  document.getElementById('caseTargetLetter').textContent = targetDisplay;
  document.getElementById('caseQuizPrompt').textContent = caseDirection === 'upper2lower'
    ? '大写 ' + currentCaseTarget.l + ' 配对哪个小写字母？'
    : '小写 ' + currentCaseTarget.l.toLowerCase() + ' 配对哪个大写字母？';
  var distractors = shuffle(LETTERS.filter(function(x){ return x.l !== currentCaseTarget.l; })).slice(0,3);
  var options = shuffle([currentCaseTarget].concat(distractors));
  var row = document.getElementById('caseChoiceRow');
  row.innerHTML = '';
  options.forEach(function(opt){
    var display = caseDirection === 'upper2lower' ? opt.l.toLowerCase() : opt.l;
    var b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = display;
    b.setAttribute('data-letter', opt.l);
    b.addEventListener('click', function(){ handleCaseAnswer(opt, b); });
    row.appendChild(b);
  });
  reactMascot('caseMascot', 'happy', 'caseBubble', '找找配对～');
  playCasePrompt();
}
function playCasePrompt(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(caseDirection === 'upper2lower'){
    speakSeq([
      {text:'Big letter ' + currentCaseTarget.l, lang:'en-US', rate:0.8},
      {text:'大写字母 ' + currentCaseTarget.l + '，找一找它的小写朋友', lang:'zh-CN', rate:0.9}
    ]);
  } else {
    speakSeq([
      {text:'Small letter ' + currentCaseTarget.l.toLowerCase(), lang:'en-US', rate:0.8},
      {text:'小写字母 ' + currentCaseTarget.l.toLowerCase() + '，找一找它的大写朋友', lang:'zh-CN', rate:0.9}
    ]);
  }
}
document.getElementById('caseReplayBtn').addEventListener('click', playCasePrompt);
document.getElementById('caseHintBtn').addEventListener('click', function(){
  var btn = document.querySelector('#caseChoiceRow [data-letter="' + currentCaseTarget.l + '"]');
  if(btn){
    btn.classList.add('hint-glow');
    setTimeout(function(){ btn.classList.remove('hint-glow'); }, 2000);
  }
  speak(currentCaseTarget.l, 'en-US', 0.7);
});
function handleCaseAnswer(opt, btn){
  if(opt.l === currentCaseTarget.l){
    btn.classList.add('correct');
    sparkleBurst(btn);
    caseStreak++;
    document.getElementById('caseStreak').textContent = '连续答对：' + caseStreak;
    addStars(1);
    reactMascot('caseMascot', 'happy', 'caseBubble', '配对成功！🎉');
    caseRecentWrong = caseRecentWrong.filter(function(x){ return x !== currentCaseTarget.l; });
    speak('Great match!', 'en-US', 0.9);
    speak('配对成功！', 'zh-CN', 0.95);
    var isMilestone = caseStreak > 0 && caseStreak % 10 === 0;
    var caseAnswerToken = uiToken;
    if(isMilestone){
      setTimeout(function(){
        if(caseAnswerToken !== uiToken) return;
        showModal({
          mascot:'🐸', title:'连续答对 ' + caseStreak + ' 题！',
          msg:'大小写配对玩得真棒！接下来想做什么？',
          actions:[
            {label:'🔠 继续挑战', onClick:function(){ nextCaseQuiz(); }},
            {label:'🎯 去玩字母小游戏', onClick:function(){ switchLetterTab('quiz'); }},
            {label:'🏠 回首页', onClick:function(){ goScreen('home'); }}
          ]
        });
      }, 700);
    } else {
      if(caseStreak % 5 === 0) launchConfetti(90);
      setTimeout(function(){
        if(caseAnswerToken !== uiToken) return;
        nextCaseQuiz();
      }, 1500);
    }
  } else {
    btn.classList.add('wrong');
    caseWrongCount++;
    reactMascot('caseMascot', 'sad', 'caseBubble', '再想想～');
    speak('Try again', 'en-US', 0.9);
    speak('再试一次', 'zh-CN', 0.95);
    setTimeout(function(){ btn.classList.remove('wrong'); }, 500);
    caseStreak = 0;
    document.getElementById('caseStreak').textContent = '连续答对：0';
    if(caseRecentWrong.indexOf(currentCaseTarget.l) === -1){
      caseRecentWrong.push(currentCaseTarget.l);
      if(caseRecentWrong.length > 6) caseRecentWrong.shift();
    }
    if(caseWrongCount >= 2){
      var correctBtn = document.querySelector('#caseChoiceRow [data-letter="' + currentCaseTarget.l + '"]');
      if(correctBtn) correctBtn.classList.add('hint-glow');
    }
  }
}

/* ============ NUMBERS: TAB SWITCH ============ */
document.querySelectorAll('[data-numtab]').forEach(function(btn){
  btn.addEventListener('click', function(){ switchNumTab(btn.getAttribute('data-numtab')); });
});

/* ============ NUMBERS: LEARN TAB (1-100) ============ */
var ONES_WORDS = ['zero','one','two','three','four','five','six','seven','eight','nine'];
var TEENS_WORDS = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
var TENS_WORDS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
var CN_DIGITS = ['零','一','二','三','四','五','六','七','八','九'];
function numberToEnglish(n){
  if(n === 100) return 'one hundred';
  if(n < 10) return ONES_WORDS[n];
  if(n < 20) return TEENS_WORDS[n-10];
  var t = Math.floor(n/10), o = n % 10;
  return TENS_WORDS[t] + (o ? ('-' + ONES_WORDS[o]) : '');
}
function numberToChinese(n){
  if(n === 100) return '一百';
  if(n < 10) return CN_DIGITS[n];
  if(n < 20) return n === 10 ? '十' : ('十' + CN_DIGITS[n-10]);
  var t = Math.floor(n/10), o = n % 10;
  return CN_DIGITS[t] + '十' + (o ? CN_DIGITS[o] : '');
}
function renderNumberLearnGrid(){
  var grid = document.getElementById('numberLearnGrid');
  grid.innerHTML = '';
  for(var n=1; n<=100; n++){
    (function(n){
      var card = document.createElement('div');
      card.className = 'letter-card number-card';
      card.id = 'numlearn-' + n;
      card.innerHTML =
        '<div class="big-letter">' + n + '</div>' +
        '<div class="word">' + numberToEnglish(n) + '</div>' +
        '<div class="cn">' + numberToChinese(n) + '</div>';
      card.addEventListener('click', function(){
        if('speechSynthesis' in window) speechSynthesis.cancel();
        speakSeq([
          {text:numberToEnglish(n), lang:'en-US', rate:0.8},
          {text:numberToChinese(n), lang:'zh-CN', rate:0.85}
        ]);
        sparkleBurst(card);
      });
      grid.appendChild(card);
    })(n);
  }
}
renderNumberLearnGrid();

(function renderDecadeChips(){
  var row = document.getElementById('numberDecadeRow');
  for(var d=1; d<=91; d+=10){
    (function(d){
      var b = document.createElement('button');
      b.className = 'range-btn';
      b.textContent = d + '-' + Math.min(d+9,100);
      b.addEventListener('click', function(){
        var el = document.getElementById('numlearn-' + d);
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
      });
      row.appendChild(b);
    })(d);
  }
})();

document.getElementById('numberSongBtn').addEventListener('click', function(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  for(var n=1; n<=100; n++){
    (function(n){
      p = p.then(function(){
        document.querySelectorAll('#numberLearnGrid .number-card').forEach(function(c){ c.style.outline = ''; });
        var el = document.getElementById('numlearn-' + n);
        if(el){
          el.style.outline = '4px solid #ffd166';
          el.scrollIntoView({behavior:'smooth', block:'center'});
        }
        return speak(numberToEnglish(n), 'en-US', 0.7);
      });
    })(n);
  }
  p.then(function(){
    document.querySelectorAll('#numberLearnGrid .number-card').forEach(function(c){ c.style.outline = ''; });
    showToast('1到100都数完啦，真棒！🎉');
  });
});

/* ============ COUNTING GAME ============ */
var countStreak = 0;
var countWrongCount = 0;
var currentCount = 1;
function nextCountQuiz(){
  countWrongCount = 0;
  currentCount = 1 + Math.floor(Math.random()*20);
  var emoji = COUNT_EMOJI[Math.floor(Math.random()*COUNT_EMOJI.length)];
  var wrap = document.getElementById('countWrap');
  wrap.innerHTML = '';
  for(var i=0;i<currentCount;i++){
    var s = document.createElement('span');
    s.textContent = emoji;
    s.style.animationDelay = (i*0.03)+'s';
    wrap.appendChild(s);
  }
  var options = new Set([currentCount]);
  while(options.size < 4){
    var d = currentCount + (Math.floor(Math.random()*7) - 3);
    if(d >= 1 && d <= 20) options.add(d);
  }
  var optArr = shuffle(Array.from(options));
  var row = document.getElementById('countChoiceRow');
  row.innerHTML = '';
  optArr.forEach(function(n){
    var b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = n;
    b.setAttribute('data-num', n);
    b.addEventListener('click', function(){ handleCountAnswer(n, b); });
    row.appendChild(b);
  });
  reactMascot('countMascot', 'happy', 'countBubble', '数一数看！');
  playCountPrompt();
}
function playCountPrompt(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  speak('How many are there?', 'en-US', 0.85).then(function(){
    return speak('一共有几个呢？', 'zh-CN', 0.9);
  });
}
document.getElementById('countReplayBtn').addEventListener('click', playCountPrompt);
document.getElementById('countHintBtn').addEventListener('click', function(){
  var btn = document.querySelector('#countChoiceRow [data-num="' + currentCount + '"]');
  if(btn){ btn.classList.add('hint-glow'); setTimeout(function(){ btn.classList.remove('hint-glow'); }, 2000); }
  speak('Let\'s count together, slowly', 'en-US', 0.75).then(function(){ return speak('我们一起慢慢数', 'zh-CN', 0.85); });
});
function handleCountAnswer(n, btn){
  if(n === currentCount){
    btn.classList.add('correct');
    sparkleBurst(btn);
    countStreak++;
    document.getElementById('countStreak').textContent = '连续答对：' + countStreak;
    addStars(1);
    reactMascot('countMascot', 'happy', 'countBubble', '数得真准！');
    speak(numberToEnglish(currentCount), 'en-US', 0.85);
    speak('答对啦，一共是 ' + currentCount + ' 个！', 'zh-CN', 0.95);
    var isMilestone = countStreak > 0 && countStreak % 10 === 0;
    var countAnswerToken = uiToken;
    if(isMilestone){
      setTimeout(function(){
        if(countAnswerToken !== uiToken) return;
        showModal({
          mascot:'🐨', title:'连续答对 ' + countStreak + ' 题！',
          msg:'数数小能手！接下来想做什么？',
          actions:[
            {label:'🍎 继续数一数', onClick:function(){ nextCountQuiz(); }},
            {label:'🧩 去玩数字连线', onClick:function(){ switchNumTab('grid'); }},
            {label:'🏠 回首页', onClick:function(){ goScreen('home'); }}
          ]
        });
      }, 700);
    } else {
      if(countStreak % 5 === 0) launchConfetti(90);
      setTimeout(function(){
        if(countAnswerToken !== uiToken) return;
        nextCountQuiz();
      }, 1500);
    }
  } else {
    btn.classList.add('wrong');
    countWrongCount++;
    reactMascot('countMascot', 'sad', 'countBubble', '再数一数～');
    speak('再数一数', 'zh-CN', 0.95);
    setTimeout(function(){ btn.classList.remove('wrong'); }, 500);
    countStreak = 0;
    document.getElementById('countStreak').textContent = '连续答对：0';
    if(countWrongCount >= 2){
      var correctBtn = document.querySelector('#countChoiceRow [data-num="' + currentCount + '"]');
      if(correctBtn) correctBtn.classList.add('hint-glow');
    }
  }
}

/* ============ RANGE UNLOCK LOGIC (shared by grid + hear) ============ */
function isRangeUnlocked(r){
  if(r <= 20) return true;
  if(r === 50) return !!state.gridCompleted[20];
  if(r === 100) return !!state.gridCompleted[50];
  return true;
}
function nextLockedRequirement(r){
  if(r === 50) return '先完成「1-20 数字连线」挑战即可解锁';
  if(r === 100) return '先完成「1-50 数字连线」挑战即可解锁';
  return '';
}

/* ============ 100 GRID (number sequence) ============ */
var gridRangeMax = 20;
var gridNext = 1;
function renderGridRangeRow(){
  var row = document.getElementById('gridRangeRow');
  row.innerHTML = '';
  GRID_RANGES.forEach(function(r){
    var unlocked = isRangeUnlocked(r);
    var b = document.createElement('button');
    b.className = 'range-btn' + (r === gridRangeMax ? ' active' : '') + (unlocked ? '' : ' locked');
    b.textContent = unlocked ? ('1-' + r) : ('🔒 1-' + r);
    b.addEventListener('click', function(){
      if(!isRangeUnlocked(r)){
        showToast(nextLockedRequirement(r));
        return;
      }
      document.querySelectorAll('#gridRangeRow .range-btn').forEach(function(x){ x.classList.remove('active'); });
      gridRangeMax = r;
      renderGridRangeRow();
      renderNumGrid(r);
    });
    row.appendChild(b);
  });
}
function renderNumGrid(max){
  gridNext = 1;
  var board = document.getElementById('numGridBoard');
  board.innerHTML = '';
  document.getElementById('gridStatus').textContent = '请找到数字：1';
  var nums = [];
  for(var i=1;i<=max;i++) nums.push(i);
  shuffle(nums).forEach(function(n){
    var b = document.createElement('button');
    b.className = 'seq-cell';
    b.textContent = n;
    b.addEventListener('click', function(){ handleGridClick(n, b); });
    board.appendChild(b);
  });
}
function handleGridClick(n, btn){
  if(btn.classList.contains('done')) return;
  if(n === gridNext){
    btn.classList.add('done');
    if('speechSynthesis' in window) speechSynthesis.cancel();
    speak(numberToEnglish(n), 'en-US', 0.8);
    speak(numberToChinese(n), 'zh-CN', 0.95);
    gridNext++;
    if(gridNext > gridRangeMax){
      document.getElementById('gridStatus').textContent = '🎉 全部完成啦，你真棒！';
      addStars(10);
      var justUnlocked = null;
      if(!state.gridCompleted[gridRangeMax]){
        state.gridCompleted[gridRangeMax] = true;
        saveState();
        if(gridRangeMax === 20 && isRangeUnlocked(50)) justUnlocked = 50;
        if(gridRangeMax === 50 && isRangeUnlocked(100)) justUnlocked = 100;
      }
      renderGridRangeRow();
      renderHearRangeRow();
      var actions = [
        {label:'🔁 再玩一次', onClick:function(){ renderNumGrid(gridRangeMax); }}
      ];
      if(justUnlocked){
        actions.push({label:'⬆️ 挑战 1-' + justUnlocked, onClick:function(){
          gridRangeMax = justUnlocked; renderGridRangeRow(); renderNumGrid(justUnlocked);
        }});
      }
      actions.push({label:'🏠 回首页', onClick:function(){ goScreen('home'); }});
      var gridDoneToken = uiToken;
      setTimeout(function(){
        if(gridDoneToken !== uiToken) return;
        showModal({
          mascot:'🏆',
          title: justUnlocked ? '太厉害了，解锁新范围！' : '数字连线完成！',
          msg: justUnlocked ? ('1-' + gridRangeMax + ' 全部完成，你解锁了「1-' + justUnlocked + '」挑战！') : ('1-' + gridRangeMax + ' 全部完成，真棒！'),
          actions: actions
        });
      }, 300);
    } else {
      document.getElementById('gridStatus').textContent = '请找到数字：' + gridNext;
    }
  } else {
    btn.classList.add('wrong');
    setTimeout(function(){ btn.classList.remove('wrong'); }, 400);
  }
}
renderGridRangeRow();
renderNumGrid(gridRangeMax);

/* ============ HEAR & PICK NUMBER ============ */
var hearRangeMax = 20;
var hearStreak = 0;
var hearWrongCount = 0;
var currentHearNum = 1;
var hearRecentWrong = []; /* session-only: recently missed numbers come back more often */
var hearQuizMode = 'plain';
function renderHearRangeRow(){
  var row = document.getElementById('hearRangeRow');
  row.innerHTML = '';
  GRID_RANGES.forEach(function(r){
    var unlocked = isRangeUnlocked(r);
    var b = document.createElement('button');
    b.className = 'range-btn' + (r === hearRangeMax ? ' active' : '') + (unlocked ? '' : ' locked');
    b.textContent = unlocked ? ('1-' + r) : ('🔒 1-' + r);
    b.addEventListener('click', function(){
      if(!isRangeUnlocked(r)){
        showToast(nextLockedRequirement(r));
        return;
      }
      hearRangeMax = r;
      renderHearRangeRow();
      nextHearQuiz();
    });
    row.appendChild(b);
  });
}
function nextHearQuiz(){
  hearWrongCount = 0;
  var validRecent = hearRecentWrong.filter(function(x){ return x <= hearRangeMax; });
  if(validRecent.length && Math.random() < 0.6){
    currentHearNum = validRecent[Math.floor(Math.random()*validRecent.length)];
  } else {
    currentHearNum = 1 + Math.floor(Math.random()*hearRangeMax);
  }
  hearQuizMode = (currentHearNum <= 20 && Math.random() < 0.5) ? 'clue' : 'plain';
  var countWrap = document.getElementById('hearCountWrap');
  if(hearQuizMode === 'clue'){
    var emoji = COUNT_EMOJI[Math.floor(Math.random()*COUNT_EMOJI.length)];
    countWrap.innerHTML = '';
    for(var i=0;i<currentHearNum;i++){
      var s = document.createElement('span');
      s.textContent = emoji;
      s.style.animationDelay = (i*0.03)+'s';
      countWrap.appendChild(s);
    }
    countWrap.style.display = '';
    document.getElementById('hearPrompt').textContent = '数一数，是哪个数字？';
  } else {
    countWrap.style.display = 'none';
    countWrap.innerHTML = '';
    document.getElementById('hearPrompt').textContent = '仔细听，是哪个数字？';
  }
  var options = new Set([currentHearNum]);
  while(options.size < 4){
    var d = 1 + Math.floor(Math.random()*hearRangeMax);
    options.add(d);
  }
  var optArr = shuffle(Array.from(options));
  var row = document.getElementById('hearChoiceRow');
  row.innerHTML = '';
  optArr.forEach(function(n){
    var b = document.createElement('button');
    b.className = 'choice-btn';
    b.textContent = n;
    b.setAttribute('data-num', n);
    b.addEventListener('click', function(){ handleHearAnswer(n, b); });
    row.appendChild(b);
  });
  reactMascot('hearMascot', 'happy', 'hearBubble', '仔细听哦～');
  playHearPrompt();
}
function playHearPrompt(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(hearQuizMode === 'clue'){
    speak('How many are there?', 'en-US', 0.85).then(function(){
      return speak('一共有几个呢？', 'zh-CN', 0.9);
    });
  } else {
    speak(numberToEnglish(currentHearNum), 'en-US', 0.8).then(function(){
      return speak(numberToChinese(currentHearNum), 'zh-CN', 0.9);
    });
  }
}
document.getElementById('hearReplayBtn').addEventListener('click', playHearPrompt);
document.getElementById('hearHintBtn').addEventListener('click', function(){
  var btn = document.querySelector('#hearChoiceRow [data-num="' + currentHearNum + '"]');
  if(btn){ btn.classList.add('hint-glow'); setTimeout(function(){ btn.classList.remove('hint-glow'); }, 2000); }
  speak(numberToChinese(currentHearNum), 'zh-CN', 0.7);
});
function handleHearAnswer(n, btn){
  if(n === currentHearNum){
    btn.classList.add('correct');
    sparkleBurst(btn);
    hearStreak++;
    document.getElementById('hearStreak').textContent = '连续答对：' + hearStreak;
    addStars(1);
    hearRecentWrong = hearRecentWrong.filter(function(x){ return x !== currentHearNum; });
    reactMascot('hearMascot', 'happy', 'hearBubble', hearQuizMode === 'clue' ? '数得真准！' : '耳朵真灵！');
    if(hearQuizMode === 'clue'){
      speak(numberToEnglish(currentHearNum), 'en-US', 0.85);
      speak('答对啦，一共是 ' + currentHearNum + ' 个！', 'zh-CN', 0.95);
    } else {
      speak('Correct!', 'en-US', 0.9);
      speak('答对了！', 'zh-CN', 0.95);
    }
    var isMilestone = hearStreak > 0 && hearStreak % 10 === 0;
    var hearAnswerToken = uiToken;
    if(isMilestone){
      setTimeout(function(){
        if(hearAnswerToken !== uiToken) return;
        showModal({
          mascot:'🐧', title:'连续答对 ' + hearStreak + ' 题！',
          msg:'听音辨数字玩得真好！要不要换个更大的范围试试？',
          actions:[
            {label:'👂 继续挑战', onClick:function(){ nextHearQuiz(); }},
            {label:'🧩 去玩数字连线', onClick:function(){ switchNumTab('grid'); }},
            {label:'🏠 回首页', onClick:function(){ goScreen('home'); }}
          ]
        });
      }, 700);
    } else {
      if(hearStreak % 5 === 0) launchConfetti(90);
      setTimeout(function(){
        if(hearAnswerToken !== uiToken) return;
        nextHearQuiz();
      }, 1500);
    }
  } else {
    btn.classList.add('wrong');
    hearWrongCount++;
    reactMascot('hearMascot', 'sad', 'hearBubble', '再听一次～');
    speak('再听一次哦', 'zh-CN', 0.95);
    setTimeout(function(){ btn.classList.remove('wrong'); }, 500);
    hearStreak = 0;
    document.getElementById('hearStreak').textContent = '连续答对：0';
    if(hearRecentWrong.indexOf(currentHearNum) === -1){
      hearRecentWrong.push(currentHearNum);
      if(hearRecentWrong.length > 6) hearRecentWrong.shift();
    }
    if(hearWrongCount >= 2){
      var correctBtn = document.querySelector('#hearChoiceRow [data-num="' + currentHearNum + '"]');
      if(correctBtn) correctBtn.classList.add('hint-glow');
    }
  }
}
renderHearRangeRow();

/* ============ SONGS: 中英文儿歌 ============ */
/* Only classic public-domain / traditional folk nursery rhymes are used here
   (centuries-old English rhymes; well-known anonymous Chinese folk children's songs)
   to avoid any copyright concerns — same approach used for mascots elsewhere in this app. */
var NOTE_FREQ = {
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00, B5:987.77, C6:1046.50
};
var SONGS = [
  {
    id:'twinkle', emoji:'🌟', titleEn:'Twinkle Twinkle Little Star', titleCn:'小星星', lang:'en',
    lines:[
      {en:'Twinkle, twinkle, little star,', cn:'一闪一闪亮晶晶，', notes:['C5','C5','G5','G5','A5','A5','G5']},
      {en:'How I wonder what you are!', cn:'满天都是小星星，', notes:['F5','F5','E5','E5','D5','D5','C5']},
      {en:'Up above the world so high,', cn:'挂在天上放光明，', notes:['G5','G5','F5','F5','E5','E5','D5']},
      {en:'Like a diamond in the sky.', cn:'好像许多小眼睛。', notes:['G5','G5','F5','F5','E5','E5','D5']},
      {en:'Twinkle, twinkle, little star,', cn:'一闪一闪亮晶晶，', notes:['C5','C5','G5','G5','A5','A5','G5']},
      {en:'How I wonder what you are!', cn:'满天都是小星星。', notes:['F5','F5','E5','E5','D5','D5','C5']}
    ]
  },
  {
    id:'boat', emoji:'🚣', titleEn:'Row Row Row Your Boat', titleCn:'划呀划小船', lang:'en',
    lines:[
      {en:'Row, row, row your boat,', cn:'划呀划呀划小船，', notes:['C5','C5','C5','D5','E5']},
      {en:'Gently down the stream.', cn:'轻轻地划向前，', notes:['E5','D5','E5','F5','G5']},
      {en:'Merrily, merrily, merrily, merrily,', cn:'快乐呀快乐呀快乐呀快乐，', notes:['C6','C6','C6','G5','G5','G5','E5','E5','E5','C5','C5','C5']},
      {en:'Life is but a dream.', cn:'生活就像一场梦。', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'sheep', emoji:'🐑', titleEn:'Baa Baa Black Sheep', titleCn:'咩咩黑绵羊', lang:'en',
    lines:[
      {en:'Baa, baa, black sheep,', cn:'咩咩，黑绵羊，', notes:['C5','C5','G5','G5']},
      {en:'Have you any wool?', cn:'你有羊毛吗？', notes:['A5','A5','G5']},
      {en:'Yes sir, yes sir,', cn:'有的，有的，', notes:['F5','F5','E5','E5']},
      {en:'Three bags full.', cn:'三大袋。', notes:['D5','D5','C5']},
      {en:'One for my master,', cn:'一袋给主人，', notes:['G5','G5','F5','F5']},
      {en:'One for my dame,', cn:'一袋给夫人，', notes:['E5','E5','D5']},
      {en:'And one for the little boy', cn:'还有一袋给小男孩，', notes:['G5','G5','F5','F5','E5','E5']},
      {en:'Who lives down the lane.', cn:'住在小巷里。', notes:['D5','D5','C5']}
    ]
  },
  {
    id:'tigers', emoji:'🐯', titleEn:'Two Tigers', titleCn:'两只老虎', lang:'cn',
    lines:[
      {cn:'两只老虎，两只老虎，', en:'Two tigers, two tigers,', notes:['C5','D5','E5','C5','C5','D5','E5','C5']},
      {cn:'跑得快，跑得快，', en:'Run so fast, run so fast,', notes:['E5','F5','G5','E5','F5','G5']},
      {cn:'一只没有耳朵，一只没有尾巴，', en:'One has no ears, one has no tail,', notes:['G5','A5','G5','F5','E5','C5','G5','A5','G5','F5','E5','C5']},
      {cn:'真奇怪，真奇怪。', en:'How strange, how strange.', notes:['C5','G4','C5','C5','G4','C5']}
    ]
  },
  {
    id:'star_cn', emoji:'✨', titleEn:'Little Star', titleCn:'一闪一闪亮晶晶', lang:'cn',
    lines:[
      {cn:'一闪一闪亮晶晶，', en:'Twinkle, twinkle, little star,', notes:['C5','C5','G5','G5','A5','A5','G5']},
      {cn:'满天都是小星星，', en:'How I wonder what you are!', notes:['F5','F5','E5','E5','D5','D5','C5']},
      {cn:'挂在天上放光明，', en:'Up above the world so high,', notes:['G5','G5','F5','F5','E5','E5','D5']},
      {cn:'好像许多小眼睛。', en:'Like a diamond in the sky.', notes:['G5','G5','F5','F5','E5','E5','D5']}
    ]
  },
  {
    id:'turnip', emoji:'🥕', titleEn:'Pulling the Turnip', titleCn:'拔萝卜', lang:'cn',
    lines:[
      {cn:'拔萝卜，拔萝卜，', en:'Pulling the turnip, pulling the turnip,', notes:['C5','D5','E5','C5','D5','E5']},
      {cn:'哎呦哎呦拔不动。', en:'Oh no, oh no, it will not budge.', notes:['E5','D5','C5','E5','D5','C5']},
      {cn:'老太婆快快来，', en:'Grandma, come quickly,', notes:['G4','A4','C5','D5','E5']},
      {cn:'一起使劲拔萝卜。', en:"Let's pull the turnip together.", notes:['C5','D5','E5','F5','G5','C5']}
    ]
  },
  {
    id:'hickory', emoji:'🐭', titleEn:'Hickory Dickory Dock', titleCn:'嘀嗒嘀嗒钟', lang:'en',
    lines:[
      {en:'Hickory dickory dock,', cn:'嘀嗒嘀嗒，时钟响，', notes:['C5','D5','E5','F5','G5']},
      {en:'The mouse ran up the clock.', cn:'小老鼠，爬上钟，', notes:['G5','A5','G5','F5','E5','D5']},
      {en:'The clock struck one,', cn:'钟敲一下，', notes:['C6','B5','A5']},
      {en:'The mouse ran down,', cn:'老鼠跑下来，', notes:['G5','F5','E5','D5']},
      {en:'Hickory dickory dock.', cn:'嘀嗒嘀嗒钟。', notes:['C5','D5','E5','C5']}
    ]
  },
  {
    id:'jackjill', emoji:'🪣', titleEn:'Jack and Jill', titleCn:'杰克和吉尔', lang:'en',
    lines:[
      {en:'Jack and Jill went up the hill,', cn:'杰克和吉尔，一起上山坡，', notes:['C5','D5','E5','F5','G5','A5']},
      {en:'To fetch a pail of water.', cn:'去打一桶水。', notes:['A5','G5','F5','E5']},
      {en:'Jack fell down and broke his crown,', cn:'杰克摔了一跤，', notes:['G5','F5','E5','D5','C5']},
      {en:'And Jill came tumbling after.', cn:'吉尔也跟着摔倒啦。', notes:['C5','D5','E5','F5']}
    ]
  },
  {
    id:'humpty', emoji:'🥚', titleEn:'Humpty Dumpty', titleCn:'蛋头先生', lang:'en',
    lines:[
      {en:'Humpty Dumpty sat on a wall,', cn:'蛋头先生坐墙上，', notes:['C5','C5','G5','G5','A5']},
      {en:'Humpty Dumpty had a great fall.', cn:'一不小心摔下墙。', notes:['A5','G5','F5','F5','E5']},
      {en:"All the king's horses and all the king's men,", cn:'国王的马和人都来了，', notes:['E5','D5','D5','C5','C5']},
      {en:"Couldn't put Humpty together again.", cn:'也没办法把他拼回去。', notes:['D5','E5','F5','G5','C5']}
    ]
  },
  {
    id:'marylamb', emoji:'🐑', titleEn:'Mary Had a Little Lamb', titleCn:'玛丽有只小羊羔', lang:'en',
    lines:[
      {en:'Mary had a little lamb,', cn:'玛丽有一只小羊羔，', notes:['E5','D5','C5','D5','E5']},
      {en:'Its fleece was white as snow.', cn:'它的毛像雪一样白。', notes:['E5','E5','E5']},
      {en:'And everywhere that Mary went,', cn:'玛丽走到哪里，', notes:['D5','D5','D5']},
      {en:'The lamb was sure to go.', cn:'小羊就跟到哪里。', notes:['E5','G5','G5']}
    ]
  },
  {
    id:'muffet', emoji:'🕷️', titleEn:'Little Miss Muffet', titleCn:'小玛菲特小姐', lang:'en',
    lines:[
      {en:'Little Miss Muffet sat on a tuffet,', cn:'小玛菲特坐在小凳子上，', notes:['C5','D5','E5','F5','G5','A5']},
      {en:'Eating her curds and whey.', cn:'吃着她的奶酪。', notes:['A5','G5','F5','E5']},
      {en:'Along came a spider,', cn:'一只蜘蛛爬过来，', notes:['G5','F5','E5']},
      {en:'Who sat down beside her,', cn:'坐在她旁边，', notes:['E5','D5','C5']},
      {en:'And frightened Miss Muffet away.', cn:'把玛菲特小姐吓跑了。', notes:['D5','E5','F5','G5','C5']}
    ]
  },
  {
    id:'raingo', emoji:'🌧️', titleEn:'Rain Rain Go Away', titleCn:'雨儿雨儿快走开', lang:'en',
    lines:[
      {en:'Rain, rain, go away,', cn:'雨儿雨儿快走开，', notes:['G5','G5','A5','A5','G5']},
      {en:'Come again another day.', cn:'改天再来吧。', notes:['F5','F5','E5','E5','D5']},
      {en:'Little children want to play,', cn:'小朋友们想出去玩，', notes:['E5','F5','G5']},
      {en:'Rain, rain, go away.', cn:'雨儿雨儿快走开。', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'oldman', emoji:'🎵', titleEn:'This Old Man', titleCn:'这个老人', lang:'en',
    lines:[
      {en:'This old man, he played one,', cn:'这个老人，他打一，', notes:['G5','G5','G5','E5','G5']},
      {en:'He played knick-knack on my thumb.', cn:'在我大拇指上敲一敲。', notes:['A5','A5','G5','E5']},
      {en:'With a knick-knack paddywhack,', cn:'咚咚咚，敲一敲，', notes:['G5','G5','E5','C5']},
      {en:'Give a dog a bone,', cn:'给小狗一根骨头，', notes:['D5','E5','F5','G5']},
      {en:'This old man came rolling home.', cn:'这个老人滚着回家了。', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'hushbaby', emoji:'🌙', titleEn:'Hush Little Baby', titleCn:'嘘宝宝别哭', lang:'en',
    lines:[
      {en:'Hush little baby, dont say a word,', cn:'嘘，宝宝，别说话，', notes:['C5','C5','C5','D5','E5']},
      {en:"Mama's gonna buy you a mockingbird.", cn:'妈妈给你买只小鸟。', notes:['E5','D5','C5','D5','E5']},
      {en:"And if that mockingbird don't sing,", cn:'如果小鸟不会唱歌，', notes:['E5','F5','G5']},
      {en:"Mama's gonna buy you a diamond ring.", cn:'妈妈给你买个戒指。', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'ringrosie', emoji:'🌸', titleEn:'Ring Around the Rosie', titleCn:'围着玫瑰转圈圈', lang:'en',
    lines:[
      {en:'Ring around the rosie,', cn:'围着玫瑰转圈圈，', notes:['C5','D5','E5','F5','G5']},
      {en:'A pocket full of posies.', cn:'口袋装满小花花。', notes:['G5','F5','E5','D5']},
      {en:'Ashes, ashes,', cn:'呼呼，呼呼，', notes:['E5','D5']},
      {en:'We all fall down!', cn:'我们都坐下啦！', notes:['C5','B4','A4']}
    ]
  },
  {
    id:'itsybitsy', emoji:'🕸️', titleEn:'Itsy Bitsy Spider', titleCn:'小小蜘蛛', lang:'en',
    lines:[
      {en:'The itsy bitsy spider climbed up the water spout.', cn:'小小蜘蛛，爬上水管，', notes:['C5','D5','E5','F5','G5','A5']},
      {en:'Down came the rain and washed the spider out.', cn:'雨水冲呀冲，把蜘蛛冲下来。', notes:['A5','G5','F5','E5','D5']},
      {en:'Out came the sun and dried up all the rain,', cn:'太阳出来了，晒干了雨水，', notes:['E5','F5','G5','A5']},
      {en:'And the itsy bitsy spider climbed up the spout again.', cn:'小小蜘蛛，又爬上了水管。', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'diushoujuan', emoji:'🧣', titleEn:'Throw the Handkerchief', titleCn:'丢手绢', lang:'cn',
    lines:[
      {cn:'丢手绢，丢手绢，', en:'Throw the handkerchief, throw the handkerchief,', notes:['C5','D5','E5','C5','C5','D5','E5','C5']},
      {cn:'轻轻地放在小朋友的后面，', en:'Gently place it behind a friend,', notes:['E5','F5','G5','A5','G5','F5','E5','D5','C5']},
      {cn:'大家不要告诉他，', en:"Don't tell him, everyone,", notes:['G5','A5','G5','F5','E5']},
      {cn:'快点快点抓住他。', en:'Quick, quick, catch him.', notes:['C5','D5','E5','F5','G5']}
    ]
  },
  {
    id:'zhaopengyou', emoji:'🤝', titleEn:'Looking for Friends', titleCn:'找朋友', lang:'cn',
    lines:[
      {cn:'找呀找呀找朋友，', en:'Looking, looking for a friend,', notes:['C5','C5','D5','D5','E5','E5','C5']},
      {cn:'找到一个好朋友，', en:'Found myself a good friend,', notes:['F5','F5','G5','G5','A5','A5','G5']},
      {cn:'敬个礼，握握手，', en:'Salute and shake hands,', notes:['F5','F5','E5','E5','D5','D5','C5']},
      {cn:'你是我的好朋友。', en:'You are my good friend.', notes:['C5','D5','E5','F5','G5','C5']}
    ]
  },
  {
    id:'paipaizuo', emoji:'🍎', titleEn:'Sitting in a Row', titleCn:'排排坐', lang:'cn',
    lines:[
      {cn:'排排坐，', en:'Sitting in a row,', notes:['C5','D5','E5']},
      {cn:'吃果果，', en:'Eating fruit,', notes:['E5','D5','C5']},
      {cn:'幼儿园里，', en:'At kindergarten,', notes:['C5','D5','E5','F5']},
      {cn:'朋友多。', en:'There are many friends.', notes:['G5','F5','E5']}
    ]
  },
  {
    id:'ladaju', emoji:'🪚', titleEn:'Pulling the Big Saw', titleCn:'拉大锯', lang:'cn',
    lines:[
      {cn:'拉大锯，扯大锯，', en:'Pull the big saw, pull the big saw,', notes:['C5','C5','D5','D5','E5','E5','C5']},
      {cn:'姥姥家，唱大戏，', en:"At grandma's house, singing opera,", notes:['E5','F5','G5','G5','F5','E5']},
      {cn:'接闺女，请女婿，', en:"Inviting daughter and son-in-law,", notes:['D5','D5','E5','E5','F5']},
      {cn:'小外孙，也要去。', en:'The little grandchild wants to go too.', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'xiaolaoshu', emoji:'🐁', titleEn:'Little Mouse on the Lamp Stand', titleCn:'小老鼠上灯台', lang:'cn',
    lines:[
      {cn:'小老鼠，上灯台，', en:'Little mouse climbed the lamp stand,', notes:['C5','D5','E5','D5','C5']},
      {cn:'偷油吃，下不来，', en:'Stole some oil, could not get down,', notes:['E5','F5','G5','F5','E5']},
      {cn:'吱吱吱，叫奶奶，', en:'Squeak squeak, calling grandma,', notes:['G5','A5','G5','F5','E5']},
      {cn:'奶奶抱它下不来。', en:"Grandma couldn't help it down.", notes:['D5','E5','F5','G5','C5']}
    ]
  },
  {
    id:'yaoayao', emoji:'🚣', titleEn:'Rocking to Grandma\'s Bridge', titleCn:'摇啊摇', lang:'cn',
    lines:[
      {cn:'摇啊摇，', en:'Rocking, rocking,', notes:['C5','D5','E5']},
      {cn:'摇到外婆桥，', en:"Rocking to grandma's bridge,", notes:['E5','F5','G5','A5']},
      {cn:'外婆夸我好宝宝，', en:'Grandma says I am a good baby,', notes:['A5','G5','F5','E5','D5']},
      {cn:'一摇摇到外婆桥。', en:"Rocking all the way to grandma's bridge.", notes:['C5','D5','E5','F5','C5']}
    ]
  },
  {
    id:'xiaobaitu', emoji:'🐰', titleEn:'Little White Rabbit', titleCn:'小白兔白又白', lang:'cn',
    lines:[
      {cn:'小白兔，白又白，', en:'Little white rabbit, so white,', notes:['C5','C5','D5','D5','E5']},
      {cn:'两只耳朵竖起来，', en:'Two ears stand up straight,', notes:['E5','F5','G5','A5','G5']},
      {cn:'爱吃萝卜爱吃菜，', en:'Loves radish, loves vegetables,', notes:['F5','F5','E5','E5','D5']},
      {cn:'蹦蹦跳跳真可爱。', en:'Hopping and jumping, so cute.', notes:['C5','D5','E5','F5','C5']}
    ]
  },
  {
    id:'dagongji', emoji:'🐓', titleEn:'The Big Rooster', titleCn:'大公鸡', lang:'cn',
    lines:[
      {cn:'大公鸡，真美丽，', en:'Big rooster, so beautiful,', notes:['C5','D5','E5','F5','G5']},
      {cn:'红红的鸡冠花花衣，', en:'Red comb and colorful feathers,', notes:['G5','F5','E5','D5','C5']},
      {cn:'每天早上喔喔叫，', en:'Every morning it crows cock-a-doodle-doo,', notes:['E5','F5','G5','A5']},
      {cn:'叫我早早起。', en:'Waking me up early.', notes:['G5','F5','E5','D5','C5']}
    ]
  },
  {
    id:'yueliangzou', emoji:'🌕', titleEn:'The Moon Walks With Me', titleCn:'月亮走我也走', lang:'cn',
    lines:[
      {cn:'月亮走，', en:'The moon walks,', notes:['C5','D5','E5']},
      {cn:'我也走，', en:'I walk too,', notes:['E5','D5','C5']},
      {cn:'我给月亮，', en:'I give the moon,', notes:['C5','D5','E5','F5']},
      {cn:'背花篓。', en:'A basket to carry.', notes:['G5','F5','E5']}
    ]
  },
  {
    id:'shanghudashan', emoji:'🐯', titleEn:'One Two Three Four Five', titleCn:'一二三四五上山打老虎', lang:'cn',
    lines:[
      {cn:'一二三四五，', en:'One two three four five,', notes:['C5','D5','E5','F5','G5']},
      {cn:'上山打老虎，', en:'Climb the mountain to hunt a tiger,', notes:['G5','A5','G5','F5','E5']},
      {cn:'老虎没打到，', en:"Didn't catch the tiger,", notes:['E5','D5','C5','D5']},
      {cn:'打到小松鼠。', en:'Caught a little squirrel instead.', notes:['D5','E5','F5','G5','C5']}
    ]
  }
];

var currentSong = null;
var songToken = 0;

function renderSongGrid(){
  var grid = document.getElementById('songGrid');
  grid.innerHTML = '';
  SONGS.forEach(function(song){
    var card = document.createElement('div');
    card.className = 'letter-card';
    card.innerHTML =
      '<span class="em">' + song.emoji + '</span>' +
      '<div class="word">' + song.titleEn + '</div>' +
      '<div class="cn">' + song.titleCn + '</div>';
    card.addEventListener('click', function(){ selectSong(song); });
    grid.appendChild(card);
  });
}
renderSongGrid();

function playNoteSeq(notes, expectedToken){
  return new Promise(function(resolve){
    if(!ensureAudioCtx()){ resolve(); return; }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    var i = 0;
    function step(){
      if(expectedToken !== songToken){ resolve(); return; } /* playback was stopped/replaced mid-sequence */
      if(i >= notes.length){ resolve(); return; }
      var freq = NOTE_FREQ[notes[i]];
      if(freq) playMusicNote(freq);
      i++;
      setTimeout(step, 320);
    }
    step();
  });
}

function selectSong(song){
  currentSong = song;
  document.getElementById('songGrid').style.display = 'none';
  var player = document.getElementById('songPlayer');
  player.style.display = '';
  document.getElementById('songTitleLine').textContent = song.titleEn + ' ・ ' + song.titleCn;
  var box = document.getElementById('songLyricsBox');
  box.innerHTML = '';
  song.lines.forEach(function(line, idx){
    var d = document.createElement('div');
    d.className = 'song-line';
    d.id = 'songline-' + idx;
    var primaryText = song.lang === 'en' ? line.en : line.cn;
    var secondaryText = song.lang === 'en' ? line.cn : line.en;
    d.innerHTML = '<span class="sl-en">' + primaryText + '</span><span class="sl-cn">' + secondaryText + '</span>';
    box.appendChild(d);
  });
  reactMascot('songMascot', 'happy', 'songBubble', '一起唱起来吧！🎶');
  playSong(song);
}

/* Map a musical note to a SpeechSynthesisUtterance pitch (0-2 range) so that
   singing each word/character "on" its note produces an actual melodic
   contour, instead of one flat monotone sentence — this is what makes it
   sound sung rather than recited. */
function noteToPitch(noteName){
  var freq = NOTE_FREQ[noteName];
  if(!freq) return 1.15;
  var minF = 261.63, maxF = 1046.50; /* C4 .. C6, the range used across all songs */
  var t = (freq - minF) / (maxF - minF);
  t = Math.max(0, Math.min(1, t));
  return 0.8 + t * 1.1;
}
/* Split lyric text into the "singing units" that each get their own note/pitch:
   Chinese is syllable-timed (one hanzi = one beat), so split by character;
   English is split by word — not perfectly syllable-accurate, but the notes
   array is distributed proportionally across words so the melody still rises
   and falls in the right places. */
function splitLyricUnits(text, lang){
  if(lang === 'zh-CN'){
    var cleaned = text.replace(/[，。！？、\s]/g, '');
    return Array.from(cleaned);
  }
  return text.split(/\s+/).filter(function(w){ return w.length; });
}
function speakLineMelody(text, lang, notes, myToken){
  var units = splitLyricUnits(text, lang);
  if(!units.length || !notes || !notes.length){
    return speak(text, lang, 0.85);
  }
  var p = Promise.resolve();
  units.forEach(function(unit, idx){
    var noteIdx = Math.min(notes.length - 1, Math.floor(idx * notes.length / units.length));
    var pitch = noteToPitch(notes[noteIdx]);
    p = p.then(function(){
      if(myToken !== songToken) return Promise.reject('cancelled');
      return speak(unit, lang, 0.8, pitch);
    });
  });
  return p;
}
/* Original browser speechSynthesis + per-syllable pitch "singing" fallback,
   used automatically if the pre-generated natural-voice mp3 for this song
   can't be loaded. */
function playSongSpeech(song){
  var myToken = ++songToken;
  stopMusic();
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  p = p.then(function(){
    if(myToken !== songToken) return Promise.reject('cancelled');
    return playNoteSeq(song.lines[0].notes.slice(0, 2), myToken);
  });
  song.lines.forEach(function(line, idx){
    p = p.then(function(){
      if(myToken !== songToken) return Promise.reject('cancelled');
      document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
      var el = document.getElementById('songline-' + idx);
      if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
      var primary = song.lang === 'en' ? line.en : line.cn;
      var primaryLang = song.lang === 'en' ? 'en-US' : 'zh-CN';
      var secondary = song.lang === 'en' ? line.cn : line.en;
      var secondaryLang = song.lang === 'en' ? 'zh-CN' : 'en-US';
      return speakLineMelody(primary, primaryLang, line.notes, myToken).then(function(){
        if(myToken !== songToken) return Promise.reject('cancelled');
        return speak(secondary, secondaryLang, 0.88);
      });
    });
  });
  p.then(function(){
    if(myToken !== songToken) return;
    document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
    addStars(3);
    launchConfetti(70);
    reactMascot('songMascot', 'happy', 'songBubble', '唱完啦，真棒！🎉');
    showToast('儿歌唱完啦，喜欢的话再听一次吧！🎵');
    if(musicEnabled) startMusic();
  }).catch(function(){ /* cancelled by user action, ignore */ });
}

/* Plays the pre-generated natural AI-voice recording for this song (real
   neural voice, not browser TTS), with the on-screen lyric line highlighted
   in sync via the precomputed timing map. Falls back to playSongSpeech if
   the audio file is unavailable. */
function playSong(song){
  var myToken = ++songToken;
  var uiTok = uiToken;
  stopMusic();
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var allOffsets = SONG_TIMINGS[song.id];
  if(!allOffsets){ playSongSpeech(song); return; }
  var lineOffsets = [];
  for(var i=0;i<allOffsets.length;i+=2) lineOffsets.push(allOffsets[i]);
  function highlight(lineIdx){
    document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('songline-' + lineIdx);
    if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
  }
  function onDone(){
    if(myToken !== songToken) return;
    document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
    addStars(3);
    launchConfetti(70);
    reactMascot('songMascot', 'happy', 'songBubble', '唱完啦，真棒！🎉');
    showToast('儿歌唱完啦，喜欢的话再听一次吧！🎵');
    if(musicEnabled) startMusic();
  }
  playNoteSeq(song.lines[0].notes.slice(0, 2), myToken).then(function(){
    if(myToken !== songToken) return;
    playTimedAudio(AUDIO_BASE + 'songs/' + song.id + '.mp3', lineOffsets, uiTok, highlight, onDone, function(){ playSongSpeech(song); });
  });
}

function stopSongPlayback(){
  songToken++; /* invalidate any in-flight playback chain */
  if('speechSynthesis' in window) speechSynthesis.cancel();
  stopCurrentAudio();
  document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
  if(musicEnabled) startMusic();
}

document.getElementById('songReplayBtn').addEventListener('click', function(){
  if(currentSong) playSong(currentSong);
});
document.getElementById('songStopBtn').addEventListener('click', function(){
  stopSongPlayback();
  document.getElementById('songPlayer').style.display = 'none';
  document.getElementById('songGrid').style.display = '';
  currentSong = null;
});

/* ============ POEMS: 古诗词 ============ */
/* Only classical Chinese poems whose authors died many centuries ago (all
   public domain), selected for being the most commonly taught "first poems"
   for young children in Chinese early-childhood education. */
var POEMS = [
  {id:'yong_e', title:'咏鹅', author:'骆宾王（唐）', lines:['鹅鹅鹅，','曲项向天歌。','白毛浮绿水，','红掌拨清波。'], meaning:'鹅鹅鹅，一只大白鹅弯着脖子对着天空唱歌。雪白的羽毛浮在绿色的水面上，红红的脚掌拨动着清澈的水波。'},
  {id:'jingyesi', title:'静夜思', author:'李白（唐）', lines:['床前明月光，','疑是地上霜。','举头望明月，','低头思故乡。'], meaning:'床前洒满了明亮的月光，好像地上铺了一层白霜。抬起头看着天上的月亮，低下头想念远方的家乡。'},
  {id:'chunxiao', title:'春晓', author:'孟浩然（唐）', lines:['春眠不觉晓，','处处闻啼鸟。','夜来风雨声，','花落知多少。'], meaning:'春天睡觉真舒服，不知不觉天就亮了，到处都能听到小鸟在叫。昨天夜里又刮风又下雨，不知道有多少花被吹落了。'},
  {id:'minnong', title:'悯农', author:'李绅（唐）', lines:['锄禾日当午，','汗滴禾下土。','谁知盘中餐，','粒粒皆辛苦。'], meaning:'农民伯伯在中午的太阳下锄地，汗水一滴一滴落在禾苗下的泥土里。谁知道我们碗里的每一粒米饭，都是农民辛辛苦苦种出来的呀。'},
  {id:'guanquelou', title:'登鹳雀楼', author:'王之涣（唐）', lines:['白日依山尽，','黄河入海流。','欲穷千里目，','更上一层楼。'], meaning:'太阳靠着山慢慢落下去，黄河的水流向大海。想要看得更远更远，那就要再爬上一层楼。'},
  {id:'hua', title:'画', author:'王维（唐，传）', lines:['远看山有色，','近听水无声。','春去花还在，','人来鸟不惊。'], meaning:'远远看去山是有颜色的，走近听水却没有声音。这是因为这是一幅画呀！画里的春天过去了花还开着，画里的人走近了小鸟也不会被吓跑。'},
  {id:'yongliu', title:'咏柳', author:'贺知章（唐）', lines:['碧玉妆成一树高，','万条垂下绿丝绦。','不知细叶谁裁出，','二月春风似剪刀。'], meaning:'柳树像用碧玉打扮成的一样高高的，垂下来的柳条像绿色的丝带。不知道这些细细的叶子是谁剪出来的，原来是二月的春风，它就像一把神奇的剪刀。'},
  {id:'jiangnan', title:'江南', author:'汉乐府（汉代）', lines:['江南可采莲，','莲叶何田田。','鱼戏莲叶间。'], meaning:'江南是采莲子的好地方，莲叶长得多茂盛呀。小鱼儿在莲叶中间快乐地游来游去。'},
  {id:'gulangyuexing', title:'古朗月行（节选）', author:'李白（唐）', lines:['小时不识月，','呼作白玉盘。','又疑瑶台镜，','飞在青云端。'], meaning:'小时候不认识月亮，把它叫作白玉做的盘子。又怀疑它是瑶台上的镜子，飞到了蓝天白云之间。'},
  {id:'wanglushan', title:'望庐山瀑布', author:'李白（唐）', lines:['日照香炉生紫烟，','遥看瀑布挂前川。','飞流直下三千尺，','疑是银河落九天。'], meaning:'太阳照着香炉峰升起紫色的云雾，远远看去瀑布像是挂在山前的一条河。水流飞快地冲下来，好像有三千尺那么长，让人怀疑是银河从天上掉了下来。'},
  {id:'zengwanglun', title:'赠汪伦', author:'李白（唐）', lines:['李白乘舟将欲行，','忽闻岸上踏歌声。','桃花潭水深千尺，','不及汪伦送我情。'], meaning:'李白坐上船正要出发，忽然听到岸上传来踏步唱歌的声音。桃花潭的水虽然有千尺深，也比不上汪伦送别我的这份情谊深。'},
  {id:'zaofa', title:'早发白帝城', author:'李白（唐）', lines:['朝辞白帝彩云间，','千里江陵一日还。','两岸猿声啼不住，','轻舟已过万重山。'], meaning:'清早告别彩云环绕的白帝城，千里之外的江陵一天就能到达。两岸猿猴的叫声不停地响着，轻快的小船已经穿过了层层叠叠的山峦。'},
  {id:'xiangsi', title:'相思', author:'王维（唐）', lines:['红豆生南国，','春来发几枝。','愿君多采撷，','此物最相思。'], meaning:'红豆生长在南方，春天来了不知又长出多少新枝。希望你多多采摘一些，因为这小小的红豆最能寄托相思之情。'},
  {id:'jiuyuejiu', title:'九月九日忆山东兄弟', author:'王维（唐）', lines:['独在异乡为异客，','每逢佳节倍思亲。','遥知兄弟登高处，','遍插茱萸少一人。'], meaning:'一个人在外地作客，每到节日就格外思念家乡的亲人。远远地就能想到兄弟们登高的地方，大家都插上了茱萸，只少了我一个人。'},
  {id:'luchai', title:'鹿柴', author:'王维（唐）', lines:['空山不见人，','但闻人语响。','返景入深林，','复照青苔上。'], meaning:'安静的山里看不见人，只能听到说话的声音。夕阳的余光照进深深的树林里，又照在了绿色的青苔上。'},
  {id:'songyuan', title:'送元二使安西', author:'王维（唐）', lines:['渭城朝雨浥轻尘，','客舍青青柳色新。','劝君更尽一杯酒，','西出阳关无故人。'], meaning:'渭城早晨的小雨湿润了地上的尘土，旅店旁的柳树显得格外青翠新绿。劝你再干一杯酒吧，因为西出阳关后就再也见不到老朋友了。'},
  {id:'chunyexiyu', title:'春夜喜雨', author:'杜甫（唐）', lines:['好雨知时节，','当春乃发生。','随风潜入夜，','润物细无声。'], meaning:'好雨懂得下雨的时节，正好在春天到来的时候降落。它随着春风悄悄地在夜里飘落，静静地滋润着万物，没有一点声音。'},
  {id:'juju_huangli', title:'绝句', author:'杜甫（唐）', lines:['两个黄鹂鸣翠柳，','一行白鹭上青天。','窗含西岭千秋雪，','门泊东吴万里船。'], meaning:'两只黄鹂鸟在翠绿的柳树上唱歌，一行白鹭飞向蓝蓝的天空。窗户里能看见西边山岭上千年不化的积雪，门口停泊着从遥远东吴来的船只。'},
  {id:'jiangpan', title:'江畔独步寻花', author:'杜甫（唐）', lines:['黄四娘家花满蹊，','千朵万朵压枝低。','留连戏蝶时时舞，','自在娇莺恰恰啼。'], meaning:'黄四娘家门前的小路开满了鲜花，千朵万朵的花把树枝都压弯了。蝴蝶留恋花丛不停地飞舞，自由自在的黄莺也在欢快地歌唱。'},
  {id:'shanxing', title:'山行', author:'杜牧（唐）', lines:['远上寒山石径斜，','白云生处有人家。','停车坐爱枫林晚，','霜叶红于二月花。'], meaning:'沿着弯弯曲曲的石头小路向寒冷的山上走去，白云升起的地方有几户人家。停下车来是因为喜爱这傍晚的枫树林，被霜打过的枫叶比二月的鲜花还要红。'},
  {id:'qingming', title:'清明', author:'杜牧（唐）', lines:['清明时节雨纷纷，','路上行人欲断魂。','借问酒家何处有？','牧童遥指杏花村。'], meaning:'清明节的时候细雨纷纷飘落，路上的行人心情低落。问一声哪里有卖酒的地方，放牛的小孩指了指远处的杏花村。'},
  {id:'jiangxue', title:'江雪', author:'柳宗元（唐）', lines:['千山鸟飞绝，','万径人踪灭。','孤舟蓑笠翁，','独钓寒江雪。'], meaning:'千座山上看不见一只鸟飞过，条条小路上也没有人的脚印。江面上只有一条小船，船上一位披着蓑衣戴着斗笠的老人，独自在寒冷的雪中钓鱼。'},
  {id:'minnong2', title:'悯农（其一）', author:'李绅（唐）', lines:['春种一粒粟，','秋收万颗子。','四海无闲田，','农夫犹饿死。'], meaning:'春天种下一粒种子，秋天就能收获很多粮食。天下已经没有荒废的田地了，可是仍然有农民因为吃不饱饭而饿死。'},
  {id:'wangtianmen', title:'望天门山', author:'李白（唐）', lines:['天门中断楚江开，','碧水东流至此回。','两岸青山相对出，','孤帆一片日边来。'], meaning:'天门山被长江从中间冲开，碧绿的江水向东流到这里打了个回旋。两岸的青山相对耸立着，一只小船正从太阳升起的地方驶来。'},
  {id:'chishang', title:'池上', author:'白居易（唐）', lines:['小娃撑小艇，','偷采白莲回。','不解藏踪迹，','浮萍一道开。'], meaning:'一个小娃娃撑着小船，偷偷地采了白莲花回来。他不懂得掩藏自己的踪迹，水面上的浮萍被小船划开了一条痕迹。'},
  {id:'yijiangnan', title:'忆江南', author:'白居易（唐）', lines:['江南好，','风景旧曾谙。','日出江花红胜火，','春来江水绿如蓝。','能不忆江南？'], meaning:'江南真美好，那里的风景我曾经很熟悉。太阳出来的时候江边的花儿比火还要红，春天来临时江水绿得像蓝草一样。怎能叫人不怀念江南呢？'},
  {id:'fudegu', title:'赋得古原草送别（节选）', author:'白居易（唐）', lines:['离离原上草，','一岁一枯荣。','野火烧不尽，','春风吹又生。'], meaning:'原野上茂盛的青草，每年都会枯萎一次又生长一次。就算野火也烧不尽它们，春风一吹它们又重新长了出来。'},
  {id:'xiaochi', title:'小池', author:'杨万里（宋）', lines:['泉眼无声惜细流，','树阴照水爱晴柔。','小荷才露尖尖角，','早有蜻蜓立上头。'], meaning:'泉眼悄悄地流出细细的水流，树荫倒映在水面上，好像也喜爱这晴朗柔和的天气。小小的荷叶刚刚露出尖尖的角，就已经有蜻蜓站在了它的上面。'},
  {id:'suxinshi', title:'宿新市徐公店', author:'杨万里（宋）', lines:['篱落疏疏一径深，','树头花落未成阴。','儿童急走追黄蝶，','飞入菜花无处寻。'], meaning:'稀疏的篱笆旁有一条深深的小路，树上的花刚落还没长出树荫。小孩子快步追赶着黄色的蝴蝶，蝴蝶飞进了油菜花丛中就再也找不到了。'},
  {id:'xiaochujingci', title:'晓出净慈寺送林子方', author:'杨万里（宋）', lines:['毕竟西湖六月中，','风光不与四时同。','接天莲叶无穷碧，','映日荷花别样红。'], meaning:'到底是六月的西湖景色，风光和其他季节很不一样。荷叶连着天空一片碧绿，无边无际，被阳光照耀的荷花显得格外红艳。'},
  {id:'yeshusujian', title:'夜书所见', author:'叶绍翁（宋）', lines:['萧萧梧叶送寒声，','江上秋风动客情。','知有儿童挑促织，','夜深篱落一灯明。'], meaning:'萧萧的风吹动梧桐叶送来阵阵寒意，江上的秋风让远方的客人思念起家乡。忽然看见远处篱笆下有一盏灯还亮着，知道那是孩子们在捉蟋蟀。'},
  {id:'youyuanbuzhi', title:'游园不值', author:'叶绍翁（宋）', lines:['应怜屐齿印苍苔，','小扣柴扉久不开。','春色满园关不住，','一枝红杏出墙来。'], meaning:'大概是园主人爱惜青苔怕我的木屐踩坏它，我轻轻敲了敲柴门，很久也没有人来开。满园的春色是关不住的，一枝红色的杏花已经伸出墙外来了。'},
  {id:'cunju', title:'村居', author:'高鼎（清）', lines:['草长莺飞二月天，','拂堤杨柳醉春烟。','儿童散学归来早，','忙趁东风放纸鸢。'], meaning:'二月的天气里青草生长、黄莺飞舞，轻拂堤岸的杨柳陶醉在春天的烟雾中。孩子们放学回来得早，赶紧趁着东风放起了风筝。'},
  {id:'suojian', title:'所见', author:'袁枚（清）', lines:['牧童骑黄牛，','歌声振林樾。','意欲捕鸣蝉，','忽然闭口立。'], meaning:'放牛的孩子骑在黄牛背上，歌声在树林间回荡。他忽然想要捕捉正在叫的蝉，就立刻闭上嘴巴停下来站着不动了。'},
  {id:'jihaizashi', title:'己亥杂诗（节选）', author:'龚自珍（清）', lines:['九州生气恃风雷，','万马齐喑究可哀。','我劝天公重抖擞，','不拘一格降人才。'], meaning:'国家要有活力，需要依靠风雷一样的巨大变革，大家都不敢说话是很可悲的。我希望上天重新振作起来，不要拘泥一种规矩，多多降下各种各样的人才。'},
  {id:'leyouyuan', title:'乐游原', author:'李商隐（唐）', lines:['向晚意不适，','驱车登古原。','夕阳无限好，','只是近黄昏。'], meaning:'傍晚时心里有些不畅快，就驾着车登上古老的乐游原。夕阳的景色无限美好，只可惜已经快要到黄昏时分了。'},
  {id:'furonglou', title:'芙蓉楼送辛渐', author:'王昌龄（唐）', lines:['寒雨连江夜入吴，','平明送客楚山孤。','洛阳亲友如相问，','一片冰心在玉壶。'], meaning:'寒冷的雨随着江水在夜里洒满吴地，天亮时送别友人只留下楚山孤独地立着。洛阳的亲友们如果问起我的近况，就说我的心像玉壶里的冰一样纯洁。'},
  {id:'chusai', title:'出塞', author:'王昌龄（唐）', lines:['秦时明月汉时关，','万里长征人未还。','但使龙城飞将在，','不教胡马度阴山。'], meaning:'依然是秦汉时期的明月和边关，出征万里的将士们还没有回来。只要有像飞将军李广那样的名将镇守，就不会让敌人的战马越过阴山。'},
  {id:'liangzhouci', title:'凉州词', author:'王之涣（唐）', lines:['黄河远上白云间，','一片孤城万仞山。','羌笛何须怨杨柳，','春风不度玉门关。'], meaning:'黄河远远地流向白云之间，一座孤零零的城池坐落在高山中间。何必用羌笛吹奏哀怨的《折杨柳》曲子呢，春风本来就吹不到玉门关外。'},
  {id:'biedongda', title:'别董大', author:'高适（唐）', lines:['千里黄云白日曛，','北风吹雁雪纷纷。','莫愁前路无知己，','天下谁人不识君。'], meaning:'千里之外黄云密布，太阳都显得昏暗，北风吹着大雁，大雪纷纷飘落。不要担心前方的路上没有知己朋友，天下有谁不认识你呢。'},
  {id:'wangyue', title:'望岳', author:'杜甫（唐）', lines:['岱宗夫如何？','齐鲁青未了。','造化钟神秀，','阴阳割昏晓。'], meaning:'泰山到底是什么样子呢？在齐鲁大地上，那青色的山峦望不到尽头。大自然把神奇秀丽都汇聚在这里，山的南北两面明暗不同，仿佛把清晨和黄昏分割开来。'},
  {id:'zhushi', title:'竹石', author:'郑燮（清）', lines:['咬定青山不放松，','立根原在破岩中。','千磨万击还坚劲，','任尔东西南北风。'], meaning:'竹子紧紧咬住青山一点也不放松，它的根牢牢地扎在破碎的岩石中间。经历千万次磨难和打击依然坚强挺立，任凭你从哪个方向刮来大风都不怕。'},
  {id:'yuanri', title:'元日', author:'王安石（宋）', lines:['爆竹声中一岁除，','春风送暖入屠苏。','千门万户曈曈日，','总把新桃换旧符。'], meaning:'在噼里啪啦的爆竹声中送走了旧的一年，春风送来暖意，人们喝着屠苏酒。初升的太阳照耀着千家万户，大家都把新的桃符换下了旧的。'},
  {id:'boshuangzhou', title:'泊船瓜洲', author:'王安石（宋）', lines:['京口瓜洲一水间，','钟山只隔数重山。','春风又绿江南岸，','明月何时照我还。'], meaning:'京口和瓜洲之间只隔着一条江水，钟山也只隔着几座山。春风又一次吹绿了江南的两岸，明月什么时候才能照着我回到家乡呢。'},
  {id:'tixilinbi', title:'题西林壁', author:'苏轼（宋）', lines:['横看成岭侧成峰，','远近高低各不同。','不识庐山真面目，','只缘身在此山中。'], meaning:'从正面看是绵延的山岭，从侧面看却是高耸的山峰，从远近高低看都不一样。之所以认不清庐山真正的样子，是因为我自己就身处在这座山中。'},
  {id:'yinhu', title:'饮湖上初晴后雨', author:'苏轼（宋）', lines:['水光潋滟晴方好，','山色空蒙雨亦奇。','欲把西湖比西子，','淡妆浓抹总相宜。'], meaning:'晴天的时候湖水波光粼粼很美好，下雨时山色迷蒙也很奇妙。如果把西湖比作古代美女西施，那么无论是淡雅打扮还是浓艳打扮，都一样合适好看。'},
  {id:'huichong', title:'惠崇春江晚景', author:'苏轼（宋）', lines:['竹外桃花三两枝，','春江水暖鸭先知。','蒌蒿满地芦芽短，','正是河豚欲上时。'], meaning:'竹林外面有几枝桃花开了，春天江水变暖，鸭子最先察觉到。遍地长满了蒌蒿，芦苇也才刚刚发芽，正是河豚快要逆流而上的时节。'},
  {id:'dongyedushu', title:'冬夜读书示子聿', author:'陆游（宋）', lines:['古人学问无遗力，','少壮工夫老始成。','纸上得来终觉浅，','绝知此事要躬行。'], meaning:'古人做学问是不遗余力的，年轻时候下的功夫往往要到年老时才能有所成就。从书本上学来的知识终究是浅薄的，要真正弄懂一件事，必须亲自去实践。'},
  {id:'shier', title:'示儿', author:'陆游（宋）', lines:['死去元知万事空，','但悲不见九州同。','王师北定中原日，','家祭无忘告乃翁。'], meaning:'我原本知道人死后世间万事都和自己无关了，只是悲伤没能见到国家统一。等到朝廷的军队收复中原的那一天，你们祭祀的时候一定别忘了告诉我。'},
  {id:'youshanxicun', title:'游山西村', author:'陆游（宋）', lines:['莫笑农家腊酒浑，','丰年留客足鸡豚。','山重水复疑无路，','柳暗花明又一村。'], meaning:'不要笑话农家腊月里酿的酒有些浑浊，丰收的年景里用来招待客人的鸡肉猪肉很丰盛。山峦重叠水流曲折，正怀疑没有路可走时，忽然眼前柳树成荫繁花似锦，又出现了一个村庄。'},
  {id:'qiuxi', title:'秋夕', author:'杜牧（唐）', lines:['银烛秋光冷画屏，','轻罗小扇扑流萤。','天阶夜色凉如水，','坐看牵牛织女星。'], meaning:'银白色的烛光映照着秋夜冷清的画屏，用轻盈的丝绸小扇子扑打着飞舞的萤火虫。夜色像水一样清凉，她坐在石阶上看着天上的牛郎星和织女星。'},
  {id:'qiqiao', title:'乞巧', author:'林杰（唐）', lines:['七夕今宵看碧霄，','牵牛织女渡河桥。','家家乞巧望秋月，','穿尽红丝几万条。'], meaning:'七夕的夜晚人们抬头看着蓝天，传说牵牛星和织女星正走过鹊桥相会。家家户户望着秋天的月亮向织女乞求心灵手巧，穿过的红线不知有多少条。'},
  {id:'dalinsi', title:'大林寺桃花', author:'白居易（唐）', lines:['人间四月芳菲尽，','山寺桃花始盛开。','长恨春归无觅处，','不知转入此中来。'], meaning:'四月里山下的鲜花已经凋谢了，山上寺庙里的桃花才刚刚盛开。我常常为春天的离去无处寻觅而遗憾，没想到它竟然转到这山中来了。'},
  {id:'guanshuyougan', title:'观书有感', author:'朱熹（宋）', lines:['半亩方塘一鉴开，','天光云影共徘徊。','问渠那得清如许？','为有源头活水来。'], meaning:'半亩大的方形池塘像一面打开的镜子，天空的光和云彩的影子在水面上一起晃动。要问这池塘为什么这么清澈，是因为有源头活水不断地流进来。'},
  {id:'chunri', title:'春日', author:'朱熹（宋）', lines:['胜日寻芳泗水滨，','无边光景一时新。','等闲识得东风面，','万紫千红总是春。'], meaning:'在晴朗美好的日子里到泗水河边赏花，看到无边无际的春光焕然一新。随随便便就能认出春风的样子，因为到处万紫千红全都是春天的景色。'},
  {id:'chilege', title:'敕勒歌', author:'北朝民歌', lines:['敕勒川，','阴山下。','天似穹庐，','笼盖四野。','天苍苍，','野茫茫，','风吹草低见牛羊。'], meaning:'敕勒族生活的大草原，就在阴山的脚下。天空好像一个巨大的圆顶帐篷，笼罩着四面八方的原野。天是那么蓝，原野是那么辽阔，风吹过的地方草低了下去，露出了成群的牛羊。'},
  {id:'changgexing', title:'长歌行（节选）', author:'汉乐府', lines:['百川东到海，','何时复西归？','少壮不努力，','老大徒伤悲。'], meaning:'千万条河流最终都向东流入大海，什么时候才能再向西流回来呢？年轻的时候不努力，到年老的时候只能白白地伤心难过。'},
  {id:'huixiangoushu', title:'回乡偶书', author:'贺知章（唐）', lines:['少小离家老大回，','乡音无改鬓毛衰。','儿童相见不相识，','笑问客从何处来。'], meaning:'年少的时候离开家乡，年老了才回来，家乡的口音没有改变，但鬓角的头发已经稀疏花白。村里的孩子们看见我却不认识，笑着问这位客人是从哪里来的。'}
];

var currentPoem = null;

function renderPoemGrid(){
  var grid = document.getElementById('poemGrid');
  grid.innerHTML = '';
  POEMS.forEach(function(poem){
    var card = document.createElement('div');
    card.className = 'letter-card';
    card.innerHTML =
      '<span class="em">📜</span>' +
      '<div class="word">' + poem.title + '</div>' +
      '<div class="cn">' + poem.author + '</div>';
    card.addEventListener('click', function(){ selectPoem(poem); });
    grid.appendChild(card);
  });
}
renderPoemGrid();

function selectPoem(poem){
  currentPoem = poem;
  document.getElementById('poemGrid').style.display = 'none';
  var player = document.getElementById('poemPlayer');
  player.style.display = '';
  document.getElementById('poemTitleLine').innerHTML =
    '<div style="font-size:22px; font-weight:bold; color:var(--pink-d);">' + poem.title + '</div>' +
    '<div class="poem-meta">' + poem.author + '</div>';
  var box = document.getElementById('poemLinesBox');
  box.innerHTML = '';
  poem.lines.forEach(function(line, idx){
    var d = document.createElement('div');
    d.className = 'poem-line';
    d.id = 'poemline-' + idx;
    d.textContent = line;
    box.appendChild(d);
  });
  var meaningBox = document.getElementById('poemMeaningBox');
  meaningBox.style.display = 'none';
  meaningBox.textContent = '';
  reactMascot('poemMascot', 'happy', 'poemBubble', '一起读古诗吧～');
  playPoem(poem);
}

/* Original browser speechSynthesis line-by-line reading, used automatically
   if the pre-generated natural-voice mp3 for this poem can't be loaded. */
function playPoemSpeech(poem){
  var myToken = uiToken;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  poem.lines.forEach(function(line, idx){
    p = p.then(function(){
      if(myToken !== uiToken) return Promise.reject('cancelled');
      document.querySelectorAll('.poem-line').forEach(function(el){ el.classList.remove('active'); });
      var el = document.getElementById('poemline-' + idx);
      if(el){ el.classList.add('active'); }
      return speak(line, 'zh-CN', 0.72);
    });
  });
  p.then(function(){
    if(myToken !== uiToken) return;
    document.querySelectorAll('.poem-line').forEach(function(el){ el.classList.remove('active'); });
    addStars(2);
    launchConfetti(60);
    reactMascot('poemMascot', 'happy', 'poemBubble', '读完啦，真棒！🎉');
  }).catch(function(){ /* cancelled by navigation, ignore */ });
}

/* Plays the pre-generated natural AI-voice recording for this poem (real
   neural voice, not browser TTS), highlighting each line in sync via the
   precomputed timing map. Falls back to playPoemSpeech if unavailable. */
function playPoem(poem){
  var myToken = uiToken;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var offsets = POEM_TIMINGS[poem.id];
  if(!offsets){ playPoemSpeech(poem); return; }
  function highlight(idx){
    document.querySelectorAll('.poem-line').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('poemline-' + idx);
    if(el){ el.classList.add('active'); }
  }
  function onDone(){
    document.querySelectorAll('.poem-line').forEach(function(el){ el.classList.remove('active'); });
    addStars(2);
    launchConfetti(60);
    reactMascot('poemMascot', 'happy', 'poemBubble', '读完啦，真棒！🎉');
  }
  playTimedAudio(AUDIO_BASE + 'poems/' + poem.id + '.mp3', offsets, myToken, highlight, onDone, function(){ playPoemSpeech(poem); });
}

document.getElementById('poemReplayBtn').addEventListener('click', function(){
  if(currentPoem) playPoem(currentPoem);
});
document.getElementById('poemMeaningBtn').addEventListener('click', function(){
  if(!currentPoem) return;
  var box = document.getElementById('poemMeaningBox');
  box.style.display = '';
  box.textContent = currentPoem.meaning;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  stopCurrentAudio();
  var audio = new Audio(AUDIO_BASE + 'poems/' + currentPoem.id + '_meaning.mp3');
  currentPlaybackAudio = audio;
  audio.addEventListener('error', function(){ speak(currentPoem.meaning, 'zh-CN', 0.85); });
  var pr = audio.play();
  if(pr && pr.catch) pr.catch(function(){ speak(currentPoem.meaning, 'zh-CN', 0.85); });
});
document.getElementById('poemStopBtn').addEventListener('click', function(){
  bumpUiToken();
  document.querySelectorAll('.poem-line').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('poemPlayer').style.display = 'none';
  document.getElementById('poemGrid').style.display = '';
  currentPoem = null;
});

/* ============ STORIES: 儿童故事 ============ */
/* Original simple retellings inspired by ancient/public-domain folk tales
   and fables (Aesop's Fables ~2500 years old; The Three Little Pigs / Little
   Red Riding Hood are traditional European folk tales; Monkeys Fishing for
   the Moon is an anonymous traditional Chinese folk tale) — not copied text
   from any specific modern translation, so there are no copyright concerns.
   Narration uses the same free browser text-to-speech as the rest of the
   app (see pickVoice's natural/neural voice preference above); there is no
   free way to embed an actual recorded human voice in a static web page. */
var STORIES = [
  {id:'guitu', emoji:'🐢', title:'龟兔赛跑', paragraphs:[
    '森林里，兔子和乌龟要举行一场赛跑比赛。',
    '兔子跑得飞快，一下子就把乌龟甩得老远，它想：乌龟这么慢，我睡一觉再跑也来得及！',
    '于是兔子躺在大树下呼呼大睡起来。',
    '乌龟虽然走得很慢，但它一步一步，从来没有停下来。',
    '乌龟悄悄地超过了正在睡觉的兔子，一直爬到了终点。',
    '兔子醒来的时候，乌龟已经赢得了比赛。小朋友，做事情要坚持到底，不能骄傲哦！'
  ]},
  {id:'sanzhuxiaozhu', emoji:'🐷', title:'三只小猪', paragraphs:[
    '猪妈妈让三只小猪出去盖自己的房子。',
    '猪大哥偷懒，用稻草盖了一间房子，很快就盖好了。',
    '猪二哥用木头盖了房子，比猪大哥的结实一点。',
    '猪小弟最勤劳，他用砖头一块一块地盖了一间又结实又漂亮的房子。',
    '大灰狼来了，一口气就把稻草房子和木头房子吹倒了，猪大哥和猪二哥赶紧跑到猪小弟家里。',
    '大灰狼怎么吹也吹不倒砖头房子，三只小猪在结实的房子里安全地生活下去了。'
  ]},
  {id:'xiaohongmao', emoji:'🧺', title:'小红帽', paragraphs:[
    '小红帽要去看望生病的外婆，妈妈叮嘱她不要在路上贪玩。',
    '在森林里，小红帽遇到了大灰狼，大灰狼假装很友好地和她说话。',
    '大灰狼偷偷跑到外婆家，可是善良的猎人叔叔一直在附近巡逻。',
    '猎人叔叔发现了大灰狼的坏主意，及时赶到外婆家，把外婆和小红帽都保护得好好的。',
    '小红帽明白了，以后再也不和陌生人随便说话啦。'
  ]},
  {id:'houzilaoyueliang', emoji:'🐒', title:'猴子捞月亮', paragraphs:[
    '一天晚上，小猴子看见井里有一个圆圆的月亮，它以为月亮掉进井里了。',
    '小猴子赶紧叫来好朋友们，大家手拉着手，一个接一个地吊下井去捞月亮。',
    '捞了半天，怎么也捞不到月亮，最小的猴子觉得很奇怪。',
    '它抬起头一看，月亮好好地挂在天上呢！原来井里的月亮只是水中的影子呀。',
    '猴子们哈哈大笑，一起抬头看着天上又大又圆的月亮。'
  ]},
  {id:'langlaile', emoji:'🐺', title:'狼来了', paragraphs:[
    '有个放羊的孩子觉得很无聊，就大喊：狼来了！狼来了！',
    '村民们听到喊声，都急忙跑来帮忙，可是根本没有狼，孩子哈哈大笑，觉得很好玩。',
    '过了几天，孩子又喊了一次狼来了，村民们又跑来了，还是没有狼。',
    '后来，狼真的来了，孩子拼命地喊狼来了，可是这次没有人再相信他了。',
    '小朋友，我们要做诚实的孩子，不能说谎话哦。'
  ]},
  {id:'shouzhudaitu', emoji:'🐇', title:'守株待兔', paragraphs:[
    '古时候有个农夫，每天在地里辛苦种田。',
    '有一天，一只兔子跑得太快，一头撞在田边的树桩上，就死了。',
    '农夫捡到了兔子，非常高兴，觉得自己运气真好。',
    '从那以后，他每天都守在树桩旁边，等着再捡到兔子，田里的庄稼也不管了。',
    '结果他再也没有等到兔子，庄稼却因为没人照顾都荒废了。小朋友，做事不能靠运气，要靠自己踏踏实实努力呀！'
  ]},
  {id:'bamiaozhuzhang', emoji:'🌱', title:'拔苗助长', paragraphs:[
    '从前有个人种了一片禾苗，他天天去看，觉得禾苗长得太慢了。',
    '他心里很着急，就想出一个办法：把每一棵禾苗都往上拔高一点。',
    '他辛辛苦苦忙了一整天，把田里所有的禾苗都拔高了一些，累得满头大汗。',
    '他回家高兴地告诉家人，说自己帮禾苗长高了。',
    '第二天大家一起去地里看，发现禾苗全都枯死了。小朋友，做事情要按照规律慢慢来，着急是没有用的哦。'
  ]},
  {id:'yanerdaoling', emoji:'🔔', title:'掩耳盗铃', paragraphs:[
    '从前有个人看见人家门上挂着一口大铃铛，很想偷回家。',
    '可是他知道，只要一碰铃铛就会发出很大的响声，会被人发现。',
    '他想了一个办法：把自己的耳朵捂住，这样自己就听不到铃铛的声音了。',
    '他捂着耳朵伸手去摘铃铛，铃铛"哗啦"一声响了起来，别人都听到了，很快就把他抓住了。',
    '小朋友，自己听不见不代表别人也听不见，做坏事总会被发现的，做人要诚实哦。'
  ]},
  {id:'huashetianzu', emoji:'🐍', title:'画蛇添足', paragraphs:[
    '从前有几个人比赛画蛇，谁先画完谁就能喝到一壶酒。',
    '其中一个人画得最快，第一个画完了，他左看右看，觉得时间还很多。',
    '他心想：我再给蛇画上几只脚，让它更好看。于是拿起笔给蛇添上了脚。',
    '这时另一个人也画完了，看到他画的蛇有脚，笑着说：蛇本来就没有脚，你画错啦！',
    '于是那壶酒被别人喝掉了。小朋友，做事情恰到好处就行，多此一举反而会把事情弄糟糕。'
  ]},
  {id:'wangyangbulao', emoji:'🐑', title:'亡羊补牢', paragraphs:[
    '从前有个牧羊人，他养的羊圈破了一个洞。',
    '有一天早上，他发现少了一只羊，原来是被狼从洞里叼走了。',
    '邻居劝他赶紧把羊圈修好，可他觉得羊已经丢了，修不修都一样，就没有理会。',
    '第二天，又有一只羊从那个破洞跑丢了，他这才后悔，赶紧把羊圈的洞补好了。',
    '从那以后，他的羊再也没有丢过。小朋友，发现错误及时改正，永远都不算晚哦。'
  ]},
  {id:'kezhouqiujian', emoji:'⛵', title:'刻舟求剑', paragraphs:[
    '从前有个人坐船过江，一不小心把随身带的宝剑掉进了江里。',
    '船上的人都为他着急，可他却不慌不忙，拿出小刀在船舷上刻了一个记号。',
    '他说：我的剑是从这里掉下去的，我做了记号，等船靠岸了再来找。',
    '船靠岸后，他就从刻记号的地方跳下水去找剑，可是船已经走了很远，怎么也找不到。',
    '小朋友，船一直在动，河水也一直在流，用老办法解决变化的问题，是找不到答案的呀。'
  ]},
  {id:'jingdizhiwa', emoji:'🐸', title:'井底之蛙', paragraphs:[
    '有一只青蛙，一直住在一口枯井里，它觉得自己的天地就是井口那么大。',
    '有一天，一只大海龟路过井边，青蛙热情地邀请它下来看看自己的家。',
    '青蛙骄傲地说：你看，我这里多快乐，跳一跳、玩一玩，井口的天空就是全世界啦。',
    '海龟听了笑着说：我住的大海一望无际，比你的井大千万倍呢。',
    '青蛙这才知道，原来世界这么大，自己看到的只是很小很小的一部分。小朋友，要多出去看看，才能懂得更多呀。'
  ]},
  {id:'yegonghaolong', emoji:'🐉', title:'叶公好龙', paragraphs:[
    '古时候有个叫叶公的人，非常喜欢龙，家里到处都画着龙、雕着龙。',
    '天上的真龙听说了这件事，很感动，心想：一定要去拜访这位喜欢我的朋友。',
    '有一天，真龙从天上飞下来，把头伸进叶公家的窗户里探望。',
    '叶公一看到真的龙，吓得脸色发白，转身就跑，再也不敢说自己喜欢龙了。',
    '小朋友，喜欢一样东西就要真心接受它本来的样子，嘴上说说和真正喜欢是不一样的哦。'
  ]},
  {id:'lanyuchongshu', emoji:'🎵', title:'滥竽充数', paragraphs:[
    '古时候有个国王喜欢听很多人一起吹竽，就请了三百个乐师一起演奏。',
    '有个叫南郭的人根本不会吹竽，但他也混进了乐队里，每次都装模作样地摆动手指。',
    '因为人太多，声音混在一起，国王一直没有发现他不会吹。',
    '后来新国王上任，喜欢听一个人单独吹奏，南郭先生知道自己藏不住了，只好偷偷地逃走了。',
    '小朋友，没有真本事是藏不住的，我们要踏踏实实学习真正的本领呀。'
  ]},
  {id:'maiduhuanzhu', emoji:'💎', title:'买椟还珠', paragraphs:[
    '有个商人想卖一颗珍珠，特意为它做了一个非常精美的盒子。',
    '盒子用香木做成，还镶嵌了美丽的珠宝花纹，看起来十分华丽。',
    '一位客人看到了，非常喜欢这个盒子，出高价把它买了下来。',
    '客人打开盒子，把里面的珍珠取出来还给了商人，只带走了那个漂亮的盒子。',
    '小朋友，我们要懂得分辨什么才是真正珍贵的东西，不要被外表的华丽迷惑了眼睛哦。'
  ]},
  {id:'saiwengshima', emoji:'🐴', title:'塞翁失马', paragraphs:[
    '边塞有位老人丢了一匹马，邻居们都来安慰他，他却说：这说不定是件好事呢。',
    '过了几个月，那匹马自己跑回来了，还带回了一匹健壮的野马，邻居们都来祝贺他。',
    '老人的儿子很喜欢骑那匹野马，有一天骑马摔断了腿，邻居们又来安慰他。',
    '老人还是说：这说不定又是件好事呢。后来打仗了，年轻人都要去当兵，他儿子因为腿伤留在了家里，平安无事。',
    '小朋友，好事和坏事有时候是会互相转变的，遇到困难不要灰心，说不定后面就有好事在等着呢。'
  ]},
  {id:'yugongyishan', emoji:'⛰️', title:'愚公移山', paragraphs:[
    '从前有位老人，家门口有两座大山挡住了出门的路，出行非常不方便。',
    '老人下定决心，要带领全家人把两座大山搬走，大家每天挖山不止。',
    '有个聪明人笑话他说：你年纪这么大了，怎么可能搬得动大山呢？',
    '老人回答说：我死了还有儿子，儿子死了还有孙子，子子孙孙无穷无尽，山却不会再长高，总有一天能搬完。',
    '他们坚持不懈地挖着，天帝被他的毅力感动了，就派神仙把两座大山搬走了。小朋友，只要有毅力坚持下去，再大的困难也能被克服哦。'
  ]},
  {id:'jingweitianhai', emoji:'🐦', title:'精卫填海', paragraphs:[
    '传说古时候有位小公主，名叫女娃，她非常喜欢在大海边玩耍。',
    '有一天她乘船出海，不幸遇到大浪，被无情的大海淹没了。',
    '女娃的灵魂变成了一只小鸟，人们叫她精卫，她的叫声就像在喊自己的名字。',
    '精卫非常愤怒，她每天衔着西山上的小石子和树枝，一趟又一趟地飞到大海上空，把它们投进海里，想要把大海填平。',
    '她从不放弃，日复一日、年复一年地坚持着。小朋友，精卫这种永不放弃的精神，值得我们大家学习呀。'
  ]},
  {id:'kuafuzhuiri', emoji:'☀️', title:'夸父追日', paragraphs:[
    '传说有个巨人叫夸父，他觉得太阳每天升起又落下，很想追上它、抓住它。',
    '于是夸父迈开大步，拼命地追赶着太阳，跑过了一座座高山，越过了一条条大河。',
    '他跑得又渴又累，一口气喝干了黄河和渭河的水，可还是觉得口渴难耐。',
    '他又向北方的大湖跑去想要喝水，可是还没跑到，就在半路上倒下了。',
    '他手中的拐杖变成了一片桃林，为后来经过的人遮阴解渴。小朋友，夸父追日的故事告诉我们，要有敢于追求梦想的勇气呀。'
  ]},
  {id:'nvwabutian', emoji:'🌈', title:'女娲补天', paragraphs:[
    '传说很久很久以前，天空突然裂开了一个大窟窿，大地上洪水泛滥，百姓非常痛苦。',
    '女神女娲看到人们受苦，心里非常难过，决定想办法修补天空。',
    '她跑遍大地，挑选了五种颜色的美丽石头，用火慢慢把它们炼成浆，用来填补天上的裂缝。',
    '女娲又杀死了一只在水中作乱的大龟，用它的四条腿把天空重新撑了起来，让天地恢复了稳固。',
    '从此，天空不再漏水，大地也恢复了平静。小朋友，女娲这种为了帮助大家、不怕辛苦的精神真让人敬佩呢。'
  ]},
  {id:'houyisheri', emoji:'🏹', title:'后羿射日', paragraphs:[
    '传说古时候天上一下子出现了十个太阳，把大地晒得像火炉一样，庄稼都枯死了，百姓生活非常艰难。',
    '有一位神箭手名叫后羿，他非常同情百姓，决定要为大家解除灾难。',
    '后羿拿起神弓，一支接一支地把箭射向天空，一个又一个多余的太阳被他射了下来。',
    '大家纷纷叫好，请求他留下最后一个太阳，好让天地重新有光亮和温暖。',
    '后羿听从了大家的请求，只留下了一个太阳，从此天气变得凉爽宜人。小朋友，后羿用自己的本领帮助了所有人，是个了不起的英雄。'
  ]},
  {id:'tiechumochengzhen', emoji:'🪡', title:'铁杵磨成针', paragraphs:[
    '传说李白小时候不喜欢读书，总是想着出去玩。',
    '有一天他偷偷跑出学堂，看见一位老婆婆坐在河边，正在磨一根很粗的铁棒。',
    '李白很好奇，就问老婆婆在做什么，老婆婆说：我要把这根铁棒磨成一根绣花针。',
    '李白惊讶地说：铁棒这么粗，怎么可能磨成细细的针呢？老婆婆笑着说：只要我每天坚持磨下去，铁棒总有一天会变成针的。',
    '李白听后深受触动，从此发奋读书，最终成为了一位伟大的诗人。小朋友，只要有恒心，多难的事情也能做成功呀。'
  ]},
  {id:'kongrongrangli', emoji:'🍐', title:'孔融让梨', paragraphs:[
    '孔融是古时候一个非常聪明懂事的小孩子。',
    '有一天，家里买来了一些梨，大大小小都有，妈妈让孔融先挑。',
    '孔融想了想，拿起一个最小的梨，把大的梨都留给了哥哥弟弟们。',
    '爸爸很奇怪地问他为什么这样做，孔融说：我年纪小，应该吃小的梨，大的应该让给哥哥们。',
    '大家都夸奖孔融是个懂得谦让的好孩子。小朋友，和兄弟姐妹相处的时候，学会谦让，会让大家都更开心哦。'
  ]},
  {id:'caochongchengxiang', emoji:'🐘', title:'曹冲称象', paragraphs:[
    '古时候有人送给曹操一头大象，曹操很想知道这头大象到底有多重。',
    '大臣们想了很多办法，可是没有那么大的秤能称出大象的重量，大家都很为难。',
    '曹操年幼的儿子曹冲想出了一个好办法：先把大象牵到船上，在船身沉下去的地方做上记号。',
    '然后把大象牵下船，往船上装石头，装到船沉到刚才的记号为止，再把石头分开称重，加起来就是大象的重量了。',
    '大臣们都对曹冲的聪明才智赞叹不已。小朋友，遇到难题的时候，多动脑筋想办法，问题总会解决的。'
  ]},
  {id:'simaguangzagang', emoji:'🏺', title:'司马光砸缸', paragraphs:[
    '司马光小时候和小伙伴们在院子里玩耍，院子里有一口装满水的大水缸。',
    '一个小朋友爬到缸边玩，一不小心掉进了大水缸里，水都快要没过他的头了。',
    '别的孩子都吓坏了，有的哭了起来，有的转身跑去找大人。',
    '司马光却冷静下来，他搬起一块大石头，用力把水缸砸破，缸里的水哗地流了出来，掉进水里的小朋友得救了。',
    '小朋友，遇到危险的时候要像司马光一样保持冷静，动脑筋想办法解决问题呀。'
  ]},
  {id:'zhengrenmaili', emoji:'👞', title:'郑人买履', paragraphs:[
    '郑国有个人想去买一双新鞋，出门前，他先在家里量了量自己脚的尺寸，把尺码记在了一张纸上。',
    '他高高兴兴地去了集市，找到卖鞋的摊位，挑好了鞋子，才发现忘记带那张写着尺码的纸了。',
    '他连忙跑回家去取那张纸，可是等他赶回集市的时候，天已经黑了，集市也已经收摊了。',
    '路人问他：你为什么不直接用自己的脚试一试鞋子呢？他回答说：我只相信量好的尺码，不相信自己的脚。',
    '小朋友，做事情要懂得灵活变通，不能死板地只相信一种方法呀。'
  ]},
  {id:'zixiangmaodun', emoji:'⚔️', title:'自相矛盾', paragraphs:[
    '古时候有个商人在集市上卖矛和盾，他大声吆喝招揽顾客。',
    '他举起盾牌说：我的盾非常坚固，什么样锋利的矛都戳不穿它！',
    '接着他又举起矛说：我的矛非常锋利，什么样坚固的盾都能戳穿！',
    '这时旁边有人问他：如果用你的矛来戳你的盾，结果会怎么样呢？商人一下子回答不上来了，闹了个大红脸。',
    '小朋友，说话做事要前后一致，不能自己说的话自己都对不上哦。'
  ]},
  {id:'jinggongzhiniao', emoji:'🏹', title:'惊弓之鸟', paragraphs:[
    '古时候有位射箭高手，有一天他和朋友一起在郊外散步，看见天上飞过一只大雁。',
    '他对朋友说：我不用箭，只要拉一下弓弦，就能让那只大雁掉下来。',
    '朋友不太相信，他就拉开弓弦，弦发出"嘣"的一声响，那只大雁果然应声掉落在地上。',
    '朋友很惊讶，射箭高手解释说：这只大雁飞得很慢，叫声也很悲伤，说明它以前受过箭伤，一听到弓弦的声音就吓得魂飞魄散，用力过猛而跌落了。',
    '小朋友，受过伤害的小动物会变得非常害怕类似的声音，这个故事也提醒我们要善待身边的动物哦。'
  ]},
  {id:'dongshixiaopin', emoji:'💃', title:'东施效颦', paragraphs:[
    '古时候有位美女叫西施，她因为心口疼痛，常常皱着眉头，捂着胸口，看起来更加楚楚动人。',
    '村里有个叫东施的姑娘，长得并不好看，她看见西施皱眉的样子很受人喜爱，就也学着皱眉捂胸口。',
    '东施每天都模仿西施的样子在村里走来走去，觉得自己一定也会变得很美。',
    '可是村里的人看到东施奇怪的模样，都被吓得关上了门，不敢出来看她。',
    '小朋友，每个人都有自己独特的美，盲目模仿别人反而会失去自己的特色哦。'
  ]},
  {id:'handanxuebu', emoji:'🚶', title:'邯郸学步', paragraphs:[
    '古时候有个年轻人，听说邯郸城里的人走路姿势特别好看，就决定去邯郸学习走路。',
    '他到了邯郸后，天天在街上仔细观察人们走路的样子，努力模仿。',
    '可是学来学去，他总觉得自己走得不对，越学越别扭，越走越不自然。',
    '最后，他不但没有学会邯郸人走路的姿势，反而连自己原来怎么走路都忘记了，只好爬着回家。',
    '小朋友，盲目模仿别人而丢掉自己的长处，是很可惜的哦，我们要保持自己的特点呀。'
  ]},
  {id:'duiniutanqin', emoji:'🐂', title:'对牛弹琴', paragraphs:[
    '从前有位很会弹琴的乐师，他的琴声优美动听，很多人都喜欢听他弹奏。',
    '有一天，他看见一头牛在草地上吃草，突发奇想，想弹一首优雅的曲子给牛听。',
    '他坐在牛的旁边，认认真真地弹起了美妙的乐曲，可是那头牛依然低着头，只顾自己吃草，一点反应也没有。',
    '乐师觉得很奇怪，后来他换了一种方式，模仿蚊虫飞舞和小牛哞哞叫的声音，牛立刻竖起了耳朵注意听。',
    '小朋友，和别人说话或做事时，要考虑对方能不能听懂、能不能理解，这样才能事半功倍呀。'
  ]},
  {id:'beigongsheying', emoji:'🐍', title:'杯弓蛇影', paragraphs:[
    '古时候有个人到朋友家做客，朋友请他喝酒，他一低头，看见酒杯里好像有一条小蛇的影子。',
    '他心里非常害怕，可是又不好意思拒绝朋友的好意，只好硬着头皮把酒喝了下去。',
    '回家以后，他越想越害怕，觉得自己一定是喝下了蛇，结果吓得生了一场病。',
    '朋友知道后，特意请他再来家里坐一坐，这才发现，原来是墙上挂着的弓，倒映在酒杯里，看起来像一条蛇。',
    '他这才恍然大悟，病也很快就好了。小朋友，遇到奇怪的事情，要冷静地寻找原因，不要自己吓自己哦。'
  ]},
  {id:'hualongdianjing', emoji:'🐲', title:'画龙点睛', paragraphs:[
    '古时候有位画家非常擅长画龙，他画的龙栩栩如生，好像随时都会飞起来一样。',
    '有一次，他在墙上画了四条龙，可是都没有画上眼睛。',
    '大家都很好奇地问他为什么不画眼睛，他说：如果点上眼睛，龙就会飞走的。',
    '大家都不相信，非要他试一试，画家只好拿起笔，给其中两条龙点上了眼睛。',
    '就在这时，天空忽然雷电交加，两条被点了眼睛的龙腾空而起，飞向天空，而没有点眼睛的龙依然留在墙上。小朋友，这个故事告诉我们，做事情抓住关键的部分，效果会大不一样呢。'
  ]},
  {id:'nanyuanbeizhe', emoji:'🚗', title:'南辕北辙', paragraphs:[
    '从前有个人想要去南方的楚国，可是他驾着马车却一直往北走。',
    '路人看见了很奇怪，就问他：楚国在南边，你为什么往北走呢？',
    '他说：没关系，我的马跑得很快！路人说：可是方向错了，马跑得再快也到不了楚国呀。',
    '他又说：没关系，我带的路费很多！路人摇摇头说：方向不对，路费再多也没有用。',
    '那个人始终不肯改变方向，结果离楚国越来越远。小朋友，做事情方向一定要正确，不然越努力可能离目标越远哦。'
  ]},
  {id:'hujiahuwei', emoji:'🐯', title:'狐假虎威', paragraphs:[
    '森林里，一只老虎抓住了一只狐狸，准备把它当作美餐。',
    '狐狸眼珠一转，装出很神气的样子说：你不能吃我，我是天帝派来管理百兽的，你吃了我天帝是不会放过你的。',
    '老虎将信将疑，狐狸接着说：不信你跟在我后面走一走，看看百兽见到我是不是都会害怕地逃跑。',
    '老虎跟着狐狸走进森林，森林里的小动物们看见老虎，都吓得四处逃散。',
    '老虎以为动物们真的是害怕狐狸，却不知道大家怕的其实是自己。小朋友，我们要看清事情的真相，不要被表面的样子欺骗了哦。'
  ]},
  {id:'nongfuheshe', emoji:'🐍', title:'农夫和蛇', paragraphs:[
    '冬天的早晨，一个农夫在路边发现了一条冻僵的蛇，一动也不动。',
    '农夫非常心疼这条蛇，就把它放进自己的怀里，用体温帮它取暖。',
    '过了一会儿，蛇渐渐暖和过来，恢复了力气。',
    '可是蛇一醒过来，就狠狠地咬了农夫一口，农夫这才明白，自己的好心帮助了一个危险的对象。',
    '小朋友，善良是很珍贵的品质，但我们也要懂得分辨，保护好自己哦。'
  ]},
  {id:'wuyaheshui', emoji:'🐦‍⬛', title:'乌鸦喝水', paragraphs:[
    '一只乌鸦飞了很久，非常口渴，它看见地上有一个装了水的瓶子。',
    '乌鸦飞过去想喝水，可是瓶口很小，瓶子里的水又不多，它的嘴巴伸进去怎么也够不到水面。',
    '乌鸦想了想，看见周围有很多小石子，它灵机一动，衔起一颗石子丢进瓶子里。',
    '乌鸦一颗接一颗地把小石子丢进瓶子里，瓶子里的水面渐渐升高了。',
    '最后，水面升到了瓶口，乌鸦终于喝到了水。小朋友，遇到困难的时候多动脑筋，办法总是会有的呀。'
  ]},
  {id:'langhexiaoyang', emoji:'🐺', title:'狼和小羊', paragraphs:[
    '一只小羊在小河边悠闲地喝水，这时一只狼走了过来，想找借口吃掉它。',
    '狼凶狠地说：你把我的河水搅浑了，我没法喝水了！小羊委屈地说：我在下游喝水，怎么会把上游的水搅浑呢？',
    '狼又说：去年你在背后骂我！小羊说：去年我还没有出生呢，怎么可能骂你？',
    '狼编不出理由了，恼羞成怒地说：不管怎样，反正我就是要吃掉你！说着就扑向了小羊。',
    '这个故事告诉我们，坏人做坏事总能找到借口，但借口再多也掩盖不了他们的本质。小朋友，遇到不讲道理的人，要学会保护自己哦。'
  ]},
  {id:'huliheputao', emoji:'🦊', title:'狐狸和葡萄', paragraphs:[
    '一只狐狸走在葡萄架下，看见架子上挂满了紫红色的葡萄，看起来非常诱人。',
    '狐狸馋得直流口水，跳起来想要摘葡萄吃，可是葡萄架太高了，怎么跳也够不到。',
    '狐狸试了一次又一次，跳得筋疲力尽，还是没有摘到一颗葡萄。',
    '最后狐狸只好放弃了，它一边走一边自我安慰说：这些葡萄肯定是酸的，我才不想吃呢。',
    '小朋友，得不到的东西不要用假装不喜欢来欺骗自己，坦然面对才是更好的态度呀。'
  ]},
  {id:'mayihezhameng', emoji:'🐜', title:'蚂蚁和蚱蜢', paragraphs:[
    '夏天的时候，一群蚂蚁正忙着搬运粮食，为过冬做准备，累得满头大汗。',
    '一只蚱蜢在旁边悠闲地唱歌跳舞，笑话蚂蚁说：天气这么好，你们干嘛不好好玩耍，忙忙碌碌做什么？',
    '蚂蚁们没有理会蚱蜢，继续认真地搬运粮食，一点一点地积攒着过冬的食物。',
    '冬天来了，天气变得又冷又饿，蚱蜢没有准备粮食，饿得走不动路，只好去向蚂蚁们求助。',
    '蚂蚁们把自己储存的粮食分给了蚱蜢。小朋友，未雨绸缪、提前做好准备，才能应对未来的困难呀。'
  ]},
  {id:'beifengyutaiyang', emoji:'☀️', title:'北风与太阳', paragraphs:[
    '北风和太阳比赛，看谁能让路上的行人脱下身上的外套，谁就获胜。',
    '北风先来，它用力地呼呼吹，越吹越猛烈，可是行人却把外套裹得更紧了，生怕被冻着。',
    '轮到太阳了，它把温暖的阳光柔和地照在行人身上，天气渐渐变得暖和起来。',
    '行人觉得身上越来越热，就自己主动把外套脱了下来。',
    '这样，太阳赢得了这场比赛。小朋友，温柔和耐心有时候比强硬更能解决问题哦。'
  ]},
  {id:'shizihelaoshu', emoji:'🦁', title:'狮子和老鼠', paragraphs:[
    '一只狮子正在睡觉，一只小老鼠不小心跑到了它身上，把它吵醒了。',
    '狮子很生气，一把抓住老鼠，准备把它吃掉。老鼠吓坏了，苦苦哀求说：请放过我吧，说不定以后我能帮到你呢！',
    '狮子觉得老鼠这么弱小，怎么可能帮到自己，但还是好心地把它放走了。',
    '过了几天，狮子不小心被猎人的网困住了，怎么挣扎也逃不出去。',
    '小老鼠听到了狮子的叫声，赶紧跑过来，用锋利的牙齿咬断绳子，救出了狮子。小朋友，不要小看任何一个人的帮助，善良总会有好的回报呀。'
  ]},
  {id:'xiajinbadene', emoji:'🥚', title:'下金蛋的鹅', paragraphs:[
    '从前有个农夫养了一只鹅，这只鹅每天都会下一个金蛋，农夫因此变得越来越富有。',
    '农夫很开心，但他渐渐变得贪心起来，觉得鹅每天只下一个金蛋太慢了。',
    '他心想：这只鹅的肚子里一定藏着很多金子，不如把它剖开，把金子一次性都取出来。',
    '于是农夫把鹅杀死剖开，可是里面什么金子都没有，只有和普通鹅一样的内脏。',
    '农夫后悔莫及，可是鹅已经死了，再也不会有金蛋了。小朋友，贪心会让我们失去本来拥有的幸福，要懂得知足呀。'
  ]},
  {id:'baixuegongzhu', emoji:'🍎', title:'白雪公主', paragraphs:[
    '从前有位美丽善良的公主，因为皮肤像雪一样白，大家都叫她白雪公主。',
    '公主的继母是个嫉妒心很强的王后，因为魔镜说白雪公主比她更美丽，就想害她。',
    '白雪公主逃进森林，遇到了七个善良的小矮人，大家一起快乐地生活在小屋里。',
    '王后化装成老婆婆，给白雪公主吃了一个毒苹果，公主昏睡了过去，小矮人们把她放进水晶棺材，伤心地守护着她。',
    '后来一位王子经过，公主终于苏醒过来，大家都为她感到高兴。小朋友，善良的人总会遇到愿意帮助她的朋友呀。'
  ]},
  {id:'huiguniang', emoji:'👠', title:'灰姑娘', paragraphs:[
    '从前有个善良的姑娘，因为继母和姐姐们的欺负，每天都要做很多家务，身上总是脏兮兮的，大家叫她灰姑娘。',
    '有一天，城堡里要举办舞会，姐姐们打扮得漂漂亮亮地去了，灰姑娘却被留在家里，伤心地哭了起来。',
    '这时一位仙女出现了，用魔法把南瓜变成马车，把灰姑娘的旧衣服变成了漂亮的礼服和水晶鞋，但提醒她一定要在午夜十二点前回家。',
    '灰姑娘在舞会上和王子跳了一晚上舞，两人都非常开心，可是钟声敲响时，她匆忙逃跑，掉落了一只水晶鞋。',
    '王子拿着水晶鞋找遍了全国，终于找到了灰姑娘，两人从此幸福地生活在一起。小朋友，善良和真诚总会被看见的呀。'
  ]},
  {id:'shuimeiren', emoji:'🌹', title:'睡美人', paragraphs:[
    '从前有位公主刚出生的时候，一位没有被邀请的巫婆生气地诅咒她，说公主在十六岁那年会被纺锤刺伤手指，然后长眠不醒。',
    '国王为了保护公主，下令把全国的纺锤都收了起来，可是公主十六岁那年，还是在城堡的一个小房间里发现了一个纺锤，好奇地摸了一下。',
    '公主的手指被刺伤了，立刻沉沉地睡了过去，整个城堡的人也都跟着睡着了，城堡外长满了茂密的荆棘。',
    '很多年过去了，一位勇敢的王子听说了这个故事，穿过重重荆棘来到城堡，找到了沉睡的公主。',
    '王子轻轻地唤醒了公主，整个城堡也重新苏醒过来，大家都过上了幸福的生活。小朋友，善良和勇气总能战胜困难呀。'
  ]},
  {id:'choxiaoya', emoji:'🦢', title:'丑小鸭', paragraphs:[
    '在一个鸭子家庭里，有一只小鸭子长得又大又丑，和其他兄弟姐妹很不一样，大家都叫它丑小鸭。',
    '因为长得不好看，丑小鸭常常被其他小动物嘲笑和欺负，它感到非常伤心，独自离开家去流浪。',
    '丑小鸭经历了寒冷的冬天，忍受着饥饿和孤独，但它始终没有放弃希望。',
    '春天来了，丑小鸭看见湖面上有几只美丽的天鹅，忍不住游过去，心想就算被嘲笑也想靠近它们看看。',
    '它低头看见自己在水中的倒影，惊讶地发现，自己不知何时已经变成了一只美丽的白天鹅。小朋友，不要因为一时的不同就灰心，每个人都有自己发光的时刻呀。'
  ]},
  {id:'huangdidexinzhuang', emoji:'👑', title:'皇帝的新装', paragraphs:[
    '从前有位皇帝非常喜欢穿漂亮的新衣服，把大量的时间和金钱都花在了打扮上。',
    '有两个骗子听说了这件事，就假装是织布能手，说他们能织出世界上最美丽的布料，而且这种布料愚笨的人是看不见的。',
    '皇帝很想要这样神奇的衣服，就派人送去很多金银财宝，骗子们假装辛苦地忙碌了很多天，其实什么布也没有织。',
    '皇帝穿上这件"新衣服"在大街上游行，其实他什么也没穿，可是大臣们和百姓都不敢说真话，怕被人说自己愚笨。',
    '这时人群中一个小孩子大声说：皇帝根本没有穿衣服呀！大家这才敢跟着笑了起来。小朋友，说真话是很勇敢也很珍贵的品质呢。'
  ]},
  {id:'jiekeyuwandou', emoji:'🌱', title:'杰克与豌豆', paragraphs:[
    '从前有个叫杰克的男孩，家里很穷，只有一头老牛可以卖钱换粮食。',
    '杰克把牛牵到集市上，路上遇到一个老人，用几颗豌豆种子换走了他的牛。',
    '妈妈知道后很生气，把豌豆种子扔到窗外。没想到第二天早上，窗外长出了一根高得看不到顶的豌豆藤。',
    '杰克顺着豌豆藤爬到了云端，发现了一座巨人的城堡，里面藏着会下金蛋的鹅和会唱歌的金竖琴。',
    '杰克机智地带着宝物逃回了家，从此他和妈妈过上了幸福的生活。小朋友，遇到困难时保持勇敢和聪明，往往能带来意想不到的好运呀。'
  ]},
  {id:'alibaba', emoji:'🏺', title:'阿里巴巴和四十大盗', paragraphs:[
    '从前有个叫阿里巴巴的樵夫，靠砍柴为生，生活很清贫。',
    '有一天他在山里砍柴，无意中看见一群强盗来到一座石门前，喊出咒语"芝麻开门"，石门就打开了，里面藏满了金银财宝。',
    '强盗们走后，阿里巴巴也走到石门前，学着说"芝麻开门"，石门果然打开了，他惊喜地拿走了一些财宝。',
    '阿里巴巴用聪明和谨慎躲开了强盗们的报复，还依靠机智的女仆的帮助，多次化解了危险。',
    '最后坏强盗受到了应有的惩罚，阿里巴巴一家过上了平安幸福的生活。小朋友，遇到宝藏或者好运，也要保持谨慎和善良哦。'
  ]},
  {id:'niulangzhinv', emoji:'⭐', title:'牛郎织女', paragraphs:[
    '传说天上的织女心灵手巧，织出的云锦美丽无比，她偷偷下凡游玩，认识了善良勤劳的牛郎。',
    '牛郎和织女互相喜欢，结成了夫妻，生活过得幸福美满，还生了一对可爱的孩子。',
    '天上的王母娘娘知道后，非常生气，把织女强行带回了天庭，还用金簪划出一条天河，把牛郎和织女分隔在两岸。',
    '牛郎和织女隔着天河互相思念，泪流不止，他们的真情感动了喜鹊，无数喜鹊飞来搭成一座鹊桥。',
    '王母娘娘也被感动了，允许他们在每年七月初七这一天，通过鹊桥相会一次。小朋友，真挚的感情是非常珍贵动人的呀。'
  ]},
  {id:'changebenyue', emoji:'🌕', title:'嫦娥奔月', paragraphs:[
    '传说古时候后羿射下了九个多余的太阳，立下大功，西王母便赏给他一颗长生不老药。',
    '后羿舍不得离开心爱的妻子嫦娥独自成仙，就把仙药交给嫦娥保管，两人打算一起分享。',
    '后羿的一个心术不正的徒弟趁后羿外出，逼迫嫦娥交出仙药，情急之下，嫦娥一口把药吞了下去。',
    '嫦娥吞下仙药后，身体渐渐变轻，飘飘悠悠地飞了起来，一直飞到月亮上，从此住在寂静的月宫里。',
    '后羿非常思念妻子，从此每年月圆的时候都会摆上她爱吃的瓜果遥祭嫦娥。小朋友，这也是中秋节赏月的美丽传说呢。'
  ]},
  {id:'tianluogunian', emoji:'🐚', title:'田螺姑娘', paragraphs:[
    '从前有个勤劳善良的年轻人，独自一人种地生活，日子过得很辛苦。',
    '有一天他在田里捡到一只很大的田螺，觉得它很特别，就带回家养在水缸里。',
    '从那以后，年轻人每天干完农活回家，都会发现桌上已经摆好了热腾腾的饭菜，他觉得非常奇怪。',
    '有一天，他提前回家，悄悄躲在门外偷看，发现是田螺变成的美丽姑娘在为他做饭。',
    '姑娘因为身份被发现，只好留下来和年轻人一起生活，从此两人相互扶持、勤劳耕作。小朋友，勤劳善良的人总会遇到美好的事情呀。'
  ]},
  {id:'mulancongjun', emoji:'⚔️', title:'花木兰', paragraphs:[
    '古时候，国家征兵打仗，木兰的父亲年纪已经很大，家里又没有兄长可以代替他去。',
    '木兰非常担心父亲，决定女扮男装，代替父亲去参军打仗，家人虽然担心，但也支持她的决定。',
    '木兰在军营里刻苦训练，勇敢作战，立下了不少战功，可是身边的战友们一直没有发现她是女孩子。',
    '战争结束后，皇帝要封赏木兰做大官，木兰却婉言谢绝，只希望能够回家团聚。',
    '木兰回到家中，换上了女儿装，战友们再见到她时都非常惊讶。小朋友，木兰勇敢孝顺的精神，一直被大家传颂到今天呢。'
  ]},
  {id:'shierszhinggushi', emoji:'🐲', title:'十二生肖的故事', paragraphs:[
    '传说古时候，天帝决定挑选十二种动物作为生肖，并且举办了一场过河比赛，谁先到达就能排在前面。',
    '聪明的老鼠请求老实的牛驮着自己过河，牛什么也没多想，就答应了，一路认真地游着。',
    '就在快要到达对岸的时候，老鼠从牛背上跳了下来，抢先一步冲到了终点，所以老鼠排在了第一位，牛排在了第二位。',
    '老虎、兔子、龙、蛇、马、羊、猴子、鸡、狗也都各显本领，陆续渡过了河流，只有懒惰贪玩的猪最后才慢悠悠地赶到，所以排在了最后一位。',
    '从此，十二种动物按照到达的先后顺序，组成了十二生肖，每一年都有一个属于自己的生肖动物。小朋友，你知道自己是属什么的吗？'
  ]}
];

var currentStory = null;

function renderStoryGrid(){
  var grid = document.getElementById('storyGrid');
  grid.innerHTML = '';
  STORIES.forEach(function(story){
    var card = document.createElement('div');
    card.className = 'letter-card';
    card.innerHTML =
      '<span class="em">' + story.emoji + '</span>' +
      '<div class="word">' + story.title + '</div>';
    card.addEventListener('click', function(){ selectStory(story); });
    grid.appendChild(card);
  });
}
renderStoryGrid();

function selectStory(story){
  currentStory = story;
  document.getElementById('storyGrid').style.display = 'none';
  var player = document.getElementById('storyPlayer');
  player.style.display = '';
  document.getElementById('storyTitleLine').textContent = story.emoji + ' ' + story.title;
  var box = document.getElementById('storyParasBox');
  box.innerHTML = '';
  story.paragraphs.forEach(function(para, idx){
    var d = document.createElement('div');
    d.className = 'story-para';
    d.id = 'storypara-' + idx;
    d.textContent = para;
    box.appendChild(d);
  });
  reactMascot('storyMascot', 'happy', 'storyBubble', '故事开始啦～');
  playStory(story);
}

/* Original browser speechSynthesis paragraph-by-paragraph narration, used
   automatically if the pre-generated natural-voice mp3 can't be loaded. */
function playStorySpeech(story){
  var myToken = uiToken;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  story.paragraphs.forEach(function(para, idx){
    p = p.then(function(){
      if(myToken !== uiToken) return Promise.reject('cancelled');
      document.querySelectorAll('.story-para').forEach(function(el){ el.classList.remove('active'); });
      var el = document.getElementById('storypara-' + idx);
      if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
      return speak(para, 'zh-CN', 0.82);
    });
  });
  p.then(function(){
    if(myToken !== uiToken) return;
    document.querySelectorAll('.story-para').forEach(function(el){ el.classList.remove('active'); });
    addStars(3);
    launchConfetti(70);
    reactMascot('storyMascot', 'happy', 'storyBubble', '故事讲完啦，真棒！🎉');
    showToast('故事讲完啦，喜欢的话再听一次吧！📖');
  }).catch(function(){ /* cancelled by navigation, ignore */ });
}

/* Plays the pre-generated natural AI-voice recording for this story (real
   neural voice, not browser TTS), highlighting each paragraph in sync via
   the precomputed timing map. Falls back to playStorySpeech if unavailable. */
function playStory(story){
  var myToken = uiToken;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var offsets = STORY_TIMINGS[story.id];
  if(!offsets){ playStorySpeech(story); return; }
  function highlight(idx){
    document.querySelectorAll('.story-para').forEach(function(el){ el.classList.remove('active'); });
    var el = document.getElementById('storypara-' + idx);
    if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
  }
  function onDone(){
    document.querySelectorAll('.story-para').forEach(function(el){ el.classList.remove('active'); });
    addStars(3);
    launchConfetti(70);
    reactMascot('storyMascot', 'happy', 'storyBubble', '故事讲完啦，真棒！🎉');
    showToast('故事讲完啦，喜欢的话再听一次吧！📖');
  }
  playTimedAudio(AUDIO_BASE + 'stories/' + story.id + '.mp3', offsets, myToken, highlight, onDone, function(){ playStorySpeech(story); });
}

document.getElementById('storyReplayBtn').addEventListener('click', function(){
  if(currentStory) playStory(currentStory);
});
document.getElementById('storyStopBtn').addEventListener('click', function(){
  bumpUiToken();
  document.querySelectorAll('.story-para').forEach(function(el){ el.classList.remove('active'); });
  document.getElementById('storyPlayer').style.display = 'none';
  document.getElementById('storyGrid').style.display = '';
  currentStory = null;
});

})();
