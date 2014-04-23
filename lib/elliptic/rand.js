var assert = require('assert');
var elliptic = require('../elliptic');
var BN = elliptic.bn;

var r;

module.exports = function rand(min, max) {
  if (!r)
    r = new Rand();

  return r.generate(min, max);
};

function Rand() {
}

Rand.prototype.generate = function generate(min, max) {
  var delta = max.sub(min).isub(1);
  assert(delta.cmp(0) !== 0);
  var r = new BN(this._rand(Math.ceil(delta.bitLength() / 8)));
  return r.mod(delta).add(min);
};

if (typeof window === 'object') {
  if (window.crypto && window.crypto.getRandomValues) {
    // Modern browsers
    Rand.prototype._rand = function _rand(n) {
      var arr = new Uint8Array(n);
      window.crypto.getRandomValues(arr);
      return arr;
    };
  } else {
    // Old junk
    Rand.prototype._rand = function() {
      throw new Error('Not implemented yet');
    };
  }
} else {
  // Node.js
  var crypto;
  Rand.prototype._rand = function _rand(n) {
    if (!crypto)
      crypto = require('crypto');
    return crypto.randomBytes(n);
  }
}
