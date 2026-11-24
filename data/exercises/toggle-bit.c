// @title: Đảo bit thứ n bằng XOR
// @level: Cơ bản
// @desc: Viết hàm uint32_t toggle_bit(uint32_t reg, uint8_t n) trả về reg sau khi đảo bit n bằng toán tử ^.
// @hint: XOR với 1 đảo bit, XOR với 0 giữ nguyên.
//==== starter
#include <stdint.h>

uint32_t toggle_bit(uint32_t reg, uint8_t n) {
    // TODO
}
//==== solution
#include <stdint.h>

uint32_t toggle_bit(uint32_t reg, uint8_t n) {
    reg ^= (1U << n);
    return reg;
}
//==== test
int main(void) {
    TEST_BEGIN();
    static const struct { uint32_t in; uint8_t n; uint32_t out; } t[] = {
        { 0x00000000u, 0, 0x00000001u },
        { 0x00000005u, 2, 0x00000001u },
        { 0x00000000u, 12, 0x00001000u },
        { 0xFFFFFFFFu, 31, 0x7FFFFFFFu },
        { 0x00000000u, 31, 0x80000000u },
    };
    for (unsigned i = 0; i < sizeof t / sizeof t[0]; i++) {
        char msg[96];
        uint32_t got = toggle_bit(t[i].in, t[i].n);
        snprintf(msg, sizeof msg, "toggle_bit(0x%08X, %u) = 0x%08X", (unsigned)t[i].in, t[i].n, (unsigned)t[i].out);
        CHECK(got == t[i].out, msg, "nhận được 0x%08X", (unsigned)got);
    }
    return t_fail != 0;
}
