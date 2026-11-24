# GPIO ở mức thanh ghi

## Quy trình 5 bước (STM32F4)

```c
#include "stm32f4xx.h"

void led_init(void) {
    /* 1. Bật clock cho port D – thiếu bước này mọi lần ghi đều bị bỏ qua */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIODEN;

    /* 2. MODER: 01 = General purpose output (2 bit/chân) */
    GPIOD->MODER &= ~(3U << (12 * 2));
    GPIOD->MODER |=  (1U << (12 * 2));

    /* 3. OTYPER: 0 = Push-pull */
    GPIOD->OTYPER &= ~(1U << 12);

    /* 4. OSPEEDR: 00 low, 01 medium, 10 high, 11 very high */
    GPIOD->OSPEEDR &= ~(3U << (12 * 2));

    /* 5. PUPDR: 00 = không kéo */
    GPIOD->PUPDR &= ~(3U << (12 * 2));
}
```

## Bảng thanh ghi

| Thanh ghi | Offset | Bit/chân | Giá trị |
|---|---|---|---|
| `MODER` | 0x00 | 2 | 00 Input · 01 Output · 10 Alternate function · 11 Analog |
| `OTYPER` | 0x04 | 1 | 0 Push-pull · 1 Open-drain |
| `OSPEEDR` | 0x08 | 2 | Tốc độ sườn (ảnh hưởng EMI, không phải tần số tối đa của code) |
| `PUPDR` | 0x0C | 2 | 00 không · 01 Pull-up · 10 Pull-down |
| `IDR` | 0x10 | 1 | Mức logic đang đọc được trên chân (chỉ đọc) |
| `ODR` | 0x14 | 1 | Giá trị xuất ra |
| `BSRR` | 0x18 | — | Bit 0–15: **set**; bit 16–31: **reset** (chỉ ghi) |
| `LCKR` | 0x1C | — | Khóa cấu hình đến lần reset kế |
| `AFR[0]`/`AFR[1]` | 0x20/0x24 | 4 | Chọn AF0–AF15 cho chân 0–7 / 8–15 |

Chú ý: trên STM32F4 Discovery, **PA13/PA14 là chân SWD** (debug). Ghi đè `GPIOA->MODER = …` toàn bộ sẽ làm mất kết nối với debugger – luôn sửa đúng bit của chân mình.

## Push-pull vs Open-drain

- **Push-pull**: chủ động kéo lên VDD và xuống GND → điều khiển LED, tín hiệu số thông thường.
- **Open-drain**: chỉ kéo xuống; mức cao nhờ điện trở pull-up → bus **I2C**, nhiều thiết bị cùng chung một dây, giao tiếp với mức điện áp khác (5V tolerant).

## BSRR – ghi nguyên tử

```c
GPIOD->BSRR = (1U << 12);          /* set PD12   */
GPIOD->BSRR = (1U << (12 + 16));   /* reset PD12 */
GPIOD->BSRR = (1U << 13) | (1U << (12 + 16));   /* set PD13 và reset PD12 cùng lúc */
```

Vì sao không dùng `ODR |= …`?

```
main:  đọc ODR (0x0000)
           ── ngắt xảy ra: ISR làm ODR |= 1<<13  → ODR = 0x2000
main:  OR 1<<12 → 0x1000, ghi ODR = 0x1000      ← thay đổi của ISR bị mất!
```

`BSRR` là thanh ghi chỉ ghi, phần cứng chỉ tác động các bit có giá trị 1 → không có bước đọc, không có race.

Đảo trạng thái nguyên tử: `GPIOD->BSRR = (GPIOD->ODR & (1U << 12)) ? (1U << 28) : (1U << 12);` (vẫn có đọc ODR, nhưng chỉ ảnh hưởng chân 12).

## Đọc nút nhấn

```c
/* PA0 – nút USER trên Discovery, có điện trở kéo xuống ngoài */
RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
GPIOA->MODER &= ~(3U << 0);                    /* input */
GPIOA->PUPDR = (GPIOA->PUPDR & ~3U) | 2U;      /* pull-down */

if (GPIOA->IDR & (1U << 0)) { /* đang nhấn */ }
```

Nút cơ học **dội** (bounce) 1–20 ms: một lần nhấn sinh nhiều sườn. Lọc bằng phần mềm: đọc định kỳ mỗi 5–10 ms (từ SysTick) và chỉ chấp nhận khi N lần đọc liên tiếp giống nhau.

## Alternate function

Muốn PA2/PA3 làm USART2 TX/RX (AF7):

```c
GPIOA->MODER  = (GPIOA->MODER & ~((3U << 4) | (3U << 6))) | (2U << 4) | (2U << 6);  /* AF */
GPIOA->AFR[0] = (GPIOA->AFR[0] & ~((0xFU << 8) | (0xFU << 12))) | (7U << 8) | (7U << 12);
```

Số AF tra trong bảng "Alternate function mapping" của **datasheet** (không phải reference manual).
