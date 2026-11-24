// @title: Máy trạng thái đèn giao thông
// @level: Trung bình
// @desc: Viết light_t light_next(light_t s, event_t e). Sự kiện EV_TIMER: RED → GREEN → YELLOW → RED. EV_EMERGENCY: chuyển ngay về RED từ mọi trạng thái. Trạng thái không hợp lệ (ví dụ giá trị rác) → RED (an toàn).
// @hint: Dùng switch (s) với nhánh default trả về LIGHT_RED; xử lý EV_EMERGENCY trước switch.
//==== starter
typedef enum { LIGHT_RED, LIGHT_GREEN, LIGHT_YELLOW } light_t;
typedef enum { EV_TIMER, EV_EMERGENCY } event_t;

light_t light_next(light_t s, event_t e) {
    // TODO
    return s;
}
//==== solution
typedef enum { LIGHT_RED, LIGHT_GREEN, LIGHT_YELLOW } light_t;
typedef enum { EV_TIMER, EV_EMERGENCY } event_t;

light_t light_next(light_t s, event_t e) {
    if (e == EV_EMERGENCY) return LIGHT_RED;
    switch (s) {
    case LIGHT_RED:    return LIGHT_GREEN;
    case LIGHT_GREEN:  return LIGHT_YELLOW;
    case LIGHT_YELLOW: return LIGHT_RED;
    default:           return LIGHT_RED;   /* trạng thái hỏng → an toàn */
    }
}
//==== test
int main(void) {
    TEST_BEGIN();
    CHECK(light_next(LIGHT_RED, EV_TIMER) == LIGHT_GREEN, "RED + TIMER → GREEN", "sai");
    CHECK(light_next(LIGHT_GREEN, EV_TIMER) == LIGHT_YELLOW, "GREEN + TIMER → YELLOW", "sai");
    CHECK(light_next(LIGHT_YELLOW, EV_TIMER) == LIGHT_RED, "YELLOW + TIMER → RED", "sai");
    CHECK(light_next(LIGHT_GREEN, EV_EMERGENCY) == LIGHT_RED && light_next(LIGHT_YELLOW, EV_EMERGENCY) == LIGHT_RED, "EMERGENCY từ GREEN/YELLOW → RED", "sai");
    light_t s = LIGHT_RED;
    for (int i = 0; i < 9; i++) s = light_next(s, EV_TIMER);
    CHECK(s == LIGHT_RED, "9 lần TIMER quay lại RED (chu kỳ 3)", "s = %d", (int)s);
    CHECK(light_next((light_t)7, EV_TIMER) == LIGHT_RED, "Trạng thái rác (7) → RED", "sai");
    return t_fail != 0;
}
