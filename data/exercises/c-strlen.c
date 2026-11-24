// @title: Tự viết strlen
// @level: Cơ bản
// @desc: Viết size_t my_strlen(const char *s) trả về số ký tự trước ký tự kết thúc '\0'. Không dùng hàm thư viện.
// @hint: Dùng con trỏ chạy: const char *p = s; while (*p) p++; return p - s;
//==== starter
#include <stddef.h>

size_t my_strlen(const char *s) {
    // TODO
    return 0;
}
//==== solution
#include <stddef.h>

size_t my_strlen(const char *s) {
    const char *p = s;
    while (*p != '\0') {
        p++;
    }
    return (size_t)(p - s);
}
//==== test
int main(void) {
    TEST_BEGIN();
    CHECK(my_strlen("") == 0, "my_strlen(\"\") = 0", "nhận được %zu", my_strlen(""));
    CHECK(my_strlen("abc") == 3, "my_strlen(\"abc\") = 3", "nhận được %zu", my_strlen("abc"));
    CHECK(my_strlen("Hello\0World") == 5, "Dừng ở '\\0' đầu tiên: \"Hello\\0World\" → 5", "nhận được %zu", my_strlen("Hello\0World"));
    char buf[300];
    memset(buf, 'x', 299); buf[299] = '\0';
    CHECK(my_strlen(buf) == 299, "Chuỗi dài 299 ký tự", "nhận được %zu", my_strlen(buf));
    return t_fail != 0;
}
