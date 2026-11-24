// @title: Con trỏ cấp 2: danh sách liên kết
// @level: Trung bình
// @desc: Cho node_t. Viết void list_push(node_t **head, node_t *n) chèn n vào ĐẦU danh sách, và node_t *list_pop(node_t **head) tháo phần tử đầu (trả về NULL nếu rỗng). Cần node_t ** vì hàm phải sửa biến head của người gọi. Không dùng malloc: node được cấp phát tĩnh bởi người gọi.
// @hint: push: n->next = *head; *head = n;   pop: node_t *n = *head; if (n) { *head = n->next; n->next = NULL; } return n;
//==== starter
#include <stddef.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

void list_push(node_t **head, node_t *n) {
    // TODO
}

node_t *list_pop(node_t **head) {
    // TODO
    return NULL;
}
//==== solution
#include <stddef.h>

typedef struct node {
    int value;
    struct node *next;
} node_t;

void list_push(node_t **head, node_t *n) {
    n->next = *head;
    *head = n;
}

node_t *list_pop(node_t **head) {
    node_t *n = *head;
    if (n != NULL) {
        *head = n->next;
        n->next = NULL;
    }
    return n;
}
//==== test
int main(void) {
    TEST_BEGIN();
    node_t a = { 1, NULL }, b = { 2, NULL }, c = { 3, NULL };
    node_t *head = NULL;
    list_push(&head, &a);
    CHECK(head == &a && a.next == NULL, "push vào danh sách rỗng: head = &a", "head sai");
    list_push(&head, &b);
    list_push(&head, &c);
    CHECK(head == &c && c.next == &b && b.next == &a, "Thứ tự sau 3 lần push: c → b → a", "liên kết sai");
    node_t *x = list_pop(&head);
    CHECK(x == &c && head == &b, "pop trả về &c, head = &b", "x/head sai");
    CHECK(x == NULL || x->next == NULL, "Node vừa pop có next = NULL", "next chưa được xóa");
    list_pop(&head); list_pop(&head);
    CHECK(head == NULL, "pop hết → head = NULL", "head khác NULL");
    CHECK(list_pop(&head) == NULL, "pop danh sách rỗng → NULL", "không trả về NULL");
    return t_fail != 0;
}
