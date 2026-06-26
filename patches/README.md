# elliptic CVE-2025-14505 patch (patch-package)

`elliptic+6.6.1.patch` fixes **CVE-2025-14505 / GHSA-848j-6mx2-7j84** in
`elliptic@6.6.1` (the leading-zero `k` RFC 6979 truncation bug) as a one-line
change to `lib/elliptic/ec/index.js`. It is intended to be applied in a
downstream project via [`patch-package`](https://www.npmjs.com/package/patch-package),
without forking or republishing `elliptic`.

## What it changes

In `EC.prototype.sign`, the per-iteration nonce `k` is generated as a
fixed-width buffer of `this.n.byteLength()` bytes but was truncated with
`this._truncateToN(k, true)`, which derives the bit length from
`BN#byteLength()` and drops leading zero bytes — producing the wrong RFC 6979
§2.3.2 `bits2int` shift. The patch passes the full generated bit length
explicitly:

```diff
-    k = this._truncateToN(k, true);
+    k = this._truncateToN(k, true, this.n.byteLength() * 8);
```

`dist/` is intentionally not patched: npm only ships `lib/` (`"files": ["lib"]`),
so the browser bundle is never present in a consumer's `node_modules`.

## How to apply it in a consuming project

1. Confirm the installed version is `elliptic@6.6.1` (the patch filename is
   version-pinned; patch-package will refuse to apply on a different version):

   ```bash
   npm ls elliptic
   ```

2. Install patch-package and copy this patch into your repo:

   ```bash
   npm install --save-dev patch-package
   mkdir -p patches
   cp elliptic+6.6.1.patch patches/
   ```

3. Add a `postinstall` hook in your `package.json` so the patch is reapplied on
   every install:

   ```json
   {
     "scripts": {
       "postinstall": "patch-package"
     }
   }
   ```

4. Apply it now:

   ```bash
   npx patch-package
   ```

For transitive dependencies (e.g. `jwk-to-pem -> elliptic`), make sure your
dependency tree resolves to a single `elliptic@6.6.1` (use `npm dedupe` or an
`overrides` entry pinning `elliptic` to `6.6.1`) so the patch targets the
installed copy.

## Required security action

A code fix alone is **not** sufficient if vulnerable signatures were ever
produced. **Rotate / invalidate any keys previously used to sign with a
vulnerable `elliptic` build (<= 6.6.1).** A faulty signature plus a correct
signature for the same input can leak the private key.
