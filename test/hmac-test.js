var assert = require('assert');
var elliptic = require('../');
var utils = elliptic.utils;

describe('Hmac', function() {
  it('should support hmac-sha256', function() {
    var test = [
      {
        key: '00010203 04050607 08090A0B 0C0D0E0F' +
             '10111213 14151617 18191A1B 1C1D1E1F 20212223 24252627' +
             '28292A2B 2C2D2E2F 30313233 34353637 38393A3B 3C3D3E3F',
        msg: 'Sample message for keylen=blocklen',
        res: '8bb9a1db9806f20df7f77b82138c7914d174d59e13dc4d0169c9057b133e1d62'
      },
      {
        key: '00010203 04050607' +
             '08090A0B 0C0D0E0F 10111213 14151617 18191A1B 1C1D1E1F',
        msg: 'Sample message for keylen<blocklen',
        res: 'a28cf43130ee696a98f14a37678b56bcfcbdd9e5cf69717fecf5480f0ebdf790'
      },
      {
        key: '00010203' +
             '04050607 08090A0B 0C0D0E0F 10111213 14151617 18191A1B' +
             '1C1D1E1F 20212223 24252627 28292A2B 2C2D2E2F 30313233' +
             '34353637 38393A3B 3C3D3E3F 40414243 44454647 48494A4B' +
             '4C4D4E4F 50515253 54555657 58595A5B 5C5D5E5F 60616263',
        msg: 'Sample message for keylen=blocklen',
        res: 'bdccb6c72ddeadb500ae768386cb38cc41c63dbb0878ddb9c7a38a431b78378d'
      },
      {
        key: '00' +
             '01020304 05060708 090A0B0C 0D0E0F10 11121314 15161718' +
             '191A1B1C 1D1E1F20 21222324 25262728 292A2B2C 2D2E2F30',
        msg: 'Sample message for keylen<blocklen, with truncated tag',
        res: '27a8b157839efeac98df070b331d593618ddb985d403c0c786d23b5d132e57c7'
      }
    ];
    for (var i = 0; i < test.length; i++) {
      var opt = test[i];
      var h = elliptic.hmac(elliptic.hash.sha256, opt.key, 'hex');
      assert.equal(h.update(opt.msg).digest('hex'), opt.res);
      var h = elliptic.hmac(elliptic.hash.sha256, opt.key, 'hex');
      assert.equal(h.update(opt.msg.slice(0, 10))
                    .update(opt.msg.slice(10))
                    .digest('hex'), opt.res);
    }
  });
});
