/* eslint-env node, mocha */
'use strict';

var assert = require('assert');
var elliptic = require('../');

describe('ECDH', function() {
  function test(name) {
    it('should work with ' + name + ' curve', function() {
      var ecdh = new elliptic.ec(name);
      var s1 = ecdh.genKeyPair();
      var s2 = ecdh.genKeyPair();
      var sh1 = s1.derive(s2.getPublic());
      var sh2 = s2.derive(s1.getPublic());

      assert.equal(sh1.toString(16), sh2.toString(16));

      sh1 = s1.derive(ecdh.keyFromPublic(s2.getPublic('hex'), 'hex')
        .getPublic());
      sh2 = s2.derive(ecdh.keyFromPublic(s1.getPublic('hex'), 'hex')
        .getPublic());
      assert.equal(sh1.toString(16), sh2.toString(16));
    });
  }

  test('curve25519');
  test('ed25519');
  test('secp256k1');
});

describe('ECDH twist attack', () => {
  it('should be able to prevent a twist attack for secp256k1', () => {
    var bobEcdh = new elliptic.ec('secp256k1');
    var malloryEcdh = new elliptic.ec('secp256k1');
    var bob = bobEcdh.genKeyPair();
    // This is a bad point that shouldn't be able to be passed to derive.
    // If a bad point can be passed it's possible to perform a twist attack.
    var mallory = malloryEcdh.keyFromPublic({ x: 14, y: 16 });
    assert.throws(function () {
      bob.derive(mallory.getPublic());
    });
  });
});
