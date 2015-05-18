'use strict';

var bn = require('bn.js');
var hash = require('hash.js');
var elliptic = require('../../elliptic');
var utils = elliptic.utils;
var assert = utils.assert;
var KeyPair = require('./key');
var Signature = require('./signature');

function parseBytes(bytes) {
  return typeof bytes === 'string' ? utils.toArray(bytes, 'hex') :
                                     bytes;
}

function EDDSA(curve) {
  if (!(this instanceof EDDSA))
    return new EDDSA(curve);

  assert(typeof curve === 'string');
  assert(curve === 'ed25519', 'only tested with ed25519 so far');
  var curve = this.curve = elliptic.curves[curve].curve;
  this.g = curve.g;
  this.g.precompute(curve.n.bitLength() + 1);

  this.pointClass = curve.point().constructor;
  this.encBytes = Math.ceil(curve.n.bitLength() / 8);
  this.hash = hash.sha512;
}

module.exports = EDDSA;

/**
* @param {Array} message - message bytes
* @param {Array|String|KeyPair} secret - secret bytes or a keypair
* @returns {bytes} - signature
*/
EDDSA.prototype.sign = function sign(message, secret) {
  message = parseBytes(message);
  var key = this.keyFromSecret(secret);
  var r = this.hashToIntModN(key.messagePrefix(), message);
  var R = this.g.mul(r);
  var Rencoded = this.encodePoint(R);
  var s_ = this.hashToIntModN(Rencoded, key.pubBytes(), message)
               .mul(key.priv());
  var S = r.add(s_).mod(this.curve.n);
  return this.makeSignature({ R: R, S: S, Rencoded: Rencoded });
};

function pointEq(a, b) {
  return a.getX().cmp(b.getX()) === 0 &&
         a.getY().cmp(b.getY()) === 0;
}

EDDSA.prototype.isPoint = function isPoint(val) {
  return val instanceof this.pointClass;
};

/**
* @param {Array} message - message bytes
* @param {Array|String|Signature} sig - sig bytes
* @param {Array|String|Point|KeyPair} pub - public key
* @returns {bytes} - true if public key matches sig of message
*/
EDDSA.prototype.verify = function verify(message, sig, pub) {
  message = parseBytes(message);
  sig = this.makeSignature(sig);
  var key = this.keyFromPublic(pub);
  var h = this.hashToIntModN(sig.Rencoded(), key.pubBytes(), message);
  var SG = this.g.mul(sig.S());
  var RplusAh = sig.R().add(key.pub().mul(h));
  return pointEq(RplusAh, SG);
};

/**
* @returns {bn} little-endian intepretation of hash of one or more
*               Arrays of bytes.
*/
EDDSA.prototype.hashToIntModN = function hashToIntModN() {
  var hash = this.hash();
  for (var i = 0; i < arguments.length; i++)
    hash.update(arguments[i]);
  return this.decodeInt(hash.digest()).mod(this.curve.n);
};

EDDSA.prototype.keyFromPublic = function keyFromPublic(pub) {
  if (pub instanceof KeyPair) {
    return pub;
  } else {
    var pubIsPoint = this.isPoint(pub);
    var pubBytes = !pubIsPoint ? parseBytes(pub) : undefined;
    pub = pubIsPoint ? pub : undefined;
    return new KeyPair(this, { pub: pub, pubBytes: pubBytes });
  }
};

EDDSA.prototype.keyFromSecret = function keyFromSecret(secret) {
  if (secret instanceof KeyPair) {
    return secret;
  }
  return new KeyPair(this, { secret: parseBytes(secret) });
};

EDDSA.prototype.encodePoint = function encodePoint(point) {
  var enc = this.encodeInt(point.getY());
  enc[this.encBytes - 1] |= point.getX().isOdd() ? 0x80 : 0;
  return enc;
};

EDDSA.prototype.makeSignature = function makeSignature(sig) {
  if (sig instanceof Signature) return sig;
  if (typeof sig !== 'object') sig = parseBytes(sig);
  return new Signature(this, sig);
};

EDDSA.prototype.decodePoint = function decodePoint(bytes) {
  bytes = parseBytes(bytes);
  assert(bytes.length === this.encBytes);

  var curve = this.curve;
  var lastIx = this.encBytes - 1;

  var normed = bytes.slice(0, lastIx).concat(bytes[lastIx] & ~0x80);
  var odd = Boolean(bytes[lastIx] & 0x80);

  // x^2 = (y^2 - 1) / (d y^2 + 1)
  var y = this.decodeRedInt(normed);
  var y2 = y.redSqr();
  var lhs = y2.redSub(curve.one);
  var rhs = y2.redMul(curve.d).redAdd(curve.one);
  var x2 = lhs.redMul(rhs.redInvm());

  if (x2.cmpn(0) === 0) {
    if (odd)
      throw new Error('invalid point');
    else
      return curve.point(new bn(0).toRed(curve.red), y);
  }

  var x = x2.redSqrt();
  if (x.redSqr().redSub(x2).cmpn(0) !== 0)
    throw new Error('invalid point');

  if (x.isOdd() !== odd)
    x = x.redNeg();

  return curve.point(x, y);
};

EDDSA.prototype.encodeInt = function encodeInt(num) {
  var bytes = num.toArray();
  while (bytes.length < this.encBytes)
    bytes.unshift(0);
  return bytes.reverse();
};

EDDSA.prototype.decodeInt = function decodeInt(bytes) {
  return new bn(parseBytes(bytes), 'le');
};

EDDSA.prototype.decodeRedInt = function decodeRedInt(bytes) {
  return this.decodeInt(parseBytes(bytes)).toRed(this.curve.red);
};
