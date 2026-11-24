int main(void) {
    TEST_BEGIN();
    /* line 0 and line 1 both pending: only line 0 may be cleared */
    EXTI->PR = EXTI_PR_PR0 | EXTI_PR_PR1; GPIOD->ODR = 0; GPIOD->BSRR = 0;
    EXTI0_IRQHandler();
    CHECK(EXTI->PR == EXTI_PR_PR0, "Xóa cờ bằng cách ghi 1 vào PR0 (EXTI->PR = EXTI_PR_PR0)",
          "giá trị ghi vào PR = 0x%X (0x3 nghĩa là dùng |= → xóa nhầm cờ line 1)", (unsigned)EXTI->PR);
    CHECK((GPIOD->ODR & (1U << 12)) || (GPIOD->BSRR & (1U << 12)), "Lần ngắt 1: LED PD12 bật",
          "ODR = 0x%X, BSRR = 0x%X", (unsigned)GPIOD->ODR, (unsigned)GPIOD->BSRR);

    EXTI->PR = EXTI_PR_PR0; GPIOD->ODR = 1U << 12; GPIOD->BSRR = 0;
    EXTI0_IRQHandler();
    CHECK(!(GPIOD->ODR & (1U << 12)) || (GPIOD->BSRR & (1U << 28)), "Lần ngắt 2: LED PD12 đảo về tắt",
          "ODR = 0x%X, BSRR = 0x%X", (unsigned)GPIOD->ODR, (unsigned)GPIOD->BSRR);

    EXTI->PR = EXTI_PR_PR1; GPIOD->ODR = 0; GPIOD->BSRR = 0;
    EXTI0_IRQHandler();
    CHECK(GPIOD->ODR == 0 && GPIOD->BSRR == 0, "Không làm gì khi PR0 không pending (có kiểm tra cờ)",
          "ODR = 0x%X, BSRR = 0x%X", (unsigned)GPIOD->ODR, (unsigned)GPIOD->BSRR);
    return t_fail != 0;
}
