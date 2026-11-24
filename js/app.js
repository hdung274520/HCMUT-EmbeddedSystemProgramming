const $ = id => document.getElementById(id);
const hex = n => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---------- Navigation & theme ----------
document.querySelectorAll('nav button').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('nav button, .view').forEach(e => e.classList.remove('active'));
  btn.classList.add('active');
  $(btn.dataset.view).classList.add('active');
  if (btn.dataset.view === 'playground') editor.refresh();
});
const setTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('theme', t); } catch {} };
try { setTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')); } catch { setTheme('light'); }
$('themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

// ---------- Module 2: calculators ----------
const out = (id, fn) => { try { $(id).textContent = fn(); } catch (e) { $(id).textContent = '⚠ ' + e.message; } };
$('bbCalc').onclick = () => out('bbOut', () => {
  const r = Calc.bitband(parseInt($('bbAddr').value, 16), +$('bbBit').value);
  return `Vùng: ${r.region}\nByte offset: ${hex(r.offset)}\nAlias = base + offset×32 + bit×4\n→ ${hex(r.alias)}\n\n*(volatile uint32_t*)${hex(r.alias)} = 1;`;
});
$('brrCalc').onclick = () => out('brrOut', () => {
  const r = Calc.usartBrr(+$('brrClk').value, +$('brrBaud').value);
  return `USARTDIV = ${r.div.toFixed(4)}\nMantissa = ${r.mant} (0x${r.mant.toString(16).toUpperCase()})\nFraction = ${r.frac}\nUSART_BRR = ${hex(r.brr)}\nBaud thực = ${r.real.toFixed(1)} (sai số ${r.errPct.toFixed(2)}%)`;
});
$('stCalc').onclick = () => out('stOut', () => {
  const r = Calc.systick(+$('stClk').value, +$('stMs').value);
  return `Số xung = ${r.ticks}\nSYST_RVR = ${r.rvr} (${hex(r.rvr)})\n${r.ok ? '✅ Hợp lệ (24-bit)' : '❌ Vượt 0xFFFFFF – giảm T hoặc dùng prescaler'}`;
});

const rb = new RingBuffer(8);
const drawRing = msg => {
  $('rbView').innerHTML = rb.buf.map((v, i) =>
    `<div class="slot ${v !== null ? 'full' : ''}">${v === null ? '·' : esc(v)}<small>${i === rb.head ? 'W' : ''}${i === rb.tail ? 'R' : ''}</small></div>`).join('');
  $('rbOut').textContent = `${msg || ''}\nhead(W)=${rb.head} tail(R)=${rb.tail} ${rb.isFull() ? '[FULL]' : rb.isEmpty() ? '[EMPTY]' : ''}`;
};
$('rbPut').onclick = () => drawRing(rb.put($('rbVal').value || '?') ? 'Put OK' : 'Buffer đầy – put bị từ chối');
$('rbGet').onclick = () => { const v = rb.get(); drawRing(v === null ? 'Buffer rỗng' : `Get → ${v}`); };
$('rbReset').onclick = () => { rb.reset(); drawRing('Reset'); };
drawRing();

// ---------- Module 3: playground ----------
const editor = CodeMirror.fromTextArea($('editor'), { mode: 'text/x-csrc', lineNumbers: true, theme: 'material-darker', indentUnit: 4, matchBrackets: true });
let exercises = [], current = null;
const loadExercise = i => {
  current = exercises[i];
  $('exDesc').textContent = current.description;
  let saved = null; try { saved = localStorage.getItem('ex-' + current.id); } catch {}
  editor.setValue(saved || current.starter);
  $('checkOut').innerHTML = '';
};
editor.on('change', () => { try { current && localStorage.setItem('ex-' + current.id, editor.getValue()); } catch {} });
$('exSelect').onchange = e => loadExercise(e.target.value);
$('exReset').onclick = () => { editor.setValue(current.starter); };
$('exSolution').onclick = () => { editor.setValue(current.solution); };
let mockHeader = null, marked = [];
const getText = f => fetch(f).then(r => { if (!r.ok) throw new Error('Không tải được ' + f); return r.text(); });
$('checkBtn').onclick = async () => {
  const btn = $('checkBtn');
  btn.disabled = true; btn.textContent = '⏳ Đang biên dịch & chạy...';
  marked.forEach(l => editor.removeLineClass(l, 'background', 'cm-err'));
  marked = [];
  $('checkOut').innerHTML = ''; $('compileLog').textContent = '';
  try {
    mockHeader = mockHeader || await getText('data/stm32_mock.h');
    const harness = await getText(`data/harness/${current.id}.c`);
    const r = await Evaluator.compileAndRun(Evaluator.buildSource(editor.getValue(), harness, mockHeader));
    r.diagnostics.forEach(d => { const h = editor.addLineClass(d.line - 1, 'background', 'cm-err'); if (h) marked.push(h); });
    $('compileLog').textContent = r.log || 'Biên dịch thành công, không có cảnh báo.';
    $('checkOut').innerHTML = !r.compiled ? '<li class="bad">✘ Lỗi biên dịch – sửa lỗi ở trên rồi chạy lại.</li>'
      : r.results.map(x => `<li class="${x.pass ? 'ok' : 'bad'}">${x.pass ? '✔' : '✘'} ${esc(x.msg)}${x.detail && !x.pass ? ' — <i>' + esc(x.detail) + '</i>' : ''}</li>`).join('')
        + `<li><b>Điểm: ${r.score}/${r.total} ${r.total && r.score === r.total ? '🎉 Đạt!' : ''}</b></li>`;
  } catch (e) {
    $('checkOut').innerHTML = `<li class="bad">⚠ ${esc(e.message)} (cần Internet để gọi godbolt.org)</li>`;
  } finally {
    btn.disabled = false; btn.textContent = '▶ Biên dịch & Chấm điểm';
  }
};

// ---------- Data loading ----------
const getJSON = f => fetch('data/' + f).then(r => r.json());
Promise.all([getJSON('theory.json'), getJSON('exercises.json'), getJSON('quiz.json')]).then(([theory, ex, quiz]) => {
  const renderTheory = q => {
    q = q.toLowerCase();
    $('theoryList').innerHTML = theory.filter(t => (t.title + t.content).toLowerCase().includes(q)).map(t =>
      `<details ${q ? 'open' : ''}><summary>${t.title}</summary>${t.content}</details>`).join('') || '<p>Không tìm thấy.</p>';
  };
  $('theorySearch').oninput = e => renderTheory(e.target.value);
  renderTheory('');

  exercises = ex;
  $('exSelect').innerHTML = ex.map((e, i) => `<option value="${i}">${e.title}</option>`).join('');
  loadExercise(0);

  Quiz.render(quiz.questions, $('quizList'), $('score'));
  $('quizReset').onclick = () => { Quiz.reset(); Quiz.render(quiz.questions, $('quizList'), $('score')); };
  Quiz.renderCards(quiz.flashcards, $('cardList'));
}).catch(() => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    '<p class="card" style="color:var(--bad)">Không tải được data/*.json. Hãy chạy qua web server: <code>python3 -m http.server</code> rồi mở http://localhost:8000</p>');
});
