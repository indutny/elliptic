/* eslint-env node, mocha */
'use strict';

var assert = require('assert');
var elliptic = require('../');
var Signature = require('../lib/elliptic/ec/signature');
var BN = require('bn.js');
var hash = require('hash.js');

var entropy = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25,
];

var msg = 'deadbeef';

describe('ECDSA', function() {
  function test(name) {
    describe('curve ' + name, function() {
      var curve;
      var ecdsa;
      var keys;

      beforeEach(function() {
        curve = elliptic.curves[name];
        assert(curve);

        ecdsa = new elliptic.ec(curve);
        keys = ecdsa.genKeyPair({
          entropy: entropy,
        });
      });

      it('should generate proper key pair', function() {
        var keylen = 64;
        if (name === 'p384') {
          keylen = 96;
        } else if (name === 'p521') {
          keylen = 132;
        }
        // Get keys out of pair
        assert(keys.getPublic().x && keys.getPublic().y);
        assert(keys.getPrivate().length > 0);
        assert.equal(keys.getPrivate('hex').length, keylen);
        assert(keys.getPublic('hex').length > 0);
        assert(keys.getPrivate('hex').length > 0);
        assert(keys.validate().result);
      });

      it('should sign and verify', function() {
        var signature = ecdsa.sign(msg, keys);
        assert(ecdsa.verify(msg, signature, keys), 'Normal verify');
      });

      it('should sign and verify using key\'s methods', function() {
        var signature = keys.sign(msg);
        assert(keys.verify(msg, signature), 'On-key verify');
      });

      it('should load private key from the hex value', function() {
        var copy = ecdsa.keyFromPrivate(keys.getPrivate('hex'), 'hex');
        var signature = ecdsa.sign(msg, copy);
        assert(ecdsa.verify(msg, signature, copy), 'hex-private verify');
      });

      it('should have `signature.s <= keys.ec.nh`', function() {
        // key.sign(msg, options)
        var sign = keys.sign('hello', { canonical: true });
        assert(sign.s.cmp(keys.ec.nh) <= 0);
      });

      it('should support `options.k`', function() {
        var sign = keys.sign(msg, {
          k: function(iter) {
            assert(iter >= 0);
            return new BN(1358);
          },
        });
        assert(ecdsa.verify(msg, sign, keys), 'custom-k verify');
      });

      it('should have another signature with pers', function () {
        var sign1 = keys.sign(msg);
        var sign2 = keys.sign(msg, { pers: '1234', persEnc: 'hex' });
        assert.notEqual(sign1.r.toArray().concat(sign1.s.toArray()),
          sign2.r.toArray().concat(sign2.s.toArray()));
      });

      it('should load public key from compact hex value', function() {
        var pub = keys.getPublic(true, 'hex');
        var copy = ecdsa.keyFromPublic(pub, 'hex');
        assert.equal(copy.getPublic(true, 'hex'), pub);
      });

      it('should load public key from hex value', function() {
        var pub = keys.getPublic('hex');
        var copy = ecdsa.keyFromPublic(pub, 'hex');
        assert.equal(copy.getPublic('hex'), pub);
      });

      it('should support hex DER encoding of signatures', function() {
        var signature = ecdsa.sign(msg, keys);
        var dsign = signature.toDER('hex');
        assert(ecdsa.verify(msg, dsign, keys), 'hex-DER encoded verify');
      });

      it('should support DER encoding of signatures', function() {
        var signature = ecdsa.sign(msg, keys);
        var dsign = signature.toDER();
        assert(ecdsa.verify(msg, dsign, keys), 'DER encoded verify');
      });

      it('should not verify signature with wrong public key', function() {
        var signature = ecdsa.sign(msg, keys);

        var wrong = ecdsa.genKeyPair();
        assert(!ecdsa.verify(msg, signature, wrong), 'Wrong key verify');
      });

      it('should not verify signature with wrong private key', function() {
        var signature = ecdsa.sign(msg, keys);

        var wrong = ecdsa.keyFromPrivate(keys.getPrivate('hex') +
                                         keys.getPrivate('hex'));
        assert(!ecdsa.verify(msg, signature, wrong), 'Wrong key verify');
      });
    });
  }
  test('secp256k1');
  test('ed25519');
  test('p256');
  test('p384');
  test('p521');

  describe('RFC6979 vector', function() {
    function test(opt) {
      opt.cases.forEach(function(c) {
        var ecdsa = elliptic.ec({
          curve: opt.curve,
          hash: c.hash,
        });
        var descr = 'should not fail on "' + opt.name + '" ' +
                    'and hash ' + c.hash.name + ' on "' + c.message + '"';
        it(descr, function() {
          var dgst = c.hash().update(c.message).digest();
          var sign = ecdsa.sign(dgst, opt.key);
          assert.equal(sign.r.toString(16), c.r);
          assert.equal(sign.s.toString(16), c.s);
          assert.ok(ecdsa.keyFromPublic(opt.pub).validate().result,
            'Invalid public key');
          assert.ok(ecdsa.verify(dgst, sign, opt.pub),
            'Invalid signature');
        });
      });
    }

    test({
      name: 'ECDSA, 192 Bits (Prime Field)',
      curve: elliptic.curves.p192,
      key: '6fab034934e4c0fc9ae67f5b5659a9d7d1fefd187ee09fd4',
      pub: {
        x: 'ac2c77f529f91689fea0ea5efec7f210d8eea0b9e047ed56',
        y: '3bc723e57670bd4887ebc732c523063d0a7c957bc97c1c43',
      },
      cases: [
        {
          message: 'sample',
          hash: hash.sha224,
          r: 'a1f00dad97aeec91c95585f36200c65f3c01812aa60378f5',
          s: 'e07ec1304c7c6c9debbe980b9692668f81d4de7922a0f97a',
        },
        {
          message: 'sample',
          hash: hash.sha256,
          r: '4b0b8ce98a92866a2820e20aa6b75b56382e0f9bfd5ecb55',
          s: 'ccdb006926ea9565cbadc840829d8c384e06de1f1e381b85',
        },
        {
          message: 'test',
          hash: hash.sha224,
          r: '6945a1c1d1b2206b8145548f633bb61cef04891baf26ed34',
          s: 'b7fb7fdfc339c0b9bd61a9f5a8eaf9be58fc5cba2cb15293',
        },
        {
          message: 'test',
          hash: hash.sha256,
          r: '3a718bd8b4926c3b52ee6bbe67ef79b18cb6eb62b1ad97ae',
          s: '5662e6848a4a19b1f1ae2f72acd4b8bbe50f1eac65d9124f',
        },
      ],
    });

    test({
      name: 'ECDSA, 224 Bits (Prime Field)',
      curve: elliptic.curves.p224,
      key: 'f220266e1105bfe3083e03ec7a3a654651f45e37167e88600bf257c1',
      pub: {
        x: '00cf08da5ad719e42707fa431292dea11244d64fc51610d94b130d6c',
        y: 'eeab6f3debe455e3dbf85416f7030cbd94f34f2d6f232c69f3c1385a',
      },
      cases: [
        {
          message: 'sample',
          hash: hash.sha224,
          r: '1cdfe6662dde1e4a1ec4cdedf6a1f5a2fb7fbd9145c12113e6abfd3e',
          s: 'a6694fd7718a21053f225d3f46197ca699d45006c06f871808f43ebc',
        },
        {
          message: 'sample',
          hash: hash.sha256,
          r: '61aa3da010e8e8406c656bc477a7a7189895e7e840cdfe8ff42307ba',
          s: 'bc814050dab5d23770879494f9e0a680dc1af7161991bde692b10101',
        },
        {
          message: 'test',
          hash: hash.sha224,
          r: 'c441ce8e261ded634e4cf84910e4c5d1d22c5cf3b732bb204dbef019',
          s: '902f42847a63bdc5f6046ada114953120f99442d76510150f372a3f4',
        },
        {
          message: 'test',
          hash: hash.sha256,
          r: 'ad04dde87b84747a243a631ea47a1ba6d1faa059149ad2440de6fba6',
          s: '178d49b1ae90e3d8b629be3db5683915f4e8c99fdf6e666cf37adcfd',
        },
      ],
    });

    test({
      name: 'ECDSA, 256 Bits (Prime Field)',
      curve: elliptic.curves.p256,
      key: 'c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721',
      pub: {
        x: '60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6',
        y: '7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299',
      },
      cases: [
        {
          message: 'sample',
          hash: hash.sha224,
          r: '53b2fff5d1752b2c689df257c04c40a587fababb3f6fc2702f1343af7ca9aa3f',
          s: 'b9afb64fdc03dc1a131c7d2386d11e349f070aa432a4acc918bea988bf75c74c',
        },
        {
          message: 'sample',
          hash: hash.sha256,
          r: 'efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716',
          s: 'f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8',
        },
        {
          message: 'test',
          hash: hash.sha224,
          r: 'c37edb6f0ae79d47c3c27e962fa269bb4f441770357e114ee511f662ec34a692',
          s: 'c820053a05791e521fcaad6042d40aea1d6b1a540138558f47d0719800e18f2d',
        },
        {
          message: 'test',
          hash: hash.sha256,
          r: 'f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367',
          s: '19f4113742a2b14bd25926b49c649155f267e60d3814b4c0cc84250e46f0083',
        },
      ],
    });

    test({
      name: 'ECDSA, 384 Bits (Prime Field)',
      curve: elliptic.curves.p384,
      key: '6b9d3dad2e1b8c1c05b19875b6659f4de23c3b667bf297ba9aa4774078713' +
           '7d896d5724e4c70a825f872c9ea60d2edf5',
      pub: {
        x: 'ec3a4e415b4e19a4568618029f427fa5da9a8bc4ae92e02e06aae5286b30' +
           '0c64def8f0ea9055866064a254515480bc13',
        y: '8015d9b72d7d57244ea8ef9ac0c621896708a59367f9dfb9f54ca84b3f' +
           '1c9db1288b231c3ae0d4fe7344fd2533264720',
      },
      cases: [
        {
          message: 'sample',
          hash: hash.sha224,
          r: '42356e76b55a6d9b4631c865445dbe54e056d3b3431766d05092447' +
             '93c3f9366450f76ee3de43f5a125333a6be060122',
          s: '9da0c81787064021e78df658f2fbb0b042bf304665db721f077a429' +
             '8b095e4834c082c03d83028efbf93a3c23940ca8d',
        },
        {
          message: 'sample',
          hash: hash.sha384,
          r: '94edbb92a5ecb8aad4736e56c691916b3f88140666ce9fa73d6' +
             '4c4ea95ad133c81a648152e44acf96e36dd1e80fabe46',
          s: '99ef4aeb15f178cea1fe40db2603138f130e740a19624526203b' +
             '6351d0a3a94fa329c145786e679e7b82c71a38628ac8',
        },
        {
          message: 'test',
          hash: hash.sha384,
          r: '8203b63d3c853e8d77227fb377bcf7b7b772e97892a80f36a' +
             'b775d509d7a5feb0542a7f0812998da8f1dd3ca3cf023db',
          s: 'ddd0760448d42d8a43af45af836fce4de8be06b485e9b61b827c2f13' +
             '173923e06a739f040649a667bf3b828246baa5a5',
        },
      ],
    });

    test({
      name: 'ECDSA, 521 Bits (Prime Field)',
      curve: elliptic.curves.p521,
      key: '0fad06daa62ba3b25d2fb40133da757205de67f5bb0018fee8c86e1b68c7e75' +
           'caa896eb32f1f47c70855836a6d16fcc1466f6d8fbec67db89ec0c08b0e996b' +
           '83538',
      pub: {
        x: '1894550d0785932e00eaa23b694f213f8c3121f86dc97a04e5a7167db4e5bcd3' +
           '71123d46e45db6b5d5370a7f20fb633155d38ffa16d2bd761dcac474b9a2f502' +
           '3a4',
        y: '0493101c962cd4d2fddf782285e64584139c2f91b47f87ff82354d6630f746a2' +
           '8a0db25741b5b34a828008b22acc23f924faafbd4d33f81ea66956dfeaa2bfdfcf5',
      },
      cases: [
        {
          message: 'sample',
          hash: hash.sha384,
          r: '1ea842a0e17d2de4f92c15315c63ddf72685c18195c2bb95e572b9c5136ca4' +
             'b4b576ad712a52be9730627d16054ba40cc0b8d3ff035b12ae75168397f5' +
             'd50c67451',
          s: '1f21a3cee066e1961025fb048bd5fe2b7924d0cd797babe0a83b66f1e35ee' +
             'af5fde143fa85dc394a7dee766523393784484bdf3e00114a1c857cde1aa2' +
             '03db65d61',
        },
        {
          message: 'sample',
          hash: hash.sha512,
          r: 'c328fafcbd79dd77850370c46325d987cb525569fb63c5d3bc53950e6d4c5f1' +
             '74e25a1ee9017b5d450606add152b534931d7d4e8455cc91f9b15bf05ec36e3' +
             '77fa',
          s: '617cce7cf5064806c467f678d3b4080d6f1cc50af26ca209417308281b68af2' +
             '82623eaa63e5b5c0723d8b8c37ff0777b1a20f8ccb1dccc43997f1ee0e44da4' +
             'a67a',
        },
        {
          message: 'test',
          hash: hash.sha512,
          r: '13e99020abf5cee7525d16b69b229652ab6bdf2affcaef38773b4b7d087' +
             '25f10cdb93482fdcc54edcee91eca4166b2a7c6265ef0ce2bd7051b7cef945' +
             'babd47ee6d',
          s: '1fbd0013c674aa79cb39849527916ce301c66ea7ce8b80682786ad60f98' +
             'f7e78a19ca69eff5c57400e3b3a0ad66ce0978214d13baf4e9ac60752f7b15' +
             '5e2de4dce3',
        },
      ],
    });
  });

  describe('Maxwell\'s trick', function() {
    var p256 = elliptic.curves.p256;
    assert(p256);
    var p384 = elliptic.curves.p384;
    assert(p384);

    var msg =
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    var vectors = [
      {
        curve: p256,
        pub: '041548fc88953e06cd34d4b300804c5322cb48c24aaaa4d0' +
             '7a541b0f0ccfeedeb0ae4991b90519ea405588bdf699f5e6' +
             'd0c6b2d5217a5c16e8371062737aa1dae1',
        message: msg,
        sig: '3006020106020104',
        result: true,
      },
      {
        curve: p256,
        pub: '04ad8f60e4ec1ebdb6a260b559cb55b1e9d2c5ddd43a41a2' +
             'd11b0741ef2567d84e166737664104ebbc337af3d861d352' +
             '4cfbc761c12edae974a0759750c8324f9a',
        message: msg,
        sig: '3006020106020104',
        result: true,
      },
      {
        curve: p256,
        pub: '0445bd879143a64af5746e2e82aa65fd2ea07bba4e355940' +
             '95a981b59984dacb219d59697387ac721b1f1eccf4b11f43' +
             'ddc39e8367147abab3084142ed3ea170e4',
        message: msg,
        sig: '301502104319055358e8617b0c46353d039cdaae020104',
        result: true,
      },
      {
        curve: p256,
        pub: '040feb5df4cc78b35ec9c180cc0de5842f75f088b4845697' +
             '8ffa98e716d94883e1e6500b2a1f6c1d9d493428d7ae7d9a' +
             '8a560fff30a3d14aa160be0c5e7edcd887',
        message: msg,
        sig: '301502104319055358e8617b0c46353d039cdaae020104',
        result: false,
      },
      {
        curve: p384,
        pub: '0425e299eea9927b39fa92417705391bf17e8110b4615e9e' +
             'b5da471b57be0c30e7d89dbdc3e5da4eae029b300344d385' +
             '1548b59ed8be668813905105e673319d59d32f574e180568' +
             '463c6186864888f6c0b67b304441f82aab031279e48f047c31',
        message: msg,
        sig: '3006020103020104',
        result: true,
      },
      {
        curve: p384,
        pub: '04a328f65c22307188b4af65779c1d2ec821c6748c6bd8dc' +
             '0e6a008135f048f832df501f7f3f79966b03d5bef2f187ec' +
             '34d85f6a934af465656fb4eea8dd9176ab80fbb4a27a649f' +
             '526a7dfe616091b78d293552bc093dfde9b31cae69d51d3afb',
        message: msg,
        sig: '3006020103020104',
        result: true,
      },
      {
        curve: p384,
        pub: '04242e8585eaa7a28cc6062cab4c9c5fd536f46b17be1728' +
             '288a2cda5951df4941aed1d712defda023d10aca1c5ee014' +
             '43e8beacd821f7efa27847418ab95ce2c514b2b6b395ee73' +
             '417c83dbcad631421f360d84d64658c98a62d685b220f5aad4',
        message: msg,
        sig: '301d0218389cb27e0bc8d21fa7e5f24cb74f58851313e696333ad68e020104',
        result: true,
      },
      {
        curve: p384,
        pub: '04cdf865dd743fe1c23757ec5e65fd5e4038b472ded2af26' +
             '1e3d8343c595c8b69147df46379c7ca40e60e80170d34a11' +
             '88dbb2b6f7d3934c23d2f78cfb0db3f3219959fad63c9b61' +
             '2ef2f20d679777b84192ce86e781c14b1bbb77eacd6e0520e2',
        message: msg,
        sig: '301d0218389cb27e0bc8d21fa7e5f24cb74f58851313e696333ad68e020104',
        result: false,
      },
    ];

    vectors.forEach(function(vector, i) {
      it('should pass on vector#' + i, function() {
        var ecdsa = new elliptic.ec(vector.curve);
        var key = ecdsa.keyFromPublic(vector.pub, 'hex');
        var msg = vector.message;
        var sig = vector.sig;

        var actual = ecdsa.verify(msg, sig, key);
        assert.equal(actual, vector.result);
      });
    });
  });

  it('should deterministically generate private key', function() {
    var curve = elliptic.curves.secp256k1;
    assert(curve);

    var ecdsa = new elliptic.ec(curve);
    var keys = ecdsa.genKeyPair({
      pers: 'my.pers.string',
      entropy: hash.sha256().update('hello world').digest(),
    });
    assert.equal(
      keys.getPrivate('hex'),
      '6160edb2b218b7f1394b9ca8eb65a72831032a1f2f3dc2d99291c2f7950ed887');
  });

  it('should recover the public key from a signature', function() {
    var ec = new elliptic.ec('secp256k1');
    var key = ec.genKeyPair();
    var msg = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
    var signature = key.sign(msg);
    var recid = ec.getKeyRecoveryParam(msg, signature, key.getPublic());
    var r =  ec.recoverPubKey(msg, signature, recid);
    assert(key.getPublic().eq(r), 'the keys should match');
  });

  it('should fail to recover key when no quadratic residue available',
    function() {
      var ec = new elliptic.ec('secp256k1');

      var message =
        'f75c6b18a72fabc0f0b888c3da58e004f0af1fe14f7ca5d8c897fe164925d5e9';

      assert.throws(function() {
        ec.recoverPubKey(message, {
          r: 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140',
          s: '8887321be575c8095f789dd4c743dfe42c1820f9231f98a962b210e3ac2452a3',
        }, 0);
      });
    });

  it('Wycheproof special hash case with hex', function() {
    var curve = new elliptic.ec('p192');
    var msg =
      '00000000690ed426ccf17803ebe2bd0884bcd58a1bb5e7477ead3645f356e7a9';
    var sig = '303502186f20676c0d04fc40ea55d5702f798355787363a9' +
              '1e97a7e50219009d1c8c171b2b02e7d791c204c17cea4cf5' +
              '56a2034288885b';
    var pub = '04cd35a0b18eeb8fcd87ff019780012828745f046e785deb' +
              'a28150de1be6cb4376523006beff30ff09b4049125ced29723';
    var pubKey = curve.keyFromPublic(pub, 'hex');
    assert(pubKey.verify(msg, sig) === true);
  });

  it('Wycheproof special hash case with Array', function() {
    var curve = new elliptic.ec('p192');
    var msg = [
      0x00, 0x00, 0x00, 0x00, 0x69, 0x0e, 0xd4, 0x26, 0xcc, 0xf1, 0x78,
      0x03, 0xeb, 0xe2, 0xbd, 0x08, 0x84, 0xbc, 0xd5, 0x8a, 0x1b, 0xb5,
      0xe7, 0x47, 0x7e, 0xad, 0x36, 0x45, 0xf3, 0x56, 0xe7, 0xa9,
    ];
    var sig = '303502186f20676c0d04fc40ea55d5702f798355787363a9' +
              '1e97a7e50219009d1c8c171b2b02e7d791c204c17cea4cf5' +
              '56a2034288885b';
    var pub = '04cd35a0b18eeb8fcd87ff019780012828745f046e785deb' +
              'a28150de1be6cb4376523006beff30ff09b4049125ced29723';
    var pubKey = curve.keyFromPublic(pub, 'hex');
    assert(pubKey.verify(msg, sig) === true);
  });

  it('Wycheproof special hash case with BN', function() {
    var curve = new elliptic.ec('p192');
    var msg = new BN(
      '00000000690ed426ccf17803ebe2bd0884bcd58a1bb5e7477ead3645f356e7a9',
      16,
    );
    var sig = '303502186f20676c0d04fc40ea55d5702f798355787363a9' +
              '1e97a7e50219009d1c8c171b2b02e7d791c204c17cea4cf5' +
              '56a2034288885b';
    var pub = '04cd35a0b18eeb8fcd87ff019780012828745f046e785deb' +
              'a28150de1be6cb4376523006beff30ff09b4049125ced29723';
    var pubKey = curve.keyFromPublic(pub, 'hex');
    assert(pubKey.verify(msg, sig, { msgBitLength: 32 * 8 }) === true);
  });

  describe('Signature', function () {
    it('recoveryParam is 0', function () {
      var sig = new Signature({ r: '00', s: '00', recoveryParam: 0 });
      assert.equal(sig.recoveryParam, 0);
    });

    it('recoveryParam is 1', function () {
      var sig = new Signature({ r: '00', s: '00', recoveryParam: 1 });
      assert.equal(sig.recoveryParam, 1);
    });
  });
});
