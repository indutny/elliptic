var assert = require('assert');
var elliptic = require('../elliptic');

var r;

module.exports = function rand(len) {
  if (!r)
    r = new Rand();

  return r.generate(len);
};

function Rand() {
}

Rand.prototype.generate = function generate(len) {
  return this._rand(len);
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
      crypto = require('cry' + 'pto');
    return crypto.randomBytes(n);
  };
}
