/* eslint-env node, mocha */
'use strict';

var assert = require('assert');
var BN = require('bn.js');
var elliptic = require('../');

describe('Curve', function() {
  it('should work with example curve', function() {
    var curve = new elliptic.curve.short({
      p: '1d',
      a: '4',
      b: '14',
    });

    var p = curve.point('18', '16');
    assert(p.validate());
    assert(p.dbl().validate());
    assert(p.dbl().add(p).validate());
    assert(p.dbl().add(p.dbl()).validate());
    assert(p.dbl().add(p.dbl()).eq(p.add(p).add(p).add(p)));
  });

  it('should dbl points on edwards curve using proj coordinates', function() {
    var curve = new elliptic.curve.edwards({
      p: new BN('97ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' +
        'ffffffffffffffffffffffffffffffffff3f', 16, 'le'),
      q: new BN('19973cfd137ee273272d101b28695e7ce1ee951ef221fbd5ffffffffff' +
        'ffffffffffffffffffffffffffffffffffff0f', 16, 'le'),
      r: '8',
      a: '1',
      c: '1',
      // -67254 mod p
      d: new BN('e1f8feffffffffffffffffffffffffffffffffffffffffffffffffff' +
        'ffffffffffffffffffffffffffffffffffffff3f', 16, 'le'),
      g: [
        new BN('0396f77094ccc0eb985310e8bc7d519311846453b8ba232935640b2b0' +
          '340f868ae208d6ee95bf0e59103b2ead08d6f19', 16, 'le'),
        new BN('11', 16, 'le'),
      ],
    });

    var point = [
      '21fd21b36cbdbe0d77ad8692c25d918774f5d3bc179c4cb0ae3c364bf1bea981d0' +
      '2e9f97cc62f20acacf0c553887e5fb',
      '29f994329799dba72aa12ceb06312300167b6e18fbed607c63709826c57292cf29' +
      'f5bab4f5c99c739cf107a3833bb553',
    ];

    var double = [
      '0561c8722cf82b2f0d7c36bc72e34539dcbf181e8d98f5244480e79f5b51a4a541' +
      '457016c9c0509d49078eb5909a1121',
      '05b7812fae9d164ee9249c56a16e29a1ad2cdc6353227074dd96d59df363a0bcb5' +
      'bc67d50b44843ea833156bdc0ac6a2',
    ];

    var p = curve.pointFromJSON(point);
    var d = curve.pointFromJSON(double);
    assert(p.dbl().eq(d));
  });

  it('should be able to find a point given y coordinate for all edwards curves',
    function() {
      var curve = new elliptic.curve.edwards({
        p: new BN('f7' +
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff07',
        16, 'le'),
        q: new BN('71' +
        'c966d15fd444893407d3dfc46579f7ffffffffffffffffffffffffffffff01',
        16, 'le'),
        r: '4',
        a: '1',
        // -1174 mod p
        d: new BN('61' +
        'fbffffffffffffffffffffffffffffffffffffffffffffffffffffffffff07',
        16, 'le'),
        c: '1',
      });

      var target = curve.point(
        '05d040ddaa645bf27d2d2f302c5697231425185fd9a410f220ac5c5c7fbeb8a1',
        '02f8ca771306cd23e929775177f2c213843a017a6487b2ec5f9b2a3808108ef2',
      );

      var point = curve.pointFromY('02' +
      'f8ca771306cd23e929775177f2c213843a017a6487b2ec5f9b2a3808108ef2');
      assert(point.eq(target));
    });

  it('should find an odd point given a y coordinate', function() {
    var curve = new elliptic.curve.edwards({
      p: '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed',
      a: '-1',
      c: '1',
      // -121665 * (121666^(-1)) (mod P)
      d: '52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3',
      n: '1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed',
      gRed: false,
      g: [
        '216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a',

        // 4/5
        '6666666666666666666666666666666666666666666666666666666666666658',
      ],
    });

    var bytes = new Uint8Array([ 5, 69, 248, 173, 171, 254, 19, 253, 143, 140, 146, 174, 26, 128, 3, 52, 106, 55, 112, 245, 62, 127, 42, 93, 0, 81, 47, 177, 30, 25, 39, 70 ]);
    var y = new BN(bytes, 16, 'le');
    var point = curve.pointFromY(y, true);
    var target = '2cd591ae3789fd62dc420a152002f79973a387eacecadc6a9a00c1a89488c15d';
    assert.deepStrictEqual(point.getX().toString(16), target);
  });

  it('should work with secp112k1', function() {
    var curve = new elliptic.curve.short({
      p: 'db7c 2abf62e3 5e668076 bead208b',
      a: 'db7c 2abf62e3 5e668076 bead2088',
      b: '659e f8ba0439 16eede89 11702b22',
    });

    var p = curve.point(
      '0948 7239995a 5ee76b55 f9c2f098',
      'a89c e5af8724 c0a23e0e 0ff77500');
    assert(p.validate());
    assert(p.dbl().validate());
  });

  it('should work with secp256k1', function() {
    var curve = new elliptic.curve.short({
      p: 'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ' +
             'fffffc2f',
      a: '0',
      b: '7',
      n: 'ffffffff ffffffff ffffffff fffffffe ' +
             'baaedce6 af48a03b bfd25e8c d0364141',
      g: [
        '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
        '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
      ],
    });

    var p = curve.point(
      '79be667e f9dcbbac 55a06295 ce870b07 029bfcdb 2dce28d9 59f2815b 16f81798',
      '483ada77 26a3c465 5da4fbfc 0e1108a8 fd17b448 a6855419 9c47d08f fb10d4b8',
    );
    assert(p.validate());
    assert(p.dbl().validate());
    assert(p.toJ().dbl().toP().validate());
    assert(p.mul(new BN('79be667e f9dcbbac 55a06295 ce870b07', 16)).validate());

    var j = p.toJ();
    assert(j.trpl().eq(j.dbl().add(j)));

    // Endomorphism test
    assert(curve.endo);
    assert.equal(
      curve.endo.beta.fromRed().toString(16),
      '7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee');
    assert.equal(
      curve.endo.lambda.toString(16),
      '5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72');

    var k = new BN('1234567890123456789012345678901234', 16);
    var split = curve._endoSplit(k);

    var testK = split.k1.add(split.k2.mul(curve.endo.lambda)).umod(curve.n);
    assert.equal(testK.toString(16), k.toString(16));
  });

  it('should compute this problematic secp256k1 multiplication', function() {
    var curve = elliptic.curves.secp256k1.curve;
    var g1 = curve.g; // precomputed g
    assert(g1.precomputed);
    var g2 = curve.point(g1.getX(), g1.getY()); // not precomputed g
    assert(!g2.precomputed);
    var a = new BN(
      '6d1229a6b24c2e775c062870ad26bc261051e0198c67203167273c7c62538846', 16);
    var p1 = g1.mul(a);
    var p2 = g2.mul(a);
    assert(p1.eq(p2));
  });

  it('should not use fixed NAF when k is too large', function() {
    var curve = elliptic.curves.secp256k1.curve;
    var g1 = curve.g; // precomputed g
    assert(g1.precomputed);
    var g2 = curve.point(g1.getX(), g1.getY()); // not precomputed g
    assert(!g2.precomputed);

    var a = new BN(
      '6d1229a6b24c2e775c062870ad26bc26' +
            '1051e0198c67203167273c7c6253884612345678',
      16);
    var p1 = g1.mul(a);
    var p2 = g2.mul(a);
    assert(p1.eq(p2));
  });

  it('should not fail on secp256k1 regression', function() {
    var curve = elliptic.curves.secp256k1.curve;
    var k1 = new BN(
      '32efeba414cd0c830aed727749e816a01c471831536fd2fce28c56b54f5a3bb1', 16);
    var k2 = new BN(
      '5f2e49b5d64e53f9811545434706cde4de528af97bfd49fde1f6cf792ee37a8c', 16);

    var p1 = curve.g.mul(k1);
    var p2 = curve.g.mul(k2);

    // 2 + 2 + 1 = 2 + 1 + 2
    var two = p2.dbl();
    var five = two.dbl().add(p2);
    var three = two.add(p2);
    var maybeFive = three.add(two);

    assert(maybeFive.eq(five));

    p1 = p1.mul(k2);
    p2 = p2.mul(k1);

    assert(p1.validate());
    assert(p2.validate());
    assert(p1.eq(p2));
  });

  it('should correctly double the affine point on secp256k1', function() {
    var bad = {
      x: '026a2073b1ef6fab47ace18e60e728a05180a82755bbcec9a0abc08ad9f7a3d4',
      y: '9cd8cb48c3281596139f147c1364a3ede88d3f310fdb0eb98c924e599ca1b3c9',
      z: 'd78587ad45e4102f48b54b5d85598296e069ce6085002e169c6bad78ddc6d9bd',
    };

    var good = {
      x: 'e7789226739ac2eb3c7ccb2a9a910066beeed86cdb4e0f8a7fee8eeb29dc7016',
      y: '4b76b191fd6d47d07828ea965e275b76d0e3e0196cd5056d38384fbb819f9fcb',
      z: 'cbf8d99056618ba132d6145b904eee1ce566e0feedb9595139c45f84e90cfa7d',
    };

    var curve = elliptic.curves.secp256k1.curve;
    bad = curve.jpoint(bad.x, bad.y, bad.z);
    good = curve.jpoint(good.x, good.y, good.z);

    // They are the same points
    assert(bad.add(good.neg()).isInfinity());

    // But doubling borks them out
    assert(bad.dbl().add(good.dbl().neg()).isInfinity());
  });

  it('should store precomputed values correctly on negation', function() {
    var curve = elliptic.curves.secp256k1.curve;
    var p = curve.g.mul('2');
    p.precompute();
    var neg = p.neg(true);
    var neg2 = neg.neg(true);
    assert(p.eq(neg2));
  });

  it('should correctly handle scalar multiplication of zero', function() {
    var curve = elliptic.curves.secp256k1.curve;
    var p1 = curve.g.mul('0');
    var p2 = p1.mul('2');
    assert(p1.eq(p2));
  });
});

describe('Point codec', function () {
  function makeShortTest(definition) {
    var curve = elliptic.curves.secp256k1.curve;

    return function() {
      var co = definition.coordinates;
      var p = curve.point(co.x, co.y);

      // Encodes as expected
      assert.equal(p.encode('hex'), definition.encoded);
      assert.equal(p.encodeCompressed('hex'), definition.compactEncoded);

      // Decodes as expected
      assert(curve.decodePoint(definition.encoded, 'hex').eq(p));
      assert(curve.decodePoint(definition.compactEncoded, 'hex').eq(p));
      assert(curve.decodePoint(definition.hybrid, 'hex').eq(p));
    };
  }

  function makeMontTest(definition) {
    var curve = elliptic.curves.curve25519.curve;

    return function() {
      var co = definition.coordinates;
      var p = curve.point(co.x, co.z);
      var encoded = p.encode('hex');
      var decoded = curve.decodePoint(encoded, 'hex');
      assert(decoded.eq(p));
      assert.equal(encoded, definition.encoded);
    };
  }

  var shortPointEvenY = {
    coordinates: {
      x: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      y: '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
    },
    compactEncoded:
      '02' +
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    encoded:
      '04' +
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798' +
      '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
    hybrid:
      '06' +
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798' +
      '483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
  };

  var shortPointOddY = {
    coordinates: {
      x: 'fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556',
      y: 'ae12777aacfbb620f3be96017f45c560de80f0f6518fe4a03c870c36b075f297',
    },
    compactEncoded:
      '03' +
      'fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556',
    encoded:
      '04' +
      'fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556' +
      'ae12777aacfbb620f3be96017f45c560de80f0f6518fe4a03c870c36b075f297',
    hybrid:
      '07' +
      'fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556' +
      'ae12777aacfbb620f3be96017f45c560de80f0f6518fe4a03c870c36b075f297',
  };

  it('should throw when trying to decode random bytes', function() {
    assert.throws(function() {
      elliptic.curves.secp256k1.curve.decodePoint(
        '05' +
        '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
    });
  });

  it('should be able to encode/decode a short curve point with even Y',
    makeShortTest(shortPointEvenY));

  it('should be able to encode/decode a short curve point with odd Y',
    makeShortTest(shortPointOddY));

  it('should be able to encode/decode a mont curve point', makeMontTest({
    coordinates: {
      // curve25519.curve.g.mul(new BN('6')).getX().toString(16, 2)
      x: '26954ccdc99ebf34f8f1dde5e6bb080685fec73640494c28f9fe0bfa8c794531',
      z: '1',
    },
    encoded:
      '26954ccdc99ebf34f8f1dde5e6bb080685fec73640494c28f9fe0bfa8c794531',
  }));
});
