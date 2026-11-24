# Con trỏ (1): Địa chỉ, `&`, `*` và truyền tham chiếu

Con trỏ là thứ làm C trở thành ngôn ngữ của hệ thống nhúng: mọi thanh ghi ngoại vi đều được truy cập **qua một con trỏ tới một địa chỉ cố định**. Hiểu con trỏ là hiểu bộ nhớ.

## Bộ nhớ là một dãy ô có địa chỉ

Mỗi byte trong bộ nhớ có một địa chỉ. Trên STM32, SRAM bắt đầu ở `0x20000000`. Giả sử:

```c
uint32_t x = 42;
uint32_t *p = &x;
```

| Địa chỉ | Nội dung | Tên |
|---|---|---|
| `0x20000100` | `42` (4 byte) | `x` |
| `0x20000104` | `0x20000100` (4 byte) | `p` |

- `x` chứa **giá trị** 42.
- `&x` là **địa chỉ** của `x`: `0x20000100`.
- `p` là một biến bình thường, nhưng giá trị nó chứa là một địa chỉ.
- `*p` nghĩa là "đi tới địa chỉ trong `p` và lấy/ghi giá trị ở đó" → `42`.

## Ba ký hiệu cần thuộc

| Cú pháp | Đọc là | Ví dụ |
|---|---|---|
| `int *p;` | p là con trỏ tới int (khai báo) | |
| `&x` | địa chỉ của x | `p = &x;` |
| `*p` | giá trị tại địa chỉ p (giải tham chiếu) | `*p = 10;` ⇔ `x = 10;` |

Dấu `*` có hai vai trò: trong **khai báo** nó nói "đây là con trỏ"; trong **biểu thức** nó là "lấy giá trị tại".

```crun
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t x = 42;
    uint32_t *p = &x;

    printf("x  = %u\n", x);
    printf("&x = %p\n", (void *)&x);
    printf("p  = %p  (bằng &x)\n", (void *)p);
    printf("*p = %u\n", *p);

    *p = 100;                          /* ghi qua con trỏ */
    printf("sau *p = 100: x = %u\n", x);

    uint32_t **pp = &p;                /* con trỏ tới con trỏ */
    **pp = 7;
    printf("sau **pp = 7: x = %u\n", x);
    printf("sizeof(p) = %zu byte trên máy này (4 byte trên Cortex-M)\n", sizeof p);
    return 0;
}
```

## NULL và con trỏ chưa khởi tạo

```c
uint8_t *buf;          /* rác! trỏ tới địa chỉ ngẫu nhiên → ghi vào là phá bộ nhớ */
uint8_t *buf = NULL;   /* an toàn: rõ ràng "chưa trỏ đi đâu" */
if (buf != NULL) { *buf = 0; }
```

Trên PC, giải tham chiếu `NULL` gây segfault ngay. Trên Cortex-M, địa chỉ `0x00000000` là **bảng vector ngắt** (alias của Flash) – đọc `*NULL` không lỗi gì mà trả về giá trị initial SP! Lỗi âm thầm, rất khó tìm. Luôn kiểm tra `NULL` ở đầu hàm nhận con trỏ.

## Truyền tham trị vs truyền con trỏ

C luôn **truyền bản sao** của đối số. Muốn hàm sửa biến của người gọi, phải truyền địa chỉ:

```crun
#include <stdio.h>

void tang_sai(int n)   { n++; }       /* sửa bản sao, vô ích */
void tang_dung(int *n) { (*n)++; }    /* sửa biến gốc qua địa chỉ */

void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }

int main(void) {
    int x = 5, y = 9;
    tang_sai(x);   printf("tang_sai:  x = %d\n", x);
    tang_dung(&x); printf("tang_dung: x = %d\n", x);
    swap(&x, &y);  printf("swap: x = %d, y = %d\n", x, y);
    return 0;
}
```

Chú ý `(*n)++` cần ngoặc: `*n++` là `*(n++)` – tăng **con trỏ**, không tăng giá trị.

## Tham số đầu ra (output parameter)

Mẫu rất phổ biến trong driver: trả về mã lỗi, kết quả ghi qua con trỏ.

```c
typedef enum { OK = 0, ERR_TIMEOUT, ERR_PARAM } status_t;

status_t adc_read(uint8_t channel, uint16_t *out) {
    if (out == NULL || channel > 15) return ERR_PARAM;
    /* ... bắt đầu chuyển đổi, chờ EOC có timeout ... */
    *out = (uint16_t)ADC1->DR;
    return OK;
}

uint16_t v;
if (adc_read(3, &v) == OK) { /* dùng v */ }
```

## `const` với con trỏ – đọc từ phải sang trái

| Khai báo | Đọc là | Đổi `*p`? | Đổi `p`? |
|---|---|---|---|
| `const uint8_t *p` | p trỏ tới uint8_t **hằng** | ✗ | ✓ |
| `uint8_t *const p` | p là con trỏ **hằng** tới uint8_t | ✓ | ✗ |
| `const uint8_t *const p` | con trỏ hằng tới dữ liệu hằng | ✗ | ✗ |

Quy ước tốt: tham số **chỉ đọc** luôn khai báo `const T *` – vừa là tài liệu, vừa để compiler bắt lỗi ghi nhầm, vừa cho phép truyền dữ liệu nằm trong Flash.

```c
void uart_send(const uint8_t *data, size_t len);   /* hứa không sửa data */
```

## Con trỏ cấp 2 (`T **`)

Cần khi hàm phải **thay đổi chính con trỏ** của người gọi:

```c
void alloc_buffer(uint8_t **out) {
    static uint8_t pool[64];
    *out = pool;            /* ghi vào biến con trỏ của người gọi */
}

uint8_t *buf = NULL;
alloc_buffer(&buf);         /* buf giờ trỏ tới pool */
```

Ví dụ khác: `int main(int argc, char **argv)`, chèn vào đầu danh sách liên kết (`node_t **head`) – có bài tập trong Playground.

## Tóm tắt

- Con trỏ = biến chứa địa chỉ. Kích thước con trỏ trên Cortex-M = 4 byte, bất kể trỏ tới kiểu gì.
- `&` lấy địa chỉ, `*` truy cập giá trị tại địa chỉ.
- Luôn khởi tạo con trỏ (`NULL` nếu chưa có gì) và kiểm tra trước khi dùng.
- Muốn hàm sửa biến → truyền `&biến`. Muốn hàm sửa con trỏ → truyền `&con_trỏ` (`T **`).
