'use strict';

var bn = require('bn.js');
var hash = require('hash.js');
var elliptic = require('../../elliptic');
var utils = elliptic.utils;
var assert = utils.assert;
var parseBytes = utils.parseBytes;
var KeyPair = require('./key');
var Signature = require('./signature');


function EDDSA(curve) {
  if (!(this instanceof EDDSA))
    return new EDDSA(curve);

  assert(typeof curve === 'string');
  assert(curve === 'ed25519', 'only tested with ed25519 so far');

  var curve = elliptic.curves[curve].curve;
  this.curve = curve;
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
  var r = this.hashToIntModOrder(key.messagePrefix(), message);
  var R = this.g.mul(r);
  var Rencoded = this.encodePoint(R);
  var s_ = this.hashToIntModOrder(Rencoded, key.pubBytes(), message)
               .mul(key.priv());
  var S = r.add(s_).mod(this.curve.n);
  return this.makeSignature({ R: R, S: S, Rencoded: Rencoded });
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
  var h = this.hashToIntModOrder(sig.Rencoded(), key.pubBytes(), message);
  var SG = this.g.mul(sig.S());
  var RplusAh = sig.R().add(key.pub().mul(h));
  return RplusAh.eq(SG);
};


EDDSA.prototype.keyFromPublic = function keyFromPublic(pub) {
  return KeyPair.fromPublic(this, pub);
};

EDDSA.prototype.keyFromSecret = function keyFromSecret(secret) {
  return KeyPair.fromSecret(this, secret);
};

EDDSA.prototype.encodePoint = function encodePoint(point) {
  var enc = this.encodeInt(point.getY());
  enc[this.encBytes - 1] |= point.getX().isOdd() ? 0x80 : 0;
  return enc;
};

EDDSA.prototype.makeSignature = function makeSignature(sig) {
  if (sig instanceof Signature)
    return sig;
  return new Signature(this, sig);
};

/**
* @returns {bn} little-endian intepretation of hash of one or more
*               Arrays of bytes.
*/
EDDSA.prototype.hashToIntModOrder = function hashToIntModOrder() {
  var hash = this.hash();
  for (var i = 0; i < arguments.length; i++)
    hash.update(arguments[i]);
  return this.decodeInt(hash.digest()).mod(this.curve.n);
};

EDDSA.prototype.isPoint = function isPoint(val) {
  return val instanceof this.pointClass;
};

EDDSA.prototype.decodePoint = function decodePoint(bytes) {
  bytes = parseBytes(bytes);
  assert(bytes.length === this.encBytes);

  var curve = this.curve;
  var lastIx = this.encBytes - 1;

  var normed = bytes.slice(0, lastIx).concat(bytes[lastIx] & ~0x80);
  var odd = Boolean(bytes[lastIx] & 0x80);

  var y = this.decodeRedInt(normed);
  return curve.pointFromY(y, odd);
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
