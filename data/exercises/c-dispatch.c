// @title: Bảng con trỏ hàm (command dispatch)
// @level: Trung bình
// @desc: Bộ xử lý lệnh UART thường dùng bảng con trỏ hàm thay cho switch-case dài. Viết int dispatch(const handler_t table[], size_t n, uint8_t cmd): nếu cmd < n và table[cmd] khác NULL thì gọi table[cmd]() và trả về 0; ngược lại trả về -1 (không được đọc ngoài mảng).
// @hint: if (cmd >= n || table[cmd] == NULL) return -1; table[cmd](); return 0;
//==== starter
#include <stdint.h>
#include <stddef.h>

typedef void (*handler_t)(void);

int dispatch(const handler_t table[], size_t n, uint8_t cmd) {
    // TODO
    return -1;
}
//==== solution
#include <stdint.h>
#include <stddef.h>

typedef void (*handler_t)(void);

int dispatch(const handler_t table[], size_t n, uint8_t cmd) {
    if (cmd >= n || table[cmd] == NULL) return -1;
    table[cmd]();
    return 0;
}
//==== test
static int led_on, led_off, reset;
static void cmd_led_on(void) { led_on++; }
static void cmd_led_off(void) { led_off++; }
static void cmd_reset(void) { reset++; }
int main(void) {
    TEST_BEGIN();
    const handler_t table[4] = { cmd_led_on, cmd_led_off, NULL, cmd_reset };
    int r = dispatch(table, 4, 0);
    CHECK(r == 0 && led_on == 1, "cmd 0 → gọi cmd_led_on, trả về 0", "r=%d, led_on=%d", r, led_on);
    r = dispatch(table, 4, 3);
    CHECK(r == 0 && reset == 1, "cmd 3 → gọi cmd_reset", "r=%d, reset=%d", r, reset);
    r = dispatch(table, 4, 2);
    CHECK(r == -1, "Ô NULL → -1, không gọi", "r=%d", r);
    r = dispatch(table, 4, 4);
    CHECK(r == -1, "cmd = n (ngoài mảng) → -1", "r=%d", r);
    r = dispatch(table, 4, 255);
    CHECK(r == -1 && led_off == 0, "cmd = 255 → -1", "r=%d", r);
    return t_fail != 0;
}
