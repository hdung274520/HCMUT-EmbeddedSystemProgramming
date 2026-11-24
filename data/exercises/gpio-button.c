// @title: Đọc nút nhấn PA0 (Input, Pull-down)
// @level: Cơ bản
// @desc: Viết void button_init(void): bật clock GPIOA, cấu hình PA0 là Input (MODER0 = 00) với Pull-down (PUPDR0 = 10). Viết uint8_t button_read(void) trả về 1 nếu PA0 đang ở mức cao (đọc IDR), 0 nếu mức thấp. Không làm thay đổi các chân khác.
// @hint: GPIOA->PUPDR = (GPIOA->PUPDR & ~3U) | 2U;  return (GPIOA->IDR & 1U) ? 1 : 0;
//==== starter
#include "stm32f4xx.h"

void button_init(void) {
    // TODO
}

uint8_t button_read(void) {
    // TODO
    return 0;
}
//==== solution
#include "stm32f4xx.h"

void button_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    GPIOA->MODER &= ~(3U << 0);
    GPIOA->PUPDR = (GPIOA->PUPDR & ~(3U << 0)) | (2U << 0);
}

uint8_t button_read(void) {
    return (GPIOA->IDR & (1U << 0)) ? 1 : 0;
}
//==== test
int main(void) {
    TEST_BEGIN();
    RCC->AHB1ENR = 0;
    GPIOA->MODER = 0xA8000003u;   /* PA13/14/15 debug pins + PA0 dirty */
    GPIOA->PUPDR = 0x64000001u;   /* PA0 pull-up left over */
    button_init();
    CHECK(RCC->AHB1ENR & RCC_AHB1ENR_GPIOAEN, "Bật clock GPIOA", "AHB1ENR = 0x%08X", (unsigned)RCC->AHB1ENR);
    CHECK((GPIOA->MODER & 3U) == 0, "MODER0 = 00 (Input)", "MODER[1:0] = %u", (unsigned)(GPIOA->MODER & 3U));
    CHECK((GPIOA->MODER & ~3U) == 0xA8000000u, "Giữ nguyên MODER của PA13–PA15 (chân debug SWD!)", "MODER = 0x%08X", (unsigned)GPIOA->MODER);
    CHECK((GPIOA->PUPDR & 3U) == 2, "PUPDR0 = 10 (Pull-down)", "PUPDR[1:0] = %u", (unsigned)(GPIOA->PUPDR & 3U));
    CHECK((GPIOA->PUPDR & ~3U) == 0x64000000u, "Giữ nguyên PUPDR các chân khác", "PUPDR = 0x%08X", (unsigned)GPIOA->PUPDR);
    GPIOA->IDR = 0x0001;
    CHECK(button_read() == 1, "IDR bit0 = 1 → button_read() = 1", "nhận %u", button_read());
    GPIOA->IDR = 0xFFFE;
    CHECK(button_read() == 0, "IDR = 0xFFFE (chỉ PA0 thấp) → 0", "nhận %u", button_read());
    return t_fail != 0;
}
