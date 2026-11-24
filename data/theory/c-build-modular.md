# Build pipeline & Modular C

## Từ file .c đến firmware

```
main.c ──[1. Preprocess]──▶ main.i ──[2. Compile]──▶ main.s ──[3. Assemble]──▶ main.o ─┐
uart.c ─────────────────────────────────────────────────────────────────────────▶ uart.o ─┼─[4. Link + linker script .ld]──▶ fw.elf ──▶ fw.bin / fw.hex
startup_stm32f407.s ────────────────────────────────────────────────────────────▶ startup.o ┘
```

| Bước | Công cụ / lệnh | Làm gì |
|---|---|---|
| Tiền xử lý | `arm-none-eabi-gcc -E main.c` | Chép nội dung `#include`, thay `#define`, xử lý `#if` |
| Biên dịch | `-S` | C → hợp ngữ ARM Thumb |
| Hợp dịch | `-c` | Hợp ngữ → mã máy `.o` (còn ký hiệu chưa phân giải) |
| Liên kết | `arm-none-eabi-ld` (qua gcc) | Ghép các `.o`, phân giải ký hiệu, đặt section vào Flash/RAM theo **linker script** |

Linker script (`STM32F407VGTx_FLASH.ld`) khai báo vùng nhớ:

```
MEMORY {
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 1024K
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
}
```

Thêm `-Wl,-Map=fw.map` để linker xuất file map: biết từng hàm/biến nằm ở địa chỉ nào và tốn bao nhiêu byte.

Lỗi thường gặp theo bước:

- `fatal error: xxx.h: No such file` → tiền xử lý (thiếu `-I`).
- `error: expected ';'` → biên dịch.
- `undefined reference to 'uart_init'` → **liên kết** (quên thêm `uart.c` vào build, hoặc sai tên).
- `multiple definition of 'x'` → liên kết (định nghĩa biến trong header).
- `region 'RAM' overflowed` → liên kết (hết RAM).

## Header (.h) chứa gì, source (.c) chứa gì

| `uart.h` – giao diện công khai | `uart.c` – cài đặt |
|---|---|
| Include guard | `#include "uart.h"` đầu tiên |
| `#include` tối thiểu cần cho khai báo | Biến/hàm nội bộ `static` |
| `typedef`, `enum`, `#define` công khai | Định nghĩa biến toàn cục |
| Nguyên mẫu hàm | Thân hàm |
| `extern` biến (hạn chế dùng) | |

```c
/* uart.h */
#ifndef UART_H
#define UART_H

#include <stdint.h>
#include <stddef.h>

typedef enum { UART_OK = 0, UART_BUSY, UART_TIMEOUT } uart_status_t;

void          uart_init(uint32_t baud);
uart_status_t uart_write(const uint8_t *data, size_t len);
int           uart_getc(void);         /* -1 nếu không có dữ liệu */

#endif /* UART_H */
```

## Include guard

Không có guard, một header được include hai lần (trực tiếp và gián tiếp) sẽ định nghĩa lại `typedef` → lỗi. `#ifndef/#define/#endif` khiến lần include thứ hai thành rỗng. `#pragma once` là cách viết gọn được GCC/Clang/Keil hỗ trợ.

## Tránh phụ thuộc vòng (circular dependency)

`a.h` include `b.h`, `b.h` lại include `a.h` → một trong hai luôn thấy file kia "rỗng" do guard → lỗi kiểu không xác định.

Cách tránh:

1. **Phân tầng một chiều**: App → Service → Driver → HAL. Tầng dưới không bao giờ include tầng trên. Tầng dưới báo lên bằng **callback** (con trỏ hàm).
2. **Forward declaration** khi chỉ cần con trỏ:

```c
/* motor.h – không cần include "pid.h" */
struct pid;                                  /* khai báo trước */
void motor_attach_pid(struct pid *controller);
```

## Opaque pointer – đóng gói như class

Người dùng module chỉ cầm con trỏ, không thấy bên trong struct → không thể truy cập trực tiếp trường private:

```c
/* ringbuf.h */
typedef struct ringbuf ringbuf_t;            /* kiểu chưa hoàn chỉnh */
ringbuf_t *ringbuf_get(unsigned id);
bool       ringbuf_put(ringbuf_t *rb, uint8_t c);

/* ringbuf.c */
struct ringbuf { uint8_t buf[64]; uint16_t head, tail; };   /* chỉ file này biết */
static ringbuf_t pool[2];
ringbuf_t *ringbuf_get(unsigned id) { return id < 2 ? &pool[id] : NULL; }
```

## Một số cờ GCC cần biết cho nhúng

| Cờ | Tác dụng |
|---|---|
| `-mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard` | Chọn đúng lõi và FPU |
| `-O0` / `-Og` / `-O2` / `-Os` | Không tối ưu / debug được / nhanh / nhỏ |
| `-Wall -Wextra` | Bật cảnh báo – luôn dùng |
| `-ffunction-sections -fdata-sections` + `-Wl,--gc-sections` | Bỏ hàm không dùng → firmware nhỏ hơn |
| `--specs=nano.specs` | newlib-nano: printf nhỏ gọn |
| `-g3` | Thông tin debug đầy đủ cho GDB/OpenOCD |
