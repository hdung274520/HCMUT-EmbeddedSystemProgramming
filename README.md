# Embedded C Lab – STM32 / ARM Cortex-M

Web app học Lập trình Hệ thống nhúng.

**Demo:** https://hdung274520.github.io/HCMUT-EmbeddedSystemProgramming/

- **Lý thuyết** – 17 chương (C cho nhúng với 4 chương về con trỏ, Cortex-M, GPIO, NVIC/SysTick, USART, SPI, FSM, FreeRTOS, ADC), tìm kiếm không dấu, ví dụ bấm "Chạy thử" được.
- **Playground** – 23 bài có chấm tự động + chế độ tự do. Code được biên dịch bằng GCC thật và chạy trên [Compiler Explorer](https://godbolt.org) cùng header `stm32f4xx.h` giả lập (thanh ghi là biến RAM), bộ test kiểm tra giá trị thanh ghi/kết quả hàm, bật UBSan.
- **Công cụ** – Bit-band alias, USART_BRR, SysTick RVR, mô phỏng ring buffer.

## Cấu trúc
```
index.html, css/styles.css, js/{app,calculators,evaluator}.js
data/theory/index.json + *.md          lý thuyết (Markdown; ```crun = ví dụ chạy được)
data/exercises/index.json + <id>.c     mỗi bài một file: // @title, @level, @desc, @hint
                                       rồi các phần //==== starter | solution | test
data/stm32_mock.h                      header STM32 giả lập + macro CHECK cho test
```

## Chạy local
```bash
python3 -m http.server   # mở http://localhost:8000
```

## Kiểm tra (cần node + gcc)
```bash
node test.js   # mọi đáp án đạt, starter trượt, lỗi kinh điển bị bắt, ví dụ lý thuyết chạy được
```
