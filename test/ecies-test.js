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
      var enc = ec1.encrypt(msg, bob.getPublic());

      //decrypt a message with his private key
      var dec = ec1.decrypt(enc, bob.getPrivate());


      asset.equal(msg, dec);

    });
  }

  test('ed25519');
