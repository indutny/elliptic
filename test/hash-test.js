var assert = require('assert');
var elliptic = require('../');

describe('Hash', function() {
  it('should support sha256', function() {
    function hash(msg, enc) {
      return elliptic.hash.sha256().update(msg, enc).digest('hex');
    }

    assert.equal(elliptic.hash.sha256.blockSize, 512);
    assert.equal(elliptic.hash.sha256.outSize, 256);

    var test = [
      [ 'abc',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' ],
      [ 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1' ],
      [ 'deadbeef',
        '5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953',
        'hex' ],
    ];
    for (var i = 0; i < test.length; i++) {
      var msg = test[i][0];
      var res = test[i][1];
      var enc = test[i][2];

      var hash = elliptic.hash.sha256().update(msg, enc).digest('hex');
      assert.equal(hash, res);

      // Split message
      var hash = elliptic.hash.sha256()
                         .update(msg.slice(0, 2), enc)
                         .update(msg.slice(2), enc)
                         .digest('hex');
      assert.equal(hash, res);
    }
  });
});
