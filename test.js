// Self-check: node test.js  (calculators + every exercise compiled with local gcc)
const assert = require('assert');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { Calc } = require('./js/calculators.js');
const { Evaluator } = require('./js/evaluator.js');

assert.equal(Calc.bitband(0x20000010, 2).alias, 0x22000208);
assert.equal(Calc.bitband(0x40020014, 0).alias, 0x42400280);
assert.equal(Calc.usartBrr(16e6, 115200).brr, 0x8B);
assert.equal(Calc.usartBrr(16e6, 9600).brr, 0x683);
assert.equal(Calc.systick(72e6, 1).rvr, 71999);

const mock = fs.readFileSync('data/stm32_mock.h', 'utf8');
const tmp = fs.mkdtempSync(require('os').tmpdir() + '/elab-');
const exDir = 'data/exercises/';
const groups = require('./' + exDir + 'index.json');
const ids = groups.flatMap(g => g.items);
const files = fs.readdirSync(exDir).filter(f => f.endsWith('.c')).map(f => f.slice(0, -2));
assert.deepEqual([...ids].sort(), files.sort(), 'index.json and exercise files differ');
const ex = Object.fromEntries(ids.map(id => [id, Evaluator.parseExercise(fs.readFileSync(exDir + id + '.c', 'utf8'))]));

function grade(student, id) {
  const src = Evaluator.buildSource(student, id ? ex[id].test : '', mock);
  fs.writeFileSync(tmp + '/t.c', src);
  const cc = spawnSync('gcc', [...Evaluator.FLAGS.split(' '), '-o', tmp + '/t', tmp + '/t.c'], { encoding: 'utf8' });
  if (cc.status !== 0) return { compiled: false, log: cc.stderr };
  const run = spawnSync(tmp + '/t', { encoding: 'utf8', timeout: 5000 });
  const asLines = s => s.split('\n').filter(Boolean).map(text => ({ text }));
  const r = Evaluator.parse({ buildResult: { code: 0 }, stdout: asLines(run.stdout), stderr: asLines(run.stderr), code: run.status ?? 139 });
  r.warnings = cc.stderr;
  return r;
}

for (const id of ids) {
  const e = ex[id];
  for (const k of ['title', 'level', 'desc', 'hint', 'starter', 'solution', 'test']) assert.ok(e[k], `${id}: missing ${k}`);
  const s = grade(e.solution, id);
  assert.ok(s.compiled && s.total > 0 && s.score === s.total, id + ' solution: ' + JSON.stringify(s));
  assert.ok(!s.warnings.includes('main.c'), id + ' solution has warnings: ' + s.warnings);
  const t = grade(e.starter, id);
  assert.ok(t.compiled, id + ' starter must compile: ' + t.log);
  assert.ok(t.score < t.total, id + ' starter should fail');
}
// common mistakes must be caught
const sol = id => ex[id].solution;
const wrong = [
  ['exti0', sol('exti0').replace('EXTI->PR = EXTI_PR_PR0', 'EXTI->PR |= EXTI_PR_PR0')],
  ['usart-puts', sol('usart-puts').replace(/while \(!\(USART1->SR & USART_SR_TXE\)\);/, '')],
  ['gpio-pd12', sol('gpio-pd12').replace(/.*MODER &=.*\n/, '')],
  ['toggle-bit', sol('toggle-bit').replace('1U << n', '1 << n')],
  ['spi1-mode0', sol('spi1-mode0').replace('SPI1->CR1 = 0;', '').replace(/.*CPOL \| SPI_CR1_CPHA.*\n/, '')],
  ['gpio-pd12', sol('gpio-pd12').replace('GPIOD->BSRR = (1U << 12);', 'GPIOD->ODR |= (1U << 12);')],
  ['gpio-pd12', sol('gpio-pd12').replace('GPIOD->BSRR = (1U << 12);', 'GPIOD->BSRR = (1U << 12)')],
  ['c-swap', 'void swap(int *a, int *b) { *a ^= *b; *b ^= *a; *a ^= *b; }'],
  ['c-reverse', '#include <stddef.h>\nvoid reverse(int *a, size_t n) { size_t i = 0, j = n - 1; while (i < j) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; j--; } }'],
  ['ring-buffer', sol('ring-buffer').replace('if (next == rb->tail) return false;', '')],
  ['systick-init', sol('systick-init').replace('ticks - 1U > 0xFFFFFFU', 'ticks > 0xFFFFFFU')],
  ['usart-brr', '#include <stdint.h>\nuint16_t usart_brr(uint32_t f, uint32_t b) { return (uint16_t)(f / b); }'],
  ['gpio-button', sol('gpio-button').replace('GPIOA->MODER &= ~(3U << 0);', 'GPIOA->MODER = 0;')],
];
for (const [id, code] of wrong) {
  const r = grade(code, id);
  assert.ok(!r.compiled || r.score < r.total, id + ' mistake not caught: ' + JSON.stringify((r.results || []).filter(x => !x.pass)));
}
// sandbox mode: free program with main(), stdout captured
const sb = grade('#include <stdio.h>\nint main(void) { int x = 5; int *p = &x; *p = 9; printf("x=%d\\n", x); return 0; }', null);
assert.equal(sb.output, 'x=9');
// every runnable (```crun) example in the theory must compile and exit 0
let examples = 0;
for (const f of fs.readdirSync('data/theory').filter(f => f.endsWith('.md'))) {
  for (const m of fs.readFileSync('data/theory/' + f, 'utf8').matchAll(/```crun\n([\s\S]*?)```/g)) {
    const r = grade(m[1], null);
    assert.ok(r.compiled && r.exitCode === 0 && !r.results.length, `${f} example failed: ${JSON.stringify(r)}`);
    examples++;
  }
}
const tIndex = require('./data/theory/index.json').flatMap(g => g.items.map(i => i.id));
assert.deepEqual(tIndex.sort(), fs.readdirSync('data/theory').filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)).sort());
console.log(`${examples} runnable theory examples ok`);
fs.rmSync(tmp, { recursive: true });
console.log(`all ok (${ids.length} exercises)`);
