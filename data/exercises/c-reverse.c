// @title: Đảo ngược mảng bằng hai con trỏ
// @level: Cơ bản
// @desc: Viết void reverse(int *a, size_t n) đảo ngược mảng tại chỗ. Dùng hai con trỏ: một từ đầu, một từ cuối, tiến vào giữa. Chú ý n = 0: với size_t, n - 1 bị tràn thành số rất lớn!
// @hint: if (n < 2) return; int *l = a, *r = a + n - 1; while (l < r) { hoán đổi *l, *r; l++; r--; }
//==== starter
#include <stddef.h>

void reverse(int *a, size_t n) {
    // TODO
}
//==== solution
#include <stddef.h>

void reverse(int *a, size_t n) {
    if (n < 2) return;
    int *l = a, *r = a + n - 1;
    while (l < r) {
        int t = *l;
        *l++ = *r;
        *r-- = t;
    }
}
//==== test
static int eq(const int *a, const int *b, size_t n) { return memcmp(a, b, n * sizeof *a) == 0; }
int main(void) {
    TEST_BEGIN();
    int a[] = { 1, 2, 3, 4, 5 }, ra[] = { 5, 4, 3, 2, 1 };
    reverse(a, 5);
    CHECK(eq(a, ra, 5), "Số phần tử lẻ: {1,2,3,4,5} → {5,4,3,2,1}", "a = {%d,%d,%d,%d,%d}", a[0], a[1], a[2], a[3], a[4]);
    int b[] = { 1, 2, 3, 4 }, rb[] = { 4, 3, 2, 1 };
    reverse(b, 4);
    CHECK(eq(b, rb, 4), "Số phần tử chẵn: {1,2,3,4} → {4,3,2,1}", "b = {%d,%d,%d,%d}", b[0], b[1], b[2], b[3]);
    int c[] = { 9, 8 };
    reverse(c, 1);
    CHECK(c[0] == 9 && c[1] == 8, "n = 1 không thay đổi gì (và không đụng phần tử ngoài)", "c = {%d,%d}", c[0], c[1]);
    int d[] = { 7 };
    reverse(d, 0);
    CHECK(d[0] == 7, "n = 0 không truy cập bộ nhớ", "d[0] = %d", d[0]);
    return t_fail != 0;
}
