// @title: Tính địa chỉ Bit-band alias
// @level: Trung bình
// @desc: Viết uint32_t bitband_alias(uint32_t addr, uint8_t bit) trả về địa chỉ alias cho vùng SRAM (0x20000000–0x200FFFFF → alias 0x22000000) và Peripheral (0x40000000–0x400FFFFF → alias 0x42000000). Trả về 0 nếu addr ngoài hai vùng hoặc bit > 31. Sau đó có thể dùng *(volatile uint32_t *)alias = 1; để set bit nguyên tử.
// @hint: alias = alias_base + (addr - region_base) * 32 + bit * 4
//==== starter
#include <stdint.h>

uint32_t bitband_alias(uint32_t addr, uint8_t bit) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>

uint32_t bitband_alias(uint32_t addr, uint8_t bit) {
    if (bit > 31) return 0;
    if (addr >= 0x20000000u && addr < 0x20100000u)
        return 0x22000000u + (addr - 0x20000000u) * 32u + bit * 4u;
    if (addr >= 0x40000000u && addr < 0x40100000u)
        return 0x42000000u + (addr - 0x40000000u) * 32u + bit * 4u;
    return 0;
}
//==== test
int main(void) {
    TEST_BEGIN();
    CHECK(bitband_alias(0x20000010u, 2) == 0x22000208u, "SRAM 0x20000010 bit 2 → 0x22000208", "nhận 0x%08X", (unsigned)bitband_alias(0x20000010u, 2));
    CHECK(bitband_alias(0x40020C14u, 12) == 0x424182B0u, "GPIOD_ODR (0x40020C14) bit 12 → 0x424182B0", "nhận 0x%08X", (unsigned)bitband_alias(0x40020C14u, 12));
    CHECK(bitband_alias(0x200FFFFCu, 31) == 0x23FFFFFCu, "Biên trên SRAM: 0x200FFFFC bit 31 → 0x23FFFFFC", "nhận 0x%08X", (unsigned)bitband_alias(0x200FFFFCu, 31));
    CHECK(bitband_alias(0x08000000u, 0) == 0, "Flash 0x08000000 → 0 (không có bit-band)", "nhận 0x%08X", (unsigned)bitband_alias(0x08000000u, 0));
    CHECK(bitband_alias(0x20100000u, 0) == 0, "0x20100000 ngoài vùng 1 MB → 0", "nhận 0x%08X", (unsigned)bitband_alias(0x20100000u, 0));
    CHECK(bitband_alias(0x20000000u, 32) == 0, "bit = 32 → 0", "nhận 0x%08X", (unsigned)bitband_alias(0x20000000u, 32));
    return t_fail != 0;
}
