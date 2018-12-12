var assert = require('assert');
var elliptic = require('../');
var BN = require('bn.js')

describe('EC API', function () {
  it('should instantiate with valid curve (secp256k1)', function () {
    var ec = new elliptic.ec('secp256k1');

    assert(ec);
    assert(typeof ec === 'object');
  });

  it('should consider leading zeros when truncate hash to n', function () {
    function hexToBytes(hex) {
      for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
      return bytes;
    }
    var ec = new elliptic.ec('p256');
    var seed = '49255321320058729917982773444793127850273694476748623591312642711554767198';
    var resultBn = new BN(seed, 10)
    var msgHex = '001be0a5686f0c826a08601b828a2c0a347bf8cbbce0f7b6e5d87f114712395eaaf0429a5d3c224363a2602dfe91e0f6';
    var msgBytes = hexToBytes(msgHex)
    assert.deepStrictEqual(ec._truncateToN(msgHex).toString(10), seed);
    assert.deepStrictEqual(ec._truncateToN(msgBytes).toString(10), seed);
  });
});
