# Con trỏ (2): Mảng, số học con trỏ & chuỗi

## Mảng "phân rã" thành con trỏ

Trong hầu hết biểu thức, tên mảng tự động trở thành **con trỏ tới phần tử đầu tiên**:

```c
uint16_t adc[4] = { 10, 20, 30, 40 };
uint16_t *p = adc;          /* ⇔ p = &adc[0]; */
```

Và phép truy cập chỉ số thực chất là số học con trỏ:

| Viết | Tương đương |
|---|---|
| `adc[i]` | `*(adc + i)` |
| `&adc[i]` | `adc + i` |
| `p[i]` | `*(p + i)` |

## Số học con trỏ đi theo **kích thước phần tử**

`p + 1` không cộng 1 byte mà cộng `sizeof(*p)` byte:

```crun
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t words[3] = { 0x11111111, 0x22222222, 0x33333333 };
    uint32_t *pw = words;
    uint8_t  *pb = (uint8_t *)words;

    printf("pw     = %p\n", (void *)pw);
    printf("pw + 1 = %p  (+4 byte)\n", (void *)(pw + 1));
    printf("pb + 1 = %p  (+1 byte)\n", (void *)(pb + 1));
    printf("*(pw + 2) = 0x%08X\n", *(pw + 2));

    uint32_t *end = words + 3;            /* trỏ NGAY SAU phần tử cuối: hợp lệ để so sánh */
    printf("số phần tử = end - words = %td\n", end - words);

    for (uint32_t *it = words; it < end; it++)
        printf("  phần tử tại %p = 0x%08X\n", (void *)it, *it);
    return 0;
}
```

Quy tắc:

- Hiệu hai con trỏ (cùng mảng) = **số phần tử** giữa chúng, kiểu `ptrdiff_t`.
- Được tạo con trỏ tới vị trí **ngay sau** phần tử cuối (`arr + n`) để so sánh, nhưng **không được** giải tham chiếu nó.
- Trỏ ra ngoài mảng (`arr - 1`, `arr + n + 1`) là UB dù không đọc.

## Truyền mảng vào hàm – mất kích thước

```c
void process(uint8_t buf[64]) {       /* thực ra là uint8_t *buf */
    sizeof(buf);                      /* = 4 (kích thước con trỏ), KHÔNG phải 64! */
}
```

Vì vậy hàm nhận mảng luôn đi kèm độ dài: `void process(const uint8_t *buf, size_t len)`. Macro đếm phần tử chỉ dùng được ở nơi mảng còn là mảng:

```c
#define ARRAY_LEN(a) (sizeof(a) / sizeof((a)[0]))
```

## Duyệt bằng con trỏ – phong cách hay gặp trong driver

```c
/* Gửi buffer qua SPI */
void spi_write(const uint8_t *data, size_t len) {
    const uint8_t *end = data + len;
    while (data < end) {
        while (!(SPI1->SR & SPI_SR_TXE)) { }
        SPI1->DR = *data++;          /* lấy giá trị rồi tăng con trỏ */
    }
}
```

`*data++` = `*(data++)`: dùng giá trị hiện tại rồi dịch con trỏ sang phần tử kế.

## Chuỗi ký tự

Chuỗi C là mảng `char` kết thúc bằng `'\0'`:

```c
char a[] = "OK";        /* mảng 3 byte {'O','K','\0'} trong RAM – sửa được   */
const char *b = "OK";   /* con trỏ tới chuỗi hằng trong FLASH (.rodata)      */
b[0] = 'X';             /* UB! Trên MCU: ghi vào Flash → bỏ qua hoặc HardFault */
```

Luôn khai báo con trỏ tới chuỗi hằng là `const char *`. Chuỗi trong Flash tiết kiệm RAM – điều rất quan trọng khi MCU chỉ có 20 KB RAM.

Các lỗi chuỗi kinh điển:

- Quên chỗ cho `'\0'`: `char s[5] = "Hello";` – không có ký tự kết thúc.
- `strcpy` vào buffer nhỏ → tràn buffer. Dùng `snprintf(buf, sizeof buf, …)`.
- So sánh chuỗi bằng `==` → so sánh **địa chỉ**. Dùng `strcmp`.

## Xem một biến dưới dạng từng byte – Endianness

Cortex-M là **little-endian**: byte thấp nằm ở địa chỉ thấp.

```crun
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t v = 0x12345678;
    uint8_t *b = (uint8_t *)&v;          /* char/uint8_t* được phép trỏ tới mọi kiểu */
    for (int i = 0; i < 4; i++)
        printf("địa chỉ +%d: 0x%02X\n", i, b[i]);
    /* little-endian in ra 78 56 34 12 */
    return 0;
}
```

Khi nhận dữ liệu big-endian từ cảm biến (I2C, SPI) phải ghép byte thủ công: `(uint16_t)((p[0] << 8) | p[1])`.

## Mảng 2 chiều và con trỏ tới mảng

```c
uint8_t frame[8][16];          /* 8 hàng × 16 byte, liên tục trong bộ nhớ */
uint8_t (*row)[16] = frame;    /* con trỏ tới MỘT HÀNG 16 byte */
row++;                         /* nhảy 16 byte – sang hàng kế */
uint8_t *cell = &frame[2][5];  /* = (uint8_t*)frame + 2*16 + 5 */
```

## Tóm tắt

- `a[i] ≡ *(a + i)`; `p + 1` tiến `sizeof(*p)` byte.
- Mảng truyền vào hàm thành con trỏ → luôn truyền kèm độ dài.
- Chuỗi literal nằm trong Flash → `const char *`.
- Ép sang `uint8_t *` để xem từng byte; nhớ Cortex-M là little-endian.
