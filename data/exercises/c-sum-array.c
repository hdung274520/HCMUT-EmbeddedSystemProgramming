// @title: Tổng mảng bằng số học con trỏ
// @level: Cơ bản
// @desc: Viết int32_t sum_array(const int32_t *p, size_t n) trả về tổng n phần tử bắt đầu từ p. Thử duyệt bằng con trỏ (p++, hoặc con trỏ end = p + n) thay vì chỉ số [i]. n = 0 trả về 0.
// @hint: const int32_t *end = p + n; while (p < end) sum += *p++;
//==== starter
#include <stdint.h>
#include <stddef.h>

int32_t sum_array(const int32_t *p, size_t n) {
    // TODO
    return 0;
}
//==== solution
#include <stdint.h>
#include <stddef.h>

int32_t sum_array(const int32_t *p, size_t n) {
    int32_t sum = 0;
    const int32_t *end = p + n;
    while (p < end) {
        sum += *p++;
    }
    return sum;
}
//==== test
int main(void) {
    TEST_BEGIN();
    const int32_t a[] = { 1, 2, 3, 4 };
    CHECK(sum_array(a, 4) == 10, "sum({1,2,3,4}) = 10", "nhận được %ld", (long)sum_array(a, 4));
    const int32_t b[] = { -10, 5, -3, 100, 0, 8 };
    CHECK(sum_array(b, 6) == 100, "sum({-10,5,-3,100,0,8}) = 100", "nhận được %ld", (long)sum_array(b, 6));
    CHECK(sum_array(b + 3, 2) == 100, "sum(b + 3, 2) = 100 (bắt đầu giữa mảng)", "nhận được %ld", (long)sum_array(b + 3, 2));
    CHECK(sum_array(a, 0) == 0, "n = 0 → 0", "nhận được %ld", (long)sum_array(a, 0));
    return t_fail != 0;
}
