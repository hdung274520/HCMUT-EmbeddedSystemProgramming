/* Embedded C Lab — UI Controller: 3-region layout, theory reader, split mode, GCC playground & hardware tools. */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = (n) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch { /* private mode */ }
    }
  };

  async function getText(file) {
    const r = await fetch(file);
    if (!r.ok) throw new Error(`Không tải được ${file} (HTTP ${r.status})`);
    return r.text();
  }

  function highlightC(code, el) {
    if (window.CodeMirror && typeof CodeMirror.runMode === 'function') {
      CodeMirror.runMode(code, 'text/x-csrc', el);
    } else {
      el.textContent = code;
    }
  }

  const SANDBOX = {
    id: 'tu-do',
    title: 'Chế độ tự do',
    group: 'Sandbox',
    level: '',
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
`
  };

  let currentViewMode = 'theory'; // 'theory' | 'playground' | 'split' | 'tools'
  let sidebarSearchQuery = '';
  let theory = null;
  let currentTheoryId = null;

  let exGroups = null;
  const exCache = {};
  let editor = null;
  let currentEx = null;
  let mockHeader = null;
  let pendingRun = false;
  let lineMarks = [];
  let isOutputExpanded = false;
  let toastTimer = null;
  const passed = new Set(store.get('passed', []));

  /* ---------------- Notifications & Status ---------------- */
  function showToast(message) {
    const toast = $('#toastNotification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-2');
    }, 2200);
  }

  function updateCompilerBadge(state, message) {
    const badge = $('#compilerStatusBadge');
    const dot = $('#compilerStatusDot');
    const text = $('#compilerStatusText');
    if (!badge || !dot || !text) return;

    text.textContent = message;
    badge.className = 'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono border mb-2 transition-colors ';
    if (state === 'busy') {
      badge.className += 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25';
      dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0';
    } else if (state === 'error') {
      badge.className += 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';
      dot.className = 'w-2 h-2 rounded-full bg-rose-400 shrink-0';
    } else {
      badge.className += 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 shrink-0';
    }
  }

  /* ---------------- Theme ---------------- */
  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    store.set('theme', isDark ? 'dark' : 'light');
  }

  /* ---------------- Mobile Drawer ---------------- */
  function openMobileDrawer() {
    $('#lessonSidebar')?.classList.remove('-translate-x-full');
    $('#mobileDrawerBackdrop')?.classList.remove('hidden');
  }

  function closeMobileDrawer() {
    $('#lessonSidebar')?.classList.add('-translate-x-full');
    $('#mobileDrawerBackdrop')?.classList.add('hidden');
  }

  /* ---------------- Layout Mode Switcher ---------------- */
  function applyViewModeUI(mode) {
    currentViewMode = mode;
    const workspace = $('#workspaceContainer');
    const theoryPane = $('#theoryPane');
    const playgroundPane = $('#playgroundPane');
    const toolsPane = $('#toolsPane');
    const resizer = $('#paneResizer');
    const sidebar = $('#lessonSidebar');
    const mobileMenuBtn = $('#mobileMenuBtn');
    const readingWrapper = $('#readingMaxWrapper');
    const quickSplitLabel = $('#quickSplitLabel');
    const progressCard = $('#sidebarProgressCard');

    $$('.rail-nav-btn').forEach((btn) => {
      const active = btn.dataset.modeSwitch === mode;
      btn.className = 'rail-nav-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ' + (
        active
          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-surface-850 border border-transparent'
      );
    });

    $$('.mobile-mode-btn').forEach((btn) => {
      const active = btn.dataset.modeSwitch === mode || (mode === 'split' && btn.dataset.modeSwitch === 'playground');
      btn.className = 'mobile-mode-btn px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition ' + (
        active
          ? 'bg-white dark:bg-surface-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
          : 'text-slate-600 dark:text-slate-400'
      );
    });

    $$('.theory-top-tab').forEach((btn) => {
      const active = btn.dataset.modeSwitch === mode || (mode === 'split' && btn.dataset.modeSwitch === 'theory');
      btn.className = 'theory-top-tab px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ' + (
        active
          ? 'bg-white dark:bg-surface-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
      );
    });

    workspace.classList.remove('split-active');
    toolsPane.classList.add('hidden');
    theoryPane.classList.add('hidden');
    theoryPane.classList.remove('flex');
    playgroundPane.classList.add('hidden');
    playgroundPane.classList.remove('flex');
    resizer.classList.add('hidden');
    resizer.classList.remove('lg:flex');

    if (mode === 'theory') {
      theoryPane.classList.remove('hidden');
      theoryPane.classList.add('flex');
      sidebar.classList.remove('hidden', 'lg:hidden');
      sidebar.classList.add('lg:flex');
      mobileMenuBtn?.classList.remove('hidden');
      progressCard.classList.add('hidden');
      readingWrapper.classList.add('max-w-4xl');
      if (quickSplitLabel) quickSplitLabel.textContent = 'Mở Code song song';
    } else if (mode === 'playground') {
      playgroundPane.classList.remove('hidden');
      playgroundPane.classList.add('flex');
      sidebar.classList.remove('hidden', 'lg:hidden');
      sidebar.classList.add('lg:flex');
      mobileMenuBtn?.classList.remove('hidden');
      progressCard.classList.remove('hidden');
      setTimeout(() => editor?.refresh(), 30);
    } else if (mode === 'split') {
      workspace.classList.add('split-active');
      theoryPane.classList.remove('hidden');
      theoryPane.classList.add('flex');
      playgroundPane.classList.remove('hidden');
      playgroundPane.classList.add('flex');
      resizer.classList.remove('hidden');
      resizer.classList.add('lg:flex');
      sidebar.classList.remove('hidden', 'lg:flex');
      sidebar.classList.add('lg:hidden');
      mobileMenuBtn?.classList.remove('hidden');
      progressCard.classList.add('hidden');
      readingWrapper.classList.remove('max-w-4xl');
      if (quickSplitLabel) quickSplitLabel.textContent = 'Thu về chế độ đọc';
      setTimeout(() => editor?.refresh(), 30);
    } else {
      toolsPane.classList.remove('hidden');
      sidebar.classList.remove('lg:flex');
      sidebar.classList.add('hidden');
      mobileMenuBtn?.classList.add('hidden');
      progressCard.classList.add('hidden');
    }
  }

  function navigateToMode(mode) {
    if (mode === 'theory') {
      location.hash = `#/theory/${encodeURIComponent(currentTheoryId || 'c-types')}`;
    } else if (mode === 'playground') {
      location.hash = `#/lab/${encodeURIComponent(currentEx?.id || 'c-swap')}`;
    } else if (mode === 'split') {
      if (window.innerWidth < 1024) {
        location.hash = `#/lab/${encodeURIComponent(currentEx?.id || 'c-swap')}`;
      } else {
        location.hash = `#/split/${encodeURIComponent(currentTheoryId || 'c-types')}`;
      }
    } else {
      location.hash = '#/tools';
    }
  }

  /* =========================================================================
     THEORY
     ========================================================================= */
  async function loadTheory() {
    if (theory) return theory;
    const groups = JSON.parse(await getText('data/theory/index.json'));
    const flat = groups.flatMap((g, gIdx) => g.items.map((it) => ({ ...it, group: g.group, groupIdx: gIdx })));
    await Promise.all(flat.map(async (it) => {
      it.md = await getText(`data/theory/${it.id}.md`);
      it.text = fold(`${it.title} ${it.group} ${it.md}`);
    }));
    theory = { groups, flat };
    populateTheorySelect();
    return theory;
  }

  function populateTheorySelect() {
    const sel = $('#theoryChapterSelect');
    if (!sel || !theory) return;
    sel.innerHTML = theory.flat.map((it, idx) =>
      `<option value="${esc(it.id)}">${String(idx + 1).padStart(2, '0')}. ${esc(it.title)}</option>`
    ).join('');
    if (currentTheoryId) sel.value = currentTheoryId;
  }

  function renderTheorySidebar() {
    if (!theory) return;
    const container = $('#sidebarListContainer');
    const searchInput = $('#sidebarSearchInput');
    if (searchInput) searchInput.placeholder = 'Tìm: con trỏ, BSRR, mutex...';

    const q = fold(sidebarSearchQuery.trim());
    let html = '';
    let matchCount = 0;

    for (const g of theory.groups) {
      const items = g.items.filter((it) => {
        if (!q) return true;
        const entry = theory.flat.find((f) => f.id === it.id);
        return entry && entry.text.includes(q);
      });
      if (!items.length) continue;

      const itemsHtml = items.map((it) => {
        matchCount++;
        const idx = theory.flat.findIndex((f) => f.id === it.id) + 1;
        const numStr = String(idx).padStart(2, '0');
        const isActive = it.id === currentTheoryId;
        return `
          <a href="#/${currentViewMode === 'split' ? 'split' : 'theory'}/${encodeURIComponent(it.id)}"
             data-sidebar-theory="${esc(it.id)}"
             class="w-full text-left px-3 py-2.5 rounded-lg border transition cursor-pointer flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
               isActive
                 ? 'bg-white dark:bg-surface-800 border-slate-300 dark:border-slate-700/90 text-slate-900 dark:text-white shadow-xs'
                 : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-surface-850 hover:text-slate-900 dark:hover:text-slate-200'
             }">
            <span class="font-mono text-[11px] font-semibold mt-0.5 shrink-0 ${
              isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
            }">${numStr}</span>
            <span class="text-[13px] leading-snug ${isActive ? 'font-semibold' : 'font-normal'}">${esc(it.title)}</span>
          </a>
        `;
      }).join('');

      html += `
        <div>
          <div class="px-2.5 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            ${esc(g.group)}
          </div>
          <div class="space-y-1">${itemsHtml}</div>
        </div>
      `;
    }

    if (matchCount === 0) {
      html = `
        <div class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Không tìm thấy chương phù hợp với từ khóa "<strong>${esc(sidebarSearchQuery.trim())}</strong>".
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function extractLeadSummary(md) {
    const lines = md.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('|') || trimmed.startsWith('```') || trimmed.startsWith('-') || trimmed.startsWith('>')) continue;
      return trimmed.replace(/\*\*/g, '').replace(/`/g, '');
    }
    return '';
  }

  async function showTheory(id, forceRender = false) {
    await loadTheory();
    const foundIdx = theory.flat.findIndex((it) => it.id === id);
    const idx = foundIdx >= 0 ? foundIdx : 0;
    const it = theory.flat[idx];

    if (it.id === currentTheoryId && !forceRender) {
      renderTheorySidebar();
      return;
    }
    currentTheoryId = it.id;
    const sel = $('#theoryChapterSelect');
    if (sel) sel.value = it.id;

    renderTheorySidebar();

    const runnableCount = (it.md.match(/```crun\n/g) || []).length;
    const codeCount = (it.md.match(/```c\n/g) || []).length;
    const lead = extractLeadSummary(it.md);
    const numStr = String(idx + 1).padStart(2, '0');
    const totalStr = String(theory.flat.length).padStart(2, '0');

    const hero = $('#moduleHeroCard');
    hero.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span class="font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          STM32 • ${esc(it.group)}
        </span>
        <span class="font-mono text-[11px] text-slate-500 dark:text-slate-400">
          Chương ${numStr}/${totalStr}${runnableCount ? ` • ${runnableCount} ví dụ chạy GCC` : codeCount ? ` • ${codeCount} đoạn mã C` : ''}
        </span>
      </div>
      <h2 class="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
        ${esc(it.title)}
      </h2>
      ${lead ? `<p class="mt-2 text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">${esc(lead)}</p>` : ''}
    `;

    const body = $('#leftDynamicBody');
    body.innerHTML = `
      ${marked.parse(it.md)}
      <div class="mt-8 p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-surface-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">Thực hành &amp; Kiểm chứng mã C trên GCC 15</p>
          <p class="text-xs text-slate-600 dark:text-slate-400 mb-0">Mở Playground để giải 23 bài tập chấm tự động hoặc thử code song song ngay cạnh lý thuyết.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" data-open-split="true"
                  class="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-200/80 hover:bg-slate-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-slate-800 dark:text-slate-200 transition cursor-pointer">
            Mở Code song song
          </button>
          <button type="button" data-open-lab="true"
                  class="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer">
            Làm bài tập Playground →
          </button>
        </div>
      </div>
    `;

    enhanceProse(body);

    const prevBtn = $('#prevModuleBtn');
    const nextBtn = $('#nextModuleBtn');
    const prev = theory.flat[idx - 1];
    const next = theory.flat[idx + 1];

    if (prevBtn) {
      prevBtn.disabled = !prev;
      prevBtn.dataset.gotoTheory = prev ? prev.id : '';
      prevBtn.textContent = prev ? `← ${prev.title}` : '← Chương trước';
    }
    if (nextBtn) {
      nextBtn.disabled = !next;
      nextBtn.dataset.gotoTheory = next ? next.id : '';
      nextBtn.textContent = next ? `${next.title} →` : 'Chương tiếp theo →';
    }

    const scrollEl = $('#leftContentScroll');
    if (scrollEl) scrollEl.scrollTop = 0;
    document.title = `${it.title} — Embedded C Lab`;
  }

  function enhanceProse(root) {
    $$('table', root).forEach((t) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.replaceWith(w);
      w.append(t);
    });

    $$('pre > code', root).forEach((code) => {
      const pre = code.parentElement;
      const lang = (code.className.match(/language-(\w+)/) || [])[1] || '';
      const isC = lang === 'c' || lang === 'crun';
      const src = code.textContent.replace(/\n$/, '');
      pre.className = 'code';
      if (isC) {
        code.textContent = '';
        highlightC(src, code);
      }

      const block = document.createElement('div');
      block.className = 'code-block';
      block.innerHTML = `
        <div class="code-bar">
          <span class="font-semibold">${lang === 'crun' ? 'C · chạy được (GCC)' : isC ? 'C' : 'text'}</span>
          <span class="flex items-center gap-1.5">
            <button type="button" data-act="copy"
                    class="px-2 py-1 rounded text-[11px] font-sans font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-800 transition cursor-pointer">
              Sao chép
            </button>
            ${lang === 'crun' ? `
              <button type="button" data-act="run"
                      class="px-2.5 py-1 rounded text-[11px] font-sans font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer">
                ▶ Chạy thử
              </button>` : ''}
          </span>
        </div>
      `;
      pre.replaceWith(block);
      block.append(pre);

      block.addEventListener('click', async (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.act === 'copy') {
          try {
            await navigator.clipboard.writeText(src);
            btn.textContent = '✓ Đã chép';
            showToast('Đã sao chép đoạn mã C');
          } catch {
            btn.textContent = 'Không chép được';
          }
          setTimeout(() => { btn.textContent = 'Sao chép'; }, 1500);
        } else if (btn.dataset.act === 'run') {
          store.set('code:' + SANDBOX.id, src);
          pendingRun = true;
          if (currentEx && currentEx.id === SANDBOX.id && editor) {
            editor.setValue(src);
          }
          if (window.innerWidth >= 1024) {
            if (currentViewMode === 'split') {
              await showLab(SANDBOX.id);
            } else {
              location.hash = `#/split/${encodeURIComponent(currentTheoryId || 'c-types')}`;
            }
          } else {
            location.hash = '#/lab/' + SANDBOX.id;
          }
        }
      });
    });
  }

  /* =========================================================================
     PLAYGROUND & EXERCISES
     ========================================================================= */
  function initEditor() {
    if (editor) return;
    const textarea = $('#editor');
    if (!textarea) return;

    if (window.CodeMirror) {
      editor = CodeMirror.fromTextArea(textarea, {
        mode: 'text/x-csrc',
        theme: 'dracula',
        lineNumbers: true,
        matchBrackets: true,
        styleActiveLine: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        extraKeys: {
          'Ctrl-Enter': () => runCurrentCode(),
          'Cmd-Enter': () => runCurrentCode(),
          'Tab': (cm) => {
            if (cm.somethingSelected()) cm.indentSelection('add');
            else cm.replaceSelection('    ', 'end');
          },
          'Shift-Tab': (cm) => cm.indentSelection('subtract')
        }
      });
      editor.on('change', () => {
        if (currentEx) store.set('code:' + currentEx.id, editor.getValue());
      });
    }
  }

  async function loadExercises() {
    initEditor();
    if (exGroups) return;
    exGroups = JSON.parse(await getText('data/exercises/index.json'));
    populateExerciseSelect();
    await Promise.all(allExIds().map(getExercise));
    populateExerciseSelect();
    if (currentViewMode === 'playground') renderExerciseSidebar();
  }

  const allExIds = () => (exGroups ? exGroups.flatMap((g) => g.items) : []);

  async function getExercise(id) {
    if (id === SANDBOX.id) return SANDBOX;
    if (!exCache[id]) {
      const e = Evaluator.parseExercise(await getText(`data/exercises/${id}.c`));
      const groupObj = exGroups.find((g) => g.items.includes(id));
      exCache[id] = { ...e, id, group: groupObj ? groupObj.group : '' };
    }
    return exCache[id];
  }

  function populateExerciseSelect() {
    const sel = $('#exerciseSelect');
    if (!sel || !exGroups) return;

    let html = `<option value="${SANDBOX.id}">⚡ ${SANDBOX.title} (Sandbox)</option>`;
    let idx = 0;
    for (const g of exGroups) {
      html += `<optgroup label="${esc(g.group)}">`;
      for (const id of g.items) {
        idx++;
        const ex = exCache[id];
        const ok = passed.has(id);
        const label = `${String(idx).padStart(2, '0')}. ${ex ? ex.title : id}${ok ? ' ✓' : ''}`;
        html += `<option value="${esc(id)}">${esc(label)}</option>`;
      }
      html += `</optgroup>`;
    }
    sel.innerHTML = html;
    if (currentEx) sel.value = currentEx.id;
  }

  function renderExerciseSidebar() {
    if (!exGroups) return;
    const container = $('#sidebarListContainer');
    const searchInput = $('#sidebarSearchInput');
    if (searchInput) searchInput.placeholder = 'Tìm bài tập: con trỏ, GPIO, UART...';

    const q = fold(sidebarSearchQuery.trim());
    const ids = allExIds();
    const totalCount = ids.length;
    const doneCount = ids.filter((id) => passed.has(id)).length;

    $('#progressText').textContent = `${doneCount}/${totalCount}`;
    $('#progressBar').style.width = (totalCount ? (doneCount / totalCount) * 100 : 0) + '%';

    let html = '';
    let matchCount = 0;

    if (!q || fold(SANDBOX.title + ' sandbox').includes(q)) {
      const isSandboxActive = currentEx?.id === SANDBOX.id;
      html += `
        <div>
          <div class="px-2.5 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            SANDBOX
          </div>
          <a href="#/lab/${SANDBOX.id}" data-sidebar-ex="${SANDBOX.id}"
             class="w-full text-left px-3 py-2.5 rounded-lg border transition cursor-pointer flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
               isSandboxActive
                 ? 'bg-white dark:bg-surface-800 border-slate-300 dark:border-slate-700/90 text-slate-900 dark:text-white shadow-xs'
                 : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-surface-850 hover:text-slate-900 dark:hover:text-slate-200'
             }">
            <span class="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">★</span>
            <span class="text-[13px] ${isSandboxActive ? 'font-semibold' : 'font-normal'}">${esc(SANDBOX.title)}</span>
          </a>
        </div>
      `;
    }

    let runningNum = 0;
    for (const g of exGroups) {
      const itemsHtml = g.items.map((id) => {
        runningNum++;
        const ex = exCache[id];
        const title = ex ? ex.title : id;
        const haystack = fold(`${id} ${title} ${g.group} ${ex?.desc || ''}`);
        if (q && !haystack.includes(q)) return '';

        matchCount++;
        const ok = passed.has(id);
        const isActive = currentEx?.id === id;
        const numStr = String(runningNum).padStart(2, '0');

        return `
          <a href="#/lab/${esc(id)}" data-sidebar-ex="${esc(id)}"
             class="w-full text-left px-3 py-2.5 rounded-lg border transition cursor-pointer flex items-start gap-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
               isActive
                 ? 'bg-white dark:bg-surface-800 border-slate-300 dark:border-slate-700/90 text-slate-900 dark:text-white shadow-xs'
                 : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-surface-850 hover:text-slate-900 dark:hover:text-slate-200'
             }">
            <span class="font-mono text-[11px] font-semibold mt-0.5 shrink-0 ${
              ok ? 'text-emerald-500' : isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
            }">${ok ? '✓' : numStr}</span>
            <span class="text-[13px] leading-snug ${isActive ? 'font-semibold' : 'font-normal'}">${esc(title)}</span>
          </a>
        `;
      }).filter(Boolean).join('');

      if (itemsHtml) {
        html += `
          <div>
            <div class="px-2.5 pb-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ${esc(g.group)}
            </div>
            <div class="space-y-1">${itemsHtml}</div>
          </div>
        `;
      }
    }

    if (matchCount === 0 && !html) {
      html = `
        <div class="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Không tìm thấy bài tập phù hợp với từ khóa "<strong>${esc(sidebarSearchQuery.trim())}</strong>".
        </div>
      `;
    }
    container.innerHTML = html;
  }

  async function showLab(id) {
    await loadExercises();
    const ids = allExIds();
    const target = id === SANDBOX.id || ids.includes(id) ? id : (currentEx?.id || ids[0]);
    const ex = await getExercise(target);

    if (currentEx?.id !== ex.id) {
      loadExerciseIntoEditor(ex);
    } else if (editor) {
      const storedCode = store.get('code:' + ex.id, ex.starter);
      if (ex.id === SANDBOX.id && editor.getValue() !== storedCode) {
        editor.setValue(storedCode);
      }
    }

    if (currentViewMode === 'playground') renderExerciseSidebar();
    setTimeout(() => editor?.refresh(), 30);

    if (pendingRun) {
      pendingRun = false;
      runCurrentCode();
    }
  }

  function loadExerciseIntoEditor(ex) {
    currentEx = ex;
    const sel = $('#exerciseSelect');
    if (sel) sel.value = ex.id;

    $('#exGroup').textContent = ex.group || 'Playground';
    $('#exLevel').textContent = ex.level || '';
    $('#exTitle').textContent = ex.title;
    $('#exDesc').innerHTML = esc(ex.desc || '');

    const hintEl = $('#exHint');
    hintEl.hidden = !ex.hint;
    hintEl.open = false;
    $('p', hintEl).textContent = ex.hint || '';

    const solEl = $('#exSolution');
    solEl.hidden = !ex.solution;
    solEl.open = false;
    const solCode = $('code', solEl);
    solCode.textContent = '';
    if (ex.solution) highlightC(ex.solution.trimEnd(), solCode);

    const codeVal = store.get('code:' + ex.id, ex.starter);
    if (editor) {
      editor.setValue(codeVal);
      editor.clearHistory();
    } else {
      $('#editor').value = codeVal;
    }

    $('#runBtnLabel').textContent = ex.test ? 'Biên dịch & chấm' : 'Biên dịch & chạy';
    $('#editorNote').textContent = '';
    setResultStatus('idle', 'Chưa chạy');
    $('#resultBody').innerHTML = `<p class="text-slate-400 leading-relaxed">${
      ex.test
        ? 'Bộ test sẽ gọi hàm của bạn với nhiều trường hợp (kể cả biên và thanh ghi có giá trị “rác” sẵn) rồi kiểm tra kết quả.'
        : 'Chương trình chạy trên máy chủ godbolt.org; mọi thứ in bằng printf hiện ở phần Output.'
    }</p>`;

    if (currentViewMode === 'playground') {
      document.title = `${ex.title} — Embedded C Lab`;
    }
  }

  function setResultStatus(kind, text) {
    const el = $('#resultStatus');
    if (!el) return;
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ';
    if (kind === 'busy') {
      el.className = base + 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    } else if (kind === 'pass') {
      el.className = base + 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (kind === 'fail') {
      el.className = base + 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    } else {
      el.className = base + 'bg-surface-850 text-slate-400 border-slate-700/80';
    }
    el.textContent = text;
  }

  async function runCurrentCode() {
    const btn = $('#runBtn');
    const iconPlay = $('#runIconPlay');
    const iconSpin = $('#runIconSpinner');
    const btnLabel = $('#runBtnLabel');
    if (!btn || btn.disabled || !currentEx) return;

    btn.disabled = true;
    iconPlay.classList.add('hidden');
    iconSpin.classList.remove('hidden');
    btnLabel.textContent = 'Đang biên dịch...';
    setResultStatus('busy', 'Đang biên dịch…');
    updateCompilerBadge('busy', 'Đang biên dịch GCC...');

    if (editor) {
      lineMarks.forEach((m) => editor.removeLineClass(m.line, 'background', m.cls));
    }
    lineMarks = [];

    const ex = currentEx;
    const sourceCode = editor ? editor.getValue() : $('#editor').value;

    try {
      mockHeader = mockHeader || await getText('data/stm32_mock.h');
      const res = await Evaluator.compileAndRun(Evaluator.buildSource(sourceCode, ex.test || '', mockHeader));
      if (currentEx !== ex) return;
      renderResult(res, ex);
      updateCompilerBadge('ready', 'GCC 15 • Sẵn sàng');
    } catch (err) {
      setResultStatus('fail', 'Không kết nối được');
      updateCompilerBadge('error', 'Lỗi kết nối GCC');
      $('#resultBody').innerHTML = `
        <div class="rounded-xl border border-rose-800/60 bg-rose-950/35 p-3.5 text-rose-200 space-y-1">
          <p class="font-semibold">${esc(err.message)}</p>
          <p class="text-xs text-rose-300/80">Cần kết nối Internet để gọi trình biên dịch GCC trên godbolt.org. Kiểm tra mạng rồi thử lại.</p>
        </div>
      `;
    } finally {
      btn.disabled = false;
      iconSpin.classList.add('hidden');
      iconPlay.classList.remove('hidden');
      btnLabel.textContent = currentEx?.test ? 'Biên dịch & chấm' : 'Biên dịch & chạy';
    }
  }

  function renderResult(r, ex) {
    if (editor) {
      for (const d of r.diagnostics) {
        const cls = d.error ? 'cm-err-line' : 'cm-warn-line';
        if (d.line >= 1 && d.line <= editor.lineCount()) {
          lineMarks.push({ line: editor.addLineClass(d.line - 1, 'background', cls), cls });
        }
      }
    }

    const parts = [];
    if (!r.compiled) {
      setResultStatus('fail', 'Lỗi biên dịch');
      parts.push(`<p class="text-rose-300 font-medium">Trình biên dịch báo lỗi — các dòng liên quan đã được tô đỏ trong editor.</p>`);
    } else if (ex.test) {
      const ok = r.total > 0 && r.score === r.total;
      setResultStatus(ok ? 'pass' : 'fail', ok ? `Đạt ${r.score}/${r.total}` : `${r.score}/${r.total} test đạt`);
      const pct = r.total ? (r.score / r.total) * 100 : 0;

      parts.push(`
        <div class="flex items-center gap-3">
          <div class="flex-1 h-2 rounded-full bg-surface-850 overflow-hidden border border-slate-800">
            <span class="block h-full ${ok ? 'bg-emerald-500' : 'bg-amber-400'} rounded-full transition-all duration-300" style="width:${pct}%"></span>
          </div>
          <strong class="font-mono text-xs ${ok ? 'text-emerald-400' : 'text-amber-300'}">${r.score}/${r.total}</strong>
        </div>
      `);

      parts.push('<ul class="space-y-1.5">' + r.results.map((c) => `
        <li class="flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
          c.pass
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
        }">
          <span class="font-mono font-bold shrink-0 ${c.pass ? 'text-emerald-400' : 'text-rose-400'}">${c.pass ? '✓' : '✗'}</span>
          <span class="min-w-0">
            <span class="sr-only">${c.pass ? 'Đạt: ' : 'Trượt: '}</span>${esc(c.msg)}
            ${!c.pass && c.detail ? `<span class="block font-mono text-[11px] text-rose-300/85 mt-0.5 break-all">${esc(c.detail)}</span>` : ''}
          </span>
        </li>
      `).join('') + '</ul>');

      if (ok && !passed.has(ex.id)) {
        passed.add(ex.id);
        store.set('passed', [...passed]);
        populateExerciseSelect();
        if (currentViewMode === 'playground') renderExerciseSidebar();
        showToast(`Hoàn thành bài "${ex.title}"!`);
      }
    } else {
      const ok = r.exitCode === 0 && !r.results.length;
      setResultStatus(ok ? 'pass' : 'fail', ok ? 'Chạy xong' : `Mã thoát ${r.exitCode}`);
      if (r.results.length) {
        parts.push('<ul class="space-y-1.5">' + r.results.map((c) => `
          <li class="flex items-start gap-2 px-3 py-2 rounded-lg border bg-rose-500/10 border-rose-500/30 text-rose-200 text-xs">
            <span class="font-mono font-bold text-rose-400 shrink-0">✗</span>
            <span>${esc(c.msg)}<span class="block font-mono text-[11px] text-rose-300/85 mt-0.5">${esc(c.detail)}</span></span>
          </li>
        `).join('') + '</ul>');
      }
      if (ok && !r.output) {
        parts.push(`<p class="text-emerald-300 font-mono text-xs">✓ Thực thi thành công (exit code 0, không có stdout).</p>`);
      }
    }

    if (r.output) {
      parts.push(`
        <div class="space-y-1.5">
          <h4 class="font-mono text-[11px] uppercase tracking-wider text-slate-400">Output (stdout)</h4>
          <pre class="font-mono text-xs leading-relaxed text-slate-200 bg-surface-900/90 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap break-words">${esc(r.output)}</pre>
        </div>
      `);
    }

    if (r.log) {
      parts.push(`
        <div class="space-y-1.5">
          <h4 class="font-mono text-[11px] uppercase tracking-wider ${r.compiled ? 'text-amber-400' : 'text-rose-400'}">Thông báo trình biên dịch</h4>
          <pre class="font-mono text-xs leading-relaxed ${r.compiled ? 'text-amber-200 bg-amber-950/25 border-amber-800/50' : 'text-rose-200 bg-rose-950/35 border-rose-800/60'} border rounded-xl p-3 whitespace-pre-wrap break-words">${esc(r.log)}</pre>
        </div>
      `);
    }

    $('#resultBody').innerHTML = parts.join('');
  }

  /* =========================================================================
     TOOLS (CALCULATORS & RING BUFFER)
     ========================================================================= */
  function bindTool(form, compute) {
    if (!form) return;
    const err = $('.field-error', form);
    const out = $('.out', form);
    const update = () => {
      $$('input', form).forEach((i) => i.removeAttribute('aria-invalid'));
      try {
        out.innerHTML = compute(Object.fromEntries(new FormData(form)));
        err.textContent = '';
      } catch (e) {
        err.textContent = e.message;
        $$('input', form).forEach((i) => i.setAttribute('aria-invalid', 'true'));
      }
    };
    form.addEventListener('input', update);
    form.addEventListener('submit', (e) => e.preventDefault());
    update();
  }

  const row = (k, v, cls = '') => {
    const valCls = cls === 'key'
      ? 'text-emerald-600 dark:text-emerald-400 font-bold text-sm'
      : cls === 'bad'
        ? 'text-rose-600 dark:text-rose-400 font-semibold'
        : 'text-slate-900 dark:text-slate-100';
    return `<dt class="text-slate-500 dark:text-slate-400">${k}</dt><dd class="font-mono text-right break-all ${valCls}">${v}</dd>`;
  };

  function initTools() {
    bindTool($('#toolBitband'), (f) => {
      const addr = Number.parseInt(f.addr, 16);
      if (!/^\s*(0x)?[0-9a-f]+\s*$/i.test(f.addr) || Number.isNaN(addr)) {
        throw new Error('Địa chỉ phải là số hex, ví dụ 0x40020C14.');
      }
      if (f.bit === '' || !Number.isInteger(+f.bit)) {
        throw new Error('Bit phải là số nguyên 0–31.');
      }
      const r = Calc.bitband(addr, +f.bit);
      return row('Vùng', r.region)
        + row('Byte offset', hex(r.offset))
        + row('Alias', hex(r.alias), 'key')
        + `<div class="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">*(volatile uint32_t *)${hex(r.alias)} = 1;</div>`;
    });

    bindTool($('#toolBrr'), (f) => {
      const r = Calc.usartBrr(+f.clk, +f.baud);
      const errPct = Math.abs(r.errPct);
      return row('USARTDIV', r.div.toFixed(4))
        + row('DIV_Mantissa', `${r.mant} (0x${r.mant.toString(16).toUpperCase()})`)
        + row('DIV_Fraction', `${r.frac} (0x${r.frac.toString(16).toUpperCase()})`)
        + row('USART_BRR', hex(r.brr), 'key')
        + row('Baud thực tế', r.real.toFixed(1))
        + row('Sai số', `${r.errPct.toFixed(2)} %${errPct > 2 ? ' – quá lớn' : ''}`, errPct > 2 ? 'bad' : '')
        + `<div class="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">USARTx->BRR = ${hex(r.brr)};</div>`;
    });

    bindTool($('#toolSystick'), (f) => {
      if (!(+f.clk > 0) || !(+f.ms > 0)) throw new Error('Tần số và thời gian phải lớn hơn 0.');
      const r = Calc.systick(+f.clk, +f.ms);
      const maxMs = ((0x1000000 / +f.clk) * 1000).toFixed(2);
      return row('Số xung', r.ticks.toLocaleString('vi-VN'))
        + row('SYST_RVR', `${r.rvr.toLocaleString('vi-VN')} (${hex(r.rvr)})`, r.ok ? 'key' : 'bad')
        + row('Hợp lệ 24 bit', r.ok ? 'Có' : `Không – T tối đa ${maxMs} ms`, r.ok ? '' : 'bad')
        + (r.ok ? `<div class="col-span-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all">SysTick->LOAD = ${r.rvr}; SysTick->VAL = 0; SysTick->CTRL = 7;</div>` : '');
    });

    const rb = new RingBuffer(8);
    function drawRing(msg) {
      const view = $('#rbView');
      const out = $('#rbOut');
      if (!view || !out) return;

      view.innerHTML = rb.buf.map((v, i) => `
        <div class="flex flex-col items-center gap-0.5 py-2 rounded-lg border font-mono text-sm font-semibold ${
          v !== null
            ? 'bg-emerald-500/15 border-emerald-500/50 text-slate-900 dark:text-emerald-200'
            : 'bg-white dark:bg-surface-950 border-slate-200 dark:border-slate-800 text-slate-400'
        }">
          <span class="min-h-[14px] text-[10px] font-sans font-bold flex gap-0.5">
            ${i === rb.head ? '<span class="text-amber-500">W</span>' : ''}
            ${i === rb.tail ? '<span class="text-sky-500">R</span>' : ''}
          </span>
          <span>${v === null ? '·' : esc(v)}</span>
          <span class="text-[10px] font-normal text-slate-400">${i}</span>
        </div>
      `).join('');

      const count = (rb.head - rb.tail + rb.size) % rb.size;
      view.setAttribute('aria-label', `Ring buffer chứa ${count}/${rb.size - 1} byte, head = ${rb.head}, tail = ${rb.tail}`);
      out.textContent = `${msg} · head(W) = ${rb.head}, tail(R) = ${rb.tail}, đang chứa ${count}/${rb.size - 1}${rb.isFull() ? ' · ĐẦY' : rb.isEmpty() ? ' · RỖNG' : ''}`;
    }

    $('#rbPut')?.addEventListener('click', () => {
      const input = $('#rbVal');
      const v = input.value || '?';
      drawRing(rb.put(v) ? `put('${v}') → true` : `put('${v}') → false (đầy)`);
      input.value = String.fromCharCode(((v.charCodeAt(0) - 64) % 26) + 65);
    });
    $('#rbGet')?.addEventListener('click', () => {
      const v = rb.get();
      drawRing(v === null ? 'get() → false (rỗng)' : `get() → '${v}'`);
    });
    $('#rbReset')?.addEventListener('click', () => {
      rb.reset();
      drawRing('reset');
    });
    drawRing('Khởi tạo: head = tail = 0');
  }

  /* =========================================================================
     ROUTER & EVENTS
     ========================================================================= */
  async function route() {
    const [rawView, rawId] = location.hash.replace(/^#\/?/, '').split('/');
    const id = rawId ? decodeURIComponent(rawId) : null;

    let mode = 'theory';
    if (rawView === 'lab') mode = 'playground';
    else if (rawView === 'split') mode = window.innerWidth >= 1024 ? 'split' : 'playground';
    else if (rawView === 'tools') mode = 'tools';

    if (mode !== currentViewMode && (mode === 'theory' || mode === 'playground')) {
      sidebarSearchQuery = '';
      const searchInput = $('#sidebarSearchInput');
      if (searchInput) searchInput.value = '';
    }

    applyViewModeUI(mode);
    closeMobileDrawer();

    if (mode === 'theory') {
      await showTheory(id);
    } else if (mode === 'playground') {
      await showLab(id);
    } else if (mode === 'split') {
      await Promise.all([
        showTheory(id, true),
        showLab(currentEx?.id || 'c-swap')
      ]);
      document.title = `Song song: ${theory?.flat.find((f) => f.id === currentTheoryId)?.title || 'Lý thuyết'} — Embedded C Lab`;
    } else {
      document.title = 'Công cụ tính toán — Embedded C Lab';
    }
  }

  function showFatal(e) {
    console.error(e);
    const body = $('#leftDynamicBody');
    if (body) {
      body.innerHTML = `
        <div class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200 space-y-2">
          <p class="font-semibold">Lỗi tải dữ liệu: ${esc(e.message)}</p>
          <p class="text-xs opacity-85">Nếu bạn mở file trực tiếp (<code>file://</code>), hãy chạy <code>python3 -m http.server</code> trong thư mục dự án rồi mở <code>http://localhost:8000</code>.</p>
        </div>
      `;
    }
  }

  function bindEvents() {
    $$('[data-mode-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigateToMode(btn.dataset.modeSwitch);
        closeMobileDrawer();
      });
    });

    $('#quickSplitBtn')?.addEventListener('click', () => {
      navigateToMode(currentViewMode === 'split' ? 'theory' : 'split');
    });

    $('#theoryChapterSelect')?.addEventListener('change', (e) => {
      const targetId = e.target.value;
      const prefix = currentViewMode === 'split' ? 'split' : 'theory';
      location.hash = `#/${prefix}/${encodeURIComponent(targetId)}`;
    });

    $('#sidebarSearchInput')?.addEventListener('input', (e) => {
      sidebarSearchQuery = e.target.value;
      if (currentViewMode === 'playground') renderExerciseSidebar();
      else renderTheorySidebar();
    });

    $('#sidebarListContainer')?.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMobileDrawer();
    });

    $('#prevModuleBtn')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.gotoTheory;
      if (id) location.hash = `#/${currentViewMode === 'split' ? 'split' : 'theory'}/${encodeURIComponent(id)}`;
    });

    $('#nextModuleBtn')?.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.gotoTheory;
      if (id) location.hash = `#/${currentViewMode === 'split' ? 'split' : 'theory'}/${encodeURIComponent(id)}`;
    });

    $('#leftDynamicBody')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-split]')) {
        navigateToMode('split');
      } else if (e.target.closest('[data-open-lab]')) {
        navigateToMode('playground');
      }
    });

    $('#mobileMenuBtn')?.addEventListener('click', openMobileDrawer);
    $('#closeSidebarBtn')?.addEventListener('click', closeMobileDrawer);
    $('#mobileDrawerBackdrop')?.addEventListener('click', closeMobileDrawer);

    $('#exerciseSelect')?.addEventListener('change', async (e) => {
      const id = e.target.value;
      if (currentViewMode === 'split') {
        await showLab(id);
      } else {
        location.hash = `#/lab/${encodeURIComponent(id)}`;
      }
    });

    $('#toggleTaskBtn')?.addEventListener('click', (e) => {
      const card = $('#taskCard');
      if (!card) return;
      const hidden = card.classList.toggle('hidden');
      e.currentTarget.textContent = hidden ? 'Hiện đề bài' : 'Đề bài';
      editor?.refresh();
    });

    $('#resetBtn')?.addEventListener('click', () => {
      if (!currentEx) return;
      if (editor) editor.setValue(currentEx.starter);
      else $('#editor').value = currentEx.starter;
      $('#editorNote').textContent = 'Đã đặt lại code ban đầu. Nhấn Ctrl+Z để hoàn tác.';
      showToast('Đã khôi phục code mẫu ban đầu');
    });

    $('#runBtn')?.addEventListener('click', () => runCurrentCode());

    $('#toggleOutputExpandBtn')?.addEventListener('click', (e) => {
      isOutputExpanded = !isOutputExpanded;
      document.documentElement.style.setProperty('--editor-height', isOutputExpanded ? '22%' : '55%');
      e.currentTarget.textContent = isOutputExpanded ? 'Thu gọn Output' : 'Phóng to Output';
      editor?.refresh();
    });

    $('#themeToggleBtn')?.addEventListener('click', toggleTheme);
    $('#mobileThemeBtn')?.addEventListener('click', toggleTheme);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileDrawer();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1024) {
        closeMobileDrawer();
      } else if (currentViewMode === 'split') {
        applyViewModeUI('playground');
      }
    });

    window.addEventListener('hashchange', () => {
      route().catch(showFatal);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (window.SplitResizer) {
      window.SplitResizer.init(() => editor?.refresh());
    }
    initTools();
    bindEvents();
    route().catch(showFatal);
  });
})();
