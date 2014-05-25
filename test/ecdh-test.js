var assert = require('assert');
var elliptic = require('../');
var hash = require('hash.js');

describe('ECDH', function() {
  function test(name) {
    it('should work with ' + name + ' curve', function() {
      var curve = elliptic.curves[name];
      assert(curve);

      var ecdh = new elliptic.ecdh(curve);
      var s1 = ecdh.genKeyPair();
      var s2 = ecdh.genKeyPair();
      var sh1 = s1.getShared(s2.getPublic());
      var sh2 = s2.getShared(s1.getPublic());

      assert.equal(sh1.toString(16), sh2.toString(16));
    });
  }

  test('curve25519');
  test('secp256k1');
});
