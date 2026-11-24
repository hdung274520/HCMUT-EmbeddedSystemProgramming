// Real C grading: student code + mock STM32 header + test harness are compiled
// with GCC and executed on Compiler Explorer (godbolt.org, CORS-enabled public API).
const Evaluator = {
  API: 'https://godbolt.org/api/compiler/cg153/compile', // x86-64 gcc 15.3
  FLAGS: '-std=c11 -O0 -Wall -Wextra -fsanitize=undefined -fdiagnostics-color=never',

  // #line keeps compiler line numbers matching the editor; the include line is blanked, not removed.
  buildSource(student, harness, mock) {
    const code = student.replace(/^[ \t]*#[ \t]*include[ \t]*["<]stm32f4xx\.h[">].*$/gm, '');
    return `${mock}\n#line 1 "main.c"\n${code}\n#line 1 "harness.c"\n${harness}\n`;
  },

  async compileAndRun(source) {
    const res = await fetch(this.API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        source,
        options: { userArguments: this.FLAGS, filters: { execute: true }, compilerOptions: { executorRequest: true } },
      }),
    });
    if (!res.ok) throw new Error(`Compiler Explorer trả về HTTP ${res.status}`);
    return this.parse(await res.json());
  },

  // Normalise a Compiler Explorer response (also used by test.js with local gcc output).
  parse(d) {
    const lines = a => (a || []).map(l => l.text.replace(/\x1b\[[0-9;]*m/g, ''));
    const build = d.buildResult || {};
    const diagnostics = (build.stderr || []).filter(l => l.tag && l.tag.file === 'main.c')
      .map(l => ({ line: l.tag.line, col: l.tag.column, text: l.tag.text, error: l.tag.severity >= 3 }));
    const results = [];
    for (const l of lines(d.stdout)) {
      const [kind, msg, detail] = l.split('|');
      if (kind === 'PASS' || kind === 'FAIL') results.push({ pass: kind === 'PASS', msg, detail: detail || '' });
    }
    const runtime = lines(d.stderr).filter(t => /runtime error/.test(t)); // UBSan
    if (runtime.length) results.push({ pass: false, msg: 'Không có hành vi không xác định (UB)', detail: runtime.join(' ') });
    if (d.timedOut) results.push({ pass: false, msg: 'Chương trình chạy quá thời gian', detail: '' });
    return {
      compiled: build.code === 0,
      log: lines(build.stderr).join('\n').replace(/<source>/g, 'stm32f4xx.h'), // mock header is the unnamed top file
      diagnostics,
      results,
      score: results.filter(r => r.pass).length,
      total: results.length,
    };
  },
};
if (typeof module !== 'undefined') module.exports = { Evaluator };
