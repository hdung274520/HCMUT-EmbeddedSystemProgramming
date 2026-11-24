/* Embedded C Lab – UI: routing, theory reader, playground, tools. */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = n => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
const icons = () => lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
const fold = s => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: not persisted */ } },
};
const getText = async f => { const r = await fetch(f); if (!r.ok) throw new Error(`Không tải được ${f} (HTTP ${r.status})`); return r.text(); };
const highlight = (code, el) => CodeMirror.runMode(code, 'text/x-csrc', el);

/* ---------------- Theme ---------------- */
$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  store.set('theme', t);
});

/* ---------------- Mobile list toggles ---------------- */
$$('.list-toggle').forEach(b => b.addEventListener('click', () =>
  b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true')));
const collapseLists = () => $$('.list-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));

/* ---------------- Router: #/theory/<id>, #/lab/<id>, #/tools ---------------- */
const views = { theory: showTheory, lab: showLab, tools: () => {} };
let lastView = null;
function route() {
  const [view, id] = location.hash.replace(/^#\/?/, '').split('/');
  const v = views[view] ? view : 'theory';
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  $$('.nav a').forEach(a => { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (lastView && lastView !== v) $('#main').focus({ preventScroll: true });
  lastView = v;
  collapseLists();
  Promise.resolve(views[v](id ? decodeURIComponent(id) : null)).catch(showFatal);
}
function showFatal(e) {
  console.error(e);
  const box = document.createElement('div');
  box.className = 'result';
  box.innerHTML = `<div class="result-body"><p><strong>Lỗi tải dữ liệu.</strong> ${esc(e.message)}</p>
    <p class="muted">Nếu bạn mở file trực tiếp (file://), hãy chạy <code>python3 -m http.server</code> trong thư mục dự án rồi mở http://localhost:8000.</p></div>`;
  $('.view.active').prepend(box);
}
window.addEventListener('hashchange', route);

/* =========================================================================
   THEORY
   ========================================================================= */
let theory = null;   // { groups, flat: [{id,title,group,md,text}] }
async function loadTheory() {
  if (theory) return theory;
  const groups = JSON.parse(await getText('data/theory/index.json'));
  const flat = groups.flatMap(g => g.items.map(it => ({ ...it, group: g.group })));
  await Promise.all(flat.map(async it => {
    it.md = await getText(`data/theory/${it.id}.md`);
    it.text = fold(it.title + ' ' + it.md);
  }));
  theory = { groups, flat };
  renderToc('');
  $('#theorySearch').addEventListener('input', e => renderToc(e.target.value));
  return theory;
}

function renderToc(query) {
  const q = fold(query.trim());
  let n = 0, html = '';
  for (const g of theory.groups) {
    const items = g.items.filter(it => !q || theory.flat.find(f => f.id === it.id).text.includes(q));
    if (!items.length) continue;
    html += `<div class="list-group"><h2>${esc(g.group)}</h2>`;
    for (const it of items) {
      n++;
      const idx = theory.flat.findIndex(f => f.id === it.id) + 1;
      html += `<a class="list-item" href="#/theory/${it.id}" data-id="${it.id}"><span class="num">${String(idx).padStart(2, '0')}</span><span class="label">${esc(it.title)}</span></a>`;
    }
    html += '</div>';
  }
  $('#toc').innerHTML = html;
  $('#searchInfo').textContent = q ? (n ? `${n} chương khớp “${query.trim()}”` : 'Không có chương nào khớp. Thử từ khóa khác.') : '';
  markCurrent('#toc', currentTheoryId);
}

function markCurrent(listSel, id) {
  $$(`${listSel} .list-item`).forEach(a => {
    if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

let currentTheoryId = null;
async function showTheory(id) {
  await loadTheory();
  const i = Math.max(0, theory.flat.findIndex(it => it.id === id));
  const it = theory.flat[i];
  if (it.id === currentTheoryId) return;
  currentTheoryId = it.id;
  markCurrent('#toc', it.id);

  const art = $('#article');
  art.innerHTML = `<p class="eyebrow">${esc(it.group)}</p><div class="prose">${marked.parse(it.md)}</div>`;
  enhanceProse(art);

  const prev = theory.flat[i - 1], next = theory.flat[i + 1];
  art.insertAdjacentHTML('beforeend', `<nav class="article-nav" aria-label="Chương trước/sau">
    ${prev ? `<a href="#/theory/${prev.id}"><small><i data-lucide="arrow-left"></i>Chương trước</small>${esc(prev.title)}</a>` : ''}
    ${next ? `<a class="next" href="#/theory/${next.id}"><small>Chương sau<i data-lucide="arrow-right"></i></small>${esc(next.title)}</a>` : ''}
  </nav>`);
  icons();
  window.scrollTo(0, 0);
  document.title = `${it.title} – Embedded C Lab`;
}

// Tables get a scroll wrapper; code blocks get highlighting, copy and (for ```crun) a run button.
function enhanceProse(root) {
  $$('table', root).forEach(t => { const w = document.createElement('div'); w.className = 'table-wrap'; t.replaceWith(w); w.append(t); });
  $$('pre > code', root).forEach(code => {
    const pre = code.parentElement;
    const lang = (code.className.match(/language-(\w+)/) || [])[1] || '';
    const isC = lang === 'c' || lang === 'crun';
    const src = code.textContent.replace(/\n$/, '');
    pre.className = 'code';
    if (isC) { code.textContent = ''; highlight(src, code); }
    const block = document.createElement('div');
    block.className = 'code-block';
    block.innerHTML = `<div class="code-bar"><span>${lang === 'crun' ? 'C · chạy được' : isC ? 'C' : 'text'}</span><span class="actions">
      <button class="btn btn-ghost btn-sm" type="button" data-act="copy"><i data-lucide="copy"></i><span>Sao chép</span></button>
      ${lang === 'crun' ? '<button class="btn btn-secondary btn-sm" type="button" data-act="run"><i data-lucide="play"></i><span>Chạy thử</span></button>' : ''}
    </span></div>`;
    pre.replaceWith(block);
    block.append(pre);
    block.addEventListener('click', async e => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.act === 'copy') {
        try { await navigator.clipboard.writeText(src); btn.lastElementChild.textContent = 'Đã chép'; }
        catch { btn.lastElementChild.textContent = 'Không chép được'; }
        setTimeout(() => { btn.lastElementChild.textContent = 'Sao chép'; }, 1500);
      } else {
        store.set('code:' + SANDBOX.id, src);
        pendingRun = true;
        location.hash = '#/lab/' + SANDBOX.id;
      }
    });
  });
}

/* =========================================================================
   PLAYGROUND
   ========================================================================= */
const SANDBOX = {
  id: 'tu-do', title: 'Chế độ tự do', group: 'Sandbox', level: '',
  desc: 'Viết một chương trình C đầy đủ có hàm main(). Có sẵn header stm32f4xx.h giả lập (GPIOD, RCC, USART1… là biến trong RAM), nên có thể vừa thao tác thanh ghi vừa printf giá trị ra để quan sát.',
  starter: `#include <stdio.h>
#include <stdint.h>
#include "stm32f4xx.h"

int main(void) {
    uint32_t x = 42;
    uint32_t *p = &x;
    *p += 8;
    printf("x = %u, &x = %p\\n", x, (void *)p);

    GPIOD->MODER = (GPIOD->MODER & ~(3U << 24)) | (1U << 24);
    printf("GPIOD->MODER = 0x%08X\\n", (unsigned)GPIOD->MODER);
    return 0;
}
`,
};
let exGroups = null, exCache = {}, editor = null, current = null, mock = null, pendingRun = false, marks = [];
const passed = new Set(store.get('passed', []));

async function loadExercises() {
  if (exGroups) return;
  exGroups = JSON.parse(await getText('data/exercises/index.json'));
  editor = CodeMirror.fromTextArea($('#editor'), {
    mode: 'text/x-csrc', lineNumbers: true, indentUnit: 4, matchBrackets: true, tabSize: 4,
    extraKeys: { 'Ctrl-Enter': run, 'Cmd-Enter': run, Tab: cm => cm.execCommand('insertSoftTab') },
  });
  editor.on('change', () => { if (current) store.set('code:' + current.id, editor.getValue()); });
  $('#runBtn').addEventListener('click', run);
  $('#resetBtn').addEventListener('click', () => {
    editor.setValue(current.starter);
    $('#editorNote').textContent = 'Đã đặt lại code ban đầu. Nhấn Ctrl+Z để hoàn tác.';
  });
  renderExList();
}

const allExIds = () => exGroups.flatMap(g => g.items);
function renderExList() {
  let html = `<div class="list-group"><a class="list-item" href="#/lab/${SANDBOX.id}" data-id="${SANDBOX.id}"><i data-lucide="flask-conical"></i><span class="label">${SANDBOX.title}</span></a></div>`;
  let n = 0;
  for (const g of exGroups) {
    html += `<div class="list-group"><h2>${esc(g.group)}</h2>`;
    for (const id of g.items) {
      n++;
      const ok = passed.has(id);
      html += `<a class="list-item" href="#/lab/${id}" data-id="${id}">
        <i data-lucide="${ok ? 'circle-check' : 'circle'}" class="${ok ? 'done' : 'todo'}"></i>
        <span class="label">${esc(exCache[id]?.title || id)}</span>
        <span class="sr-only">${ok ? '(đã đạt)' : ''}</span></a>`;
    }
    html += '</div>';
  }
  $('#exList').innerHTML = html;
  const done = allExIds().filter(id => passed.has(id)).length;
  $('#progressText').textContent = `${done}/${n}`;
  $('#progressBar').style.width = (n ? done / n * 100 : 0) + '%';
  markCurrent('#exList', current?.id);
  icons();
}

async function getExercise(id) {
  if (id === SANDBOX.id) return SANDBOX;
  if (!exCache[id]) {
    const e = Evaluator.parseExercise(await getText(`data/exercises/${id}.c`));
    exCache[id] = { ...e, id, group: exGroups.find(g => g.items.includes(id)).group };
  }
  return exCache[id];
}

async function showLab(id) {
  await loadExercises();
  // titles for the list come from the files themselves; fetch them once in the background
  if (!Object.keys(exCache).length) Promise.all(allExIds().map(getExercise)).then(renderExList).catch(() => {});
  const ids = allExIds();
  const target = id === SANDBOX.id || ids.includes(id) ? id : ids[0];
  if (target !== id) { history.replaceState(null, '', '#/lab/' + target); }
  const ex = await getExercise(target);
  if (current?.id !== ex.id) loadIntoEditor(ex);
  editor.refresh();
  if (pendingRun) { pendingRun = false; run(); }
}

function loadIntoEditor(ex) {
  current = ex;
  markCurrent('#exList', ex.id);
  $('#exGroup').textContent = ex.group;
  $('#exLevel').textContent = ex.level || '';
  $('#exTitle').textContent = ex.title;
  $('#exDesc').innerHTML = esc(ex.desc);
  $('#exHint').hidden = !ex.hint;
  $('#exHint').open = false;
  $('#exHint p').textContent = ex.hint || '';
  $('#exSolution').hidden = !ex.solution;
  $('#exSolution').open = false;
  const sol = $('#exSolution code');
  sol.textContent = '';
  if (ex.solution) highlight(ex.solution.trimEnd(), sol);
  editor.setValue(store.get('code:' + ex.id, ex.starter));
  editor.clearHistory();
  $('#runBtn span').textContent = ex.test ? 'Biên dịch & chấm' : 'Biên dịch & chạy';
  $('#editorNote').textContent = '';
  setStatus('idle', 'Chưa chạy');
  $('#resultBody').innerHTML = `<p class="muted">${ex.test
    ? 'Bộ test sẽ gọi hàm của bạn với nhiều trường hợp (kể cả biên và thanh ghi có giá trị “rác” sẵn) rồi kiểm tra kết quả.'
    : 'Chương trình chạy trên máy chủ godbolt.org; mọi thứ in bằng printf hiện ở phần Output.'}</p>`;
  document.title = `${ex.title} – Playground`;
}

function setStatus(kind, text) {
  const icon = { idle: 'circle-dashed', busy: 'loader', pass: 'circle-check', fail: 'circle-x' }[kind];
  $('#resultStatus').className = 'status status-' + kind;
  $('#resultStatus').innerHTML = `<i data-lucide="${icon}"></i>${esc(text)}`;
  icons();
}

async function run() {
  const btn = $('#runBtn');
  if (btn.disabled || !current) return;
  btn.disabled = true;
  setStatus('busy', 'Đang biên dịch…');
  marks.forEach(m => editor.removeLineClass(m.line, 'background', m.cls));
  marks = [];
  const ex = current;
  try {
    mock = mock || await getText('data/stm32_mock.h');
    const r = await Evaluator.compileAndRun(Evaluator.buildSource(editor.getValue(), ex.test || '', mock));
    if (current !== ex) return;           // user switched exercise while waiting
    renderResult(r, ex);
  } catch (e) {
    setStatus('fail', 'Không kết nối được');
    $('#resultBody').innerHTML = `<p>${esc(e.message)}</p><p class="muted">Cần Internet để gọi trình biên dịch trên godbolt.org. Kiểm tra kết nối rồi thử lại.</p>`;
  } finally {
    btn.disabled = false;
  }
}

function renderResult(r, ex) {
  for (const d of r.diagnostics) {
    const cls = d.error ? 'cm-err-line' : 'cm-warn-line';
    if (d.line >= 1 && d.line <= editor.lineCount()) marks.push({ line: editor.addLineClass(d.line - 1, 'background', cls), cls });
  }
  const parts = [];
  if (!r.compiled) {
    setStatus('fail', 'Lỗi biên dịch');
    parts.push(`<p>Trình biên dịch báo lỗi – các dòng liên quan được tô đỏ trong editor.</p>`);
  } else if (ex.test) {
    const ok = r.total > 0 && r.score === r.total;
    setStatus(ok ? 'pass' : 'fail', ok ? `Đạt ${r.score}/${r.total}` : `${r.score}/${r.total} test đạt`);
    parts.push(`<div class="score"><div class="progress-bar"><span style="width:${r.total ? r.score / r.total * 100 : 0}%"></span></div><strong>${r.score}/${r.total}</strong></div>`);
    parts.push('<ul class="checks">' + r.results.map(c => `<li class="${c.pass ? 'ok' : 'bad'}">
      <i data-lucide="${c.pass ? 'check' : 'x'}"></i><span><span class="sr-only">${c.pass ? 'Đạt: ' : 'Trượt: '}</span>${esc(c.msg)}
      ${!c.pass && c.detail ? `<span class="detail">${esc(c.detail)}</span>` : ''}</span></li>`).join('') + '</ul>');
    if (ok && !passed.has(ex.id)) { passed.add(ex.id); store.set('passed', [...passed]); renderExList(); }
  } else {
    const ok = r.exitCode === 0 && !r.results.length;
    setStatus(ok ? 'pass' : 'fail', ok ? 'Chạy xong' : `Mã thoát ${r.exitCode}`);
    if (r.results.length) parts.push('<ul class="checks">' + r.results.map(c => `<li class="bad"><i data-lucide="x"></i><span>${esc(c.msg)}<span class="detail">${esc(c.detail)}</span></span></li>`).join('') + '</ul>');
  }
  if (r.output) parts.push(`<div class="out-block"><h4><i data-lucide="terminal"></i>Output (stdout)</h4><pre>${esc(r.output)}</pre></div>`);
  if (r.log) parts.push(`<div class="out-block"><h4><i data-lucide="file-warning"></i>Thông báo trình biên dịch</h4><pre class="${r.compiled ? '' : 'log-error'}">${esc(r.log)}</pre></div>`);
  $('#resultBody').innerHTML = parts.join('');
  icons();
}

/* =========================================================================
   TOOLS
   ========================================================================= */
function bindTool(form, compute) {
  const err = $('.field-error', form), out = $('.out', form);
  const update = () => {
    $$('input', form).forEach(i => i.removeAttribute('aria-invalid'));
    try {
      out.innerHTML = compute(Object.fromEntries(new FormData(form)));
      err.textContent = '';
    } catch (e) {
      err.textContent = e.message;
      $$('input', form).forEach(i => i.setAttribute('aria-invalid', 'true'));
    }
  };
  form.addEventListener('input', update);
  form.addEventListener('submit', e => e.preventDefault());
  update();
}
const row = (k, v, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;

bindTool($('#toolBitband'), f => {
  const addr = Number.parseInt(f.addr, 16);
  if (!/^\s*(0x)?[0-9a-f]+\s*$/i.test(f.addr) || Number.isNaN(addr)) throw new Error('Địa chỉ phải là số hex, ví dụ 0x40020C14.');
  if (f.bit === '' || !Number.isInteger(+f.bit)) throw new Error('Bit phải là số nguyên 0–31.');
  const r = Calc.bitband(addr, +f.bit);
  return row('Vùng', r.region) + row('Byte offset', hex(r.offset)) + row('Alias', hex(r.alias), 'key')
    + `<div class="code-line">*(volatile uint32_t *)${hex(r.alias)} = 1;</div>`;
});
bindTool($('#toolBrr'), f => {
  const r = Calc.usartBrr(+f.clk, +f.baud);
  const err = Math.abs(r.errPct);
  return row('USARTDIV', r.div.toFixed(4)) + row('DIV_Mantissa', `${r.mant} (0x${r.mant.toString(16).toUpperCase()})`)
    + row('DIV_Fraction', `${r.frac} (0x${r.frac.toString(16).toUpperCase()})`) + row('USART_BRR', hex(r.brr), 'key')
    + row('Baud thực tế', r.real.toFixed(1)) + row('Sai số', `${r.errPct.toFixed(2)} %${err > 2 ? ' – quá lớn' : ''}`, err > 2 ? 'bad' : '')
    + `<div class="code-line">USARTx->BRR = ${hex(r.brr)};</div>`;
});
bindTool($('#toolSystick'), f => {
  if (!(+f.clk > 0) || !(+f.ms > 0)) throw new Error('Tần số và thời gian phải lớn hơn 0.');
  const r = Calc.systick(+f.clk, +f.ms);
  const maxMs = (0x1000000 / +f.clk * 1000).toFixed(2);
  return row('Số xung', r.ticks.toLocaleString('vi-VN')) + row('SYST_RVR', `${r.rvr.toLocaleString('vi-VN')} (${hex(r.rvr)})`, r.ok ? 'key' : 'bad')
    + row('Hợp lệ 24 bit', r.ok ? 'Có' : `Không – T tối đa ${maxMs} ms`, r.ok ? '' : 'bad')
    + (r.ok ? `<div class="code-line">SysTick->LOAD = ${r.rvr}; SysTick->VAL = 0; SysTick->CTRL = 7;</div>` : '');
});

const rb = new RingBuffer(8);
function drawRing(msg) {
  $('#rbView').innerHTML = rb.buf.map((v, i) => `<div class="slot ${v !== null ? 'full' : ''}">
    <span class="ptr">${i === rb.head ? '<span class="w">W</span>' : ''}${i === rb.tail ? '<span class="r">R</span>' : ''}</span>
    ${v === null ? '·' : esc(v)}<span class="idx">${i}</span></div>`).join('');
  const count = (rb.head - rb.tail + rb.size) % rb.size;
  $('#rbView').setAttribute('aria-label', `Ring buffer chứa ${count}/${rb.size - 1} byte, head = ${rb.head}, tail = ${rb.tail}`);
  $('#rbOut').textContent = `${msg} · head(W) = ${rb.head}, tail(R) = ${rb.tail}, đang chứa ${count}/${rb.size - 1}${rb.isFull() ? ' · ĐẦY' : rb.isEmpty() ? ' · RỖNG' : ''}`;
}
$('#rbPut').addEventListener('click', () => {
  const v = $('#rbVal').value || '?';
  drawRing(rb.put(v) ? `put('${v}') → true` : `put('${v}') → false (đầy)`);
  $('#rbVal').value = String.fromCharCode(((v.charCodeAt(0) - 64) % 26) + 65);   // next letter
});
$('#rbGet').addEventListener('click', () => { const v = rb.get(); drawRing(v === null ? 'get() → false (rỗng)' : `get() → '${v}'`); });
$('#rbReset').addEventListener('click', () => { rb.reset(); drawRing('reset'); });
drawRing('Khởi tạo: head = tail = 0');

/* ---------------- Start ---------------- */
icons();
route();
