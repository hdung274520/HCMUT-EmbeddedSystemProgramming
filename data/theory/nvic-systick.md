# Ngắt: NVIC, EXTI & SysTick

## Dòng chảy của một ngắt ngoài

```
Nút nhấn PA0 ─▶ SYSCFG_EXTICR (chọn port A cho line 0) ─▶ EXTI line 0
   (RTSR/FTSR chọn sườn, IMR cho phép) ─▶ cờ EXTI->PR bit0 = 1 ─▶ NVIC (IRQ 6, ISER, priority)
   ─▶ CPU đẩy 8 thanh ghi lên stack, đọc vector[16+6] ─▶ EXTI0_IRQHandler()
```

```c
void button_irq_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB2ENR |= RCC_APB2ENR_SYSCFGEN;          /* SYSCFG cần clock! */
    GPIOA->MODER &= ~3U;                            /* PA0 input */

    SYSCFG->EXTICR[0] &= ~0xFU;                     /* EXTI0 ← port A (0000) */
    EXTI->RTSR |= EXTI_RTSR_TR0;                    /* sườn lên */
    EXTI->FTSR &= ~EXTI_FTSR_TR0;
    EXTI->IMR  |= EXTI_IMR_MR0;                     /* bỏ mask line 0 */

    NVIC_SetPriority(EXTI0_IRQn, 5);
    NVIC_EnableIRQ(EXTI0_IRQn);
}
```

## Viết ISR đúng cách

```c
volatile uint8_t g_button_event = 0;

void EXTI0_IRQHandler(void) {
    if (EXTI->PR & EXTI_PR_PR0) {
        EXTI->PR = EXTI_PR_PR0;      /* ghi 1 để XÓA cờ (rc_w1) */
        g_button_event = 1;          /* chỉ đặt cờ, xử lý trong main */
    }
}
```

1. **Xóa cờ pending** của ngoại vi. Quên → ngay khi thoát ISR, NVIC thấy vẫn pending và vào lại – chương trình "treo" trong ISR.
2. **Không dùng `EXTI->PR |= …`**: phép đọc trả về mọi cờ đang chờ, ghi lại tất cả bit 1 → xóa nhầm cờ của line khác.
3. ISR **ngắn**: không `delay`, không `printf`, không chờ cờ vô hạn.
4. Biến chia sẻ với main phải `volatile`.
5. Xóa cờ ở **đầu** ISR, vì do bus/pipeline, lệnh ghi cần vài chu kỳ mới tới ngoại vi; xóa ở cuối ISR có thể khiến ISR bị gọi lại một lần thừa (thêm `__DSB()` nếu cần).

## Priority: preempt và sub-priority

STM32 dùng **4 bit cao** của mỗi thanh ghi IPR (16 mức). `NVIC_SetPriorityGrouping()` chia 4 bit đó:

| Group | Preempt bit | Sub bit | Số mức preempt |
|---|---|---|---|
| 0 | 0 | 4 | 1 |
| 2 | 2 | 2 | 4 |
| 4 | 4 | 0 | 16 (FreeRTOS yêu cầu) |

- **Giá trị nhỏ hơn = ưu tiên cao hơn.**
- Ngắt có **preempt priority** cao hơn được **chen ngang** (nested) ngắt đang chạy.
- **Sub-priority** chỉ quyết định thứ tự khi hai ngắt **cùng pending** với cùng preempt priority – không bao giờ chen ngang.
- Cùng hết → số IRQ nhỏ hơn được phục vụ trước.

Tối ưu phần cứng: **tail-chaining** (ngắt kế tiếp chạy ngay mà không pop/push stack lại, 6 chu kỳ) và **late arrival**.

## Critical section

```c
uint32_t primask = __get_PRIMASK();
__disable_irq();
shared_counter++;              /* đọc–sửa–ghi an toàn */
__set_PRIMASK(primask);        /* khôi phục trạng thái cũ (lồng nhau an toàn) */
```

Giữ critical section càng ngắn càng tốt – nó làm tăng độ trễ của mọi ngắt.

## SysTick – timer 24 bit trong lõi

| Thanh ghi | Địa chỉ | Ý nghĩa |
|---|---|---|
| `CTRL` (SYST_CSR) | 0xE000E010 | bit0 ENABLE, bit1 TICKINT, bit2 CLKSOURCE (1 = clock CPU), bit16 COUNTFLAG |
| `LOAD` (SYST_RVR) | 0xE000E014 | Giá trị nạp lại (24 bit) |
| `VAL` (SYST_CVR) | 0xE000E018 | Giá trị đếm hiện tại; ghi bất kỳ = xóa về 0 |

Bộ đếm đếm **xuống** từ LOAD về 0 rồi nạp lại → chu kỳ = **LOAD + 1** xung:

```
SYST_RVR = T × f_clk − 1          (tối đa 0xFFFFFF = 16 777 215)
1 ms @ 16 MHz  → 15 999
1 ms @ 168 MHz → 167 999
Tối đa @ 168 MHz ≈ 99.8 ms
```

```c
volatile uint32_t g_ms = 0;
void SysTick_Handler(void) { g_ms++; }

void systick_init_1ms(uint32_t f_clk) {
    SysTick->LOAD = f_clk / 1000U - 1U;
    SysTick->VAL  = 0;
    SysTick->CTRL = SysTick_CTRL_CLKSOURCE_Msk | SysTick_CTRL_TICKINT_Msk | SysTick_CTRL_ENABLE_Msk;
}

void delay_ms(uint32_t ms) {
    uint32_t start = g_ms;
    while ((g_ms - start) < ms) { }   /* phép trừ không dấu: đúng cả khi g_ms tràn */
}
```

So sánh `(now - start) < ms` thay vì `now < start + ms` – cách viết thứ hai sai khi bộ đếm quay vòng sau ~49 ngày.

Dùng công cụ "SysTick" trong mục Công cụ để tính `SYST_RVR`.
