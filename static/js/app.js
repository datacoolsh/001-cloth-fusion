/* ─── State ───────────────────────────────────────────────────────────────── */
const state = {
  step: 1,
  originalFile: null,
  removedBgB64: null,   // base64 透明PNG
  measurements: { height: 165, weight: 55, bust: 88, waist: 68, hip: 92 },
  clothes: [],
  selectedTop: null,
  selectedBottom: null,
  aiResultB64: null,  // IDM-VTON 生成结果
};

/* ─── DOM refs ────────────────────────────────────────────────────────────── */
const panels    = () => document.querySelectorAll('.step-panel');
const stepItems = () => document.querySelectorAll('.step-item');
const stepConns = () => document.querySelectorAll('.step-connector');

/* ─── Step Navigation ─────────────────────────────────────────────────────── */
function goToStep(n) {
  state.step = n;
  panels().forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  stepItems().forEach((s, i) => {
    s.classList.toggle('active', i + 1 === n);
    s.classList.toggle('done',   i + 1 < n);
  });
  stepConns().forEach((c, i) => {
    c.style.background = i + 1 < n ? 'var(--success)' : 'var(--border)';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── Toast ───────────────────────────────────────────────────────────────── */
function toast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

/* ─── Step 1: Upload & Measurements ──────────────────────────────────────── */
function initUpload() {
  const zone     = document.getElementById('upload-zone');
  const input    = document.getElementById('photo-input');
  const preview  = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-img');
  const nextBtn  = document.getElementById('btn-step1-next');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleFileSelect(input.files[0]);
  });

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) { toast('请上传图片文件'); return; }
    state.originalFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    preview.style.display = 'block';
    zone.querySelector('.upload-content').style.display = 'none';
    nextBtn.disabled = false;
  }

  // 测量值滑块
  const sliders = {
    height: { el: document.getElementById('sl-height'), disp: document.getElementById('val-height'), min: 145, max: 195 },
    weight: { el: document.getElementById('sl-weight'), disp: document.getElementById('val-weight'), min: 38,  max: 120 },
    bust:   { el: document.getElementById('sl-bust'),   disp: document.getElementById('val-bust'),   min: 72,  max: 110 },
    waist:  { el: document.getElementById('sl-waist'),  disp: document.getElementById('val-waist'),  min: 56,  max: 96  },
    hip:    { el: document.getElementById('sl-hip'),    disp: document.getElementById('val-hip'),    min: 78,  max: 115 },
  };

  Object.entries(sliders).forEach(([key, { el, disp }]) => {
    el.value = state.measurements[key];
    disp.textContent = state.measurements[key];
    el.addEventListener('input', () => {
      state.measurements[key] = parseInt(el.value);
      disp.textContent = el.value;
    });
  });

  // 体型预设
  const presets = {
    '标准': { bust: 88, waist: 68, hip: 92 },
    '偏瘦': { bust: 82, waist: 62, hip: 85 },
    '微胖': { bust: 96, waist: 78, hip: 100 },
    '运动': { bust: 90, waist: 70, hip: 94 },
  };

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const p = presets[btn.dataset.preset];
      if (!p) return;
      Object.entries(p).forEach(([key, val]) => {
        state.measurements[key] = val;
        sliders[key].el.value = val;
        sliders[key].disp.textContent = val;
      });
    });
  });
}

/* ─── Step 2: Background Removal ─────────────────────────────────────────── */
async function runRemoveBg() {
  goToStep(2);
  const steps = document.querySelectorAll('.proc-step');

  async function activateStep(i, delay = 0) {
    await pause(delay);
    steps.forEach((s, j) => {
      s.classList.toggle('active', j === i);
      if (j < i) s.classList.add('done');
    });
  }

  await activateStep(0);

  try {
    const formData = new FormData();
    formData.append('file', state.originalFile);

    await activateStep(1, 600);
    const resp = await fetch('/api/remove-bg', { method: 'POST', body: formData });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.detail || '背景去除失败');
    }

    const data = await resp.json();
    state.removedBgB64 = data.image;

    await activateStep(2, 400);
    await pause(600);
    steps.forEach(s => s.classList.add('done'));
    await pause(800);

    // 加载服装列表
    await loadClothes();
    goToStep(3);

  } catch (e) {
    toast(`错误：${e.message}`);
    goToStep(1);
  }
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ─── Step 3: Select Clothes ──────────────────────────────────────────────── */
async function loadClothes() {
  const resp = await fetch('/api/clothes');
  const data = await resp.json();
  state.clothes = data.items;

  renderClothesSection('top',    data.items.filter(i => i.category === 'top'));
  renderClothesSection('bottom', data.items.filter(i => i.category === 'bottom'));
}

function renderClothesSection(category, items) {
  const grid = document.getElementById(`grid-${category}`);
  grid.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'clothes-card';
    card.dataset.id = item.id;

    const imgSrc = item.img_b64
      ? `data:${item.mime || 'image/jpeg'};base64,${item.img_b64}`
      : `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${encodeURIComponent(item.color)}"/></svg>`;

    card.innerHTML = `
      <img class="clothes-img" src="${imgSrc}" alt="${item.name}">
      <div class="clothes-name">${item.name}</div>
    `;

    card.addEventListener('click', () => selectClothes(category, item, card));
    grid.appendChild(card);
  });
}

function selectClothes(category, item, card) {
  const grid = document.getElementById(`grid-${category}`);
  grid.querySelectorAll('.clothes-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  if (category === 'top')    state.selectedTop    = item;
  if (category === 'bottom') state.selectedBottom = item;

  document.getElementById('btn-step3-next').disabled =
    !(state.selectedTop || state.selectedBottom);
}

/* ─── Step 4: 初始化展示区（显示去背景人物照） ─────────────────────────────── */
function initTryOn() {
  const personImg = document.getElementById('tryon-person-img');
  const resultImg = document.getElementById('tryon-result-img');
  const loadingEl = document.getElementById('tryon-loading-overlay');
  const stageTitle = document.getElementById('stage-title');
  const stageBadge = document.getElementById('stage-ai-badge');

  // 重置为初始状态：显示人物照，隐藏AI结果和加载层
  loadingEl.style.display = 'none';
  resultImg.classList.add('tryon-result-hidden');
  stageBadge.style.display = 'none';
  stageTitle.textContent = '人物照片';

  if (state.removedBgB64) {
    personImg.src = `data:image/png;base64,${state.removedBgB64}`;
  }

  // 如果本次已有AI结果（返回上一步再进来时保留），直接显示
  if (state.aiResultB64) {
    resultImg.src = `data:image/png;base64,${state.aiResultB64}`;
    resultImg.classList.remove('tryon-result-hidden');
    stageBadge.style.display = '';
    stageTitle.textContent = 'AI 试穿结果';
  }

  renderOutfitSummary();
}

/* ─── AI Try-On (IDM-VTON via Replicate) ─────────────────────────────────── */
async function runAITryOn() {
  if (!state.removedBgB64) { toast('请先完成照片处理'); return; }

  const topItem    = state.selectedTop;
  const bottomItem = state.selectedBottom;
  if (!topItem && !bottomItem) { toast('请至少选择一件服装'); return; }

  const btn        = document.getElementById('btn-ai-tryon');
  const loadingEl  = document.getElementById('tryon-loading-overlay');
  const loadingTxt = document.getElementById('tryon-loading-text');
  const resultImg  = document.getElementById('tryon-result-img');
  const stageTitle = document.getElementById('stage-title');
  const stageBadge = document.getElementById('stage-ai-badge');
  const errMsg     = document.getElementById('ai-error-msg');

  btn.disabled = true;
  errMsg.style.display = 'none';
  loadingEl.style.display = '';

  try {
    let personB64 = state.removedBgB64;

    // ── 第一步：上装 ──────────────────────────────────────
    if (topItem?.img_b64) {
      loadingTxt.textContent = `正在合成上装「${topItem.name}」，约需 60–90 秒…`;
      const resp = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_b64:   personB64,
          garment_b64:  topItem.img_b64,
          garment_desc: topItem.name,
          category:     topItem.ai_category || 'upper_body',
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `服务器错误 ${resp.status}`);
      }
      personB64 = (await resp.json()).image;
    }

    // ── 第二步：下装 ──────────────────────────────────────
    if (bottomItem?.img_b64) {
      loadingTxt.textContent = `正在合成下装「${bottomItem.name}」，请稍候…`;
      const resp = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_b64:   personB64,
          garment_b64:  bottomItem.img_b64,
          garment_desc: bottomItem.name,
          category:     bottomItem.ai_category || 'lower_body',
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `服务器错误 ${resp.status}`);
      }
      personB64 = (await resp.json()).image;
    }

    // ── 展示结果 ──────────────────────────────────────────
    state.aiResultB64 = personB64;
    resultImg.src = `data:image/png;base64,${personB64}`;
    loadingEl.style.display = 'none';
    resultImg.classList.remove('tryon-result-hidden');
    stageTitle.textContent = 'AI 试穿结果';
    stageBadge.style.display = '';

  } catch (e) {
    loadingEl.style.display = 'none';
    errMsg.textContent = `生成失败：${e.message}`;
    errMsg.style.display = '';
    toast(`AI 试穿失败：${e.message}`, 5000);
  } finally {
    btn.disabled = false;
  }
}

function renderOutfitSummary() {
  const wrap = document.getElementById('outfit-items');
  wrap.innerHTML = '';

  [
    { item: state.selectedTop,    cat: '上装' },
    { item: state.selectedBottom, cat: '下装' },
  ].forEach(({ item, cat }) => {
    if (!item) return;
    const imgSrc = item.img_b64
      ? `data:${item.mime||'image/jpeg'};base64,${item.img_b64}`
      : '';
    wrap.innerHTML += `
      <div class="outfit-item">
        <div class="outfit-swatch">
          ${imgSrc ? `<img src="${imgSrc}" alt="">` : `<div style="background:${item.color};width:100%;height:100%"></div>`}
        </div>
        <div>
          <div class="outfit-item-name">${item.name}</div>
          <div class="outfit-item-cat">${cat}</div>
        </div>
      </div>`;
  });
}

/* ─── Bootstrap ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initUpload();
  goToStep(1);

  document.getElementById('btn-step1-next').addEventListener('click', () => {
    if (!state.originalFile) { toast('请先上传您的照片'); return; }
    runRemoveBg();
  });

  document.getElementById('btn-step3-back').addEventListener('click', () => goToStep(1));
  document.getElementById('btn-step3-next').addEventListener('click', () => {
    if (!state.selectedTop && !state.selectedBottom) {
      toast('请至少选择一件服装');
      return;
    }
    goToStep(4);
    setTimeout(initTryOn, 60);
  });

  document.getElementById('btn-ai-tryon').addEventListener('click', runAITryOn);

  document.getElementById('btn-step4-back').addEventListener('click', () => goToStep(3));
  document.getElementById('btn-restart').addEventListener('click', () => {
    state.originalFile   = null;
    state.removedBgB64   = null;
    state.selectedTop    = null;
    state.selectedBottom = null;
    state.aiResultB64    = null;
    document.getElementById('upload-preview').style.display = 'none';
    document.getElementById('photo-input').value = '';
    document.querySelector('.upload-content').style.display = '';
    document.getElementById('btn-step1-next').disabled = true;
    goToStep(1);
  });
});
