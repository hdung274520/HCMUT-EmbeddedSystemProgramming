// @title: Đếm bit 1 & kiểm tra lũy thừa của 2
// @level: Cơ bản
// @desc: Viết int popcount32(uint32_t x) đếm số bit 1, và int is_pow2(uint32_t x) trả về 1 nếu x là lũy thừa của 2 (1, 2, 4, ...), 0 nếu không (x = 0 không phải lũy thừa của 2).
// @hint: x & (x - 1) xóa bit 1 thấp nhất. Lặp đến khi x = 0 để đếm; is_pow2: x != 0 && (x & (x - 1)) == 0.
//==== starter
#include <stdint.h>

int popcount32(uint32_t x) {
    // TODO
    return 0;
}

int is_pow2(uint32_t x) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>

int popcount32(uint32_t x) {
    int n = 0;
    while (x) {
        x &= x - 1;   /* xóa bit 1 thấp nhất */
        n++;
    }
    return n;
}

int is_pow2(uint32_t x) {
    return x != 0 && (x & (x - 1)) == 0;
}
//==== test
int main(void) {
    TEST_BEGIN();
    static const struct { uint32_t x; int n; } pc[] = { { 0, 0 }, { 1, 1 }, { 0xF0, 4 }, { 0x80000001u, 2 }, { 0xFFFFFFFFu, 32 } };
    for (unsigned i = 0; i < 5; i++) {
        char msg[64];
        snprintf(msg, sizeof msg, "popcount32(0x%X) = %d", (unsigned)pc[i].x, pc[i].n);
        CHECK(popcount32(pc[i].x) == pc[i].n, msg, "nhận được %d", popcount32(pc[i].x));
    }
    CHECK(is_pow2(1) && is_pow2(64) && is_pow2(0x80000000u), "is_pow2: 1, 64, 0x80000000 → 1", "sai");
    CHECK(!is_pow2(0) && !is_pow2(6) && !is_pow2(0xFFFFFFFFu), "is_pow2: 0, 6, 0xFFFFFFFF → 0", "sai");
    return t_fail != 0;
}
