/* Mock stm32f4xx.h: peripherals are plain RAM structs so student code compiles
 * and runs on a PC (host-based unit testing, like Unity/Ceedling). */
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>

#define __IO volatile
typedef struct { __IO uint32_t MODER, OTYPER, OSPEEDR, PUPDR, IDR, ODR, BSRR, LCKR, AFR[2]; } GPIO_TypeDef;
typedef struct { __IO uint32_t CR, PLLCFGR, CFGR, CIR, AHB1RSTR, AHB2RSTR, APB1RSTR, APB2RSTR,
                 AHB1ENR, AHB2ENR, APB1ENR, APB2ENR; } RCC_TypeDef;
typedef struct { __IO uint32_t IMR, EMR, RTSR, FTSR, SWIER, PR; } EXTI_TypeDef;
typedef struct { __IO uint32_t MEMRMP, PMC, EXTICR[4]; } SYSCFG_TypeDef;
typedef struct { __IO uint32_t SR, DR, BRR, CR1, CR2, CR3, GTPR; } USART_TypeDef;
typedef struct { __IO uint32_t CR1, CR2, SR, DR, CRCPR, RXCRCR, TXCRCR, I2SCFGR, I2SPR; } SPI_TypeDef;
typedef struct { __IO uint32_t CTRL, LOAD, VAL, CALIB; } SysTick_Type;

GPIO_TypeDef gpioa_mem, gpiob_mem, gpioc_mem, gpiod_mem, gpioe_mem;
RCC_TypeDef rcc_mem; EXTI_TypeDef exti_mem; SYSCFG_TypeDef syscfg_mem;
USART_TypeDef usart1_mem, usart2_mem; SPI_TypeDef spi1_mem; SysTick_Type systick_mem;

#define GPIOA (&gpioa_mem)
#define GPIOB (&gpiob_mem)
#define GPIOC (&gpioc_mem)
#define GPIOD (&gpiod_mem)
#define GPIOE (&gpioe_mem)
#define RCC (&rcc_mem)
#define EXTI (&exti_mem)
#define SYSCFG (&syscfg_mem)
#define USART2 (&usart2_mem)
#define SPI1 (&spi1_mem)
#define SysTick (&systick_mem)

/* USART1 goes through a hook on every access, so each byte written to DR is
 * logged and TXE is cleared for a few accesses (like a real shift register). */
#define USART_IDLE_DR 0xFFFFu
char usart1_log[256]; int usart1_len, usart1_overrun, usart1_wait; uint32_t usart1_prev_sr;
USART_TypeDef *usart1_hook(void) {
    USART_TypeDef *u = &usart1_mem;
    if (u->DR != USART_IDLE_DR) {                 /* previous access wrote DR */
        if (!(usart1_prev_sr & (1U << 7))) usart1_overrun++;
        if (usart1_len < 255) usart1_log[usart1_len++] = (char)u->DR;
        u->DR = USART_IDLE_DR;
        u->SR &= ~((1U << 7) | (1U << 6));
        usart1_wait = 2;
    } else if (usart1_wait && --usart1_wait == 0) {
        u->SR |= (1U << 7) | (1U << 6);
    }
    usart1_prev_sr = u->SR;
    return u;
}
void usart1_reset(void) {
    memset(usart1_log, 0, sizeof usart1_log);
    usart1_len = usart1_overrun = usart1_wait = 0;
    usart1_mem.DR = USART_IDLE_DR; usart1_mem.SR = (1U << 7) | (1U << 6);
    usart1_prev_sr = usart1_mem.SR;
}
#define USART1 (usart1_hook())

/* Bit definitions (subset of CMSIS) */
#define RCC_AHB1ENR_GPIOAEN (1U << 0)
#define RCC_AHB1ENR_GPIOBEN (1U << 1)
#define RCC_AHB1ENR_GPIOCEN (1U << 2)
#define RCC_AHB1ENR_GPIODEN (1U << 3)
#define RCC_AHB1ENR_GPIOEEN (1U << 4)
#define RCC_APB1ENR_USART2EN (1U << 17)
#define RCC_APB2ENR_USART1EN (1U << 4)
#define RCC_APB2ENR_SPI1EN (1U << 12)
#define RCC_APB2ENR_SYSCFGEN (1U << 14)
#define EXTI_PR_PR0 (1U << 0)
#define EXTI_PR_PR1 (1U << 1)
#define EXTI_IMR_MR0 (1U << 0)
#define EXTI_RTSR_TR0 (1U << 0)
#define EXTI_FTSR_TR0 (1U << 0)
#define USART_SR_RXNE (1U << 5)
#define USART_SR_TC (1U << 6)
#define USART_SR_TXE (1U << 7)
#define USART_CR1_RE (1U << 2)
#define USART_CR1_TE (1U << 3)
#define USART_CR1_RXNEIE (1U << 5)
#define USART_CR1_UE (1U << 13)
#define SPI_CR1_CPHA (1U << 0)
#define SPI_CR1_CPOL (1U << 1)
#define SPI_CR1_MSTR (1U << 2)
#define SPI_CR1_BR_0 (1U << 3)
#define SPI_CR1_BR_1 (1U << 4)
#define SPI_CR1_BR_2 (1U << 5)
#define SPI_CR1_BR (7U << 3)
#define SPI_CR1_SPE (1U << 6)
#define SPI_CR1_SSI (1U << 8)
#define SPI_CR1_SSM (1U << 9)
#define SPI_SR_RXNE (1U << 0)
#define SPI_SR_TXE (1U << 1)
#define SPI_SR_BSY (1U << 7)
#define SysTick_CTRL_ENABLE_Msk (1U << 0)
#define SysTick_CTRL_TICKINT_Msk (1U << 1)
#define SysTick_CTRL_CLKSOURCE_Msk (1U << 2)

typedef enum { EXTI0_IRQn = 6, EXTI1_IRQn = 7, USART1_IRQn = 37, SPI1_IRQn = 35 } IRQn_Type;
uint8_t nvic_enabled[96]; uint32_t nvic_prio[96];
void NVIC_EnableIRQ(IRQn_Type n) { nvic_enabled[n] = 1; }
void NVIC_DisableIRQ(IRQn_Type n) { nvic_enabled[n] = 0; }
void NVIC_SetPriority(IRQn_Type n, uint32_t p) { nvic_prio[n] = p; }
void __disable_irq(void) {}
void __enable_irq(void) {}
void __DSB(void) {}
void __DMB(void) {}

/* Test helpers: one "PASS|msg" or "FAIL|msg|detail" line per check */
int t_fail;
#define CHECK(cond, msg, ...) do { if (cond) printf("PASS|%s\n", msg); \
    else { t_fail++; printf("FAIL|%s|", msg); printf(__VA_ARGS__); printf("\n"); } } while (0)
void t_timeout(int s) { (void)s; printf("FAIL|Chương trình bị treo quá 2 giây (vòng lặp chờ cờ không thoát?)|\n"); _exit(1); }
#define TEST_BEGIN() do { setvbuf(stdout, NULL, _IONBF, 0); signal(SIGALRM, t_timeout); alarm(2); } while (0)
