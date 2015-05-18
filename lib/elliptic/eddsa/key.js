'use strict';

var elliptic = require('../../elliptic');
var utils = elliptic.utils;
var assert = utils.assert;
var lazyComputed = utils.lazyComputed;

/**
* @param {EDDSA} eddsa - instance
* @param {Object} params - public/private key parameters
*
* @param {Array<Byte>} [params.secret] - secret seed bytes
* @param {bn} [params.priv] - private key scalar (aka `a` in eddsa terms)
* @param {Point} [params.pub] - public key point (aka `A` in eddsa terms)
* @param {Array<Byte>} [params.pubBytes] - public key point encoded as bytes
* @param {Array<Byte>} [params.privBytes] - private key point encoded as bytes
* @param {Array<Byte>} [params.messagePrefix] - message prefix
*
* Any optional params not passed in, will be computed lazily (when possible)
*/
function KeyPair(eddsa, params) {
  var self = this;
  this.eddsa = eddsa;

  // Set all params passed in as private members, others will be computed lazily
  // where possible.
  Object.keys(params).forEach(function(k) {
    self['_' + k] = params[k];
  });
}

KeyPair.prototype.secret = function secret() {
  return this._secret;
};

lazyComputed(KeyPair, 'pubBytes', function pubBytes() {
  return this.eddsa.encodePoint(this.pub());
});

lazyComputed(KeyPair, 'pub', function pub() {
  if (this._pubBytes) {
    return this.eddsa.decodePoint(this._pubBytes);
  } else {
    return this.eddsa.g.mul(this.priv());
  }
});

lazyComputed(KeyPair, 'privBytes', function privBytes() {
  var eddsa = this.eddsa;
  var hash = this.hash();
  var lastIx = eddsa.encBytes - 1;

  var a = hash.slice(0, eddsa.encBytes);
  a[0] &= 248;
  a[lastIx] &= 127;
  a[lastIx] |= 64;

  return a;
});

lazyComputed(KeyPair, 'priv', function priv() {
  return this.eddsa.decodeRedInt(this.privBytes());
});

lazyComputed(KeyPair, 'hash', function hash() {
  return this.eddsa.hash().update(this.secret()).digest();
});

lazyComputed(KeyPair, 'messagePrefix', function messagePrefix() {
  return this.hash().slice(this.eddsa.encBytes);
});

KeyPair.prototype.sign = function sign(message) {
  assert(this._secret, 'KeyPair can only verify');
  return this.eddsa.sign(message, this);
};

KeyPair.prototype.verify = function verify(message, sig) {
  return this.eddsa.verify(message, sig, this);
};

KeyPair.prototype.getSecret = function getSecret(enc) {
  assert(this._secret, 'KeyPair is public only');
  return utils.encode(this.secret(), enc);
};

KeyPair.prototype.getPublic = function getPublic(enc) {
  return utils.encode(this.pubBytes(), enc);
};

module.exports = KeyPair;
