/*
 * rc4.c — RC4 stream cipher with CRC-32 integrity check
 *
 * Historical context
 * ------------------
 * RC4 was designed by Ron Rivest at RSA Security in 1987 and kept as a
 * trade secret. In 1994 it was leaked anonymously to the cypherpunks
 * mailing list. Once public, describing the algorithm was legal — but the
 * knowledge had been treated as contraband. DeCSS (1999) repeated this
 * story: Jon Lech Johansen reverse-engineered DVD CSS encryption, and the
 * resulting source code was banned in the US under the DMCA. In response,
 * Phil Carmody encoded DeCSS as a 1401-digit prime number. Possessing a
 * prime was legal; the number just happened to contain a program.
 *
 * godelify generalises that idea. Run:
 *
 *   godelify encode rc4.c
 *
 * and this file becomes a prime. The prime IS this program.
 *
 * Algorithm
 * ---------
 * RC4 is a stream cipher built from two phases:
 *
 *   KSA  (Key Scheduling Algorithm)   — permutes S[0..255] using the key
 *   PRGA (Pseudo-Random Generation)   — streams keystream bytes from S
 *
 * Encryption and decryption are identical: XOR plaintext with keystream.
 * CRC-32 is appended to the plaintext before encryption so the receiver
 * can verify integrity after decryption.
 */

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ── RC4 ─────────────────────────────────────────────────────────── */

typedef struct {
    uint8_t S[256];
    uint8_t i, j;
} RC4;

static void rc4_init(RC4 *ctx, const uint8_t *key, size_t klen) {
    for (int n = 0; n < 256; n++) ctx->S[n] = (uint8_t)n;
    uint8_t j = 0;
    for (int n = 0; n < 256; n++) {
        j += ctx->S[n] + key[n % klen];
        uint8_t t = ctx->S[n]; ctx->S[n] = ctx->S[j]; ctx->S[j] = t;
    }
    ctx->i = ctx->j = 0;
}

static uint8_t rc4_byte(RC4 *ctx) {
    ctx->i++;
    ctx->j += ctx->S[ctx->i];
    uint8_t t = ctx->S[ctx->i]; ctx->S[ctx->i] = ctx->S[ctx->j]; ctx->S[ctx->j] = t;
    return ctx->S[(uint8_t)(ctx->S[ctx->i] + ctx->S[ctx->j])];
}

static void rc4_xor(RC4 *ctx, const uint8_t *in, uint8_t *out, size_t n) {
    for (size_t k = 0; k < n; k++) out[k] = in[k] ^ rc4_byte(ctx);
}

/* ── CRC-32 (IEEE 802.3) ─────────────────────────────────────────── */

static uint32_t crc32_table[256];
static int      crc32_ready = 0;

static void crc32_build(void) {
    for (uint32_t i = 0; i < 256; i++) {
        uint32_t c = i;
        for (int k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
        crc32_table[i] = c;
    }
    crc32_ready = 1;
}

static uint32_t crc32(const uint8_t *data, size_t len) {
    if (!crc32_ready) crc32_build();
    uint32_t c = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; i++)
        c = crc32_table[(c ^ data[i]) & 0xFF] ^ (c >> 8);
    return c ^ 0xFFFFFFFFu;
}

/* ── hex dump ────────────────────────────────────────────────────── */

static void hexdump(const char *label, const uint8_t *data, size_t len) {
    printf("%-12s: ", label);
    for (size_t i = 0; i < len; i++) {
        printf("%02X", data[i]);
        if ((i + 1) % 16 == 0 && i + 1 < len) printf("\n              ");
    }
    printf("\n");
}

/* ── encrypt: plaintext → [ciphertext | crc32] ───────────────────── */

uint8_t *encrypt(const uint8_t *key,   size_t klen,
                 const uint8_t *plain, size_t plen,
                 size_t *out_len) {
    /* append 4-byte CRC before encrypting */
    size_t   buflen = plen + 4;
    uint8_t *buf    = malloc(buflen);
    memcpy(buf, plain, plen);
    uint32_t crc = crc32(plain, plen);
    buf[plen + 0] = (crc >> 24) & 0xFF;
    buf[plen + 1] = (crc >> 16) & 0xFF;
    buf[plen + 2] = (crc >>  8) & 0xFF;
    buf[plen + 3] = (crc >>  0) & 0xFF;

    uint8_t *cipher = malloc(buflen);
    RC4 ctx;
    rc4_init(&ctx, key, klen);
    rc4_xor(&ctx, buf, cipher, buflen);
    free(buf);

    *out_len = buflen;
    return cipher;
}

/* ── decrypt: [ciphertext | crc32] → plaintext (or NULL on bad CRC) */

uint8_t *decrypt(const uint8_t *key,    size_t klen,
                 const uint8_t *cipher, size_t clen,
                 size_t *out_len) {
    if (clen < 4) return NULL;

    uint8_t *buf = malloc(clen);
    RC4 ctx;
    rc4_init(&ctx, key, klen);
    rc4_xor(&ctx, cipher, buf, clen);

    size_t   plen     = clen - 4;
    uint32_t got_crc  = ((uint32_t)buf[plen]     << 24) |
                        ((uint32_t)buf[plen + 1] << 16) |
                        ((uint32_t)buf[plen + 2] <<  8) |
                        ((uint32_t)buf[plen + 3]);
    uint32_t want_crc = crc32(buf, plen);

    if (got_crc != want_crc) {
        fprintf(stderr, "CRC mismatch: got %08X, want %08X\n", got_crc, want_crc);
        free(buf);
        return NULL;
    }

    uint8_t *plain = malloc(plen + 1);
    memcpy(plain, buf, plen);
    plain[plen] = '\0';
    free(buf);

    *out_len = plen;
    return plain;
}

/* ── main ────────────────────────────────────────────────────────── */

int main(void) {
    const char *message =
        "This program is a prime number. "
        "The prime encodes every byte of this source exactly. "
        "Strip the low 32 bits, decompress, and you recover this file. "
        "That is what DeCSS did for DVD keys — and what godelify does for any C file.";

    const uint8_t key[]  = "IllegalPrime1401";
    size_t        klen   = strlen((char *)key);
    size_t        msglen = strlen(message);

    printf("=== RC4 + CRC-32 (as seen in the illegal prime tradition) ===\n\n");
    printf("Key       : %s\n", (char *)key);
    printf("Message   : %s\n\n", message);

    /* encrypt */
    size_t   clen;
    uint8_t *cipher = encrypt(key, klen, (uint8_t *)message, msglen, &clen);
    hexdump("Ciphertext", cipher, clen);
    printf("\n");

    /* decrypt */
    size_t   plen;
    uint8_t *plain = decrypt(key, klen, cipher, clen, &plen);
    if (!plain) {
        fprintf(stderr, "Decryption failed.\n");
        free(cipher);
        return 1;
    }

    printf("Decrypted : %s\n", (char *)plain);
    printf("CRC-32    : OK\n");
    printf("Match     : %s\n",
           memcmp(plain, message, msglen) == 0 ? "YES — perfect roundtrip" : "NO");

    /* demonstrate wrong key → CRC failure */
    printf("\n--- Wrong key demo ---\n");
    const uint8_t bad_key[] = "WrongKey";
    uint8_t *bad = decrypt(bad_key, strlen((char *)bad_key), cipher, clen, &plen);
    if (!bad) printf("Decryption correctly rejected (CRC mismatch).\n");
    else { free(bad); printf("Unexpected success — this should not happen.\n"); }

    free(cipher);
    free(plain);
    return 0;
}
