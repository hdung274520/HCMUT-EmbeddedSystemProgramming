static void run(const char *s) {
    char msg[96];
    usart1_reset();
    usart1_puts(s);
    int tc_ok = usart1_mem.DR == USART_IDLE_DR && (usart1_prev_sr & USART_SR_TC);
    usart1_hook(); /* collect the last byte */
    snprintf(msg, sizeof msg, "Gửi đúng chuỗi \"%s\"", s);
    CHECK(strcmp(usart1_log, s) == 0, msg, "nhận được \"%s\" (%d byte)", usart1_log, usart1_len);
    CHECK(usart1_len > 0 && usart1_overrun == 0, "Chờ TXE = 1 trước mỗi lần ghi DR", "%d byte ghi khi TXE = 0 (bị ghi đè)", usart1_overrun);
    CHECK(usart1_len > 0 && tc_ok, "Chờ TC = 1 trước khi return", "hàm return khi byte cuối chưa truyền xong");
}

int main(void) {
    TEST_BEGIN();
    run("Hello");
    run("AAA");
    return t_fail != 0;
}
