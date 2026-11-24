# Bố cục bộ nhớ, `volatile`, `static`, `const`, `extern`

## Một chương trình nằm ở đâu trên MCU?

| Section | Nằm ở | Chứa | Ví dụ |
|---|---|---|---|
| `.isr_vector` | Flash | Bảng vector ngắt | |
| `.text` | Flash | Mã máy | các hàm |
| `.rodata` | Flash | Hằng số, chuỗi literal | `const uint8_t lut[256]`, `"Hello"` |
| `.data` | Flash → **copy sang RAM** khi khởi động | Biến toàn cục/static **có giá trị đầu** | `int count = 5;` |
| `.bss` | RAM (được **xóa về 0** khi khởi động) | Biến toàn cục/static không khởi tạo / = 0 | `uint8_t buf[512];` |
| Heap | RAM, tăng lên | `malloc` | |
| Stack | RAM (cuối RAM), tăng **xuống** | Biến cục bộ, địa chỉ trả về, ngữ cảnh ngắt | `int i;` trong hàm |

`Reset_Handler` trong startup file làm đúng hai việc trước khi gọi `main()`: copy `.data` từ Flash sang RAM và ghi 0 vào `.bss`.

```c
const uint16_t sine[256] = { ... };   /* .rodata – Flash, tốn 0 byte RAM */
uint16_t       table[256] = { 1 };    /* .data – tốn 512 byte Flash + 512 byte RAM */
static uint8_t rx_buf[128];           /* .bss  – tốn 128 byte RAM */

void f(void) {
    uint8_t tmp[64];                  /* stack – mất khi hàm return */
    static uint32_t calls = 0;        /* .bss – giữ giá trị giữa các lần gọi */
    calls++;
}
```

Xem dung lượng sau khi build: `arm-none-eabi-size firmware.elf` → `text` (Flash), `data`, `bss` (RAM).

## `volatile` – "đừng tối ưu truy cập này"

Compiler giả định một biến chỉ thay đổi khi **code hiện tại** ghi vào nó. Điều đó sai với:

1. **Thanh ghi ngoại vi** – phần cứng tự thay đổi (`SR`, `DR`, `IDR`).
2. **Biến dùng chung giữa ISR và main**.
3. Biến dùng chung giữa các task RTOS.

```c
uint8_t flag = 0;                 /* THIẾU volatile */
void EXTI0_IRQHandler(void) { EXTI->PR = 1; flag = 1; }

int main(void) {
    while (flag == 0) { }         /* -O2: compiler đọc flag MỘT lần → lặp vô hạn */
}
```

Sửa: `volatile uint8_t flag;`. Ở `-O0` lỗi không hiện, bật tối ưu khi release thì treo – loại lỗi điển hình "debug chạy, release hỏng".

`volatile` **không** làm thao tác trở thành nguyên tử: `volatile uint32_t cnt; cnt++;` vẫn là đọc–cộng–ghi, có thể bị ngắt chen giữa. Cần tắt ngắt ngắn hoặc dùng LDREX/STREX.

Phân biệt:

```c
volatile uint32_t *p;      /* con trỏ tới dữ liệu volatile – kiểu thanh ghi */
uint32_t *volatile p;      /* bản thân con trỏ là volatile (ISR đổi con trỏ) */
```

## `static` – hai nghĩa khác nhau

| Vị trí | Ý nghĩa |
|---|---|
| Biến cục bộ `static` | Sống suốt chương trình (.data/.bss), giữ giá trị giữa các lần gọi, chỉ thấy trong hàm |
| Biến/hàm toàn cục `static` | **Chỉ thấy trong file .c này** (internal linkage) – "private" của module |

Quy tắc module: mọi biến và hàm nội bộ của `uart.c` đều `static`; chỉ những gì khai báo trong `uart.h` mới là public.

## `const` – không chỉ để "không sửa"

- Dữ liệu `const` toàn cục được linker đặt vào **Flash** → tiết kiệm RAM (bảng tra, font, chuỗi menu).
- Tham số `const T *` cam kết hàm không sửa dữ liệu.
- `const volatile uint32_t *` – thanh ghi **chỉ đọc** mà phần cứng thay đổi (ví dụ `IDR`).

## `extern` – khai báo, không định nghĩa

```c
/* config.c */
uint32_t g_system_clock = 16000000;    /* ĐỊNH NGHĨA: cấp phát bộ nhớ – đúng 1 lần */

/* config.h */
extern uint32_t g_system_clock;        /* KHAI BÁO: "biến này có ở đâu đó" */
```

Đặt định nghĩa trong header (không có `extern`) → mỗi file include tạo một bản → lỗi linker `multiple definition`.

## Stack – tài nguyên hữu hạn

Cortex-M thường chỉ cấp 1–4 KB stack. Tràn stack ghi đè lên `.bss`/heap mà **không báo lỗi** (trừ khi dùng MPU hoặc RTOS stack check).

Tránh:

- Mảng cục bộ lớn: `uint8_t buf[2048];` trong hàm → chuyển thành `static`.
- Đệ quy.
- `printf` với định dạng float (tốn vài trăm byte stack).

Mỗi ngắt cũng đẩy 8 thanh ghi (32 byte, 104 byte nếu có FPU) lên stack.

## Heap – hạn chế dùng

`malloc/free` lúc chạy gây **phân mảnh** và thời gian không xác định. Chuẩn MISRA cấm. Thực tế nhúng: cấp phát **tĩnh** mọi thứ, hoặc chỉ `malloc` lúc khởi tạo rồi không `free`, hoặc dùng memory pool kích thước cố định.
