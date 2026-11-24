# Kiến trúc ARM Cortex-M & Memory Map

## Tập thanh ghi lõi

| Thanh ghi | Vai trò |
|---|---|
| R0–R3 | Truyền 4 tham số đầu & giá trị trả về (theo AAPCS); bị ghi đè tự do |
| R4–R11 | Biến cục bộ; hàm được gọi phải bảo toàn |
| R12 (IP) | Thanh ghi tạm cho linker |
| R13 = **SP** | Con trỏ stack. Có 2 bản: **MSP** (main – dùng khi reset, trong ISR) và **PSP** (process – task RTOS) |
| R14 = **LR** | Địa chỉ trả về; trong ISR chứa giá trị đặc biệt `EXC_RETURN` (0xFFFFFFF9, 0xFFFFFFFD…) |
| R15 = **PC** | Địa chỉ lệnh đang thực thi |
| xPSR | Cờ N Z C V Q, số ngắt đang phục vụ (IPSR), trạng thái Thumb |
| PRIMASK | =1: chặn mọi ngắt có thể cấu hình (`__disable_irq()`) |
| FAULTMASK | =1: chặn cả HardFault (trừ NMI) |
| BASEPRI | Chặn ngắt có priority ≥ giá trị này (FreeRTOS dùng cho critical section) |
| CONTROL | Chọn MSP/PSP, mức đặc quyền, FPU đang dùng |

Hàm C có > 4 tham số → các tham số còn lại đi qua stack (chậm hơn). Đó là lý do API nhúng hay gom cấu hình vào struct và truyền con trỏ.

## Họ Cortex-M

| Lõi | Kiến trúc | Đặc điểm | Ví dụ chip |
|---|---|---|---|
| M0/M0+ | ARMv6-M | Tối giản, không bit-band, không chia phần cứng, không truy cập lệch | STM32F0, G0, RP2040 |
| M3 | ARMv7-M | Bit-band, chia phần cứng, MPU | STM32F1, F2 |
| M4 | ARMv7E-M | M3 + DSP + FPU đơn (tùy chọn) | **STM32F4**, L4 |
| M7 | ARMv7E-M | Pipeline 6 tầng, cache, FPU đôi | STM32F7, H7 |
| M33 | ARMv8-M | TrustZone | STM32L5, U5 |

## Bus matrix

Cortex-M3/M4 có kiến trúc Harvard ở mức bus: **I-Code** (lấy lệnh từ Flash), **D-Code** (đọc hằng từ Flash), **System bus** (SRAM, ngoại vi). Bus matrix cho phép CPU và DMA truy cập các slave khác nhau **đồng thời**; nếu cùng một slave thì phân xử luân phiên. Ngoại vi nối qua AHB → cầu → APB1 (chậm, ≤ 42 MHz trên F407) và APB2 (nhanh, ≤ 84 MHz). Vì vậy mỗi ngoại vi có clock riêng phải bật trong `RCC->AHB1ENR / APB1ENR / APB2ENR`.

## Memory map 4 GB

```
0xFFFFFFFF ┌─────────────────────────────┐
           │ Vendor specific             │
0xE0000000 ├─────────────────────────────┤
           │ Private Peripheral Bus      │ NVIC 0xE000E100, SysTick 0xE000E010, SCB 0xE000ED00
0xA0000000 ├─────────────────────────────┤
           │ External RAM / device (FSMC)│
0x60000000 ├─────────────────────────────┤
           │ Peripheral (0.5 GB)         │ APB1 0x40000000, APB2 0x40010000, AHB1 0x40020000
           │   bit-band alias 0x42000000 │
0x40000000 ├─────────────────────────────┤
           │ SRAM (0.5 GB)               │ 0x20000000
           │   bit-band alias 0x22000000 │
0x20000000 ├─────────────────────────────┤
           │ Code: Flash 0x08000000,     │ 0x00000000 là alias của Flash/System memory/SRAM
           │ System memory (bootloader)  │ tùy chân BOOT0/BOOT1
0x00000000 └─────────────────────────────┘
```

Khi reset, CPU đọc word tại `0x00000000` làm **MSP ban đầu**, word tại `0x00000004` làm **địa chỉ Reset_Handler**.

## Bit-banding (Cortex-M3/M4)

Mỗi **bit** trong 1 MB đầu của SRAM và Peripheral được ánh xạ sang một **word** riêng trong vùng alias. Ghi 0/1 vào word alias = clear/set đúng một bit, trong **một lệnh ghi nguyên tử** – không đọc–sửa–ghi, không bị ngắt chen.

```
alias = alias_base + (byte_addr − region_base) × 32 + bit × 4

SRAM:        region_base = 0x20000000, alias_base = 0x22000000
Peripheral:  region_base = 0x40000000, alias_base = 0x42000000
```

Ví dụ: PD12 trong `GPIOD->ODR` (0x40020C14):
offset = 0x20C14 → alias = 0x42000000 + 0x20C14 × 32 + 12 × 4 = **0x424182B0**

```c
#define BITBAND_PERI(addr, bit) \
    (*(volatile uint32_t *)(0x42000000UL + (((uint32_t)(addr) - 0x40000000UL) << 5) + ((bit) << 2)))

BITBAND_PERI(&GPIOD->ODR, 12) = 1;     /* bật LED – nguyên tử */
```

Dùng công cụ "Bit-band" trong mục Công cụ để tính nhanh.

## Exception & Fault

| Exception | Số | Priority | Nguyên nhân thường gặp |
|---|---|---|---|
| Reset | 1 | −3 | |
| NMI | 2 | −2 | Clock security system |
| HardFault | 3 | −1 | Fault leo thang, lệnh không hợp lệ, vector sai |
| MemManage | 4 | cấu hình | Vi phạm MPU, thực thi vùng XN (eXecute Never) |
| BusFault | 5 | cấu hình | Đọc/ghi địa chỉ không tồn tại, **ngoại vi chưa bật clock** |
| UsageFault | 6 | cấu hình | Lệnh không xác định, chia 0 (nếu bật `DIV_0_TRP`), truy cập lệch (nếu bật) |
| SVCall | 11 | | `svc` – RTOS khởi động task đầu |
| PendSV | 14 | thấp nhất | RTOS chuyển ngữ cảnh |
| SysTick | 15 | | Tick hệ thống |
| IRQ0… | 16+ | | Ngắt ngoại vi |

MemManage/BusFault/UsageFault mặc định bị tắt → leo thang thành HardFault. Bật riêng để có chẩn đoán chi tiết:

```c
SCB->SHCSR |= SCB_SHCSR_MEMFAULTENA_Msk | SCB_SHCSR_BUSFAULTENA_Msk | SCB_SHCSR_USGFAULTENA_Msk;
```

Đọc nguyên nhân từ `SCB->CFSR` (gồm MMFSR | BFSR | UFSR), địa chỉ lỗi từ `SCB->MMFAR` / `SCB->BFAR` (khi bit `MMARVALID`/`BFARVALID` = 1). Cách lấy PC gây lỗi: xem chương *Lỗi con trỏ thường gặp*.
