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
function pickVoice(lang){
  if(!voices || !voices.length) return null;
  var exact = voices.filter(function(v){ return v.lang === lang; });
  if(exact.length) return exact[0];
  var base = lang.split('-')[0];
  var partial = voices.filter(function(v){ return v.lang && v.lang.indexOf(base) === 0; });
  if(partial.length) return partial[0];
  return null;
}
function speak(text, lang, rate){
  return new Promise(function(resolve){
    if(muted || !('speechSynthesis' in window)){ resolve(); return; }
    try{
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      var v = pickVoice(lang);
      if(v) u.voice = v;
      u.rate = rate || 0.85;
      u.pitch = 1.15;
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
function goScreen(name){
  var songsScreen = document.getElementById('screen-songs');
  if(songsScreen.classList.contains('active') && name !== 'songs'){
    stopSongPlayback();
    document.getElementById('songPlayer').style.display = 'none';
    document.getElementById('songGrid').style.display = '';
    currentSong = null;
  }
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo({top:0, behavior:'smooth'});
}
function switchLetterTab(tab){
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
    if(isMilestone){
      setTimeout(function(){
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
      setTimeout(nextLetterQuiz, 1500);
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
      setTimeout(function(){
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
    if(isMilestone){
      setTimeout(function(){
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
      setTimeout(nextCaseQuiz, 1500);
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
    if(isMilestone){
      setTimeout(function(){
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
      setTimeout(nextCountQuiz, 1500);
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
      setTimeout(function(){
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
    if(isMilestone){
      setTimeout(function(){
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
      setTimeout(nextHearQuiz, 1500);
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

function playNoteSeq(notes){
  return new Promise(function(resolve){
    if(!ensureAudioCtx()){ resolve(); return; }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    var i = 0;
    function step(){
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

function playSong(song){
  var myToken = ++songToken;
  stopMusic();
  if('speechSynthesis' in window) speechSynthesis.cancel();
  var p = Promise.resolve();
  song.lines.forEach(function(line, idx){
    p = p.then(function(){
      if(myToken !== songToken) return Promise.reject('cancelled');
      document.querySelectorAll('.song-line').forEach(function(el){ el.classList.remove('active'); });
      var el = document.getElementById('songline-' + idx);
      if(el){ el.classList.add('active'); el.scrollIntoView({behavior:'smooth', block:'center'}); }
      return playNoteSeq(line.notes).then(function(){
        if(myToken !== songToken) return Promise.reject('cancelled');
        var primary = song.lang === 'en' ? line.en : line.cn;
        var primaryLang = song.lang === 'en' ? 'en-US' : 'zh-CN';
        var secondary = song.lang === 'en' ? line.cn : line.en;
        var secondaryLang = song.lang === 'en' ? 'zh-CN' : 'en-US';
        return speak(primary, primaryLang, 0.85).then(function(){
          if(myToken !== songToken) return Promise.reject('cancelled');
          return speak(secondary, secondaryLang, 0.85);
        });
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

})();
