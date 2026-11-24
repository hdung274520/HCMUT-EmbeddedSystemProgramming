# SPI Driver

## Tín hiệu

| Chân | Hướng (từ Master) | Ý nghĩa |
|---|---|---|
| SCK | ra | Clock do master tạo |
| MOSI | ra | Master Out Slave In |
| MISO | vào | Master In Slave Out |
| CS / NSS | ra | Chọn slave, tích cực mức thấp; mỗi slave một chân CS |

SPI là **full-duplex đồng bộ**: mỗi xung clock, master đẩy 1 bit ra MOSI **và** nhận 1 bit từ MISO. Gửi 1 byte luôn đồng thời nhận 1 byte – muốn đọc thì phải gửi byte "rác" (thường 0xFF) để tạo clock.

## CPOL & CPHA – 4 mode

| Mode | CPOL | CPHA | SCK khi nghỉ | Lấy mẫu dữ liệu ở |
|---|---|---|---|---|
| 0 | 0 | 0 | thấp | sườn **lên** (sườn đầu) |
| 1 | 0 | 1 | thấp | sườn xuống (sườn thứ hai) |
| 2 | 1 | 0 | cao | sườn xuống (sườn đầu) |
| 3 | 1 | 1 | cao | sườn lên (sườn thứ hai) |

Mode = CPOL × 2 + CPHA. Mode do **slave quy định** (xem datasheet cảm biến: ví dụ LIS3DSH hỗ trợ mode 0 và 3). Sai mode → dữ liệu lệch 1 bit hoặc toàn rác.

## Thanh ghi SPI_CR1

| Bit | Tên | Ý nghĩa |
|---|---|---|
| 0 | CPHA | |
| 1 | CPOL | |
| 2 | MSTR | 1 = Master |
| 5:3 | BR[2:0] | f_PCLK / 2^(BR+1): 000 = /2 … 011 = /16 … 111 = /256 |
| 6 | SPE | Bật SPI – cấu hình xong rồi mới bật |
| 7 | LSBFIRST | |
| 8 | SSI | Giá trị NSS nội bộ khi SSM = 1 |
| 9 | SSM | Quản lý NSS bằng phần mềm |
| 11 | DFF | 0 = 8 bit, 1 = 16 bit |

Ở chế độ master với NSS phần mềm phải đặt **SSM = 1 và SSI = 1**; nếu SSI = 0, SPI tưởng có master khác đang chiếm bus → lỗi **MODF** và tự rời chế độ master.

## Khởi tạo SPI1 Mode 0 (PA5 SCK, PA6 MISO, PA7 MOSI, PE3 CS)

```c
void spi1_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN | RCC_AHB1ENR_GPIOEEN;
    RCC->APB2ENR |= RCC_APB2ENR_SPI1EN;

    GPIOA->MODER  = (GPIOA->MODER & ~(0x3FU << 10)) | (0x2AU << 10);        /* PA5-7 AF */
    GPIOA->AFR[0] = (GPIOA->AFR[0] & ~(0xFFFU << 20)) | (0x555U << 20);     /* AF5 */

    GPIOE->MODER = (GPIOE->MODER & ~(3U << 6)) | (1U << 6);                 /* PE3 output */
    GPIOE->BSRR  = (1U << 3);                                               /* CS = 1 (nghỉ) */

    SPI1->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI | (3U << 3);       /* /16, mode 0 */
    SPI1->CR1 |= SPI_CR1_SPE;
}
```

## Truyền nhận một byte

```c
uint8_t spi1_xfer(uint8_t tx) {
    while (!(SPI1->SR & SPI_SR_TXE)) { }
    SPI1->DR = tx;
    while (!(SPI1->SR & SPI_SR_RXNE)) { }
    return (uint8_t)SPI1->DR;          /* luôn đọc DR, kể cả khi không cần, để tránh OVR */
}

uint8_t sensor_read_reg(uint8_t reg) {
    GPIOE->BSRR = (1U << (3 + 16));    /* CS = 0 */
    spi1_xfer(0x80 | reg);             /* bit 7 = đọc */
    uint8_t v = spi1_xfer(0xFF);       /* byte rác để tạo clock */
    while (SPI1->SR & SPI_SR_BSY) { }  /* chờ byte cuối ra hết */
    GPIOE->BSRR = (1U << 3);           /* CS = 1 */
    return v;
}
```

Kéo CS lên **sau khi BSY = 0**, không phải ngay sau TXE – nếu không, byte cuối bị cắt.

## Race condition trên bus SPI

Nếu main đang giao tiếp với cảm biến A mà một ISR (hoặc task RTOS khác) chen vào dùng SPI cho thẻ nhớ B → CS của hai thiết bị cùng thấp, dữ liệu hỏng. Cần khóa bus.

**Spinlock nguyên tử bằng LDREX/STREX** (Cortex-M3/M4):

```c
static volatile uint32_t spi_lock = 0;

int spi_try_lock(void) {
    if (__LDREXW(&spi_lock) != 0) { __CLREX(); return 0; }   /* đang bận */
    if (__STREXW(1, &spi_lock) != 0) return 0;                /* bị chen giữa, thử lại */
    __DMB();
    return 1;
}
void spi_unlock(void) { __DMB(); spi_lock = 0; }
```

`STREX` chỉ thành công nếu không có truy cập độc quyền nào khác (kể cả ngắt) xảy ra kể từ `LDREX` → thao tác kiểm tra-và-đặt trở thành nguyên tử mà không cần tắt ngắt.

Không bao giờ **spin chờ** khóa trong ISR khi người giữ khóa là main: main không thể chạy tiếp để nhả khóa → deadlock. ISR dùng `try_lock` và bỏ qua/hoãn nếu bận. Trong RTOS, dùng **mutex**.
