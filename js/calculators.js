// Pure hardware calculators (no DOM) – testable with node.
const Calc = {
  // Cortex-M3/M4 bit-band: alias = alias_base + (addr - region_base)*32 + bit*4
  bitband(addr, bit) {
    const regions = [
      { name: 'SRAM', base: 0x20000000, alias: 0x22000000 },
      { name: 'Peripheral', base: 0x40000000, alias: 0x42000000 },
    ];
    const r = regions.find(r => addr >= r.base && addr < r.base + 0x100000);
    if (!r) throw new Error('Địa chỉ phải nằm trong 0x20000000–0x200FFFFF hoặc 0x40000000–0x400FFFFF');
    if (bit < 0 || bit > 31) throw new Error('Bit phải trong 0–31');
    const offset = addr - r.base;
    return { region: r.name, offset, alias: r.alias + offset * 32 + bit * 4 };
  },

  // USARTDIV = fPCLK / (16 * baud); fraction rounded to 1/16, carry into mantissa
  usartBrr(fclk, baud) {
    if (!(fclk > 0 && baud > 0)) throw new Error('Tần số và baud phải > 0');
    const div = fclk / (16 * baud);
    let mant = Math.floor(div), frac = Math.round((div - mant) * 16);
    if (frac === 16) { mant++; frac = 0; }
    const brr = (mant << 4) | frac;
    const real = fclk / (16 * (mant + frac / 16));
    return { div, mant, frac, brr, real, errPct: (real - baud) / baud * 100 };
  },

  // SYST_RVR = T * f - 1, 24-bit
  systick(fclk, ms) {
    const ticks = Math.round(fclk * ms / 1000);
    const rvr = ticks - 1;
    return { ticks, rvr, ok: rvr >= 1 && rvr <= 0xFFFFFF };
  },
};

// Ring buffer, one slot kept empty to tell full from empty
class RingBuffer {
  constructor(size) { this.size = size; this.reset(); }
  reset() { this.buf = Array(this.size).fill(null); this.head = 0; this.tail = 0; }
  isEmpty() { return this.head === this.tail; }
  isFull() { return (this.head + 1) % this.size === this.tail; }
  put(v) { if (this.isFull()) return false; this.buf[this.head] = v; this.head = (this.head + 1) % this.size; return true; }
  get() { if (this.isEmpty()) return null; const v = this.buf[this.tail]; this.buf[this.tail] = null; this.tail = (this.tail + 1) % this.size; return v; }
}

if (typeof module !== 'undefined') module.exports = { Calc, RingBuffer };
