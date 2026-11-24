int main(void) {
    TEST_BEGIN();
    /* reset values made "dirty" so missing clears are caught */
    RCC->AHB1ENR = 0;
    GPIOD->MODER = 0xFFFFFFFF; GPIOD->OTYPER = 0xFFFF; GPIOD->PUPDR = 0xFFFFFFFF; GPIOD->BSRR = 0;
    led_init();
    CHECK(RCC->AHB1ENR & RCC_AHB1ENR_GPIODEN, "Bật clock GPIOD (RCC->AHB1ENR bit 3)", "AHB1ENR = 0x%08X", (unsigned)RCC->AHB1ENR);
    CHECK(((GPIOD->MODER >> 24) & 3U) == 1, "MODER12 = 01 (Output)", "MODER[25:24] = %u (phải xóa 2 bit rồi mới set)", (unsigned)((GPIOD->MODER >> 24) & 3U));
    CHECK((GPIOD->MODER | (3U << 24)) == 0xFFFFFFFF, "Không làm thay đổi MODER các chân khác", "MODER = 0x%08X", (unsigned)GPIOD->MODER);
    CHECK(!(GPIOD->OTYPER & (1U << 12)), "OTYPER12 = 0 (Push-pull)", "OTYPER = 0x%04X", (unsigned)GPIOD->OTYPER);
    CHECK((GPIOD->OTYPER | (1U << 12)) == 0xFFFF, "Không làm thay đổi OTYPER các chân khác", "OTYPER = 0x%04X", (unsigned)GPIOD->OTYPER);
    CHECK(((GPIOD->PUPDR >> 24) & 3U) == 0, "PUPDR12 = 00 (No pull)", "PUPDR[25:24] = %u", (unsigned)((GPIOD->PUPDR >> 24) & 3U));
    CHECK((GPIOD->PUPDR | (3U << 24)) == 0xFFFFFFFF, "Không làm thay đổi PUPDR các chân khác", "PUPDR = 0x%08X", (unsigned)GPIOD->PUPDR);
    CHECK(GPIOD->BSRR == (1U << 12), "Bật LED bằng BSRR = (1U << 12)", "BSRR = 0x%08X", (unsigned)GPIOD->BSRR);
    return t_fail != 0;
}
