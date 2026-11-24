# Con trỏ (4): Con trỏ hàm, callback & `void *`

## Hàm cũng có địa chỉ

Mã máy của hàm nằm trong Flash, nên hàm cũng có địa chỉ. Con trỏ hàm lưu địa chỉ đó để gọi gián tiếp.

```c
int add(int a, int b) { return a + b; }

int (*op)(int, int) = add;     /* op: con trỏ tới hàm nhận (int,int) trả int */
int r = op(2, 3);              /* gọi qua con trỏ → 5 */
```

Cú pháp khó đọc, nên luôn dùng `typedef`:

```c
typedef int (*binop_t)(int, int);
binop_t op = add;
```

Chú ý ngoặc: `int *f(int)` là **hàm trả về `int *`**; `int (*f)(int)` mới là **con trỏ hàm**.

## Ứng dụng 1 – Bảng vector ngắt

Bảng vector ở đầu Flash chính là **mảng con trỏ hàm**. Khi ngắt EXTI0 xảy ra, phần cứng đọc phần tử tương ứng và nhảy tới đó:

```c
typedef void (*isr_t)(void);

__attribute__((section(".isr_vector")))
const isr_t vector_table[] = {
    (isr_t)&_estack,        /* 0x00: giá trị SP ban đầu */
    Reset_Handler,          /* 0x04 */
    NMI_Handler,            /* 0x08 */
    HardFault_Handler,      /* 0x0C */
    /* ... */
    EXTI0_IRQHandler,       /* vị trí 16 + 6 */
};
```

Đây là lý do tên hàm ISR phải **đúng chính xác** – startup file khai báo các tên này (dạng `weak`), viết sai tên thì hàm của bạn không bao giờ được gọi.

## Ứng dụng 2 – Callback: driver báo sự kiện cho ứng dụng

Driver không nên biết ứng dụng làm gì. Ứng dụng đăng ký một hàm, driver gọi lại khi có sự kiện:

```c
/* uart.h */
typedef void (*uart_rx_cb_t)(uint8_t byte);
void uart_set_rx_callback(uart_rx_cb_t cb);

/* uart.c */
static uart_rx_cb_t rx_cb = NULL;
void uart_set_rx_callback(uart_rx_cb_t cb) { rx_cb = cb; }

void USART2_IRQHandler(void) {
    if (USART2->SR & USART_SR_RXNE) {
        uint8_t b = (uint8_t)USART2->DR;
        if (rx_cb) rx_cb(b);        /* luôn kiểm tra NULL */
    }
}

/* main.c */
static void on_byte(uint8_t b) { rb_put(&rx_buf, b); }
uart_set_rx_callback(on_byte);
```

Callback chạy **trong ngữ cảnh ngắt** → phải ngắn, không chặn, không `printf`.

## Ứng dụng 3 – Bảng dispatch thay switch-case

```c
typedef void (*cmd_fn_t)(const char *arg);

static void cmd_led(const char *arg);
static void cmd_reset(const char *arg);
static void cmd_help(const char *arg);

static const struct { const char *name; cmd_fn_t fn; } commands[] = {
    { "led",   cmd_led   },
    { "reset", cmd_reset },
    { "help",  cmd_help  },
};

void shell_exec(const char *name, const char *arg) {
    for (size_t i = 0; i < sizeof commands / sizeof commands[0]; i++)
        if (strcmp(commands[i].name, name) == 0) { commands[i].fn(arg); return; }
    uart_puts("unknown command\r\n");
}
```

Thêm lệnh mới = thêm một dòng. Bảng là `const` → nằm trong Flash.

## Ứng dụng 4 – Máy trạng thái bằng con trỏ hàm

```c
typedef struct fsm fsm_t;
typedef void (*state_fn_t)(fsm_t *m, int event);
struct fsm { state_fn_t state; };

static void st_idle(fsm_t *m, int ev);
static void st_run (fsm_t *m, int ev);

static void st_idle(fsm_t *m, int ev) { if (ev == EV_START) m->state = st_run; }
static void st_run (fsm_t *m, int ev) { if (ev == EV_STOP)  m->state = st_idle; }

fsm_t m = { st_idle };
m.state(&m, EV_START);     /* trạng thái hiện tại xử lý sự kiện */
```

## `void *` – con trỏ "không kiểu"

`void *` giữ được địa chỉ của bất kỳ kiểu dữ liệu nào, nhưng **không thể giải tham chiếu** hay làm số học trực tiếp – phải ép về kiểu cụ thể trước.

Dùng cho: hàm xử lý bộ nhớ chung (`memcpy`, `memset`), tham số ngữ cảnh trong callback, tham số task RTOS.

```crun
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

/* qsort nhận con trỏ hàm so sánh với tham số void* */
static int cmp_u16(const void *a, const void *b) {
    uint16_t x = *(const uint16_t *)a, y = *(const uint16_t *)b;
    return (x > y) - (x < y);
}

/* callback có ngữ cảnh: một hàm phục vụ nhiều đối tượng */
typedef void (*timer_cb_t)(void *ctx);
typedef struct { const char *name; int count; } led_t;
static void blink(void *ctx) {
    led_t *led = (led_t *)ctx;
    led->count++;
    printf("%s nháy lần %d\n", led->name, led->count);
}

int main(void) {
    uint16_t samples[] = { 2048, 15, 4095, 300, 1024 };
    qsort(samples, 5, sizeof samples[0], cmp_u16);
    for (int i = 0; i < 5; i++) printf("%u ", samples[i]);
    printf("(median = %u)\n", samples[2]);

    led_t red = { "LED đỏ", 0 }, green = { "LED xanh", 0 };
    timer_cb_t cb = blink;
    cb(&red); cb(&green); cb(&red);
    return 0;
}
```

Trong FreeRTOS: `xTaskCreate(vTask, "name", 128, &config, 2, NULL)` – `&config` được truyền vào task dưới dạng `void *pvParameters`.

## Tóm tắt

- `typedef ret (*name_t)(args);` – luôn typedef con trỏ hàm.
- Vector table, callback, dispatch table, FSM đều là mảng/biến con trỏ hàm.
- Luôn kiểm tra callback khác `NULL` trước khi gọi.
- `void *` dùng cho dữ liệu chung + ngữ cảnh; ép về đúng kiểu trước khi dùng.
