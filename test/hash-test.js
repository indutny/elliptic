var assert = require('assert');
var elliptic = require('../');

describe('Hash', function() {
  it('should support sha256', function() {
    function hash(msg) {
      return elliptic.hash.sha256().update(msg).digest('hex');
    }

    var test = [
      [ 'abc',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' ],
      [ 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1' ],
    ];
    for (var i = 0; i < test.length; i++)
      assert.equal(hash(test[i][0]), test[i][1]);
  });
});
