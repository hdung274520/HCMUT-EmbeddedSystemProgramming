// @title: Con trỏ tới struct: thống kê cảm biến
// @level: Trung bình
// @desc: Cho stats_t lưu min, max, tổng và số mẫu ADC. Viết stats_reset(stats_t *s), stats_add(stats_t *s, int16_t x) và int16_t stats_avg(const stats_t *s) (chia nguyên, trả về 0 khi chưa có mẫu). Dùng toán tử -> để truy cập trường qua con trỏ.
// @hint: Mẫu đầu tiên đặt cả min và max = x. Dùng s->count == 0 để nhận biết.
//==== starter
#include <stdint.h>

typedef struct {
    int16_t min;
    int16_t max;
    int32_t sum;
    uint16_t count;
} stats_t;

void stats_reset(stats_t *s) {
    // TODO
}

void stats_add(stats_t *s, int16_t x) {
    // TODO
}

int16_t stats_avg(const stats_t *s) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>

typedef struct {
    int16_t min;
    int16_t max;
    int32_t sum;
    uint16_t count;
} stats_t;

void stats_reset(stats_t *s) {
    s->min = 0;
    s->max = 0;
    s->sum = 0;
    s->count = 0;
}

void stats_add(stats_t *s, int16_t x) {
    if (s->count == 0 || x < s->min) s->min = x;
    if (s->count == 0 || x > s->max) s->max = x;
    s->sum += x;
    s->count++;
}

int16_t stats_avg(const stats_t *s) {
    return s->count ? (int16_t)(s->sum / s->count) : 0;
}
//==== test
int main(void) {
    TEST_BEGIN();
    stats_t s;
    memset(&s, 0x5A, sizeof s); /* garbage */
    stats_reset(&s);
    CHECK(s.count == 0 && s.sum == 0, "stats_reset xóa count và sum", "count=%u, sum=%ld", s.count, (long)s.sum);
    CHECK(stats_avg(&s) == 0, "avg khi chưa có mẫu = 0", "avg=%d", stats_avg(&s));
    stats_add(&s, 100);
    CHECK(s.min == 100 && s.max == 100, "Mẫu đầu tiên: min = max = 100", "min=%d, max=%d", s.min, s.max);
    stats_add(&s, -20); stats_add(&s, 400); stats_add(&s, 40);
    CHECK(s.min == -20 && s.max == 400, "min = -20, max = 400", "min=%d, max=%d", s.min, s.max);
    CHECK(s.count == 4 && s.sum == 520, "count = 4, sum = 520", "count=%u, sum=%ld", s.count, (long)s.sum);
    CHECK(stats_avg(&s) == 130, "avg = 130", "avg=%d", stats_avg(&s));
    stats_reset(&s);
    stats_add(&s, 4000); stats_add(&s, 4095);
    CHECK(s.min == 4000 && s.max == 4095 && stats_avg(&s) == 4047, "Sau reset bắt đầu lại đúng (4000, 4095 → avg 4047)", "min=%d max=%d avg=%d", s.min, s.max, stats_avg(&s));
    return t_fail != 0;
}
