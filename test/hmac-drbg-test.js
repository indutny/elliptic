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
        res: '018ec5f8e08c41e5ac974eb129ac297c5388ee1864324fa13d9b15cf98d9a157'
      },
      {
        entropy: 'totally random0123456789',
        nonce: 'secret nonce',
        pers: null,
        size: 32,
        res: 'ed5d61ecf0ef38258e62f03bbb49f19f2cd07ba5145a840d83b134d5963b3633'
      },
    ];
    for (var i = 0; i < test.length; i++)
      assert.equal(doDrbg(test[i]), test[i].res);
  });
});
