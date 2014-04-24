var assert = require('assert');
var elliptic = require('../');

describe('BN', function() {
  it('should work with Number input', function() {
    assert.equal(elliptic.bn(12345).toString(16), '3039');
  });

  it('should work with String input', function() {
    assert.equal(elliptic.bn('29048849665247').toString(16),
                 '1a6b765d8cdf');
    assert.equal(elliptic.bn('-29048849665247').toString(16),
                 '-1a6b765d8cdf');
    assert.equal(elliptic.bn('1A6B765D8CDF', 16).toString(16),
                 '1a6b765d8cdf');
    assert.equal(elliptic.bn('FF', 16).toString(), '255');
    assert.equal(elliptic.bn('1A6B765D8CDF', 16).toString(),
                 '29048849665247');
    assert.equal(elliptic.bn('a89c e5af8724 c0a23e0e 0ff77500', 16).toString(16),
                 'a89ce5af8724c0a23e0e0ff77500');
  });

  it('should add numbers', function() {
    assert.equal(elliptic.bn(14).add(26).toString(16), '28');
    var k = elliptic.bn(0x1234);
    var r = k;
    for (var i = 0; i < 257; i++)
      r = r.add(k);
    assert.equal(r.toString(16), '125868');
  });

  it('should subtract numbers', function() {
    assert.equal(elliptic.bn(14).sub(26).toString(16), '-c');
    assert.equal(elliptic.bn(26).sub(14).toString(16), 'c');
    assert.equal(elliptic.bn(26).sub(26).toString(16), '0');
    assert.equal(elliptic.bn(-26).sub(26).toString(16), '-34');

    var a = '31ff3c61db2db84b9823d320907a573f6ad37c437abe458b1802cda041d6384' +
            'a7d8daef41395491e2';
    var b = '6f0e4d9f1d6071c183677f601af9305721c91d31b0bbbae8fb790000';
    var r = '31ff3c61db2db84b9823d3208989726578fd75276287cd9516533a9acfb9a67' +
            '76281f34583ddb91e2';
    assert.equal(elliptic.bn(a, 16).sub(b, 16).toString(16), r);
  });

  it('should mul numbers', function() {
    assert.equal(elliptic.bn(0x1001).mul(0x1234).toString(16),
                 '1235234');
    assert.equal(elliptic.bn(-0x1001).mul(0x1234).toString(16),
                 '-1235234');
    assert.equal(elliptic.bn(-0x1001).mul(-0x1234).toString(16),
                 '1235234');
    var n = elliptic.bn(0x1001);
    var r = n;
    for (var i = 0; i < 4; i++)
      r = r.mul(n);
    assert.equal(r.toString(16),
                 '100500a00a005001');

    var n = elliptic.bn(
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      16
    );
    assert.equal(n.mul(n).toString(16),
                 '39e58a8055b6fb264b75ec8c646509784204ac15a8c24e05babc9729ab9' +
                     'b055c3a9458e4ce3289560a38e08ba8175a9446ce14e608245ab3a9' +
                     '978a8bd8acaa40');
  });

  it('should div numbers', function() {
    assert.equal(elliptic.bn('10').div('256').toString(16),
                 '0');
    assert.equal(elliptic.bn('69527932928').div('16974594').toString(16),
                 'fff');
    assert.equal(elliptic.bn('-69527932928').div('16974594').toString(16),
                 '-fff');

    var b = elliptic.bn(
      '39e58a8055b6fb264b75ec8c646509784204ac15a8c24e05babc9729ab9' +
          'b055c3a9458e4ce3289560a38e08ba8175a9446ce14e608245ab3a9' +
          '978a8bd8acaa40', 16);
    var n = elliptic.bn(
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      16
    );
    assert.equal(b.div(n).toString(16), n.toString(16));
  });

  it('should mod numbers', function() {
    assert.equal(elliptic.bn('10').mod('256').toString(16),
                 'a');
    assert.equal(elliptic.bn('69527932928').mod('16974594').toString(16),
                 '102f302');
    assert.equal(elliptic.bn('-69527932928').mod('16974594').toString(16),
                 '1000');
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

  it('should invm numbers', function() {
    var p = elliptic.bn(257);
    var a = elliptic.bn(3);
    var b = a.invm(p);
    assert.equal(a.mul(b).mod(p).toString(16), '1');

    var p192 = elliptic.bn(
        'fffffffffffffffffffffffffffffffeffffffffffffffff',
        16);
    var a = elliptic.bn('deadbeef', 16);
    var b = a.invm(p192);
    assert.equal(a.mul(b).mod(p192).toString(16), '1');
  });

  it('should support binc', function() {
    assert.equal(elliptic.bn(0).binc(1).toString(16), '2');
    assert.equal(elliptic.bn(2).binc(1).toString(16), '4');
    assert.equal(elliptic.bn(0xffffff).binc(1).toString(16), '1000001');
  });

  it('should support montgomery operations', function() {
    var p192 = elliptic.bn(
        'fffffffffffffffffffffffffffffffeffffffffffffffff',
        16);
    var m = elliptic.bn.mont(p192);
    var a = elliptic.bn(123);
    var b = elliptic.bn(231);
    var c = a.toMont(m).montMul(b.toMont(m)).fromMont();
    assert(c.cmp(a.mul(b).mod(p192)) === 0);
  });
});
