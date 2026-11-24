# Kiểu dữ liệu, stdint & chuyển kiểu

Trong lập trình nhúng, **kích thước chính xác của biến** quyết định nó có vừa thanh ghi không, có tràn không và tốn bao nhiêu RAM. Vì vậy không bao giờ đoán kích thước của `int`.

## Vì sao phải dùng `<stdint.h>`

Chuẩn C chỉ quy định *kích thước tối thiểu*: `int` ≥ 16 bit, `long` ≥ 32 bit. Thực tế:

| Kiểu | AVR (8-bit) | Cortex-M (32-bit) | PC x86-64 |
|---|---|---|---|
| `char` | 1 byte | 1 byte | 1 byte |
| `short` | 2 | 2 | 2 |
| `int` | **2** | **4** | 4 |
| `long` | 4 | **4** | **8** (Linux) |
| con trỏ | 2 | **4** | **8** |

Cùng một đoạn code dùng `int` có thể chạy đúng trên PC nhưng tràn trên MCU 8-bit. Giải pháp: kiểu có độ rộng cố định.

| Kiểu | Bit | Khoảng giá trị | Dùng cho |
|---|---|---|---|
| `uint8_t` | 8 | 0 … 255 | byte dữ liệu UART/SPI |
| `int8_t` | 8 | −128 … 127 | |
| `uint16_t` | 16 | 0 … 65 535 | giá trị ADC 12 bit, chỉ số buffer |
| `int16_t` | 16 | −32 768 … 32 767 | mẫu cảm biến có dấu |
| `uint32_t` | 32 | 0 … 4 294 967 295 | **thanh ghi**, địa chỉ, bộ đếm tick |
| `int32_t` | 32 | ±2.1 tỷ | tính toán trung gian |
| `uint64_t` | 64 | | timestamp µs dài hạn |

Thêm: `size_t` (kích thước/chỉ số mảng, không âm), `uintptr_t` (số nguyên đủ chứa một địa chỉ), `bool` từ `<stdbool.h>`.

## Có dấu và không dấu

- **Không dấu tràn → quay vòng (được định nghĩa)**: `uint8_t x = 255; x++;` → `x == 0`.
- **Có dấu tràn → hành vi không xác định (UB)**: compiler được phép giả định nó không bao giờ xảy ra và tối ưu theo hướng bất ngờ.
- Thanh ghi, mask, bit luôn dùng **không dấu**. Hằng số dùng hậu tố `U`: `1U << 31` (còn `1 << 31` là UB vì `1` là `int` có dấu).

## Integer promotion – cái bẫy kinh điển

Trước khi tính toán, mọi kiểu nhỏ hơn `int` (`uint8_t`, `int16_t`, `char`…) đều được **nâng lên `int`**.

```crun
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t a = 200, b = 100;
    uint8_t  sum8  = a + b;     /* 300 bị cắt còn 44 khi gán */
    uint16_t sum16 = a + b;     /* a + b tính bằng int = 300 */
    printf("sum8 = %u, sum16 = %u\n", sum8, sum16);

    uint8_t x = 0x0F;
    if ((uint8_t)~x == 0xF0) printf("~x ép về uint8_t: 0xF0\n");
    if (~x != 0xF0) printf("~x không ép = 0x%X (đã thành int!)\n", ~x);

    /* so sánh có dấu với không dấu: -1 bị đổi thành 4294967295 */
    if (-1 < 1U) printf("-1 < 1U\n"); else printf("-1 < 1U là SAI!\n");
    return 0;
}
```

Quy tắc an toàn: **không trộn có dấu và không dấu trong một biểu thức**, ép kiểu tường minh khi so sánh kết quả của `~` hoặc `<<` trên kiểu nhỏ.

## Ép kiểu (cast)

```c
int32_t  big = 70000;
int16_t  small = (int16_t)big;    /* cắt bit cao: 70000 - 65536 = 4464 */
uint32_t raw = 4095;
float    volt = raw * 3.3f / 4095; /* ép sang float trước khi chia */
uint32_t ms = (uint32_t)(volt * 1000.0f);
```

- Chia số nguyên **cắt phần thập phân**: `7 / 2 == 3`. Muốn làm tròn: `(a + b/2) / b`.
- Trên MCU không có FPU (Cortex-M0/M3), `float` được giả lập bằng phần mềm → chậm hàng chục lần. Ưu tiên **số nguyên / fixed-point**, ví dụ lưu điện áp theo mV thay vì V.

## Hằng số và `#define` vs `const`

```c
#define LED_PIN      12U          /* tiền xử lý thay chữ, không có kiểu */
static const uint32_t TIMEOUT_MS = 500;  /* có kiểu, có phạm vi, debug được */
enum { STATE_IDLE, STATE_RUN };   /* hằng số nguyên có tên */
```

Viết số: `0x1F` (hex – dùng cho thanh ghi), `017` (**octal!** – cẩn thận số 0 đứng đầu), `0b1010` (mở rộng của GCC, chuẩn từ C23).

## Kiểm tra nhanh

1. `uint8_t i; for (i = 0; i < 256; i++)` có dừng không? *(Không – `i` không bao giờ đạt 256.)*
2. Kết quả `sizeof(uint32_t *)` trên STM32? *(4 byte.)*
3. Vì sao `0xFFFFFFFF` an toàn nhưng `-1` gán cho thanh ghi thì khó đọc? *(Ý đồ không rõ ràng, dễ nhầm khi so sánh có dấu.)*
