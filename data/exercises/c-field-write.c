// @title: Ghi trường bit nhiều bit (field write)
// @level: Trung bình
// @desc: Viết uint32_t field_write(uint32_t reg, uint8_t pos, uint8_t width, uint32_t val) trả về reg sau khi thay width bit bắt đầu từ bit pos bằng val (val bị cắt cho vừa width). width từ 1 đến 31. Đây là thao tác dùng để ghi MODER (2 bit), AFR (4 bit), BR (3 bit)...
// @hint: uint32_t mask = ((1U << width) - 1U) << pos; return (reg & ~mask) | ((val << pos) & mask);
//==== starter
#include <stdint.h>

uint32_t field_write(uint32_t reg, uint8_t pos, uint8_t width, uint32_t val) {
    // TODO
    return reg;
}
//==== solution
#include <stdint.h>

uint32_t field_write(uint32_t reg, uint8_t pos, uint8_t width, uint32_t val) {
    uint32_t mask = ((1U << width) - 1U) << pos;
    return (reg & ~mask) | ((val << pos) & mask);
}
//==== test
int main(void) {
    TEST_BEGIN();
    static const struct { uint32_t reg; uint8_t pos, width; uint32_t val, out; const char *msg; } t[] = {
        { 0xFFFFFFFFu, 24, 2, 1, 0xFDFFFFFFu, "MODER12 = 01 trên thanh ghi toàn 1" },
        { 0x00000000u, 24, 2, 1, 0x01000000u, "MODER12 = 01 trên thanh ghi toàn 0" },
        { 0x12345678u, 4, 4, 0xA, 0x123456A8u, "Ghi nibble bit [7:4] = 0xA" },
        { 0x00000000u, 4, 4, 0x1F, 0x000000F0u, "val quá rộng bị cắt: 0x1F → 0xF" },
        { 0xFFFFFFFFu, 3, 3, 0, 0xFFFFFFC7u, "Xóa trường BR[2:0] (bit 5:3)" },
        { 0x00000000u, 0, 31, 0x7FFFFFFFu, 0x7FFFFFFFu, "width = 31" },
    };
    for (unsigned i = 0; i < sizeof t / sizeof t[0]; i++) {
        uint32_t got = field_write(t[i].reg, t[i].pos, t[i].width, t[i].val);
        CHECK(got == t[i].out, t[i].msg, "mong đợi 0x%08X, nhận 0x%08X", (unsigned)t[i].out, (unsigned)got);
    }
    return t_fail != 0;
}
