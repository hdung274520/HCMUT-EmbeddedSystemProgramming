// @title: Ring buffer (bộ đệm vòng) cho UART
// @level: Nâng cao
// @desc: Cài đặt bool rb_put(rb_t *rb, uint8_t c) và bool rb_get(rb_t *rb, uint8_t *out). head là vị trí GHI tiếp theo, tail là vị trí ĐỌC tiếp theo. Rỗng khi head == tail, đầy khi (head + 1) % RB_SIZE == tail (bỏ trống 1 ô → chứa tối đa RB_SIZE - 1 byte). put trả false khi đầy; get trả false khi rỗng (không ghi *out).
// @hint: put: uint16_t next = (rb->head + 1) % RB_SIZE; if (next == rb->tail) return false; rb->buf[rb->head] = c; rb->head = next; return true;
//==== starter
#include <stdint.h>
#include <stdbool.h>

#define RB_SIZE 8

typedef struct {
    uint8_t buf[RB_SIZE];
    volatile uint16_t head;   /* ISR ghi */
    volatile uint16_t tail;   /* main đọc */
} rb_t;

bool rb_put(rb_t *rb, uint8_t c) {
    // TODO
    return false;
}

bool rb_get(rb_t *rb, uint8_t *out) {
    // TODO
    return false;
}
//==== solution
#include <stdint.h>
#include <stdbool.h>

#define RB_SIZE 8

typedef struct {
    uint8_t buf[RB_SIZE];
    volatile uint16_t head;   /* ISR ghi */
    volatile uint16_t tail;   /* main đọc */
} rb_t;

bool rb_put(rb_t *rb, uint8_t c) {
    uint16_t next = (uint16_t)((rb->head + 1U) % RB_SIZE);
    if (next == rb->tail) return false;      /* đầy */
    rb->buf[rb->head] = c;
    rb->head = next;
    return true;
}

bool rb_get(rb_t *rb, uint8_t *out) {
    if (rb->head == rb->tail) return false;  /* rỗng */
    *out = rb->buf[rb->tail];
    rb->tail = (uint16_t)((rb->tail + 1U) % RB_SIZE);
    return true;
}
//==== test
int main(void) {
    TEST_BEGIN();
    rb_t rb = { { 0 }, 0, 0 };
    uint8_t c = 0xAA;
    CHECK(!rb_get(&rb, &c) && c == 0xAA, "get khi rỗng → false, không ghi *out", "c = 0x%02X", c);
    int ok = 1;
    for (int i = 0; i < RB_SIZE - 1; i++) ok &= rb_put(&rb, (uint8_t)('A' + i));
    CHECK(ok, "put được RB_SIZE - 1 = 7 byte", "có lần put bị từ chối");
    CHECK(!rb_put(&rb, 'Z'), "put lần thứ 8 → false (đầy)", "buffer nhận quá 7 byte");
    char got[8] = { 0 };
    for (int i = 0; i < 3; i++) rb_get(&rb, (uint8_t *)&got[i]);
    CHECK(memcmp(got, "ABC", 3) == 0, "FIFO: lấy ra A, B, C đúng thứ tự", "nhận \"%.3s\"", got);
    ok = rb_put(&rb, '1') && rb_put(&rb, '2') && rb_put(&rb, '3');
    CHECK(ok, "Sau khi lấy 3 byte, put thêm 3 byte (quay vòng chỉ số)", "put bị từ chối");
    char all[16] = { 0 }; int n = 0;
    while (n < 15 && rb_get(&rb, (uint8_t *)&all[n])) n++;
    CHECK(n == 7 && memcmp(all, "DEFG123", 7) == 0, "Đọc hết sau khi quay vòng: \"DEFG123\"", "nhận \"%s\" (%d byte)", all, n);
    CHECK(rb.head == rb.tail, "Rỗng lại: head == tail", "head=%u tail=%u", rb.head, rb.tail);
    return t_fail != 0;
}
