var assert = require('assert');
var bn = require('bn.js');
var elliptic = require('../../elliptic');
var utils = elliptic.utils;

var KeyPair = elliptic._key;

function ECDH(options) {
  if (!(this instanceof ECDH))
    return new ECDH(options);

  // Shortcut for `elliptic.ecdsa(elliptic.curves.curveName)`
  if (options instanceof elliptic.curves.PresetCurve)
    options = { curve: options };

  this.curve = options.curve.curve;
  // Order of the point
  this.n = options.curve.n;
  // Point on curve
  this.g = options.curve.g;
  this.g.precompute(options.curve.n.bitLength() + 1, this.n);
  // Hash for function for DRBG
  this.hash = options.hash || options.curve.hash;
}
module.exports = ECDH;

ECDH.prototype.keyPair = function keyPair(priv, pub) {
  return new KeyPair(this, priv, pub);
};

ECDH.prototype.genKeyPair = elliptic.ecdsa.prototype.genKeyPair;
