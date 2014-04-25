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

  describe('RFC6979 vector', function() {
    function test(opt) {
      it('should not fail on "' + opt.name + '"', function() {
        var ecdsa = elliptic.ecdsa({
          curve: opt.curve,
          hash: opt.hash
        });

        var dgst = opt.hash().update(opt.message).digest();
        var sign = ecdsa.sign(dgst, opt.key);
        assert.equal(sign.r.toString(16), opt.r);
        assert.equal(sign.s.toString(16), opt.s);
      });
    }

    test({
      name: 'ECDSA, 192 Bits (Prime Field): sample',
      curve: elliptic.nist.p192,
      hash: elliptic.hash.sha256,
      message: 'sample',
      key: '6fab034934e4c0fc9ae67f5b5659a9d7d1fefd187ee09fd4',
      r: '4b0b8ce98a92866a2820e20aa6b75b56382e0f9bfd5ecb55',
      s: 'ccdb006926ea9565cbadc840829d8c384e06de1f1e381b85'
    });

    test({
      name: 'ECDSA, 192 Bits (Prime Field): test',
      curve: elliptic.nist.p192,
      hash: elliptic.hash.sha256,
      message: 'test',
      key: '6fab034934e4c0fc9ae67f5b5659a9d7d1fefd187ee09fd4',
      r: '3a718bd8b4926c3b52ee6bbe67ef79b18cb6eb62b1ad97ae',
      s: '5662e6848a4a19b1f1ae2f72acd4b8bbe50f1eac65d9124f'
    });
  });
});
