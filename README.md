# Embedded C Lab – STM32 / ARM Cortex-M

Web app học Lập trình Hệ thống nhúng: lý thuyết 9 chương, công cụ tính toán (bit-band, USART_BRR, SysTick, ring buffer), Code Playground biên dịch C thật, trắc nghiệm và flashcards.

**Demo:** https://hdung274520.github.io/HCMUT-EmbeddedSystemProgramming/

## Chạy local
```bash
python3 -m http.server   # mở http://localhost:8000
```

## Chấm code
Code sinh viên + `data/stm32_mock.h` (thanh ghi giả lập trong RAM) + `data/harness/<bài>.c` được biên dịch bằng GCC và chạy trên [Compiler Explorer](https://godbolt.org) (cần Internet).

## Kiểm tra
```bash
node test.js   # cần gcc
```
