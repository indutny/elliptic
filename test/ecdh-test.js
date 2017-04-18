var assert = require('assert');
var elliptic = require('../');
var hash = require('hash.js');

describe('ECDH', function() {
  function test(name) {
    it('should work with ' + name + ' curve', function() {
      var ecdh = new elliptic.ec(name);
      var s1 = ecdh.genKeyPair();
      var s2 = ecdh.genKeyPair();
      var sh1 = s1.derive(s2.getPublic());
      var sh2 = s2.derive(s1.getPublic());

      assert.equal(sh1.toString(16), sh2.toString(16));

      var sh1 = s1.derive(ecdh.keyFromPublic(s2.getPublic('hex'), 'hex')
                              .getPublic());
      var sh2 = s2.derive(ecdh.keyFromPublic(s1.getPublic('hex'), 'hex')
                              .getPublic());
      assert.equal(sh1.toString(16), sh2.toString(16));
    });
  }

  test('curve25519');
  test('ed25519');
  test('secp256k1');
});

describe('X25519', function() {
  // See https://tools.ietf.org/html/rfc7748#section-6.1
  const ALICE_SECRET_KEY = '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a';
  const ALICE_PUBLIC_KEY = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
  const BOB_SECRET_KEY = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb';
  const BOB_PUBLIC_KEY = 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f';
  const SHARED_SECRET = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';

  const ec = new elliptic.ec('curve25519');

  const aliceKeyPair = ec.keyFromPrivate(ALICE_SECRET_KEY, 'hex');
  assert.equal(ALICE_SECRET_KEY, aliceKeyPair.getPrivate('hex'));
  assert.equal(ALICE_PUBLIC_KEY, aliceKeyPair.getPublic('hex'));

  const bobKeyPair = ec.keyFromPrivate(BOB_SECRET_KEY, 'hex');
  assert.equal(BOB_SECRET_KEY, bobKeyPair.getPrivate('hex'));
  assert.equal(BOB_PUBLIC_KEY, bobKeyPair.getPublic('hex'));

  const aliceSharedSecret = aliceKeyPair.derive(ec.keyFromPrivate(BOB_PUBLIC_KEY, 'hex').getPublic());
  assert.equal(SHARED_SECRET, aliceSharedSecret.toString(16));
  const bobSharedSecret = bobKeyPair.derive(ec.keyFromPrivate(ALICE_PUBLIC_KEY, 'hex').getPublic());
  assert.equal(SHARED_SECRET, bobSharedSecret.toString(16));
});
