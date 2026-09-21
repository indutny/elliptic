# Elliptic Repository Guide for Copilot Agents

## Project Overview

**Elliptic** is a fast elliptic-curve cryptography implementation in JavaScript. It provides cryptographic operations using various elliptic curves for digital signatures (ECDSA, EdDSA) and key agreement (ECDH).

**Repository**: dupree78758512/elliptic
**License**: MIT
**Main Entry Point**: `lib/elliptic.js`
**Package Version**: 6.6.1

## Repository Structure

```
elliptic/
├── lib/                          # Source code
│   ├── elliptic.js              # Main entry point
│   └── elliptic/
│       ├── curve/               # Curve implementations
│       │   ├── base.js          # Base curve class
│       │   ├── short.js         # Short Weierstrass curves
│       │   ├── mont.js          # Montgomery curves
│       │   ├── edwards.js       # Edwards curves
│       │   └── index.js         # Curve registry
│       ├── precomputed/         # Precomputed curve parameters
│       │   └── secp256k1.js     # Precomputed values for secp256k1
│       ├── ec/                  # ECDSA implementation
│       │   ├── index.js         # Main EC class
│       │   ├── key.js           # Key generation and handling
│       │   └── signature.js     # Signature operations
│       ├── eddsa/               # EdDSA implementation
│       │   ├── index.js         # Main EdDSA class
│       │   ├── key.js           # Key generation and handling
│       │   └── signature.js     # Signature operations
│       ├── curves.js            # Predefined curve definitions
│       └── utils.js             # Utility functions
├── test/                        # Test suite
│   ├── index.js                # Test runner
│   ├── api-test.js             # API verification tests
│   ├── curve-test.js           # Curve implementation tests
│   ├── ecdsa-test.js           # ECDSA tests
│   ├── ecdh-test.js            # ECDH tests
│   ├── ed25519-test.js         # EdDSA/Ed25519 tests
│   └── fixtures/               # Test data files
├── dist/                       # Compiled/bundled output (generated)
├── benchmarks/                 # Performance benchmarks
├── Gruntfile.js               # Build automation
├── package.json               # Package metadata and scripts
├── README.md                  # Project README
└── .eslintrc.js              # ESLint configuration
```

## Key Modules

### Main API (lib/elliptic.js)

Exports the following:
- `elliptic.ec` - ECDSA implementation
- `elliptic.eddsa` - EdDSA implementation
- `elliptic.curves` - Registry of predefined curves
- `elliptic.curve` - Curve class definitions
- `elliptic.utils` - Utility functions
- `elliptic.rand` - Random number generation (via brorand)
- `elliptic.version` - Package version

### Curve Types

1. **Short Weierstrass Curves** (`lib/elliptic/curve/short.js`)
   - Most common elliptic curves
   - Equation: y² = x³ + ax + b
   - Examples: secp256k1, secp256r1, prime256v1

2. **Montgomery Curves** (`lib/elliptic/curve/mont.js`)
   - Efficient for ECDH
   - Equation: By² = x³ + Ax² + x
   - Examples: Curve25519, Curve448

3. **Edwards Curves** (`lib/elliptic/curve/edwards.js`)
   - Used for EdDSA
   - Examples: Ed25519, Ed448

### Cryptographic Protocols

1. **EC (ECDSA)** - Elliptic Curve Digital Signature Algorithm
   - Key generation: `ec.keyPair()`
   - Signing: `keyPair.sign(message)`
   - Verification: `keyPair.verify(message, signature)`

2. **EdDSA** - Edwards-curve Digital Signature Algorithm
   - Similar API to EC
   - Typically uses Ed25519 or Ed448 curves

## Development Commands

All commands are defined in `package.json`:

```bash
# Linting
npm run lint              # Run ESLint on lib/ and test/
npm run lint:fix          # Auto-fix ESLint errors

# Testing
npm run unit              # Run unit tests with Istanbul coverage
npm run test              # Run lint + unit tests (full test suite)

# Building
grunt dist                 # Build distribution files

# Versioning
npm version <patch|minor|major>  # Runs `grunt dist && git add dist/` via the "version" lifecycle script

# Benchmarks
node benchmarks/index.js   # Run performance benchmarks

### Testing Approach

- **Test Framework**: Mocha
- **Coverage Tool**: Istanbul
- **Test Location**: `test/` directory
- **Test Files**: 
  - `api-test.js` - API stability tests
  - `curve-test.js` - Curve mathematics tests
  - `ecdsa-test.js` - ECDSA tests
  - `ecdh-test.js` - Key agreement tests
  - `ed25519-test.js` - EdDSA tests
- **Test Data**: Fixtures in `test/fixtures/`

**To run tests**:
```bash
npm test                  # Full test suite with linting
npm run unit              # Just unit tests with coverage
```

## Code Conventions

### Style Guidelines

- **Language**: Plain JavaScript (ES5/ES6)
- **Linter**: ESLint (configured in `.eslintrc.js`)
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Strict Mode**: 'use strict' at top of files

### Naming Conventions

- Files: lowercase with hyphens (e.g., `secp256k1.js`)
- Classes/Constructors: CamelCase (e.g., `EC`, `EdDSA`)
- Functions/Methods: camelCase (e.g., `sign`, `verify`, `keyPair`)
- Private methods: Often prefixed with underscore (e.g., `_sign`)
- Constants: UPPER_CASE

### Module Pattern

Modules export via `exports` or `module.exports`:
```javascript
'use strict';

var ClassName = module.exports = function ClassName(options) {
  // Constructor
};

ClassName.prototype.methodName = function methodName(arg) {
  // Method implementation
};
```

### Error Handling

- Use assertions from `minimalistic-assert` for validation
- Include meaningful error messages
- Validate input parameters early

## Common Development Tasks

### Adding Support for a New Curve

1. Create curve implementation in `lib/elliptic/curve/` (extends base.js)
2. Add curve definition to `lib/elliptic/curves.js`
3. Add tests in `test/curve-test.js` and/or specific curve test file
4. Run `npm test` to verify

### Fixing a Bug

1. Create a test case that reproduces the bug
2. Fix the implementation
3. Verify the test passes: `npm run unit`
4. Verify no regressions: `npm test`
5. Commit with descriptive message

### Optimizing Performance

1. Run benchmarks: `node benchmarks/index.js`
2. Identify bottleneck
3. Optimize in corresponding module
4. Re-run benchmarks to verify improvement
5. Run `npm test` to ensure correctness

### Adding a New Export to Main API

1. Create module in appropriate directory
2. Require and export from `lib/elliptic.js`
3. Add tests
4. Update README.md if it's a public API
5. Run `npm test`

## Dependencies

### Production Dependencies

- **bn.js** - Big number arithmetic
- **brorand** - Random number generation
- **hash.js** - Cryptographic hashing
- **hmac-drbg** - Deterministic random bit generation
- **inherits** - Inheritance utilities
- **minimalistic-assert** - Assertion library
- **minimalistic-crypto-utils** - Crypto utilities

### Dev Dependencies

Key tools:
- **mocha** - Test framework
- **istanbul** - Code coverage
- **eslint** - Linting
- **grunt** - Build automation
- **browserify** - JavaScript bundler for browser builds

## Important Notes

### Security Considerations

- This is a cryptographic library; review security implications of any changes
- Follow secure coding practices
- Use cryptographically secure random number generation
- Validate all inputs to cryptographic functions
- Test thoroughly with known test vectors

### Compatibility

- Targets both Node.js and browser environments
- Browser builds generated via Grunt/Browserify (dist/ directory)
- Careful with JavaScript number precision (limited to 53 bits)
- Relies on big number arithmetic (bn.js) for proper cryptographic precision

### Version and Release

- Current version: 6.6.1
- Version bumping is automated (see `npm run version` script)
- Dist files are built and committed with version bumps

## References

- **Security Information**: http://safecurves.cr.yp.to/
- **ECDSA**: https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm
- **EdDSA**: https://en.wikipedia.org/wiki/Edwards-curve_Digital_Signature_Algorithm
- **bn.js**: https://github.com/indutny/bn.js
- **Original Author**: Fedor Indutny

## Task Guidelines for Agents

When working on this repository:

1. **Always run tests**: Execute `npm test` after making changes
2. **Check for linting errors**: ESLint must pass before committing
3. **Preserve backward compatibility**: Don't break existing APIs unless necessary
4. **Document changes**: Update README.md or AGENTS.md if behavior changes
5. **Write tests first**: For bugs or new features, write test cases first
6. **Validate cryptographic correctness**: Use test vectors for crypto operations
7. **Performance matters**: This is a cryptography library; performance is critical
8. **Browser compatibility**: Changes should work in both Node.js and browsers
9. **Minimize dependencies**: Avoid adding new dependencies unnecessarily
10. **Code review**: Complex cryptographic changes should be carefully reviewed
