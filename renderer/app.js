// ============================================
// 데스크톱 펫 - 메인 게임 로직
// ============================================

// --- 진화 단계 정의 (색상은 사용자 설정 기반으로 자동 계산) ---
const EVOLUTION_STAGES = [
  { name: '알',         level: 1,  size: 48, bodyType: 'egg' },
  { name: '아기',       level: 3,  size: 56, bodyType: 'baby' },
  { name: '',           level: 8,  size: 64, bodyType: 'child' },
  { name: '',           level: 15, size: 72, bodyType: 'teen' },
  { name: '',           level: 25, size: 80, bodyType: 'adult' },
  { name: '',           level: 40, size: 96, bodyType: 'dragon' },
];

// --- 사용자 커스텀 설정 ---
let custom = {
  name: '슬라임',
  bodyColor: '#87CEEB',
  eyeStyle: 'round',
  eyeColor: '#222222',
  cheekStyle: 'pink',
};

// --- 상태 관리 ---
let state = {
  level: 1,
  exp: 0,
  expToNext: 10,
  happiness: 80,
  hunger: 80,
  totalInteractions: 0,
  createdAt: Date.now(),
  lastSave: Date.now(),
  lastAutoTalk: Date.now(),
  evolutionStage: 0,
  x: 400,
  y: 0,
  custom: null, // 저장 시 커스텀 설정 포함
};

// --- 이동 AI ---
let moveState = {
  direction: 1,
  speed: 1.2,
  isMoving: true,
  idleTimer: 0,
  moveTimer: 0,
  targetX: null,
};

// --- DOM 요소 ---
const container = document.getElementById('character-container');
const canvas = document.getElementById('character');
const ctx = canvas.getContext('2d');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');

// --- 대사 데이터 ---
let dialogues = {};
fetch('../data/dialogues.json')
  .then(res => res.json())
  .then(data => { dialogues = data; })
  .catch(() => {
    dialogues = { idle: ['안녕!'], feed: ['냠!'], play: ['신난다!'], pet: ['좋아!'], talk: ['반가워!'] };
  });

// --- 색상 유틸 ---
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return { h: h*360, s: s*100, l: l*100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1-l);
  const f = n => { const k = (n + h/30) % 12; return l - a * Math.max(Math.min(k-3, 9-k, 1), -1); };
  return '#' + [f(0),f(8),f(4)].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

// 진화 단계별 색상 (기본색에서 점점 진하게)
function getStageColor(stageIndex) {
  const hsl = hexToHSL(custom.bodyColor);
  const darken = [0, 0, 5, 12, 20, 10]; // 각 단계별 어둡게
  const saturate = [0, 0, 5, 10, 15, 20];
  return hslToHex(
    hsl.h + (stageIndex === 5 ? 30 : 0), // 드래곤은 색상 시프트
    Math.min(100, hsl.s + saturate[stageIndex]),
    Math.max(15, hsl.l - darken[stageIndex])
  );
}

// 진화 이름 업데이트
function updateEvolutionNames() {
  const n = custom.name;
  EVOLUTION_STAGES[0].name = '알';
  EVOLUTION_STAGES[1].name = `아기 ${n}`;
  EVOLUTION_STAGES[2].name = n;
  EVOLUTION_STAGES[3].name = `큰 ${n}`;
  EVOLUTION_STAGES[4].name = `${n} 킹`;
  EVOLUTION_STAGES[5].name = `드래곤 ${n}`;
}

// ============================================
// 캐릭터 생성 화면
// ============================================
const creatorScreen = document.getElementById('creator-screen');
const creatorPreview = document.getElementById('creator-preview');
const creatorCtx = creatorPreview.getContext('2d');

let creatorCustom = { ...custom };

function initCreator() {
  // 색상 버튼 이벤트
  document.querySelectorAll('.color-options').forEach(group => {
    const target = group.dataset.target;
    group.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        creatorCustom[target] = btn.dataset.color;
        drawCreatorPreview();
      });
    });
    // 커스텀 컬러 피커
    const picker = group.querySelector('.custom-color');
    if (picker) {
      picker.addEventListener('input', (e) => {
        group.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        creatorCustom[target] = e.target.value;
        drawCreatorPreview();
      });
    }
  });

  // 스타일 버튼 이벤트
  document.querySelectorAll('.style-options').forEach(group => {
    const target = group.dataset.target;
    group.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        creatorCustom[target] = btn.dataset.value;
        drawCreatorPreview();
      });
    });
  });

  // 생성 버튼
  document.getElementById('btn-create').addEventListener('click', () => {
    const nameInput = document.getElementById('input-name').value.trim();
    creatorCustom.name = nameInput || '슬라임';
    custom = { ...creatorCustom };
    updateEvolutionNames();
    state.custom = { ...custom };
    creatorScreen.classList.add('hidden');
    container.classList.remove('hidden');
    startGame();
  });

  drawCreatorPreview();
}

function drawCreatorPreview() {
  const size = 120;
  creatorPreview.width = size;
  creatorPreview.height = size;
  creatorCtx.clearRect(0, 0, size, size);

  creatorCtx.save();
  creatorCtx.translate(size / 2, size / 2);

  const s = size * 0.35;
  const color = creatorCustom.bodyColor;

  // 몸체 (슬라임 형태)
  creatorCtx.fillStyle = color;
  creatorCtx.beginPath();
  creatorCtx.moveTo(-s, 8);
  creatorCtx.quadraticCurveTo(-s, -s * 0.7, 0, -s);
  creatorCtx.quadraticCurveTo(s, -s * 0.7, s, 8);
  creatorCtx.quadraticCurveTo(0, 14, -s, 8);
  creatorCtx.fill();

  // 하이라이트
  creatorCtx.fillStyle = 'rgba(255,255,255,0.35)';
  creatorCtx.beginPath();
  creatorCtx.ellipse(-s * 0.3, -s * 0.2, s * 0.2, s * 0.3, -0.3, 0, Math.PI * 2);
  creatorCtx.fill();

  // 눈
  drawEyesOn(creatorCtx, s * 0.3, 0, 4, creatorCustom.eyeStyle, creatorCustom.eyeColor);

  // 입
  drawMouthOn(creatorCtx, 0, 8, s * 0.22, 80);

  // 볼터치
  drawCheeksOn(creatorCtx, s * 0.5, 6, creatorCustom.cheekStyle);

  creatorCtx.restore();
}

// ============================================
// 캐릭터 렌더링
// ============================================
let animFrame = 0;
let animTick = 0;

function drawCharacter() {
  const stage = EVOLUTION_STAGES[state.evolutionStage];
  const size = stage.size;
  canvas.width = size;
  canvas.height = size;
  ctx.clearRect(0, 0, size, size);

  animTick++;
  if (animTick % 20 === 0) animFrame = (animFrame + 1) % 4;

  const bounce = moveState.isMoving ? Math.sin(animTick * 0.15) * 3 : Math.sin(animTick * 0.05) * 1;
  const squish = moveState.isMoving ? Math.sin(animTick * 0.15) * 0.05 : 0;

  ctx.save();
  ctx.translate(size / 2, size / 2 + bounce);
  ctx.scale(moveState.direction, 1);
  ctx.scale(1 + squish, 1 - squish);

  const color = getStageColor(state.evolutionStage);

  switch (stage.bodyType) {
    case 'egg': drawEgg(size, color); break;
    case 'baby': drawBabySlime(size, color); break;
    case 'child': drawSlime(size, color, false); break;
    case 'teen': drawSlime(size, color, true); break;
    case 'adult': drawKingSlime(size, color); break;
    case 'dragon': drawDragonSlime(size, color); break;
  }

  ctx.restore();
}

function drawEgg(size, color) {
  const s = size * 0.35;
  // 알 색상은 사용자 색 + 연하게
  const hsl = hexToHSL(custom.bodyColor);
  const eggColor = hslToHex(hsl.h, Math.max(10, hsl.s - 30), Math.min(95, hsl.l + 20));
  ctx.fillStyle = eggColor;
  ctx.beginPath();
  ctx.ellipse(0, 2, s * 0.7, s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hslToHex(hsl.h, hsl.s - 20, hsl.l + 5);
  ctx.lineWidth = 2;
  ctx.stroke();

  // 알 무늬 (사용자 색상)
  ctx.strokeStyle = custom.bodyColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, 2);
  ctx.lineTo(-s * 0.1, -5);
  ctx.lineTo(s * 0.15, 5);
  ctx.lineTo(s * 0.35, -2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBabySlime(size, color) {
  const s = size * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 4, s, s * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -2, s * 0.2, s * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();

  drawEyesOn(ctx, s * 0.25, 2, 2.5, custom.eyeStyle, custom.eyeColor);
  drawCheeksOn(ctx, s * 0.45, 6, custom.cheekStyle);
}

function drawSlime(size, color, hasAccessory) {
  const s = size * 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s, 8);
  ctx.quadraticCurveTo(-s, -s * 0.7, 0, -s);
  ctx.quadraticCurveTo(s, -s * 0.7, s, 8);
  ctx.quadraticCurveTo(0, 12, -s, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.2, s * 0.2, s * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  drawEyesOn(ctx, s * 0.3, 0, 3, custom.eyeStyle, custom.eyeColor);
  drawMouthOn(ctx, 0, 6, s * 0.2, state.happiness);
  drawCheeksOn(ctx, s * 0.5, 5, custom.cheekStyle);

  if (hasAccessory) {
    const hsl = hexToHSL(custom.bodyColor);
    ctx.fillStyle = hslToHex((hsl.h + 40) % 360, 80, 60);
    ctx.beginPath();
    ctx.moveTo(-2, -s + 2);
    ctx.lineTo(0, -s - 8);
    ctx.lineTo(2, -s + 2);
    ctx.fill();
  }
}

function drawKingSlime(size, color) {
  const s = size * 0.38;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s, 8);
  ctx.quadraticCurveTo(-s * 1.1, -s * 0.5, 0, -s);
  ctx.quadraticCurveTo(s * 1.1, -s * 0.5, s, 8);
  ctx.quadraticCurveTo(0, 14, -s, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.2, s * 0.2, s * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 왕관
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(-10, -s + 2);
  ctx.lineTo(-12, -s - 10);
  ctx.lineTo(-6, -s - 4);
  ctx.lineTo(0, -s - 14);
  ctx.lineTo(6, -s - 4);
  ctx.lineTo(12, -s - 10);
  ctx.lineTo(10, -s + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#DAA520';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#FF4444';
  ctx.beginPath();
  ctx.arc(0, -s - 8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  drawEyesOn(ctx, s * 0.3, 0, 3.5, custom.eyeStyle, custom.eyeColor);
  drawMouthOn(ctx, 0, 7, s * 0.25, state.happiness);
  drawCheeksOn(ctx, s * 0.5, 6, custom.cheekStyle);
}

function drawDragonSlime(size, color) {
  const s = size * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s, 10);
  ctx.quadraticCurveTo(-s * 1.1, -s * 0.5, 0, -s);
  ctx.quadraticCurveTo(s * 1.1, -s * 0.5, s, 10);
  ctx.quadraticCurveTo(0, 16, -s, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.3, -s * 0.2, s * 0.2, s * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // 날개 (사용자 색 기반)
  const wingColor = getStageColor(5);
  ctx.fillStyle = wingColor + '99';
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, -4);
  ctx.quadraticCurveTo(-s * 1.6, -20, -s * 1.2, -8);
  ctx.quadraticCurveTo(-s * 1.4, 0, -s * 0.6, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.6, -4);
  ctx.quadraticCurveTo(s * 1.6, -20, s * 1.2, -8);
  ctx.quadraticCurveTo(s * 1.4, 0, s * 0.6, 4);
  ctx.fill();

  // 뿔
  const hsl = hexToHSL(custom.bodyColor);
  ctx.fillStyle = hslToHex((hsl.h + 30) % 360, 70, 40);
  ctx.beginPath();
  ctx.moveTo(-8, -s + 4); ctx.lineTo(-10, -s - 12); ctx.lineTo(-4, -s + 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -s + 4); ctx.lineTo(10, -s - 12); ctx.lineTo(4, -s + 2); ctx.fill();

  drawEyesOn(ctx, s * 0.25, -2, 4, custom.eyeStyle, custom.eyeColor);
  drawMouthOn(ctx, 0, 8, s * 0.2, state.happiness);
  drawCheeksOn(ctx, s * 0.5, 6, custom.cheekStyle);
}

// --- 공통 그리기 함수 ---
function drawEyesOn(c, offsetX, y, radius, style, color) {
  switch (style) {
    case 'round':
      c.fillStyle = 'white';
      c.beginPath();
      c.arc(-offsetX, y, radius + 1, 0, Math.PI * 2);
      c.arc(offsetX, y, radius + 1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.arc(-offsetX, y + 0.5, radius * 0.6, 0, Math.PI * 2);
      c.arc(offsetX, y + 0.5, radius * 0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'white';
      c.beginPath();
      c.arc(-offsetX - 1, y - 1, radius * 0.25, 0, Math.PI * 2);
      c.arc(offsetX - 1, y - 1, radius * 0.25, 0, Math.PI * 2);
      c.fill();
      break;

    case 'sparkle':
      c.fillStyle = 'white';
      c.beginPath();
      c.arc(-offsetX, y, radius + 1.5, 0, Math.PI * 2);
      c.arc(offsetX, y, radius + 1.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.arc(-offsetX, y, radius * 0.7, 0, Math.PI * 2);
      c.arc(offsetX, y, radius * 0.7, 0, Math.PI * 2);
      c.fill();
      // 큰 하이라이트 2개
      c.fillStyle = 'white';
      c.beginPath();
      c.arc(-offsetX - 1.2, y - 1.5, radius * 0.35, 0, Math.PI * 2);
      c.arc(offsetX - 1.2, y - 1.5, radius * 0.35, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(-offsetX + 1, y + 1, radius * 0.18, 0, Math.PI * 2);
      c.arc(offsetX + 1, y + 1, radius * 0.18, 0, Math.PI * 2);
      c.fill();
      break;

    case 'sleepy':
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.lineCap = 'round';
      // 감은 눈 (곡선)
      c.beginPath();
      c.arc(-offsetX, y, radius * 0.7, 0, Math.PI);
      c.stroke();
      c.beginPath();
      c.arc(offsetX, y, radius * 0.7, 0, Math.PI);
      c.stroke();
      break;

    case 'sharp':
      c.fillStyle = 'white';
      c.beginPath();
      c.ellipse(-offsetX, y, radius + 1, radius * 0.7, -0.15, 0, Math.PI * 2);
      c.ellipse(offsetX, y, radius + 1, radius * 0.7, 0.15, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(-offsetX + 0.5, y + 0.5, radius * 0.4, radius * 0.6, 0, 0, Math.PI * 2);
      c.ellipse(offsetX + 0.5, y + 0.5, radius * 0.4, radius * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'white';
      c.beginPath();
      c.arc(-offsetX - 0.5, y - 1, radius * 0.2, 0, Math.PI * 2);
      c.arc(offsetX - 0.5, y - 1, radius * 0.2, 0, Math.PI * 2);
      c.fill();
      break;
  }
}

function drawMouthOn(c, x, y, width, happiness) {
  c.strokeStyle = '#333';
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.beginPath();
  if (happiness > 60) {
    c.arc(x, y - 2, width, 0.1 * Math.PI, 0.9 * Math.PI);
  } else if (happiness > 30) {
    c.moveTo(x - width, y);
    c.lineTo(x + width, y);
  } else {
    c.arc(x, y + 4, width, 1.1 * Math.PI, 1.9 * Math.PI);
  }
  c.stroke();
}

function drawCheeksOn(c, offsetX, y, style) {
  if (style === 'none') return;
  const colors = {
    pink: 'rgba(255,150,180,0.4)',
    orange: 'rgba(255,180,120,0.4)',
    red: 'rgba(255,100,100,0.35)',
  };
  c.fillStyle = colors[style] || colors.pink;
  c.beginPath();
  c.ellipse(-offsetX, y, 3.5, 2.5, 0, 0, Math.PI * 2);
  c.ellipse(offsetX, y, 3.5, 2.5, 0, 0, Math.PI * 2);
  c.fill();
}

// --- 이동 로직 ---
function updateMovement() {
  if (modalOpen) return; // 모달 열려있으면 이동 정지

  const screenWidth = window.innerWidth;
  const stage = EVOLUTION_STAGES[state.evolutionStage];
  const margin = stage.size;

  if (!moveState.isMoving) {
    moveState.idleTimer--;
    if (moveState.idleTimer <= 0) {
      moveState.isMoving = true;
      moveState.moveTimer = 100 + Math.random() * 200;
      moveState.targetX = margin + Math.random() * (screenWidth - margin * 2);
      moveState.direction = moveState.targetX > state.x ? 1 : -1;
    }
    return;
  }

  moveState.moveTimer--;
  if (moveState.moveTimer <= 0) {
    moveState.isMoving = false;
    moveState.idleTimer = 60 + Math.random() * 120;
    return;
  }

  const dx = moveState.targetX - state.x;
  if (Math.abs(dx) < 2) {
    moveState.isMoving = false;
    moveState.idleTimer = 60 + Math.random() * 120;
    return;
  }

  moveState.direction = dx > 0 ? 1 : -1;
  state.x += moveState.direction * moveState.speed;

  if (state.x < margin) { state.x = margin; moveState.direction = 1; }
  if (state.x > screenWidth - margin) { state.x = screenWidth - margin; moveState.direction = -1; }
}

// --- 상호작용 ---
function doAction(action) {
  let expGain = 0;
  let msgs;

  switch (action) {
    case 'feed':
      state.hunger = Math.min(100, state.hunger + 25);
      state.happiness = Math.min(100, state.happiness + 5);
      expGain = 5;
      msgs = dialogues.feed;
      break;
    case 'play':
      state.happiness = Math.min(100, state.happiness + 20);
      state.hunger = Math.max(0, state.hunger - 8);
      expGain = 8;
      msgs = dialogues.play;
      break;
    case 'pet':
      state.happiness = Math.min(100, state.happiness + 15);
      expGain = 3;
      msgs = dialogues.pet;
      spawnHearts();
      break;
    case 'talk':
      state.happiness = Math.min(100, state.happiness + 10);
      expGain = 4;
      msgs = dialogues.talk;
      break;
  }

  state.totalInteractions++;
  addExp(expGain);
  showSpeech(randomPick(msgs || dialogues.idle));
  container.classList.add('bouncing');
  setTimeout(() => container.classList.remove('bouncing'), 400);
}

function addExp(amount) {
  state.exp += amount;
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level++;
    state.expToNext = Math.floor(state.expToNext * 1.3);
    showSpeech(randomPick(dialogues.levelup || ['레벨 업!']));
    checkEvolution();
  }
}

function checkEvolution() {
  for (let i = EVOLUTION_STAGES.length - 1; i >= 0; i--) {
    if (state.level >= EVOLUTION_STAGES[i].level && i > state.evolutionStage) {
      state.evolutionStage = i;
      container.classList.add('evolving');
      showSpeech(`✨ ${EVOLUTION_STAGES[i].name}(으)로 진화했다! ✨`);
      setTimeout(() => container.classList.remove('evolving'), 1500);
      break;
    }
  }
}

// --- UI ---
const modalOverlay = document.getElementById('modal-overlay');
let modalOpen = false;

function showSpeech(text) {
  speechText.textContent = text;
  speechBubble.classList.remove('hidden');
  clearTimeout(showSpeech._timer);
  showSpeech._timer = setTimeout(() => {
    speechBubble.classList.add('hidden');
  }, 4000);
}

function openModal() {
  if (modalOpen) return;
  modalOpen = true;
  updateModal();
  // 모달 위치를 화면 중앙으로 초기화
  const modal = document.getElementById('modal');
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%, -50%)';
  modalOverlay.classList.remove('hidden');
  window.electronAPI.setIgnoreMouse(false);
}

function closeModal() {
  modalOpen = false;
  modalOverlay.classList.add('hidden');
  window.electronAPI.setIgnoreMouse(true, { forward: true });
}

function updateModal() {
  const stage = EVOLUTION_STAGES[state.evolutionStage];
  document.getElementById('modal-name').textContent = stage.name;
  document.getElementById('modal-level').textContent = `Lv. ${state.level}`;
  document.getElementById('bar-happiness').style.width = state.happiness + '%';
  document.getElementById('bar-hunger').style.width = state.hunger + '%';
  document.getElementById('bar-exp').style.width = (state.exp / state.expToNext * 100) + '%';
  document.getElementById('val-happiness').textContent = Math.round(state.happiness);
  document.getElementById('val-hunger').textContent = Math.round(state.hunger);
  document.getElementById('val-exp').textContent = `${state.exp}/${state.expToNext}`;
}

function spawnHearts() {
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart-effect';
    heart.textContent = '💕';
    heart.style.left = (Math.random() * 40 + 10) + 'px';
    heart.style.top = -(Math.random() * 20 + 10) + 'px';
    container.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
  }
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- 이벤트 ---
container.addEventListener('mouseenter', () => {
  window.electronAPI.setIgnoreMouse(false);
});

container.addEventListener('mouseleave', () => {
  if (!modalOpen) {
    window.electronAPI.setIgnoreMouse(true, { forward: true });
  }
});

container.addEventListener('click', () => {
  openModal();
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.querySelectorAll('#modal-actions button').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    doAction(btn.dataset.action);
    updateModal();
  });
});

// --- 모달 드래그 이동 ---
(function() {
  const modal = document.getElementById('modal');
  const header = document.getElementById('modal-header');
  let dragging = false;
  let offsetX = 0, offsetY = 0;

  header.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = modal.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    // 드래그 시작하면 transform 제거하고 실제 좌표로 전환
    modal.style.left = rect.left + 'px';
    modal.style.top = rect.top + 'px';
    modal.style.transform = 'none';
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    modal.style.left = (e.clientX - offsetX) + 'px';
    modal.style.top = (e.clientY - offsetY) + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      header.style.cursor = 'grab';
    }
  });
})();

document.getElementById('modal-quit').addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.quitApp();
});

// --- 자동 시스템 ---
function autoDecay() {
  state.hunger = Math.max(0, state.hunger - 0.02);
  state.happiness = Math.max(0, state.happiness - 0.01);
  if (state.hunger < 20 && Math.random() < 0.005) {
    showSpeech(randomPick(dialogues.hungry || ['배고파...']));
  }
}

function autoTalk() {
  if (Date.now() - state.lastAutoTalk > 60000 && Math.random() < 0.01) {
    showSpeech(randomPick(dialogues.idle));
    state.lastAutoTalk = Date.now();
  }
}

// --- 세이브/로드 ---
function saveGame() {
  state.lastSave = Date.now();
  state.custom = { ...custom };
  window.electronAPI.saveData(state);
}

async function loadGame() {
  const saved = await window.electronAPI.loadData();
  if (saved) {
    state = { ...state, ...saved };
    if (saved.custom) {
      custom = { ...custom, ...saved.custom };
    }
    const offlineMinutes = (Date.now() - state.lastSave) / 60000;
    state.hunger = Math.max(0, state.hunger - offlineMinutes * 0.5);
  }
}

// --- 메인 루프 ---
function gameLoop() {
  updateMovement();
  drawCharacter();
  autoDecay();
  autoTalk();
  container.style.left = state.x + 'px';
  requestAnimationFrame(gameLoop);
}

function startGame() {
  updateEvolutionNames();
  setInterval(saveGame, 30000);
  setInterval(() => { if (modalOpen) updateModal(); }, 1000);
  gameLoop();

  setTimeout(() => {
    const stage = EVOLUTION_STAGES[state.evolutionStage];
    showSpeech(`안녕! 나는 ${stage.name}! 잘 부탁해~ ☺`);
  }, 2000);
}

// --- 초기화 ---
loadGame().then(() => {
  if (state.custom) {
    // 기존 세이브가 있으면 생성 화면 건너뛰기
    custom = { ...custom, ...state.custom };
    creatorScreen.classList.add('hidden');
    container.classList.remove('hidden');
    startGame();
  } else {
    // 첫 실행: 캐릭터 생성 화면 표시
    window.electronAPI.setIgnoreMouse(false);
    initCreator();
  }
});
