var assert = require('assert');
var elliptic = require('../');
var utils = elliptic.utils;

describe('Hmac_DRBG', function() {
  it('should support hmac-drbg-sha256', function() {
    function doDrbg(opt) {
      var drbg = elliptic.hmacDRBG({
        hash: elliptic.hash.sha256,
        entropy: opt.entropy,
        nonce: opt.nonce,
        pers: opt.pers
      });
      return drbg.generate(opt.size, 'hex');
    }

    var test = [
      {
        entropy: 'totally random0123456789',
        nonce: 'secret nonce',
        pers: 'my drbg',
        size: 32,
        res: 'd2b77582d9764fbb3a8933872eb9c89c6b504452d865c63ba415382287be1c75'
      },
      {
        entropy: 'totally random0123456789',
        nonce: 'secret nonce',
        pers: null,
        size: 32,
        res: '803be58185c7da6597571269d2ac8b6ed34948881756b6f701c4af41cb71b298'
      },
    ];
    for (var i = 0; i < test.length; i++)
      assert.equal(doDrbg(test[i]), test[i].res);
  });
});
