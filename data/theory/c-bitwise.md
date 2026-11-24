# Toán tử bit, mask & macro

Mọi ngoại vi trên MCU được điều khiển bằng cách bật/tắt từng bit trong thanh ghi 32 bit. Thành thạo toán tử bit là kỹ năng số một của lập trình viên nhúng.

## Sáu toán tử bit

| Toán tử | Tên | `a = 0b1100`, `b = 0b1010` | Ý nghĩa thường dùng |
|---|---|---|---|
| `a & b` | AND | `0b1000` | Giữ lại / kiểm tra bit (mask) |
| `a \| b` | OR | `0b1110` | Bật bit |
| `a ^ b` | XOR | `0b0110` | Đảo bit |
| `~a` | NOT | `…11110011` | Tạo mask ngược |
| `a << n` | Dịch trái | `0b1100 << 1 = 0b11000` | Đưa bit tới vị trí n, nhân 2ⁿ |
| `a >> n` | Dịch phải | `0b1100 >> 2 = 0b11` | Lấy bit về vị trí 0, chia 2ⁿ |

Đừng nhầm `&` với `&&`: `0b01 & 0b10 == 0` nhưng `0b01 && 0b10 == 1`.

## Bốn thao tác cơ bản trên một bit

```c
REG |=  (1U << n);          /* SET bit n          */
REG &= ~(1U << n);          /* CLEAR bit n        */
REG ^=  (1U << n);          /* TOGGLE bit n       */
bit = (REG >> n) & 1U;      /* READ bit n → 0/1   */
if (REG & (1U << n)) { }    /* TEST bit n (≠0 = đang bật) */
```

Mỗi lệnh `|=`, `&=`, `^=` thực chất là **đọc – sửa – ghi** (read-modify-write): đọc thanh ghi, tính toán, ghi lại. Nếu một ngắt xảy ra giữa lúc đọc và ghi và cũng sửa thanh ghi đó, thay đổi của ngắt bị mất. Đó là lý do tồn tại thanh ghi `BSRR` (xem chương GPIO).

## Trường nhiều bit (bit field trong thanh ghi)

Nhiều cấu hình chiếm nhiều bit: `MODER` 2 bit/chân, `AFR` 4 bit/chân, `BR` 3 bit. Quy trình luôn là **xóa trước, ghi sau**:

```c
/* Ghi giá trị 2 bit 'mode' cho chân 'pin' */
GPIOD->MODER &= ~(3U   << (pin * 2));     /* 1. xóa 2 bit           */
GPIOD->MODER |=  (mode << (pin * 2));     /* 2. OR giá trị mới       */

/* Gộp thành một lần ghi (tốt hơn: thanh ghi không bao giờ ở trạng thái trung gian) */
uint32_t mask = 3U << (pin * 2);
GPIOD->MODER = (GPIOD->MODER & ~mask) | ((mode << (pin * 2)) & mask);

/* Đọc trường */
uint32_t m = (GPIOD->MODER >> (pin * 2)) & 3U;
```

Nếu chỉ `|=` mà không xóa, giá trị cũ `11` (Analog) OR với `01` vẫn là `11` – lỗi rất hay gặp.

## Macro tiện dụng – và cách viết macro an toàn

```c
#define BIT(n)                 (1UL << (n))
#define SET_BIT(reg, mask)     ((reg) |= (mask))
#define CLEAR_BIT(reg, mask)   ((reg) &= ~(mask))
#define READ_BIT(reg, mask)    ((reg) & (mask))
#define MODIFY_REG(reg, clr, set) ((reg) = (((reg) & ~(clr)) | (set)))
```

Ba quy tắc cho macro:

1. **Bao ngoặc mọi tham số và toàn bộ biểu thức.** `#define SQR(x) x*x` → `SQR(1+2)` thành `1+2*1+2 = 5`.
2. **Tham số không được có tác dụng phụ.** `MAX(a++, b)` có thể tăng `a` hai lần.
3. **Macro nhiều lệnh bọc trong `do { … } while (0)`** để dùng an toàn sau `if` không có ngoặc nhọn.

```c
#define LED_TOGGLE() do { GPIOD->ODR ^= BIT(12); delay(100); } while (0)
```

Với hàm nhỏ, ưu tiên `static inline` – có kiểm tra kiểu và dễ debug hơn macro.

## Những phép dịch gây UB

- `1 << 31`: `1` là `int` có dấu → tràn → **UB**. Viết `1U << 31`.
- Dịch ≥ độ rộng kiểu: `x << 32` với `uint32_t` → **UB** (trên ARM thường cho 0, trên x86 cho `x`!).
- Dịch phải số âm (`-8 >> 1`): phụ thuộc compiler.

## Mẹo bit hay dùng

```crun
#include <stdio.h>
#include <stdint.h>

static void print_bin(uint8_t x) {
    for (int i = 7; i >= 0; i--) putchar((x >> i) & 1 ? '1' : '0');
    putchar('\n');
}

int main(void) {
    uint8_t x = 0x58;               /* 0101 1000 */
    print_bin(x);
    print_bin(x & (uint8_t)(x - 1)); /* xóa bit 1 thấp nhất  → 0101 0000 */
    print_bin(x & (uint8_t)-x);      /* chỉ giữ bit 1 thấp nhất → 0000 1000 */
    print_bin((uint8_t)(x | (x - 1)));/* bật mọi bit dưới bit 1 thấp nhất */
    printf("là lũy thừa của 2? %d\n", x && !(x & (x - 1)));
    printf("số chẵn? %d\n", !(x & 1));
    return 0;
}
```

## Bit-field trong struct

```c
typedef struct {
    uint32_t enable : 1;
    uint32_t mode   : 2;
    uint32_t        : 5;   /* bỏ trống */
    uint32_t prescaler : 8;
} ctrl_bits_t;
```

Gọn cho cờ trạng thái trong RAM, nhưng **không dùng để ánh xạ thanh ghi phần cứng**: thứ tự bit, padding và cách truy cập (8/16/32 bit) phụ thuộc compiler. CMSIS luôn dùng mask + shift.
