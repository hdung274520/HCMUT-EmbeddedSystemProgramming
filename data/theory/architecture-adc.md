# Kiến trúc hệ thống nhúng & ADC

## Phân tầng phần mềm

```
┌──────────────────────────────────────────────┐
│ Application   FSM điều khiển, logic nghiệp vụ │  không biết chip là gì
├──────────────────────────────────────────────┤
│ Middleware    RTOS, FatFS, LwIP, Modbus, CLI  │
├──────────────────────────────────────────────┤
│ BSP           led_on(), temp_read_c(), btn()  │  biết board: LED ở PD12
├──────────────────────────────────────────────┤
│ Driver / HAL  gpio_write(), adc_read(), uart  │  biết chip: STM32F407
├──────────────────────────────────────────────┤
│ CMSIS         GPIOD->ODR, NVIC_EnableIRQ      │
└──────────────────────────────────────────────┘
```

Nguyên tắc:

- Mỗi tầng chỉ gọi **tầng ngay dưới**, qua API trong header.
- Tầng dưới báo lên bằng **callback** – không include header tầng trên.
- Đổi board → sửa BSP. Đổi chip → sửa Driver. Application giữ nguyên.
- Application thuần C, không đụng thanh ghi → **test được trên PC** (giống cách Playground chấm bài).

## ADC trên STM32F4

| Thông số | Giá trị |
|---|---|
| Độ phân giải | 12 bit (0 … 4095), có thể chọn 10/8/6 |
| Clock ADC | f_PCLK2 / 2, 4, 6, 8 (tối đa 36 MHz) |
| Thời gian chuyển đổi | Sampling time (3–480 chu kỳ) + 12 chu kỳ |
| Kênh | 16 kênh ngoài + cảm biến nhiệt độ, VREFINT, VBAT |

```
V_in = raw × V_REF / 4095
raw = 2048, V_REF = 3.3 V  →  ≈ 1.65 V
```

**Sampling time** phải đủ dài để tụ lấy mẫu nạp đầy qua trở kháng nguồn tín hiệu; nguồn trở kháng cao (cầu phân áp 100 kΩ) cần sampling time dài.

## Đọc một kênh (single conversion, polling)

```c
void adc1_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB2ENR |= RCC_APB2ENR_ADC1EN;
    GPIOA->MODER |= (3U << (1 * 2));       /* PA1 = Analog (11) */

    ADC->CCR = (ADC->CCR & ~ADC_CCR_ADCPRE) | ADC_CCR_ADCPRE_0;   /* PCLK2 / 4 */
    ADC1->SMPR2 = (ADC1->SMPR2 & ~(7U << 3)) | (7U << 3);         /* kênh 1: 480 chu kỳ */
    ADC1->SQR1 = 0;                        /* 1 chuyển đổi trong chuỗi */
    ADC1->SQR3 = 1;                        /* lần 1 = kênh 1 */
    ADC1->CR2 |= ADC_CR2_ADON;
}

uint16_t adc1_read(void) {
    ADC1->CR2 |= ADC_CR2_SWSTART;
    while (!(ADC1->SR & ADC_SR_EOC)) { }   /* thực tế: thêm timeout */
    return (uint16_t)ADC1->DR;             /* đọc DR xóa EOC */
}
```

## Nhiều kênh: Scan + DMA + Timer trigger

Cách chuyên nghiệp: timer kích ADC đều đặn (ví dụ 1 kHz), ADC quét nhiều kênh, DMA tự chép kết quả vào mảng, CPU chỉ xử lý khi DMA báo "nửa buffer" / "đầy buffer" (double buffering). Lấy mẫu đều chu kỳ là điều kiện để lọc số hoạt động đúng.

## Xử lý tín hiệu cảm biến

**Lọc trung bình trượt** (số nguyên, không float):

```c
#define N 8
static uint16_t win[N]; static uint32_t sum; static uint8_t idx;

uint16_t moving_avg(uint16_t x) {
    sum += x - win[idx];
    win[idx] = x;
    idx = (idx + 1) & (N - 1);
    return (uint16_t)(sum / N);
}
```

**Lọc IIR bậc 1** (nhẹ hơn, chỉ 1 biến): `y += (x - y) >> 3;` (α = 1/8).

**Chuyển đơn vị bằng fixed-point**: lưu nhiệt độ theo 0.1 °C trong `int16_t` thay vì `float`.

**Ngưỡng có hysteresis** tránh relay đóng/ngắt liên tục khi giá trị dao động quanh ngưỡng:

```c
if (!fan_on && temp_c10 > 300) fan_on = 1;    /* bật khi > 30.0 °C */
if ( fan_on && temp_c10 < 280) fan_on = 0;    /* tắt khi < 28.0 °C */
```

## Thiết kế một đề tài nhúng – checklist

1. **Yêu cầu**: đo gì, điều khiển gì, tần số lấy mẫu, độ trễ chấp nhận được, nguồn điện.
2. **Sơ đồ khối phần cứng** và bảng gán chân (pin map).
3. **Kiến trúc phần mềm**: SuperLoop hay RTOS; danh sách task, priority, chu kỳ.
4. **Máy trạng thái** của hệ thống, gồm trạng thái lỗi/an toàn.
5. **Driver** từng ngoại vi, test riêng (LED → UART log → cảm biến → cơ cấu chấp hành).
6. **Giao tiếp người dùng**: UART console/CLI để debug và cấu hình.
7. **Xử lý lỗi**: timeout mọi vòng chờ, watchdog (IWDG), kiểm tra giá trị cảm biến bất thường.
