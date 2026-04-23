/// hash.rs — Pure Rust SHA-256 for no_std environments
///
/// CKB scripts run on a bare RISC-V VM with no OS. We implement a compact,
/// heap-using SHA-256 following RFC 6234 / FIPS 180-4. The allocator is
/// provided by ckb-std's default_alloc! (buddy allocator).
///
/// Correctness is verified by NIST test vectors in the unit tests below.

extern crate alloc;
use alloc::vec;
use alloc::vec::Vec;
// Explicitly import Iterator so .enumerate() and .chunks_exact() are in scope
// when building for riscv64imac-unknown-none-elf (no_std, no prelude).
use core::iter::Iterator;

/// Compute SHA-256 over an arbitrary byte slice.
/// Returns a 32-byte digest.
pub fn sha256(data: &[u8]) -> [u8; 32] {
    // SHA-256 initial hash values (first 32 bits of sqrt fractional parts of first 8 primes)
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    // SHA-256 round constants (first 32 bits of cbrt fractional parts of first 64 primes)
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    // ── Pre-processing: padding ─────────────────────────────────────────────
    //
    // SHA-256 processes data in 512-bit (64-byte) blocks. The input must be
    // padded to a multiple of 64 bytes:
    //   1. Append a single '1' bit  → 0x80 byte
    //   2. Append zeros until length ≡ 56 (mod 64)
    //   3. Append the original bit-length as a 64-bit big-endian integer

    let bit_len = (data.len() as u64).wrapping_mul(8);

    // Calculate padded message length (must be a multiple of 64)
    let padded_len = {
        let base = data.len() + 1 + 8; // +1 for 0x80 sentinel, +8 for length
        (base + 63) & !63              // round up to next multiple of 64
    };

    // Allocate and zero-fill the padded buffer
    let mut padded: Vec<u8> = vec![0u8; padded_len];

    // Copy original data, then set sentinel byte, then write bit-length
    padded[..data.len()].copy_from_slice(data);
    padded[data.len()] = 0x80;
    let len_bytes = bit_len.to_be_bytes();
    padded[padded_len - 8..padded_len].copy_from_slice(&len_bytes);

    // ── Processing: compress each 64-byte block ─────────────────────────────
    for block in padded.chunks_exact(64) {
        // Expand block into 64-word message schedule W[0..64]
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                block[i * 4],
                block[i * 4 + 1],
                block[i * 4 + 2],
                block[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7)
                ^ w[i - 15].rotate_right(18)
                ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17)
                ^ w[i - 2].rotate_right(19)
                ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        // Initialise working variables from current hash state
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;

        // 64 rounds of SHA-256 compression
        for i in 0..64 {
            let s1  = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch  = (e & f) ^ ((!e) & g);
            let t1  = hh.wrapping_add(s1)
                        .wrapping_add(ch)
                        .wrapping_add(K[i])
                        .wrapping_add(w[i]);
            let s0  = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2  = s0.wrapping_add(maj);

            hh = g; g = f; f = e;
            e = d.wrapping_add(t1);
            d = c; c = b; b = a;
            a = t1.wrapping_add(t2);
        }

        // Add compressed block result to running hash
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    // ── Produce final 32-byte digest ────────────────────────────────────────
    let mut digest = [0u8; 32];
    for (i, &word) in h.iter().enumerate() {
        digest[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    digest
}

// ── NIST FIPS 180-4 Test Vectors ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::sha256;

    fn hex(s: &str) -> [u8; 32] {
        assert_eq!(s.len(), 64, "hex test vector must be exactly 64 chars, got {}", s.len());
        let mut out = [0u8; 32];
        for i in 0..32 {
            out[i] = u8::from_str_radix(&s[i * 2..i * 2 + 2], 16).unwrap();
        }
        out
    }

    /// SHA-256("") — NIST test vector
    #[test]
    fn empty_input() {
        assert_eq!(
            sha256(&[]),
            hex("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        );
    }

    /// SHA-256("abc") — verified against system shasum and Python hashlib.
    #[test]
    fn abc() {
        assert_eq!(
            sha256(b"abc"),
            hex("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        );
    }

    /// SHA-256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq") — NIST FIPS 180-4 Appendix B.2
    #[test]
    fn longer_message() {
        assert_eq!(
            sha256(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
            hex("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1")
        );
    }

    /// Deterministic: same input always gives same output
    #[test]
    fn deterministic() {
        let data = b"ckbfs determinism test";
        assert_eq!(sha256(data), sha256(data));
    }

    /// Different inputs produce different outputs
    #[test]
    fn different_inputs_differ() {
        assert_ne!(sha256(b"hello"), sha256(b"world"));
    }
}
