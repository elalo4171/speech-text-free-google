/* ── State ── */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;
let isPaused = false;
let recordStart = 0;
let elapsed = 0;
let timerInterval = null;
let finalTranscript = '';
let currentNoteId = null;
let animFrameId = null;
let analyser = null;
let audioCtx = null;
let mediaStream = null;

const DB_KEY = 'voicenotes_data';

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || { notes: [], projects: [] };
  } catch { return { notes: [], projects: [] }; }
}
function saveData(data) { localStorage.setItem(DB_KEY, JSON.stringify(data)); }

/* ── Navigation ── */
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');

function showView(name) {
  views.forEach(v => v.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(b => b.classList.add('active'));
  if (name === 'home') renderHome();
  if (name === 'projects') renderProjects();
}

navItems.forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    if (view === 'record') {
      startRecording();
    } else {
      if (isRecording) stopRecording(false);
      showView(view);
    }
  });
});

/* ── Home ── */
function renderHome(filter = '') {
  const data = loadData();
  const list = document.getElementById('recordings-list');
  const empty = document.getElementById('empty-state');
  let notes = [...data.notes].sort((a, b) => b.createdAt - a.createdAt);
  if (filter) {
    const q = filter.toLowerCase();
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q)
    );
  }
  if (notes.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = notes.map(n => {
    const project = data.projects.find(p => p.id === n.projectId);
    const date = new Date(n.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
    const words = n.text ? n.text.split(/\s+/).filter(Boolean).length : 0;
    const preview = n.text ? n.text.substring(0, 120) : '';
    return `
      <div class="rec-card" data-id="${n.id}">
        <div class="rec-card-top">
          <span class="rec-card-title">${esc(n.title || 'Sin titulo')}</span>
          ${project ? `<span class="rec-card-project">${esc(project.name)}</span>` : ''}
        </div>
        <div class="rec-card-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${date}</span>
          <span>&middot;</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>${words.toLocaleString()} palabras</span>
        </div>
        ${preview ? `<div class="rec-card-preview">${esc(preview)}</div>` : ''}
        <div class="rec-card-bottom">
          <span class="rec-card-duration">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatTime(n.duration || 0)}
          </span>
          <div class="rec-card-actions">
            <button onclick="event.stopPropagation(); shareNote('${n.id}')" title="Compartir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <button onclick="event.stopPropagation(); copyNoteText('${n.id}')" title="Copiar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="delete-card-btn" onclick="event.stopPropagation(); deleteNote('${n.id}')" title="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.rec-card').forEach(card => {
    card.addEventListener('click', () => openNote(card.dataset.id));
  });
}

/* ── Search ── */
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
document.getElementById('btn-search').addEventListener('click', () => {
  searchBar.classList.toggle('hidden');
  if (!searchBar.classList.contains('hidden')) searchInput.focus();
  else { searchInput.value = ''; renderHome(); }
});
searchInput.addEventListener('input', () => renderHome(searchInput.value));

/* ── Recording ── */
function startRecording() {
  if (!SpeechRecognition) { toast('Tu navegador no soporta Speech Recognition'); return; }
  finalTranscript = '';
  elapsed = 0;
  isPaused = false;
  showView('record');
  document.getElementById('live-text').textContent = 'Esperando voz...';
  document.getElementById('timer').textContent = '00:00:00';
  updateRecStatus('recording');
  populateProjectDropdown();
  startSpeech();
  startTimer();
  startWaveform();
  isRecording = true;
}

function startSpeech() {
  recognition = new SpeechRecognition();
  recognition.lang = document.getElementById('setting-lang').value;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('live-text').textContent = interim || finalTranscript.slice(-100) || 'Esperando voz...';
  };
  recognition.onerror = (e) => {
    if (e.error !== 'aborted' && e.error !== 'no-speech') toast('Error: ' + e.error);
  };
  recognition.onend = () => { if (isRecording && !isPaused) try { recognition.start(); } catch {} };
  try { recognition.start(); } catch {}
}

function startTimer() {
  recordStart = Date.now();
  timerInterval = setInterval(() => {
    if (!isPaused) {
      const total = elapsed + (Date.now() - recordStart);
      document.getElementById('timer').textContent = formatTime(Math.floor(total / 1000));
    }
  }, 200);
}

function startWaveform() {
  const canvas = document.getElementById('waveform');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaStream = stream;
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    drawWaveform(canvas, ctx);
  }).catch(() => {});
}

function drawWaveform(canvas, ctx) {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const w = canvas.width, h = canvas.height;
  const barCount = 40;
  const barWidth = w / barCount * 0.6;
  const gap = w / barCount * 0.4;

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, w, h);

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    ctx.fillStyle = accent || '#f97316';

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * data.length / barCount);
      const val = data[idx] / 255;
      const barH = Math.max(4, val * h * 0.8);
      const x = i * (barWidth + gap) + gap / 2;
      const y = (h - barH) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2);
      ctx.fill();
    }
  }
  draw();
}

document.getElementById('btn-pause').addEventListener('click', () => {
  if (isPaused) {
    isPaused = false;
    recordStart = Date.now();
    updateRecStatus('recording');
    try { recognition.start(); } catch {}
  } else {
    isPaused = true;
    elapsed += Date.now() - recordStart;
    updateRecStatus('paused');
    try { recognition.stop(); } catch {}
  }
  const btn = document.getElementById('btn-pause');
  btn.querySelector('span').textContent = isPaused ? 'Reanudar' : 'Pausar';
  btn.querySelector('svg').innerHTML = isPaused
    ? '<polygon points="5 3 19 12 5 21 5 3"/>'
    : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
});

document.getElementById('btn-stop').addEventListener('click', () => {
  if (!isRecording && !isPaused) return;

  const totalSec = Math.floor((elapsed + (Date.now() - recordStart)) / 1000);
  clearInterval(timerInterval);
  isPaused = false;
  isRecording = false;

  // Clean up audio/visual
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; analyser = null; }
  // Reset pause button
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.querySelector('span').textContent = 'Pausar';
  pauseBtn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

  // Wait for recognition to deliver final results before checking
  if (recognition) {
    recognition.onend = () => {
      recognition = null;
      goToReviewOrHome(totalSec);
    };
    // stop() delivers pending results as final before firing onend
    try { recognition.stop(); } catch { recognition = null; goToReviewOrHome(totalSec); }
    // Safety timeout in case onend never fires
    setTimeout(() => { if (recognition) { recognition = null; goToReviewOrHome(totalSec); } }, 1000);
  } else {
    goToReviewOrHome(totalSec);
  }
});

function goToReviewOrHome(totalSec) {
  if (!finalTranscript.trim()) {
    toast('No se detecto voz');
    showView('home');
    return;
  }
  showReview(totalSec);
}

let reviewDuration = 0;

function showReview(totalSec) {
  reviewDuration = totalSec;
  const text = finalTranscript.trim();
  const words = text.split(/\s+/).filter(Boolean).length;

  document.getElementById('review-duration').textContent = formatTime(totalSec);
  document.getElementById('review-words').textContent = words.toLocaleString();
  document.getElementById('review-text').textContent = text;
  document.getElementById('review-title').value = generateTitle(text);

  // Populate project dropdown
  const data = loadData();
  const select = document.getElementById('review-project-select');
  const recProjectVal = document.getElementById('rec-project-select').value;
  select.innerHTML = '<option value="">Sin proyecto</option>' +
    data.projects.map(p => `<option value="${p.id}"${p.id === recProjectVal ? ' selected' : ''}>${esc(p.name)}</option>`).join('');

  showView('review');

  // Auto-copy text to clipboard
  if (text) {
    navigator.clipboard.writeText(text).then(() => toast('Texto copiado al portapapeles')).catch(() => {});
  }
}

document.getElementById('btn-copy-review').addEventListener('click', () => {
  const text = document.getElementById('review-text').textContent;
  if (!text.trim()) { toast('No hay texto'); return; }
  navigator.clipboard.writeText(text).then(() => toast('Texto copiado'));
});

document.getElementById('btn-review-save').addEventListener('click', () => {
  const data = loadData();
  const note = {
    id: uid(),
    title: document.getElementById('review-title').value.trim() || generateTitle(finalTranscript),
    text: finalTranscript.trim(),
    projectId: document.getElementById('review-project-select').value || null,
    duration: reviewDuration,
    createdAt: Date.now()
  };
  data.notes.push(note);
  saveData(data);
  toast('Nota guardada');
  showView('home');
});

document.getElementById('btn-review-discard').addEventListener('click', () => {
  toast('Nota descartada');
  showView('home');
});

document.getElementById('btn-copy-live').addEventListener('click', () => {
  const text = finalTranscript.trim();
  if (!text) { toast('No hay texto aun'); return; }
  navigator.clipboard.writeText(text).then(() => toast('Texto copiado'));
});

function stopRecording(save) {
  isRecording = false;
  isPaused = false;
  clearInterval(timerInterval);
  if (recognition) { recognition.abort(); recognition = null; }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; analyser = null; }
  // Reset pause button
  const btn = document.getElementById('btn-pause');
  btn.querySelector('span').textContent = 'Pausar';
  btn.querySelector('svg').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  showView('home');
}

document.getElementById('btn-back-record').addEventListener('click', () => {
  document.getElementById('btn-stop').click();
});

function updateRecStatus(state) {
  const el = document.getElementById('rec-status');
  el.className = 'rec-status' + (state === 'paused' ? ' paused' : '');
  el.querySelector('span:last-child').textContent = state === 'paused' ? 'PAUSADO' : 'GRABANDO';
}

function populateProjectDropdown() {
  const data = loadData();
  const select = document.getElementById('rec-project-select');
  select.innerHTML = '<option value="">Sin proyecto</option>' +
    data.projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}

/* ── Note detail ── */
function openNote(id) {
  currentNoteId = id;
  const data = loadData();
  const note = data.notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('detail-title').value = note.title || '';
  document.getElementById('detail-title-display').textContent = note.title || 'Nota';
  document.getElementById('detail-text').textContent = note.text || '';
  document.getElementById('detail-date').textContent = new Date(note.createdAt).toLocaleDateString('es-ES', { month: 'long', day: 'numeric', year: 'numeric' });
  const words = note.text ? note.text.split(/\s+/).filter(Boolean).length : 0;
  document.getElementById('detail-words').textContent = words + ' palabras';
  document.getElementById('detail-duration').textContent = formatTime(note.duration || 0);
  showView('detail');
}

// Auto-save title
document.getElementById('detail-title').addEventListener('input', (e) => {
  if (!currentNoteId) return;
  const data = loadData();
  const note = data.notes.find(n => n.id === currentNoteId);
  if (note) { note.title = e.target.value; saveData(data); }
  document.getElementById('detail-title-display').textContent = e.target.value || 'Nota';
});

// Auto-save text
document.getElementById('detail-text').addEventListener('input', () => {
  if (!currentNoteId) return;
  const data = loadData();
  const note = data.notes.find(n => n.id === currentNoteId);
  if (note) { note.text = document.getElementById('detail-text').textContent; saveData(data); }
});

document.getElementById('btn-back-detail').addEventListener('click', () => { currentNoteId = null; showView('home'); });

document.getElementById('btn-delete-note').addEventListener('click', () => {
  if (!currentNoteId) return;
  if (!confirm('Eliminar esta nota?')) return;
  const data = loadData();
  data.notes = data.notes.filter(n => n.id !== currentNoteId);
  saveData(data);
  currentNoteId = null;
  toast('Nota eliminada');
  showView('home');
});

document.getElementById('btn-copy-note').addEventListener('click', () => {
  const text = document.getElementById('detail-text').textContent;
  if (!text.trim()) { toast('Nota vacia'); return; }
  navigator.clipboard.writeText(text).then(() => toast('Texto copiado'));
});

document.getElementById('btn-share-note').addEventListener('click', () => {
  if (!currentNoteId) return;
  const data = loadData();
  const note = data.notes.find(n => n.id === currentNoteId);
  if (!note) return;
  const shareText = `${note.title}\n\n${note.text}\n\n— Creado con VoiceNotes by @elalo417`;
  if (navigator.share) {
    navigator.share({ title: note.title, text: shareText }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText).then(() => toast('Texto copiado al portapapeles'));
  }
});

document.getElementById('btn-download-note').addEventListener('click', () => {
  if (!currentNoteId) return;
  const data = loadData();
  const note = data.notes.find(n => n.id === currentNoteId);
  if (!note) return;
  const blob = new Blob([`${note.title}\n\n${note.text}`], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (note.title || 'nota') + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Descargado');
});

function deleteNote(id) {
  if (!confirm('Eliminar esta nota?')) return;
  const data = loadData();
  data.notes = data.notes.filter(n => n.id !== id);
  saveData(data);
  toast('Nota eliminada');
  renderHome();
}

function copyNoteText(id) {
  const data = loadData();
  const note = data.notes.find(n => n.id === id);
  if (note) navigator.clipboard.writeText(note.text).then(() => toast('Texto copiado'));
}

function shareNote(id) {
  const data = loadData();
  const note = data.notes.find(n => n.id === id);
  if (!note) return;
  const shareText = `${note.title}\n\n${note.text}\n\n— Creado con VoiceNotes by @elalo417`;
  if (navigator.share) {
    navigator.share({ title: note.title, text: shareText }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText).then(() => toast('Texto copiado'));
  }
}

/* ── Projects ── */
function renderProjects() {
  const data = loadData();
  const list = document.getElementById('projects-list');
  const empty = document.getElementById('projects-empty');
  if (data.projects.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  const colors = ['#f97316', '#6366f1', '#10b981', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b'];
  list.innerHTML = data.projects.map((p, i) => {
    const count = data.notes.filter(n => n.projectId === p.id).length;
    const color = colors[i % colors.length];
    return `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-left">
          <div class="project-dot" style="background:${color}"></div>
          <div>
            <div class="project-name">${esc(p.name)}</div>
            <div class="project-count">${count} nota${count !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="project-card-right">
          <button onclick="event.stopPropagation(); deleteProject('${p.id}')" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => filterByProject(card.dataset.id));
  });
}

function filterByProject(projectId) {
  showView('home');
  const data = loadData();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;
  // Filter home by project
  const list = document.getElementById('recordings-list');
  const empty = document.getElementById('empty-state');
  const notes = data.notes.filter(n => n.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt);
  if (notes.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    empty.querySelector('h3').textContent = 'Sin notas en ' + project.name;
    return;
  }
  empty.style.display = 'none';
  // Re-use renderHome mechanism by temporarily filtering
  searchInput.value = '';
  renderHome();
  // Apply client-side filter
  list.querySelectorAll('.rec-card').forEach(card => {
    const note = data.notes.find(n => n.id === card.dataset.id);
    if (note && note.projectId !== projectId) card.style.display = 'none';
  });
}

document.getElementById('btn-add-project').addEventListener('click', () => {
  showModal('Nuevo proyecto', 'Nombre del proyecto', (name) => {
    if (!name.trim()) return;
    const data = loadData();
    data.projects.push({ id: uid(), name: name.trim(), createdAt: Date.now() });
    saveData(data);
    renderProjects();
    toast('Proyecto creado');
  });
});

function deleteProject(id) {
  if (!confirm('Eliminar este proyecto? Las notas no se eliminaran.')) return;
  const data = loadData();
  data.projects = data.projects.filter(p => p.id !== id);
  data.notes.forEach(n => { if (n.projectId === id) n.projectId = null; });
  saveData(data);
  renderProjects();
  toast('Proyecto eliminado');
}

/* ── Settings ── */
const darkToggle = document.getElementById('setting-dark');
darkToggle.addEventListener('change', () => {
  document.documentElement.classList.toggle('dark', darkToggle.checked);
  localStorage.setItem('voicenotes_dark', darkToggle.checked ? '1' : '0');
});

// Load dark mode preference
if (localStorage.getItem('voicenotes_dark') === '1') {
  darkToggle.checked = true;
  document.documentElement.classList.add('dark');
}

// Language
const langSetting = document.getElementById('setting-lang');
const savedLang = localStorage.getItem('voicenotes_lang');
if (savedLang) langSetting.value = savedLang;
langSetting.addEventListener('change', () => {
  localStorage.setItem('voicenotes_lang', langSetting.value);
});

document.getElementById('btn-export-all').addEventListener('click', () => {
  const data = loadData();
  if (data.notes.length === 0) { toast('No hay notas'); return; }
  const text = data.notes.map(n => {
    const date = new Date(n.createdAt).toLocaleDateString('es-ES');
    return `## ${n.title || 'Sin titulo'}\nFecha: ${date} | Duracion: ${formatTime(n.duration || 0)}\n\n${n.text}\n\n---\n`;
  }).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voicenotes_export.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Notas exportadas');
});

document.getElementById('btn-delete-all').addEventListener('click', () => {
  if (!confirm('Borrar TODOS los datos? Esta accion no se puede deshacer.')) return;
  localStorage.removeItem(DB_KEY);
  toast('Datos borrados');
  renderHome();
});

/* ── Modal ── */
function showModal(title, placeholder, onConfirm) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-title').textContent = title;
  const input = document.getElementById('modal-input');
  input.placeholder = placeholder;
  input.value = '';
  input.focus();
  const confirm = document.getElementById('modal-confirm');
  const cancel = document.getElementById('modal-cancel');
  const close = () => document.getElementById('modal-overlay').classList.add('hidden');

  const handleConfirm = () => { onConfirm(input.value); close(); cleanup(); };
  const handleCancel = () => { close(); cleanup(); };
  const handleKey = (e) => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel(); };

  function cleanup() {
    confirm.removeEventListener('click', handleConfirm);
    cancel.removeEventListener('click', handleCancel);
    input.removeEventListener('keydown', handleKey);
  }
  confirm.addEventListener('click', handleConfirm);
  cancel.addEventListener('click', handleCancel);
  input.addEventListener('keydown', handleKey);
}

/* ── Utils ── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function generateTitle(text) {
  const words = text.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.length > 40 ? words.substring(0, 40) + '...' : words;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

/* ── Init ── */
renderHome();
