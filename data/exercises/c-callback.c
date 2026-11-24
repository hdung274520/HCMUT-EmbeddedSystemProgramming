// @title: Con trỏ hàm: callback for_each
// @level: Trung bình
// @desc: Viết void for_each(int *a, size_t n, void (*fn)(int *elem)) gọi fn cho TỪNG phần tử (truyền địa chỉ phần tử để fn có thể sửa nó). Nếu fn == NULL thì không làm gì. Đây là mẫu callback mà driver dùng để báo sự kiện cho ứng dụng.
// @hint: for (size_t i = 0; i < n; i++) fn(&a[i]);
//==== starter
#include <stddef.h>

void for_each(int *a, size_t n, void (*fn)(int *elem)) {
    // TODO
}
//==== solution
#include <stddef.h>

void for_each(int *a, size_t n, void (*fn)(int *elem)) {
    if (fn == NULL) return;
    for (size_t i = 0; i < n; i++) {
        fn(&a[i]);
    }
}
//==== test
static int calls;
static void double_it(int *x) { *x *= 2; calls++; }
static void clamp10(int *x) { if (*x > 10) *x = 10; calls++; }
int main(void) {
    TEST_BEGIN();
    int a[] = { 1, 2, 3, 4 };
    calls = 0;
    for_each(a, 4, double_it);
    CHECK(a[0] == 2 && a[1] == 4 && a[2] == 6 && a[3] == 8, "for_each(a, 4, double_it) → {2,4,6,8}", "a = {%d,%d,%d,%d}", a[0], a[1], a[2], a[3]);
    CHECK(calls == 4, "Callback được gọi đúng 4 lần", "gọi %d lần", calls);
    int b[] = { 5, 50, 15 };
    for_each(b, 3, clamp10);
    CHECK(b[0] == 5 && b[1] == 10 && b[2] == 10, "Callback khác: clamp10 → {5,10,10}", "b = {%d,%d,%d}", b[0], b[1], b[2]);
    calls = 0;
    for_each(b, 0, double_it);
    CHECK(calls == 0, "n = 0 → không gọi callback", "gọi %d lần", calls);
    for_each(b, 3, NULL);
    CHECK(1, "fn == NULL không làm chương trình crash", "crash");
    return t_fail != 0;
}
