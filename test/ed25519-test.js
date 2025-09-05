/* eslint-env node, mocha */
'use strict';

var assert = require('assert');
var elliptic = require('../');
var utils = elliptic.utils;
var toArray = elliptic.utils.toArray;
var eddsa = elliptic.eddsa;

function toHex(arr) {
  return elliptic.utils.toHex(arr).toUpperCase();
}

var MAX_PROGRAMMATIC = process.env.CI ? Infinity : 50;

describe('ed25519 derivations', function() {
  var expectedTests = 256;
  var ed25519;
  var derivations;

  before(function() {
    ed25519 = new eddsa('ed25519');
    derivations = require('./fixtures/derivation-fixtures');
    assert.equal(derivations.length, expectedTests);
  });

  function testFactory(i) {
    it('can compute correct a and A for secret: ' + i, function() {
      var test = derivations[i];
      var secret = utils.toArray(test.secret_hex, 'hex');
      var key = ed25519.keyFromSecret(secret);
      assert.equal(toHex(key.privBytes()), test.a_hex);
      var xRecovered = toHex(ed25519.encodeInt(
        ed25519.decodePoint(key.pubBytes()).getX()));
      assert.equal(xRecovered, test.A_P.x);
      assert.equal(toHex(key.pubBytes()), test.A_hex);
    });
  }

  for (var i = 0; i < Math.min(expectedTests, MAX_PROGRAMMATIC); i++)
    testFactory(i);
});

describe('sign.input ed25519 test vectors', function() {
  var expectedTests = 1024;
  var ed25519;
  var lines;

  before(function(done) {
    ed25519 = new eddsa('ed25519');
    require('fs').readFile(__dirname + '/fixtures/sign.input', function(err, f) {
      lines = f.toString().split('\n');
      assert.equal(lines.length, expectedTests + 1 /*blank line*/);
      done();
    });
  });

  function testFactory(i) {
    it('vector ' + i, function() {
      var split = lines[i].toUpperCase().split(':');
      var key = ed25519.keyFromSecret(split[0].slice(0, 64));
      var expectedPk = split[0].slice(64);

      assert.equal(toHex(key.pubBytes()), expectedPk);

      var msg = toArray(split[2], 'hex');
      var sig = key.sign(msg).toHex();
      var sigR = sig.slice(0, 64);
      var sigS = sig.slice(64);

      assert.equal(sigR, split[3].slice(0, 64));
      assert.equal(sigS, split[3].slice(64, 128));
      assert(key.verify(msg, sig));

      var forged = msg.length === 0 ? [ 0x78 ] /*ord('x')*/:
        msg.slice(0, msg.length - 1).concat(
          (msg[(msg.length - 1)] + 1) % 256);

      assert.equal(msg.length || 1, forged.length);
      assert(!key.verify(forged, sig));
    });
  }
  for (var i = 0; i < Math.min(expectedTests, MAX_PROGRAMMATIC); i++)
    testFactory(i);
});

describe('EDDSA(\'ed25519\')', function() {
  var ed25519;

  before(function() {
    ed25519 = new eddsa('ed25519');
  });

  it('has encodingLength of 32', function() {
    assert.equal(32, ed25519.encodingLength);
  });

  it('can sign/verify messages', function() {
    var secret = toArray(new Array(65).join('0'), 'hex');
    assert(secret.length === 32);
    var msg = [ 0xB, 0xE, 0xE, 0xF ];
    var key = ed25519.keyFromSecret(secret);
    var sig = key.sign(msg).toHex();

    var R = '8F1B9A7FDB22BCD2C15D4695B1CE2B063CBFAEC9B00BE360427BAC9533943F6C';
    var S = '5F0B380FD7F2E43B70AB2FA29F6C6E3FFC1012710E174786814012324BF19B0C';

    assert.equal(sig.slice(0, 64), R);
    assert.equal(sig.slice(64), S);

    assert(key.verify(msg, sig));
  });

  describe('KeyPair', function() {
    var pair;
    var secret = '00000000000000000000000000000000' +
                 '00000000000000000000000000000000';

    before(function() {
      pair = ed25519.keyFromSecret(secret);
    });

    it('can be created with keyFromSecret/keyFromPublic', function() {
      var pubKey = ed25519.keyFromPublic(toHex(pair.pubBytes()));
      assert(pubKey.pub() instanceof ed25519.pointClass);
      assert(pubKey.pub().eq(pair.pub()));
    });
    it('#getSecret returns bytes with optional encoding', function() {
      assert(Array.isArray(pair.getSecret()));
      assert(pair.getSecret('hex') === secret);
    });
    it('#getPub returns bytes with optional encoding', function() {
      assert(Array.isArray(pair.getPublic()));
      assert.equal(pair.getPublic('hex'),
        '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29');
    });
  });
});

describe('ed25519 canonicality, hash binding, and subgrep checks', function() {
  var ed25519;
  var BN = require('bn.js');

  before(function() {
    ed25519 = new eddsa('ed25519');
  });

  describe('decodePoint canonicality (RFC 8032 §5.1.3)', function() {
    it('rejects non-32-byte encodings', function() {
      var enc = ed25519.encodePoint(ed25519.g); // Array of 32 bytes

      // Too short (31)
      assert.throws(function() {
        ed25519.decodePoint(enc.slice(0, 31));
      });

      // Too long (33)
      assert.throws(function() {
        ed25519.decodePoint(enc.concat([ 0 ]));
      });
    });

    it('rejects encodings where y >= p (non-canonical)', function() {
      var p = ed25519.curve.p;
      var P = ed25519.g;
      var enc = ed25519.encodePoint(P).slice(); // canonical

      // Recover y (clear sign bit)
      var yBytes = enc.slice();
      yBytes[31] &= 0x7f;
      var y = new BN(Buffer.from(yBytes), 'le');

      // Make non-canonical y' = y + p
      var yBad = y.add(p);
      var bad = yBad.toArray('le', 32);

      // Restore sign bit from actual x parity
      bad[31] &= 0x7f;
      bad[31] |= (P.getX().isOdd() ? 0x80 : 0);

      // Should be rejected per RFC 8032 §5.1.3
      assert.throws(function() {
        ed25519.decodePoint(bad);
      });
    });
  });

  describe('verify(): bind hash to actual points', function() {
    it('rejects mismatched Rencoded()/R (hash confusion)', function() {
      // Public key: use base point for a simple valid pubkey
      var Aenc = ed25519.encodePoint(ed25519.g);
      var key = ed25519.keyFromPublic(Aenc);
      var A = key.pub();

      // Message as a plain Array (not Buffer)
      var msg = [ 0x61, 0x74, 0x74, 0x61, 0x63, 0x6b ]; // "attack"

      // Choose arbitrary Q (for hashing) and S
      var Q = ed25519.g.mul(new BN(12345));
      var Qenc = ed25519.encodePoint(Q);
      var S = new BN(4242);

      // h = H(Qenc, Aenc, msg)
      var h = ed25519.hashInt(Qenc, key.pubBytes(), msg);

      // R = [S]B - [h]A
      var R = ed25519.g.mul(S).add(A.mul(h).neg());

      // Make a legit Signature, then lie about Rencoded()
      var sig = ed25519.makeSignature({ R: R, S: S });
      sig.Rencoded = function() {
        return Qenc;
      }; // mismatch

      // With the fix (re-encoding from points), this must fail
      assert.strictEqual(ed25519.verify(msg, sig, key), false);
    });
  });

  describe('verify(): enforce subgroup membership (cofactor 8)', function() {
    it('rejects identity public key (small-order)', function() {
      // Identity encoding on ed25519: (x=0,y=1) -> 0x01 + 31*0x00
      var Aenc = new Array(32).fill(0);
      Aenc[0] = 1;

      // Forge: pick any S and set R = [S]B
      var S = new BN(1337);
      var R = ed25519.g.mul(S);

      var sig = ed25519.makeSignature({ R: R, S: S });
      var msg = [ 0x78 ]; // 'x'

      // With subgroup checks, identity public key must be rejected
      assert.strictEqual(ed25519.verify(msg, sig, Aenc), false);
    });
  });
});
