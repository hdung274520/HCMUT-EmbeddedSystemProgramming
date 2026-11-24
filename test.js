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
const q = require('./data/quiz.json'); q.questions.forEach(x => assert.ok(x.answer < x.options.length));
require('./data/theory.json');

const mock = fs.readFileSync('data/stm32_mock.h', 'utf8');
const tmp = fs.mkdtempSync(require('os').tmpdir() + '/elab-');
function grade(student, id) {
  const src = Evaluator.buildSource(student, fs.readFileSync(`data/harness/${id}.c`, 'utf8'), mock);
  fs.writeFileSync(tmp + '/t.c', src);
  const cc = spawnSync('gcc', [...Evaluator.FLAGS.split(' '), '-o', tmp + '/t', tmp + '/t.c'], { encoding: 'utf8' });
  if (cc.status !== 0) return { compiled: false, log: cc.stderr };
  const run = spawnSync(tmp + '/t', { encoding: 'utf8', timeout: 5000 });
  const asLines = s => s.split('\n').filter(Boolean).map(text => ({ text }));
  return Evaluator.parse({ buildResult: { code: 0 }, stdout: asLines(run.stdout), stderr: asLines(run.stderr) });
}

const ex = require('./data/exercises.json');
for (const e of ex) {
  const s = grade(e.solution, e.id);
  assert.ok(s.compiled && s.total > 0 && s.score === s.total, e.id + ' solution: ' + JSON.stringify(s));
  const t = grade(e.starter, e.id);
  assert.ok(!t.compiled || t.score < t.total, e.id + ' starter should fail');
}
// common mistakes must be caught
const sol = id => ex.find(e => e.id === id).solution;
const wrong = [
  ['exti0', sol('exti0').replace('EXTI->PR = EXTI_PR_PR0', 'EXTI->PR |= EXTI_PR_PR0')],
  ['usart-puts', sol('usart-puts').replace(/while \(!\(USART1->SR & USART_SR_TXE\)\);/, '')],
  ['gpio-pd12', sol('gpio-pd12').replace(/.*MODER &=.*\n/, '')],
  ['toggle-bit', sol('toggle-bit').replace('1U << n', '1 << n')],
  ['spi1-mode0', sol('spi1-mode0').replace('SPI1->CR1 = 0;', '').replace(/.*CPOL \| SPI_CR1_CPHA.*\n/, '')],
  ['gpio-pd12', sol('gpio-pd12').replace('GPIOD->BSRR = (1U << 12);', 'GPIOD->ODR |= (1U << 12);')],
  ['gpio-pd12', sol('gpio-pd12').replace('GPIOD->BSRR = (1U << 12);', 'GPIOD->BSRR = (1U << 12)')],
];
for (const [id, code] of wrong) {
  const r = grade(code, id);
  assert.ok(!r.compiled || r.score < r.total, id + ' mistake not caught: ' + JSON.stringify((r.results || []).filter(x => !x.pass)));
}
fs.rmSync(tmp, { recursive: true });
console.log('all ok');
