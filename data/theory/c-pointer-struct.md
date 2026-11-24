# Con trỏ (3): Struct, `->` & ánh xạ thanh ghi

## Struct và con trỏ tới struct

```c
typedef struct {
    uint8_t  id;
    uint16_t raw;
    int16_t  temp_c10;      /* nhiệt độ × 10 */
} sensor_t;

sensor_t s1 = { .id = 1, .raw = 0, .temp_c10 = 0 };
sensor_t *ps = &s1;

ps->raw = 2048;             /* ⇔ (*ps).raw = 2048; */
```

`p->field` chỉ là cách viết gọn của `(*p).field`. Truyền struct vào hàm **luôn bằng con trỏ** – tránh sao chép cả struct lên stack:

```c
void sensor_update(sensor_t *s, uint16_t raw) {      /* sửa được */
    s->raw = raw;
    s->temp_c10 = (int16_t)((raw * 3300 / 4095 - 500));
}
void sensor_print(const sensor_t *s) { /* chỉ đọc */ }
```

## Padding và alignment

Cortex-M truy cập `uint32_t` nhanh nhất khi địa chỉ chia hết cho 4. Compiler chèn **byte đệm** để mỗi trường được căn đúng:

```crun
#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

typedef struct { uint8_t a; uint32_t b; uint8_t c; } bad_t;    /* 1+3pad+4+1+3pad */
typedef struct { uint32_t b; uint8_t a; uint8_t c; } good_t;   /* 4+1+1+2pad */
typedef struct __attribute__((packed)) { uint8_t a; uint32_t b; uint8_t c; } packed_t;

int main(void) {
    printf("bad_t    = %zu byte, offset b = %zu\n", sizeof(bad_t), offsetof(bad_t, b));
    printf("good_t   = %zu byte\n", sizeof(good_t));
    printf("packed_t = %zu byte, offset b = %zu\n", sizeof(packed_t), offsetof(packed_t, b));
    return 0;
}
```

- **Sắp xếp trường từ lớn đến nhỏ** để giảm padding – tiết kiệm RAM khi có mảng struct.
- `__attribute__((packed))` bỏ padding (dùng cho khung giao thức), nhưng truy cập trường lệch địa chỉ chậm hơn, và trên Cortex-M0 gây **HardFault** nếu lấy con trỏ tới trường đó rồi đọc 32 bit.

## Ánh xạ thanh ghi: từ địa chỉ số thành con trỏ

Datasheet nói: thanh ghi `GPIOD_ODR` ở địa chỉ `0x40020C14`. Để ghi vào đó:

```c
#define GPIOD_ODR  (*(volatile uint32_t *)0x40020C14UL)
GPIOD_ODR |= (1U << 12);
```

Phân tích từ trong ra ngoài:

1. `0x40020C14UL` – một số nguyên.
2. `(volatile uint32_t *)` – **ép số đó thành con trỏ** tới một `uint32_t` volatile.
3. `*( … )` – giải tham chiếu: chính là "ô nhớ" 32 bit tại địa chỉ đó.
4. `volatile` – bắt compiler đọc/ghi thật mỗi lần, không cache vào thanh ghi CPU.

## Cách CMSIS làm: struct phủ lên vùng thanh ghi

Mỗi ngoại vi có các thanh ghi **liên tiếp** cách nhau 4 byte. Thay vì định nghĩa hàng trăm địa chỉ, CMSIS khai báo một struct có đúng bố cục đó và đặt nó lên địa chỉ gốc:

```c
typedef struct {
    volatile uint32_t MODER;    /* offset 0x00 */
    volatile uint32_t OTYPER;   /* offset 0x04 */
    volatile uint32_t OSPEEDR;  /* offset 0x08 */
    volatile uint32_t PUPDR;    /* offset 0x0C */
    volatile uint32_t IDR;      /* offset 0x10 */
    volatile uint32_t ODR;      /* offset 0x14 */
    volatile uint32_t BSRR;     /* offset 0x18 */
    volatile uint32_t LCKR;     /* offset 0x1C */
    volatile uint32_t AFR[2];   /* offset 0x20, 0x24 */
} GPIO_TypeDef;

#define GPIOD_BASE  0x40020C00UL
#define GPIOD       ((GPIO_TypeDef *)GPIOD_BASE)

GPIOD->ODR |= (1U << 12);       /* ghi vào 0x40020C00 + 0x14 = 0x40020C14 */
```

`GPIOD` là một **con trỏ tới struct**, nên `GPIOD->ODR` = "trường ODR của struct nằm ở địa chỉ GPIOD_BASE". Cùng một kiểu `GPIO_TypeDef` dùng được cho GPIOA…GPIOK – chỉ khác địa chỉ gốc. Vì thế driver có thể nhận port làm tham số:

```c
void gpio_set_output(GPIO_TypeDef *port, uint8_t pin) {
    port->MODER = (port->MODER & ~(3U << (pin * 2))) | (1U << (pin * 2));
}
gpio_set_output(GPIOD, 12);
gpio_set_output(GPIOA, 5);
```

Kiểm chứng offset bằng `offsetof` (trong Playground, header giả lập dùng đúng bố cục này):

```crun
#include "stm32f4xx.h"
#include <stddef.h>

int main(void) {
    printf("offset MODER = 0x%02zX\n", offsetof(GPIO_TypeDef, MODER));
    printf("offset ODR   = 0x%02zX\n", offsetof(GPIO_TypeDef, ODR));
    printf("offset BSRR  = 0x%02zX\n", offsetof(GPIO_TypeDef, BSRR));
    printf("offset AFR[1]= 0x%02zX\n", offsetof(GPIO_TypeDef, AFR[1]));
    return 0;
}
```

## Handle pattern – struct mô tả một thiết bị

Driver tốt gom mọi thứ của một thiết bị vào struct và truyền con trỏ tới nó (kiểu HAL của ST):

```c
typedef struct {
    USART_TypeDef *regs;     /* ngoại vi phần cứng nào */
    uint32_t baud;
    rb_t rx;                 /* ring buffer nhận */
    void (*on_line)(const char *line);   /* callback */
} uart_handle_t;

uart_handle_t console = { .regs = USART2, .baud = 115200 };
uart_init(&console);
```

Một bộ code phục vụ nhiều UART – chỉ khác handle.

## Tóm tắt

- `p->f ≡ (*p).f`; truyền struct bằng con trỏ, chỉ đọc thì `const`.
- Padding phụ thuộc alignment; sắp trường lớn → nhỏ; `packed` có giá phải trả.
- Thanh ghi = con trỏ `volatile` tới địa chỉ cố định; CMSIS phủ struct lên khối thanh ghi.
