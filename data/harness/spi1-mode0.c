int main(void) {
    TEST_BEGIN();
    RCC->APB2ENR = 0;
    SPI1->CR1 = SPI_CR1_CPOL | SPI_CR1_CPHA; /* dirty: Mode 3 left over */
    spi1_init();
    uint32_t cr1 = SPI1->CR1;
    CHECK(RCC->APB2ENR & RCC_APB2ENR_SPI1EN, "Bật clock SPI1 (RCC->APB2ENR bit 12)", "APB2ENR = 0x%08X", (unsigned)RCC->APB2ENR);
    CHECK(cr1 & SPI_CR1_MSTR, "MSTR = 1 (Master)", "CR1 = 0x%04X", (unsigned)cr1);
    CHECK(!(cr1 & SPI_CR1_CPOL), "CPOL = 0", "CR1 = 0x%04X", (unsigned)cr1);
    CHECK(!(cr1 & SPI_CR1_CPHA), "CPHA = 0", "CR1 = 0x%04X", (unsigned)cr1);
    CHECK((cr1 & (SPI_CR1_SSM | SPI_CR1_SSI)) == (SPI_CR1_SSM | SPI_CR1_SSI), "NSS phần mềm: SSM = 1, SSI = 1", "CR1 = 0x%04X", (unsigned)cr1);
    CHECK(((cr1 >> 3) & 7U) == 3, "BR[2:0] = 011 (f_PCLK / 16)", "BR = %u", (unsigned)((cr1 >> 3) & 7U));
    CHECK(cr1 & SPI_CR1_SPE, "SPE = 1 (bật SPI)", "CR1 = 0x%04X", (unsigned)cr1);
    return t_fail != 0;
}
