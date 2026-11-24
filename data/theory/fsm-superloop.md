# Máy trạng thái & SuperLoop

## SuperLoop – kiến trúc foreground/background

```c
volatile uint32_t g_ms;
void SysTick_Handler(void) { g_ms++; }           /* foreground: ngắt */

int main(void) {
    system_init();
    uint32_t t_btn = 0, t_led = 0, t_log = 0;
    while (1) {                                    /* background: vòng lặp chính */
        uint32_t now = g_ms;
        if (now - t_btn >= 10)   { t_btn = now; task_buttons(); }
        if (now - t_led >= 250)  { t_led = now; task_led(); }
        if (now - t_log >= 1000) { t_log = now; task_log(); }
        task_uart_rx();                            /* chạy mỗi vòng */
        __WFI();                                   /* ngủ đến ngắt kế tiếp – tiết kiệm điện */
    }
}
```

Quy tắc để SuperLoop đáp ứng tốt:

- Mỗi task **ngắn và không chặn**: không `delay_ms()`, không `while` chờ cờ vô hạn. Việc dài chia thành nhiều bước bằng máy trạng thái.
- ISR chỉ ghi nhận sự kiện (đặt cờ, đẩy vào queue); xử lý trong vòng lặp.
- Thời gian phản hồi tệ nhất = tổng thời gian chạy của mọi task trong một vòng.

## Scheduler hợp tác (cooperative) nhẹ

```c
typedef struct {
    void (*fn)(void);
    uint32_t period_ms;
    uint32_t last;
} task_t;

static task_t tasks[] = {
    { task_buttons, 10,   0 },
    { task_led,     250,  0 },
    { task_log,     1000, 0 },
};

void scheduler_run(void) {
    for (size_t i = 0; i < sizeof tasks / sizeof tasks[0]; i++) {
        if (g_ms - tasks[i].last >= tasks[i].period_ms) {
            tasks[i].last += tasks[i].period_ms;    /* không trôi chu kỳ */
            tasks[i].fn();
        }
    }
}
```

## Finite State Machine (FSM)

Hệ thống nhúng phản ứng với sự kiện tùy theo **trạng thái hiện tại**. Mô hình hóa rõ ràng tránh mớ `if` lồng nhau với hàng chục cờ.

**Cách 1 – switch-case** (đơn giản, phổ biến nhất):

```c
typedef enum { ST_IDLE, ST_HEATING, ST_HOLD, ST_ERROR } state_t;
typedef enum { EV_START, EV_TEMP_OK, EV_TIMEOUT, EV_FAULT, EV_RESET } event_t;

static state_t state = ST_IDLE;

void fsm_dispatch(event_t ev) {
    if (ev == EV_FAULT) { heater_off(); state = ST_ERROR; return; }   /* sự kiện toàn cục */
    switch (state) {
    case ST_IDLE:
        if (ev == EV_START)   { heater_on();  state = ST_HEATING; }
        break;
    case ST_HEATING:
        if (ev == EV_TEMP_OK) { timer_start(60000); state = ST_HOLD; }
        break;
    case ST_HOLD:
        if (ev == EV_TIMEOUT) { heater_off(); state = ST_IDLE; }
        break;
    case ST_ERROR:
        if (ev == EV_RESET)   { state = ST_IDLE; }
        break;
    default:
        heater_off(); state = ST_ERROR;    /* trạng thái hỏng → an toàn */
    }
}
```

**Cách 2 – bảng chuyển trạng thái** (dữ liệu trong Flash, dễ kiểm tra đầy đủ):

```c
typedef struct { state_t from; event_t ev; state_t to; void (*action)(void); } transition_t;

static const transition_t table[] = {
    { ST_IDLE,    EV_START,   ST_HEATING, heater_on  },
    { ST_HEATING, EV_TEMP_OK, ST_HOLD,    hold_start },
    { ST_HOLD,    EV_TIMEOUT, ST_IDLE,    heater_off },
    { ST_ERROR,   EV_RESET,   ST_IDLE,    NULL       },
};
```

**Cách 3 – con trỏ hàm cho mỗi trạng thái** (xem chương *Con trỏ hàm*).

Luôn có nhánh `default` đưa hệ về trạng thái an toàn: bit-flip do nhiễu có thể làm biến `state` mang giá trị rác.

## Hierarchical State Machine (HSM)

Khi nhiều trạng thái chia sẻ cùng cách xử lý một sự kiện, FSM phẳng phải lặp code. HSM cho phép trạng thái **con** kế thừa từ trạng thái **cha**:

```
ON (xử lý EV_POWER_OFF → OFF)
 ├── IDLE
 ├── HEATING
 └── HOLD
OFF
```

Sự kiện không được trạng thái con xử lý sẽ được chuyển lên cha. Mỗi trạng thái có thể có hành động **entry** và **exit** (bật/tắt timer, LED…). Framework phổ biến: QP/C (Quantum Leaps).

## Kiến trúc hướng sự kiện (event-driven)

```
ISR ──post──▶ [ event queue ] ──get──▶ dispatcher ──▶ fsm_dispatch(ev)
```

```c
void EXTI0_IRQHandler(void) { EXTI->PR = EXTI_PR_PR0; queue_post(EV_START); }

int main(void) {
    while (1) {
        event_t ev;
        while (queue_get(&ev)) fsm_dispatch(ev);
        __WFI();
    }
}
```

Lợi ích: ISR cực ngắn, logic tập trung một chỗ, dễ test trên PC (gọi `fsm_dispatch` với chuỗi sự kiện giả – chính là bài tập *Máy trạng thái đèn giao thông*).
