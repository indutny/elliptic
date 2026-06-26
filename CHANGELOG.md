# Changelog

## 6.6.1-fix-cve-2025-14505.1

Security fix fork of upstream `elliptic@6.6.1`.

- **ec:** correctly handle computation of `k` (step 3.2 of RFC 6979) with
  leading zeros — fixes **CVE-2025-14505** (GHSA-848j-6mx2-7j84).

  The per-iteration ECDSA nonce `k` is generated as a fixed-width buffer of
  `this.n.byteLength()` bytes, but was truncated using `BN#byteLength()`, which
  drops leading zero bytes. This produced an incorrect RFC 6979 §2.3.2
  `bits2int` shift, yielding faulty signatures and — given a faulty plus a
  correct signature for the same input — potential private-key recovery. The
  truncation now passes the full generated bit length (`this.n.byteLength() * 8`)
  explicitly. `_truncateToN` itself is unchanged.

### Required security action

A code fix alone is **not** sufficient if vulnerable signatures were ever
produced. Per the advisory, **rotate / invalidate any keys previously used to
sign with a vulnerable `elliptic` build** (<= 6.6.1). A faulty signature
combined with a correct signature for the same input can leak the private key.
