var assert = require('assert');
var elliptic = require('../');

describe('ECDSA', function() {
  it('should work with secp256k1 NIST curve', function() {
    var curve = elliptic.nist.secp256k1;
    assert(curve);

    var ecdsa = new elliptic.ecdsa(curve);
    var keys = ecdsa.genKeyPair();
    var msg = new elliptic.bn('deadbeef', 16);

    // Sign and verify
    var signature = ecdsa.sign(msg, keys.priv);
    assert(ecdsa.verify(msg, signature, keys.pub));

    // Wrong public key
    var keys = ecdsa.genKeyPair();
    assert(!ecdsa.verify(msg, signature, keys.pub));
  });
});
