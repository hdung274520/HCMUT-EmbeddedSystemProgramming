// @title: Endianness: đảo byte & đọc big-endian
// @level: Trung bình
// @desc: Cortex-M là little-endian, còn nhiều cảm biến/giao thức gửi big-endian. Viết uint32_t bswap32(uint32_t x) đảo thứ tự 4 byte, và uint16_t read_be16(const uint8_t *p) ghép 2 byte p[0] (byte cao) và p[1] (byte thấp) thành một số 16 bit.
// @hint: bswap32: ((x >> 24) & 0xFF) | ((x >> 8) & 0xFF00) | ((x << 8) & 0xFF0000) | (x << 24). read_be16: (uint16_t)((p[0] << 8) | p[1]).
//==== starter
#include <stdint.h>

uint32_t bswap32(uint32_t x) {
    // TODO
    return x;
}

uint16_t read_be16(const uint8_t *p) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>

uint32_t bswap32(uint32_t x) {
    return ((x >> 24) & 0x000000FFu) |
           ((x >> 8)  & 0x0000FF00u) |
           ((x << 8)  & 0x00FF0000u) |
           (x << 24);
}

uint16_t read_be16(const uint8_t *p) {
    return (uint16_t)((p[0] << 8) | p[1]);
}
//==== test
int main(void) {
    TEST_BEGIN();
    CHECK(bswap32(0x12345678u) == 0x78563412u, "bswap32(0x12345678) = 0x78563412", "nhận 0x%08X", (unsigned)bswap32(0x12345678u));
    CHECK(bswap32(0xFF000000u) == 0x000000FFu, "bswap32(0xFF000000) = 0x000000FF", "nhận 0x%08X", (unsigned)bswap32(0xFF000000u));
    CHECK(bswap32(bswap32(0xDEADBEEFu)) == 0xDEADBEEFu, "Đảo hai lần trở về giá trị cũ", "sai");
    const uint8_t frame[] = { 0x01, 0xF4, 0xFF, 0x9C };
    CHECK(read_be16(frame) == 500, "read_be16({0x01, 0xF4}) = 500", "nhận %u", read_be16(frame));
    CHECK(read_be16(frame + 2) == 0xFF9C, "read_be16(frame + 2) = 0xFF9C", "nhận 0x%04X", read_be16(frame + 2));
    return t_fail != 0;
}
