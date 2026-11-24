# USART & UART Console

## Khung truyền 8-N-1

```
idle ‾‾‾‾‾|_S_|D0|D1|D2|D3|D4|D5|D6|D7|‾P‾|‾‾‾‾ idle
           start  8 bit dữ liệu, LSB trước   stop
```

1 start (0) + 8 data + không parity + 1 stop (1) = **10 bit/ký tự**. Ở 115200 baud: 11 520 byte/s ≈ 87 µs/byte. Hai bên phải thống nhất baud rate với sai số tổng < ~3%.

## Thanh ghi USART (STM32F4)

| Thanh ghi | Bit quan trọng |
|---|---|
| `SR` | **TXE** (bit 7): DR trống, ghi tiếp được · **TC** (bit 6): truyền xong hẳn · **RXNE** (bit 5): có byte nhận · **ORE** (bit 3): tràn – byte mới đến khi byte cũ chưa đọc |
| `DR` | Ghi = gửi; đọc = nhận (đọc DR tự xóa RXNE) |
| `BRR` | DIV_Mantissa [15:4], DIV_Fraction [3:0] |
| `CR1` | **UE** (13) bật USART · M (12) 9 bit · **TE** (3) · **RE** (2) · RXNEIE (5) · TXEIE (7) |

## Công thức baud rate (OVER8 = 0)

```
USARTDIV     = f_PCLK / (16 × baud)
DIV_Mantissa = phần nguyên của USARTDIV
DIV_Fraction = round(phần lẻ × 16)        (nếu = 16 → Mantissa + 1, Fraction = 0)
USART_BRR    = (Mantissa << 4) | Fraction
```

Ví dụ f_PCLK = 16 MHz, 115200: USARTDIV = 8.6806 → M = 8, F = round(0.6806 × 16) = 11 → **BRR = 0x8B**, baud thực = 115 108 (sai số −0.08%).

Mẹo: vì BRR = USARTDIV × 16 = f_PCLK / baud, có thể tính bằng số nguyên: `BRR = (f_PCLK + baud/2) / baud`. Kiểm tra: (16 000 000 + 57 600) / 115 200 = 139 = 0x8B. ✓

Chú ý f_PCLK: USART1/6 nằm trên **APB2**, USART2/3, UART4/5 nằm trên **APB1** – clock khác nhau.

## Khởi tạo USART2 (PA2 TX, PA3 RX)

```c
void usart2_init(uint32_t pclk1, uint32_t baud) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_USART2EN;

    GPIOA->MODER  = (GPIOA->MODER & ~(0xFU << 4)) | (0xAU << 4);          /* PA2, PA3 = AF */
    GPIOA->AFR[0] = (GPIOA->AFR[0] & ~(0xFFU << 8)) | (0x77U << 8);       /* AF7 */

    USART2->BRR = (pclk1 + baud / 2U) / baud;
    USART2->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_UE;
}
```

## Ba cách truyền nhận

| | Polling | Interrupt | DMA |
|---|---|---|---|
| CPU | Chờ bận từng byte | Một ngắt / byte | Gần như rảnh |
| Độ phức tạp | Thấp | Trung bình (cần buffer) | Cao |
| Dùng khi | Debug, khởi động | Console, lệnh ngắn | Luồng dữ liệu lớn, tốc độ cao |

**Polling:**

```c
void usart2_putc(char c) {
    while (!(USART2->SR & USART_SR_TXE)) { }
    USART2->DR = (uint8_t)c;
}
void usart2_puts(const char *s) {
    while (*s) usart2_putc(*s++);
    while (!(USART2->SR & USART_SR_TC)) { }   /* trước khi tắt USART / ngủ */
}
```

**Interrupt + ring buffer cho nhận:**

```c
static rb_t rx;
void USART2_IRQHandler(void) {
    if (USART2->SR & USART_SR_RXNE) {
        rb_put(&rx, (uint8_t)USART2->DR);      /* đọc DR xóa RXNE */
    }
}
int usart2_getc(void) {                        /* gọi từ main, không chặn */
    uint8_t c;
    return rb_get(&rx, &c) ? c : -1;
}
```

## Ring buffer

Mảng kích thước N với hai chỉ số: **head** (vị trí ghi kế tiếp – ISR) và **tail** (vị trí đọc kế tiếp – main).

- Rỗng: `head == tail`
- Đầy: `(head + 1) % N == tail` → bỏ trống 1 ô, chứa tối đa N − 1 byte
- N là lũy thừa của 2 → thay `% N` bằng `& (N − 1)` (nhanh hơn trên M0 không có lệnh chia).

Một producer (ISR) + một consumer (main), mỗi bên chỉ ghi chỉ số của mình, chỉ số là `volatile` và được ghi bằng một lệnh 32/16 bit → **không cần khóa**. Mô phỏng trong mục Công cụ, cài đặt trong bài tập Playground.

## Chuyển hướng printf

newlib gọi `_write()` cho mọi đầu ra của `printf`:

```c
int _write(int fd, char *ptr, int len) {
    (void)fd;
    for (int i = 0; i < len; i++) {
        if (ptr[i] == '\n') usart2_putc('\r');   /* terminal cần CRLF */
        usart2_putc(ptr[i]);
    }
    return len;
}
```

`printf("%f")` với newlib-nano cần thêm cờ linker `-u _printf_float` (tốn ~10 KB Flash). Không gọi `printf` trong ISR.
