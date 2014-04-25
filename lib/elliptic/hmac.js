var hmac = exports;

var assert = require('assert');
var elliptic = require('../elliptic');
var utils = elliptic.utils;

function Hmac(hash, key, enc) {
  if (!(this instanceof Hmac))
    return new Hmac(hash, key, enc);
  this.Hash = hash;
  this.blockSize = hash.blockSize / 8;
  this.outSize = hash.outSize / 8;
  this.key = utils.toArray(key, enc);

  this._init();
}
module.exports = Hmac;

Hmac.prototype._init = function init() {
  // Shorten key, if needed
  if (this.key.length > this.blockSize)
    this.key = new this.Hash().update(this.key).digest();
  assert(this.key.length <= this.blockSize);

  // Add padding to key
  for (var i = this.key.length; i < this.blockSize; i++)
    this.key.push(0);

  var okey = this.key.slice();
  for (var i = 0; i < this.key.length; i++) {
    this.key[i] ^= 0x36;
    okey[i] ^= 0x5c;
  }

  this.hash = {
    inner: new this.Hash(),
    outer: new this.Hash().update(okey)
  };
};

Hmac.prototype.update = function update(msg, enc) {
  this.hash.inner.update(this.key);
  this.hash.inner.update(msg, enc);
  return this;
};

Hmac.prototype.digest = function digest(enc) {
  this.hash.outer.update(this.hash.inner.digest());
  return this.hash.outer.digest(enc);
};
