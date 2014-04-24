var assert = require('assert');
var elliptic = require('../');

describe('Curve', function() {
  it('should work with example curve', function() {
    var curve = new elliptic.curve({
      p: '1d',
      a: '4',
      b: '14'
    });

    var p = curve.point('18', '16');
    assert(p.validate());
    assert(p.dbl().validate());
    assert(p.dbl().add(p).validate());
    assert(p.dbl().add(p.dbl(p)).validate());
    assert(p.dbl().add(p.dbl(p)).eq(p.add(p).add(p).add(p)));
  });

  it('should work with secp112k1', function() {
    var curve = new elliptic.curve({
      p: 'db7c 2abf62e3 5e668076 bead208b',
      a: 'db7c 2abf62e3 5e668076 bead2088',
      b: '659e f8ba0439 16eede89 11702b22'
    });

    var p = curve.point(
      '0948 7239995a 5ee76b55 f9c2f098',
      'a89c e5af8724 c0a23e0e 0ff77500');
    assert(p.validate());
    assert(p.dbl().validate());
  });

  it('should work with secp256k1', function() {
    var curve = new elliptic.curve({
      p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ' +
             'fffffc2f',
      a: '0',
      b: '7'
    });

    var p = curve.point(
      '79be667e f9dcbbac 55a06295 ce870b07 029bfcdb 2dce28d9 59f2815b 16f81798',
      '483ada77 26a3c465 5da4fbfc 0e1108a8 fd17b448 a6855419 9c47d08f fb10d4b8'
    );
    assert(p.validate());
    assert(p.dbl().validate());
    assert(p.toJ().dbl().toP().validate());
    assert(p.mul('79be667e f9dcbbac 55a06295 ce870b07').validate());
  });
});
