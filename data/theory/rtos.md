# RTOS: FreeRTOS & CMSIS-RTOS

## Khi nào cần RTOS?

SuperLoop khó khăn khi: nhiều việc có deadline khác nhau, có việc chặn lâu (chờ mạng, ghi thẻ SD), cần ưu tiên rõ ràng. RTOS cung cấp **scheduler preemptive**: task ưu tiên cao được chạy ngay khi sẵn sàng, cắt ngang task thấp hơn.

## Task

```c
#include "FreeRTOS.h"
#include "task.h"

static void vLedTask(void *pvParameters) {
    const uint32_t period = (uint32_t)pvParameters;
    TickType_t last = xTaskGetTickCount();
    for (;;) {
        led_toggle();
        vTaskDelayUntil(&last, pdMS_TO_TICKS(period));   /* chu kỳ chính xác */
    }
}

int main(void) {
    hw_init();
    xTaskCreate(vLedTask, "LED", 128, (void *)500, 1, NULL);   /* stack 128 word = 512 byte */
    xTaskCreate(vSensorTask, "SENS", 256, NULL, 3, NULL);
    vTaskStartScheduler();       /* không bao giờ return nếu đủ heap */
    for (;;) { }
}
```

Trạng thái task: **Running** → **Ready** (sẵn sàng, chờ CPU) / **Blocked** (chờ thời gian, queue, semaphore) / **Suspended**.

Task không bao giờ `return`; nếu cần kết thúc, gọi `vTaskDelete(NULL)`.

## Priority

- FreeRTOS: **số lớn hơn = ưu tiên cao hơn** (0 = idle) – **ngược với NVIC**!
- Luôn chạy task Ready có priority cao nhất; cùng priority → round-robin mỗi tick (`configUSE_TIME_SLICING`).
- Task ưu tiên cao không bao giờ block → các task thấp hơn bị "chết đói" (starvation).

Với Cortex-M: ISR gọi API FreeRTOS (`...FromISR`) phải có NVIC priority **số lớn hơn hoặc bằng** `configMAX_SYSCALL_INTERRUPT_PRIORITY` (tức ưu tiên thấp hơn). Sai điều này → `configASSERT` hoặc crash ngẫu nhiên. Và gọi `NVIC_SetPriorityGrouping(0)` (4 bit preempt).

## Queue – truyền dữ liệu giữa task / ISR

```c
static QueueHandle_t adcQ;

void ADC_IRQHandler(void) {
    BaseType_t woken = pdFALSE;
    uint16_t v = (uint16_t)ADC1->DR;
    xQueueSendFromISR(adcQ, &v, &woken);
    portYIELD_FROM_ISR(woken);         /* chuyển ngay sang task vừa được đánh thức */
}

static void vProcessTask(void *p) {
    uint16_t v;
    for (;;) {
        if (xQueueReceive(adcQ, &v, pdMS_TO_TICKS(100)) == pdPASS) filter_add(v);
        else report_timeout();
    }
}

adcQ = xQueueCreate(16, sizeof(uint16_t));   /* sao chép theo giá trị */
```

## Semaphore vs Mutex

| | Binary semaphore | Counting semaphore | Mutex |
|---|---|---|---|
| Mục đích | Đồng bộ / báo hiệu | Đếm tài nguyên/sự kiện | Loại trừ lẫn nhau |
| Có chủ sở hữu | Không | Không | **Có** – chỉ task đã lấy mới được trả |
| Priority inheritance | Không | Không | **Có** |
| Dùng trong ISR | `GiveFromISR` | `GiveFromISR` | **Không** |

```c
/* Bảo vệ UART dùng chung */
xSemaphoreTake(uartMutex, portMAX_DELAY);
printf("temp = %d\r\n", t);
xSemaphoreGive(uartMutex);
```

**Đảo ngược ưu tiên** (priority inversion): task L (thấp) giữ khóa, task H (cao) chờ khóa, task M (trung bình) chạy chiếm CPU → H bị chặn bởi M dù không liên quan. Mutex giải quyết bằng cách tạm nâng L lên priority của H cho đến khi trả khóa.

## Quản lý heap

| Scheme | Cấp phát | Giải phóng | Gộp khối trống | Ghi chú |
|---|---|---|---|---|
| heap_1 | ✓ | ✗ | — | Đơn giản, xác định; đủ cho hệ chỉ tạo task lúc khởi động |
| heap_2 | ✓ | ✓ | ✗ | Phân mảnh – đã lỗi thời |
| heap_3 | ✓ | ✓ | theo libc | Bọc `malloc/free` + tắt scheduler |
| heap_4 | ✓ | ✓ | ✓ | **Phổ biến nhất** |
| heap_5 | ✓ | ✓ | ✓ | Như heap_4, hỗ trợ nhiều vùng RAM không liên tục (CCM, SRAM ngoài) |

Hoặc bỏ heap hoàn toàn: `configSUPPORT_STATIC_ALLOCATION = 1` và `xTaskCreateStatic()`.

## Phát hiện tràn stack

- `configCHECK_FOR_STACK_OVERFLOW = 1`: kiểm tra SP khi chuyển ngữ cảnh.
- `= 2`: kiểm tra thêm 16 byte cuối stack có còn giá trị mẫu (0xA5) không.
- Khi phát hiện, gọi `vApplicationStackOverflowHook(TaskHandle_t, char *name)`.
- `uxTaskGetStackHighWaterMark(NULL)` → số word stack **chưa bao giờ dùng** (đo thực tế để chọn kích thước).

## Tickless idle

Mặc định SysTick ngắt mỗi 1 ms đánh thức CPU dù không có việc. Với `configUSE_TICKLESS_IDLE = 1`, khi mọi task đều Blocked, kernel tính thời điểm task kế tiếp cần thức, tắt SysTick, đưa MCU vào chế độ ngủ sâu đến thời điểm đó rồi bù số tick đã bỏ qua → giảm điện năng đáng kể cho thiết bị chạy pin.

## CMSIS-RTOS v2

API chuẩn hóa của ARM (STM32CubeMX sinh sẵn), bọc FreeRTOS bên dưới:

| CMSIS-RTOS v2 | FreeRTOS |
|---|---|
| `osThreadNew()` | `xTaskCreate()` |
| `osDelay()` | `vTaskDelay()` |
| `osMessageQueuePut/Get()` | `xQueueSend/Receive()` |
| `osMutexAcquire/Release()` | `xSemaphoreTake/Give()` |
| `osPriorityNormal`… | số priority |
