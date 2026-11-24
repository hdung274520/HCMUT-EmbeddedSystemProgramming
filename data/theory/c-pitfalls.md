# Lỗi con trỏ thường gặp & cách debug

Phần lớn lỗi khó tìm trong firmware là lỗi con trỏ. Trên PC chúng gây segfault ngay; trên MCU chúng thường **âm thầm phá dữ liệu** rồi vài phút sau mới gây HardFault ở chỗ không liên quan.

## 1. Con trỏ chưa khởi tạo (wild pointer)

```c
uint8_t *p;          /* giá trị rác */
*p = 0x55;           /* ghi vào địa chỉ ngẫu nhiên */
```

✔ Luôn khởi tạo: `uint8_t *p = NULL;` và bật `-Wall -Wuninitialized`.

## 2. Trả về địa chỉ biến cục bộ (dangling pointer)

```c
char *make_msg(int v) {
    char buf[32];
    snprintf(buf, sizeof buf, "v=%d", v);
    return buf;              /* buf nằm trên stack, bị giải phóng khi return! */
}
```

Con trỏ trả về trỏ vào vùng stack mà lần gọi hàm kế tiếp sẽ ghi đè.
✔ Để người gọi cấp buffer: `void make_msg(char *out, size_t len, int v)`, hoặc dùng `static char buf[32]` (không reentrant).

## 3. Tràn buffer / off-by-one

```c
uint8_t rx[16];
for (int i = 0; i <= 16; i++) rx[i] = 0;    /* ghi rx[16] – ngoài mảng */
```

Byte ngoài mảng thường là biến kế bên trong `.bss` → biến đó tự nhiên "bị đổi giá trị".
✔ Dùng `i < N`, `sizeof`, `snprintf` thay `sprintf`, kiểm tra độ dài trước `memcpy`.

## 4. Tràn số với `size_t`

```c
void reverse(int *a, size_t n) {
    for (size_t j = n - 1; ...)   /* n = 0 → j = 4294967295 */
```

✔ Kiểm tra `n == 0` trước, hoặc duyệt bằng hai con trỏ `l < r`.

## 5. `sizeof` con trỏ thay vì `sizeof` mảng

```c
void clear(uint8_t *buf) { memset(buf, 0, sizeof buf); }   /* chỉ xóa 4 byte! */
```

✔ Truyền độ dài: `void clear(uint8_t *buf, size_t len)`.

## 6. Ép kiểu gây truy cập lệch (unaligned)

```c
uint8_t frame[8];
uint32_t v = *(uint32_t *)&frame[1];   /* địa chỉ lẻ */
```

- Cortex-M0/M0+: **HardFault** ngay.
- Cortex-M3/M4: `LDR` chấp nhận nhưng chậm; `LDRD`/`LDM` (compiler có thể sinh ra) vẫn fault.
- Còn vi phạm *strict aliasing* → compiler có thể tối ưu sai.

✔ Dùng `memcpy(&v, &frame[1], 4);` – compiler tối ưu thành lệnh phù hợp, luôn đúng.

## 7. Quên `volatile`

Biến chia sẻ ISR–main không `volatile` → vòng chờ bị tối ưu thành lặp vô hạn (xem chương Bộ nhớ).

## 8. Ghi vào chuỗi literal / dữ liệu const

```c
char *s = "hello";
s[0] = 'H';          /* .rodata nằm trong Flash */
```

✔ `const char *s` để compiler báo lỗi, hoặc `char s[] = "hello";` nếu cần sửa.

## 9. Dùng sau khi giải phóng (use-after-free) và double free

Hiếm gặp hơn nếu tuân thủ "không dùng heap lúc chạy", nhưng vẫn xảy ra với memory pool tự viết. ✔ Gán `p = NULL` ngay sau `free(p)`.

## 10. Nhầm thứ tự toán tử

| Viết | Thực ra là | Ý định thường gặp |
|---|---|---|
| `*p++` | `*(p++)` | đúng nếu muốn lấy rồi tăng con trỏ |
| `*p++ = x` vs `(*p)++` | tăng con trỏ vs tăng giá trị | |
| `if (REG & MASK == MASK)` | `REG & (MASK == MASK)` = `REG & 1` | `if ((REG & MASK) == MASK)` |
| `x << 2 + 1` | `x << 3` | `(x << 2) + 1` |

✔ Thêm ngoặc khi trộn toán tử bit với so sánh/số học. `-Wall` có `-Wparentheses` cảnh báo nhiều trường hợp.

## Debug HardFault trên Cortex-M

Khi fault xảy ra, CPU đã đẩy R0–R3, R12, LR, **PC**, xPSR lên stack. PC này chỉ đúng lệnh gây lỗi:

```c
void HardFault_Handler(void) {
    __asm volatile(
        "tst lr, #4      \n"   /* bit 2 của EXC_RETURN: dùng MSP hay PSP? */
        "ite eq          \n"
        "mrseq r0, msp   \n"
        "mrsne r0, psp   \n"
        "b hardfault_c   \n");
}

void hardfault_c(uint32_t *frame) {
    volatile uint32_t pc  = frame[6];       /* lệnh gây lỗi */
    volatile uint32_t lr  = frame[5];       /* hàm gọi nó */
    volatile uint32_t cfsr = SCB->CFSR;     /* nguyên nhân */
    volatile uint32_t bfar = SCB->BFAR;     /* địa chỉ gây BusFault */
    (void)pc; (void)lr; (void)cfsr; (void)bfar;
    while (1) { }                           /* đặt breakpoint ở đây */
}
```

Tra `pc` trong file `.map` hoặc `arm-none-eabi-addr2line -e fw.elf 0x08001234` để ra dòng code.

## Phòng bệnh hơn chữa bệnh

- Build với `-Wall -Wextra -Werror`.
- Chạy unit test logic trên PC với `-fsanitize=address,undefined` – đúng cách Playground của trang này chấm bài.
- Static analysis: `cppcheck`, `clang-tidy`.
- Bật MPU để biến vùng không được phép thành fault ngay lập tức.
- Đặt "stack canary" (giá trị đánh dấu ở đáy stack) và kiểm tra định kỳ.
