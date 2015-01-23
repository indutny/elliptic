var assert = require('assert');
var elliptic = require('../');
var hash = require('hash.js');

describe('ECIES', function() {
  function test(name) {
    it('should work with ' + name + ' curve', function() {

      var ecies = new elliptic.ec(name);

      // Generate key pair for bob
      var bob = ecies.genKeyPair();
      var msg = "deadbeef";

      //encrypt a message with his public key
      var enc = ecies.encrypt(msg, bob.getPublic());

      //decrypt a message with his private key
      var dec = ecies.decrypt(enc, bob.getPrivate());


      assert.equal(msg, dec);

    });
  }

  test('ed25519');
});
