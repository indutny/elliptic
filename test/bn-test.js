var assert = require('assert');
var elliptic = require('../');

describe('BN', function() {
  it('should work with Number input', function() {
    assert.equal(elliptic.bn(12345).toString(16), '3039');
  });

  it('should work with String input', function() {
    assert.equal(elliptic.bn('29048849665247').toString(16),
                 '1a6b765d8cdf');
    assert.equal(elliptic.bn('1A6B765D8CDF', 16).toString(16),
                 '1a6b765d8cdf');
    assert.equal(elliptic.bn('FF', 16).toString(), '255');
    assert.equal(elliptic.bn('1A6B765D8CDF', 16).toString(),
                 '29048849665247');
  });

  it('should add numbers', function() {
    assert.equal(elliptic.bn(14).add(26).toString(16), '28');
    var k = elliptic.bn(0x1234);
    var r = k;
    for (var i = 0; i < 257; i++)
      r = r.add(k);
    assert.equal(r.toString(16), '125868');
  });

  it('should substract numbers', function() {
    assert.equal(elliptic.bn(14).sub(26).toString(16), '-c');
    assert.equal(elliptic.bn(26).sub(14).toString(16), 'c');
    assert.equal(elliptic.bn(26).sub(26).toString(16), '0');
    assert.equal(elliptic.bn(-26).sub(26).toString(16), '-34');
  });

  it('should mul numbers', function() {
    assert.equal(elliptic.bn(0x1001).mul(0x1234).toString(16),
                 '1235234');
    var n = elliptic.bn(0x1001);
    var r = n;
    for (var i = 0; i < 4; i++)
      r = r.mul(n);
    assert.equal(r.toString(16),
                 '100500a00a005001');
  });

  it('should div numbers', function() {
    assert.equal(elliptic.bn('10').div('256').toString(16),
                 '0');
    assert.equal(elliptic.bn('69527932928').div('16974594').toString(16),
                 'fff');
  });

  it('should mod numbers', function() {
    assert.equal(elliptic.bn('10').mod('256').toString(16),
                 'a');
    assert.equal(elliptic.bn('69527932928').mod('16974594').toString(16),
                 '102f302');
  });

  it('should shl numbers', function() {
    assert.equal(elliptic.bn('69527932928').shl(13).toString(16),
                 '2060602000000');
    assert.equal(elliptic.bn('69527932928').shl(45).toString(16),
                 '206060200000000000000');
  });

  it('should shr numbers', function() {
    assert.equal(elliptic.bn('69527932928').shr(13).toString(16),
                 '818180');
    assert.equal(elliptic.bn('69527932928').shr(17).toString(16),
                 '81818');
  });
});
