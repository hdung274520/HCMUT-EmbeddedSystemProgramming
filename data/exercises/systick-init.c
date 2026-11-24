// @title: Khởi tạo SysTick
// @level: Trung bình
// @desc: Viết int systick_init(uint32_t ticks): nạp SysTick->LOAD = ticks - 1, xóa VAL, rồi bật CTRL với CLKSOURCE (clock CPU) | TICKINT (cho phép ngắt) | ENABLE. Trả về 0 nếu thành công. Nếu ticks = 0 hoặc ticks - 1 vượt 24 bit (0xFFFFFF) thì trả về -1 và KHÔNG ghi thanh ghi nào.
// @hint: if (ticks == 0 || ticks - 1 > 0xFFFFFFU) return -1;
//==== starter
#include "stm32f4xx.h"

int systick_init(uint32_t ticks) {
    // TODO
    return -1;
}
//==== solution
#include "stm32f4xx.h"

int systick_init(uint32_t ticks) {
    if (ticks == 0 || ticks - 1U > 0xFFFFFFU) return -1;
    SysTick->LOAD = ticks - 1U;
    SysTick->VAL = 0;
    SysTick->CTRL = SysTick_CTRL_CLKSOURCE_Msk | SysTick_CTRL_TICKINT_Msk | SysTick_CTRL_ENABLE_Msk;
    return 0;
}
//==== test
int main(void) {
    TEST_BEGIN();
    SysTick->LOAD = 0; SysTick->VAL = 1234; SysTick->CTRL = 0;
    int r = systick_init(16000);   /* 1 ms @ 16 MHz */
    CHECK(r == 0, "systick_init(16000) trả về 0", "trả về %d", r);
    CHECK(SysTick->LOAD == 15999, "LOAD = ticks - 1 = 15999", "LOAD = %u", (unsigned)SysTick->LOAD);
    CHECK(SysTick->VAL == 0, "VAL được xóa về 0", "VAL = %u", (unsigned)SysTick->VAL);
    CHECK(SysTick->CTRL == 7, "CTRL = CLKSOURCE | TICKINT | ENABLE = 7", "CTRL = %u", (unsigned)SysTick->CTRL);
    SysTick->LOAD = 111; SysTick->CTRL = 0;
    r = systick_init(0x1000001u);
    CHECK(r == -1 && SysTick->LOAD == 111 && SysTick->CTRL == 0, "ticks = 0x1000001 (quá 24 bit) → -1, không ghi thanh ghi", "r=%d, LOAD=%u", r, (unsigned)SysTick->LOAD);
    r = systick_init(0x1000000u);
    CHECK(r == 0 && SysTick->LOAD == 0xFFFFFF, "ticks = 0x1000000 → LOAD = 0xFFFFFF (biên hợp lệ)", "r=%d, LOAD=0x%X", r, (unsigned)SysTick->LOAD);
    r = systick_init(0);
    CHECK(r == -1, "ticks = 0 → -1", "r=%d", r);
    return t_fail != 0;
}
