// @title: Tính USART_BRR chỉ bằng số nguyên
// @level: Trung bình
// @desc: Với OVER8 = 0: BRR = (Mantissa << 4) | Fraction = USARTDIV × 16 = fPCLK / baud. Viết uint16_t usart_brr(uint32_t fclk, uint32_t baud) tính BRR có làm tròn, KHÔNG dùng float (MCU không có FPU thì float rất chậm).
// @hint: Làm tròn phép chia nguyên: (a + b / 2) / b.
//==== starter
#include <stdint.h>

uint16_t usart_brr(uint32_t fclk, uint32_t baud) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>

uint16_t usart_brr(uint32_t fclk, uint32_t baud) {
    return (uint16_t)((fclk + baud / 2U) / baud);
}
//==== test
int main(void) {
    TEST_BEGIN();
    static const struct { uint32_t f, b; uint16_t brr; } t[] = {
        { 16000000u, 115200u, 0x008B }, { 16000000u, 9600u, 0x0683 },
        { 84000000u, 115200u, 0x02D9 }, { 42000000u, 9600u, 0x1117 }, { 8000000u, 38400u, 0x00D0 },
    };
    for (unsigned i = 0; i < sizeof t / sizeof t[0]; i++) {
        char msg[80];
        snprintf(msg, sizeof msg, "fPCLK = %lu Hz, baud = %lu → BRR = 0x%04X", (unsigned long)t[i].f, (unsigned long)t[i].b, t[i].brr);
        uint16_t got = usart_brr(t[i].f, t[i].b);
        CHECK(got == t[i].brr, msg, "nhận 0x%04X", got);
    }
    return t_fail != 0;
}
