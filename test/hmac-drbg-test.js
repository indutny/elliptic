var assert = require('assert');
var elliptic = require('../');
var utils = elliptic.utils;
var hash = require('hash.js');

describe('Hmac_DRBG', function() {
  it('should support hmac-drbg-sha256', function() {
    function doDrbg(opt) {
      var drbg = elliptic.hmacDRBG({
        hash: hash.sha256,
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
      }
    ];
    for (var i = 0; i < test.length; i++)
      assert.equal(doDrbg(test[i]), test[i].res);
  });

  describe('NIST vector', function() {
    require('./fixtures/hmac-drbg-nist.json').forEach(function (opt) {
      it('should not fail at ' + opt.name, function() {
        var drbg = elliptic.hmacDRBG({
          hash: hash.sha256,
          entropy: opt.entropy,
          entropyEnc: 'hex',
          nonce: opt.nonce,
          nonceEnc: 'hex',
          pers: opt.pers,
          persEnc: 'hex'
        });

        for (var i = 0; i < opt.add.length; i++) {
          var last = drbg.generate(opt.expected.length / 2,
                                   'hex',
                                   opt.add[i],
                                   'hex');
        }
        assert.equal(last, opt.expected);
      });
    });
  });
});
