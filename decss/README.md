# decss

Two cipher implementations tied to the history of code-as-speech.

## Files

| File | Algorithm | What it shows |
|------|-----------|---------------|
| `css.c` | CSS (Content Scramble System) | The actual DVD descrambler from Jon Johansen's DeCSS (1999), encoded step-by-step in a [song by Seth Schoen](https://archive.org/details/CSS_Descrambler_Source_Code_set_to_music) |
| `rc4.c` | RC4 + CRC-32 | The leaked stream cipher from RSA Security (1994), with integrity checking |

## The history

**RC4** (1987) was a trade secret. In 1994 it leaked to the cypherpunks mailing list — once public, describing it was legal, but the knowledge had been treated as contraband.

**DeCSS** (1999) repeated the story. Jon Lech Johansen reverse-engineered CSS, the encryption protecting DVDs. The DMCA banned distributing the source in the US. In response, Phil Carmody encoded DeCSS as a **1401-digit prime number** — possessing a prime was legal; the number just happened to contain a program. Seth Schoen went further and [set the source code to music](https://archive.org/details/CSS_Descrambler_Source_Code_set_to_music) — a song is artistic expression, and the song happened to describe every step of the algorithm.

**godelify** generalises that idea: any C source file can become a prime.

## Build and run

```sh
gcc -o css css.c && ./css
gcc -o rc4 rc4.c && ./rc4
```

## Encode as primes

```sh
godelify encode css.c
godelify encode rc4.c
```

## Key differences

| | RC4 | CSS |
|---|---|---|
| State | 256-byte mutable permutation array | Two static-table LFSRs (9-bit + 32-bit) |
| Key length | Arbitrary | Fixed 6 bytes |
| Domain | Arbitrary-length messages | Fixed 2048-byte DVD sectors |
| Output mixing | XOR only | Table substitution (CSStab1) then XOR |
| Integrity | CRC-32 appended | None |
