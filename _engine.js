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

/* ============ NAVIGATION ============ */
/* uiToken invalidates any in-flight setTimeout-scheduled speech/progression
   (next-question timers, milestone-modal timers, song note ticks) the moment
   the user navigates away, so audio never "leaks" onto a screen/tab the
   child has already left. */
var uiToken = 0;
function bumpUiToken(){
  uiToken++;
  if('speechSynthesis' in window) speechSynthesis.cancel();
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
function playSong(song){
  var myToken = ++songToken;
  stopMusic();
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  /* short instrumental chime to signal "here comes a song" before the singing starts */
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

function stopSongPlayback(){
  songToken++; /* invalidate any in-flight playback chain */
  if('speechSynthesis' in window) speechSynthesis.cancel();
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
  {id:'jiangnan', title:'江南', author:'汉乐府（汉代）', lines:['江南可采莲，','莲叶何田田。','鱼戏莲叶间。'], meaning:'江南是采莲子的好地方，莲叶长得多茂盛呀。小鱼儿在莲叶中间快乐地游来游去。'}
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

function playPoem(poem){
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

document.getElementById('poemReplayBtn').addEventListener('click', function(){
  if(currentPoem) playPoem(currentPoem);
});
document.getElementById('poemMeaningBtn').addEventListener('click', function(){
  if(!currentPoem) return;
  var box = document.getElementById('poemMeaningBox');
  box.style.display = '';
  box.textContent = currentPoem.meaning;
  if('speechSynthesis' in window) speechSynthesis.cancel();
  speak(currentPoem.meaning, 'zh-CN', 0.85);
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

function playStory(story){
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
