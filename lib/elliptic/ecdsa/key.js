var assert = require('assert');
var bn = require('bn.js');

var elliptic = require('../../elliptic');
var utils = elliptic.utils;

function KeyPair(ecdsa, priv, pub) {
  if (priv instanceof KeyPair)
    return priv;
  if (pub instanceof KeyPair)
    return pub;

  if (!priv) {
    priv = pub;
    pub = null;
  }
  if (priv !== null && typeof priv === 'object') {
    if (priv.x && priv.y) {
      // KeyPair(public)
      pub = priv;
      priv = null;
    } else if (priv.priv || priv.pub) {
      // KeyPair({ priv: ..., pub: ... })
      pub = priv.pub;
      priv = priv.priv;
    }
  }

  this.ecdsa = ecdsa;
  this.priv = null;
  this.pub = null;

  // KeyPair(priv, pub)
  if (priv)
    this._importPrivate(priv);
  if (pub)
    this._importPublic(pub);
}
module.exports = KeyPair;

KeyPair.prototype.validate = function validate() {
  var pub = this.getPublic();

  if (pub.isInfinity())
    return { result: false, reason: 'Invalid public key' };
  if (!pub.validate())
    return { result: false, reason: 'Public key is not a point' };
  if (!pub.mul(this.n).isInfinity())
    return { result: false, reason: 'Public key * N != O' };

  return { result: true, reason: null };
};

KeyPair.prototype.getPublic = function getPublic(enc) {
  if (!this.pub)
    this.pub = this.ecdsa.g.mul(this.priv);
  if (enc === 'hex')
    return '04' + this.pub.x.toString('hex') + this.pub.y.toString('hex');
  return this.pub;
};

KeyPair.prototype.getPrivate = function getPrivate(enc) {
  return this.priv;
};

KeyPair.prototype._importPrivate = function _importPrivate(key) {
  this.priv = new bn(key, 16);
};

KeyPair.prototype._importPublic = function _importPublic(key) {
  this.pub = this.ecdsa.curve.point(key.x, key.y);
};
