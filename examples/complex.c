#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ── linked list ─────────────────────────────────────── */

typedef struct Node {
    int value;
    struct Node *next;
} Node;

Node *node_new(int v) {
    Node *n = malloc(sizeof(Node));
    n->value = v;
    n->next  = NULL;
    return n;
}

void list_push(Node **head, int v) {
    Node *n  = node_new(v);
    n->next  = *head;
    *head    = n;
}

void list_free(Node *head) {
    while (head) {
        Node *tmp = head->next;
        free(head);
        head = tmp;
    }
}

/* ── sorting ─────────────────────────────────────────── */

int cmp_int(const void *a, const void *b) {
    return (*(int *)a - *(int *)b);
}

void insertion_sort(int *arr, int n) {
    for (int i = 1; i < n; i++) {
        int key = arr[i], j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j--];
        }
        arr[j + 1] = key;
    }
}

/* ── string utilities ────────────────────────────────── */

int str_count(const char *s, char c) {
    int count = 0;
    while (*s) count += (*s++ == c);
    return count;
}

void str_reverse(char *s) {
    int l = 0, r = strlen(s) - 1;
    while (l < r) {
        char tmp = s[l]; s[l++] = s[r]; s[r--] = tmp;
    }
}

/* ── matrix multiply (2×2) ───────────────────────────── */

typedef struct { long long a[2][2]; } Mat2;

Mat2 mat_mul(Mat2 A, Mat2 B) {
    Mat2 C = {{{0}}};
    for (int i = 0; i < 2; i++)
        for (int j = 0; j < 2; j++)
            for (int k = 0; k < 2; k++)
                C.a[i][j] += A.a[i][k] * B.a[k][j];
    return C;
}

long long fib_matrix(int n) {
    if (n <= 0) return 0;
    Mat2 result = {{{{1, 0}, {0, 1}}}};
    Mat2 base   = {{{{1, 1}, {1, 0}}}};
    while (n > 0) {
        if (n & 1) result = mat_mul(result, base);
        base = mat_mul(base, base);
        n >>= 1;
    }
    return result.a[0][1];
}

/* ── sieve of Eratosthenes ───────────────────────────── */

int *sieve(int limit, int *out_count) {
    char *is_prime = calloc(limit + 1, 1);
    memset(is_prime, 1, limit + 1);
    is_prime[0] = is_prime[1] = 0;
    for (int i = 2; (long long)i * i <= limit; i++)
        if (is_prime[i])
            for (int j = i * i; j <= limit; j += i)
                is_prime[j] = 0;
    int count = 0;
    for (int i = 2; i <= limit; i++) count += is_prime[i];
    int *primes = malloc(count * sizeof(int));
    int  idx    = 0;
    for (int i = 2; i <= limit; i++)
        if (is_prime[i]) primes[idx++] = i;
    free(is_prime);
    *out_count = count;
    return primes;
}

/* ── main ────────────────────────────────────────────── */

int main(void) {
    /* linked list */
    Node *list = NULL;
    for (int i = 10; i >= 1; i--) list_push(&list, i);
    printf("List: ");
    for (Node *n = list; n; n = n->next) printf("%d ", n->value);
    printf("\n");
    list_free(list);

    /* sorting */
    int arr[] = {5, 2, 9, 1, 7, 3, 8, 4, 6};
    int n     = sizeof(arr) / sizeof(arr[0]);
    insertion_sort(arr, n);
    printf("Sorted: ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\n");

    /* string ops */
    char s[] = "godelify";
    printf("Char 'g' count: %d\n", str_count(s, 'g'));
    str_reverse(s);
    printf("Reversed: %s\n", s);

    /* fibonacci via matrix exponentiation */
    for (int i = 0; i <= 10; i++)
        printf("fib(%d) = %lld\n", i, fib_matrix(i));

    /* primes up to 100 */
    int count;
    int *primes = sieve(100, &count);
    printf("Primes up to 100 (%d total): ", count);
    for (int i = 0; i < count; i++) printf("%d ", primes[i]);
    printf("\n");
    free(primes);

    return 0;
}
