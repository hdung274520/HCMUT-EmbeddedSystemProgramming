// @title: Trả về con trỏ tới phần tử lớn nhất
// @level: Trung bình
// @desc: Viết int *find_max(int *a, size_t n) trả về CON TRỎ tới phần tử lớn nhất (phần tử đầu tiên nếu có nhiều giá trị bằng nhau). Trả về NULL khi n = 0. Người gọi có thể sửa phần tử qua con trỏ trả về.
// @hint: int *best = a; for (int *p = a + 1; p < a + n; p++) if (*p > *best) best = p;
//==== starter
#include <stddef.h>

int *find_max(int *a, size_t n) {
    // TODO
    return NULL;
}
//==== solution
#include <stddef.h>

int *find_max(int *a, size_t n) {
    if (n == 0) return NULL;
    int *best = a;
    for (int *p = a + 1; p < a + n; p++) {
        if (*p > *best) best = p;
    }
    return best;
}
//==== test
int main(void) {
    TEST_BEGIN();
    int a[] = { 3, -1, 9, 4, 9 };
    int *p = find_max(a, 5);
    CHECK(p == &a[2], "Trả về &a[2] (địa chỉ, không phải giá trị)", "trả về %s", p ? "con trỏ khác &a[2]" : "NULL");
    if (p) *p = 0;
    CHECK(a[2] == 0, "Sửa *p thay đổi phần tử trong mảng gốc", "a[2] = %d", a[2]);
    int neg[] = { -8, -3, -5 };
    CHECK(find_max(neg, 3) == &neg[1], "Mảng toàn số âm → &neg[1]", "sai vị trí");
    CHECK(find_max(a, 0) == NULL, "n = 0 → NULL", "không trả về NULL");
    return t_fail != 0;
}
