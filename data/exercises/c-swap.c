// @title: Hoán đổi hai biến bằng con trỏ
// @level: Cơ bản
// @desc: Viết hàm void swap(int *a, int *b) hoán đổi giá trị hai biến mà a và b trỏ tới. Hàm phải đúng cả khi a và b trỏ cùng một biến.
// @hint: Dùng biến tạm: int t = *a; *a = *b; *b = t; — mẹo XOR swap sẽ biến giá trị thành 0 khi a == b.
//==== starter
void swap(int *a, int *b) {
    // TODO: hoán đổi *a và *b
}
//==== solution
void swap(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}
//==== test
int main(void) {
    TEST_BEGIN();
    int x = 3, y = 7;
    swap(&x, &y);
    CHECK(x == 7 && y == 3, "swap(&x, &y) với x=3, y=7 → x=7, y=3", "x=%d, y=%d", x, y);
    int n = -5, m = 2147483647;
    swap(&n, &m);
    CHECK(n == 2147483647 && m == -5, "Đúng với số âm và INT_MAX", "n=%d, m=%d", n, m);
    int z = 42;
    swap(&z, &z);
    CHECK(z == 42, "swap(&z, &z) giữ nguyên giá trị (a và b cùng địa chỉ)", "z=%d (XOR swap làm z = 0)", z);
    return t_fail != 0;
}
