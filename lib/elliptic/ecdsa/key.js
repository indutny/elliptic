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

  // KeyPair(public, 'hex')
  if (this._importPublicHex(priv, pub))
    return;

  if (pub === 'hex')
    pub = null;

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

  if (!enc)
    return this.pub;

  var len = this.ecdsa.curve.p.byteLength();
  var x = this.pub.getX().toArray();
  var y = this.pub.getY().toArray();

  // Ensure that both x and y have enough bits
  for (var i = x.length; i < len; i++)
    x.unshift(0);
  for (var i = y.length; i < len; i++)
    y.unshift(0);

  var res = [ 0x04 ].concat(x, y);
  return utils.encode(res, enc);
};

KeyPair.prototype.getPrivate = function getPrivate(enc) {
  if (enc === 'hex')
    return this.priv.toString(16);
  else
    return this.priv;
};

KeyPair.prototype._importPrivate = function _importPrivate(key) {
  this.priv = new bn(key, 16);
};

KeyPair.prototype._importPublic = function _importPublic(key) {
  this.pub = this.ecdsa.curve.point(key.x, key.y);
};

KeyPair.prototype._importPublicHex = function _importPublic(key, enc) {
  key = utils.toArray(key, enc);
  var len = this.ecdsa.curve.p.byteLength();
  if (key[0] !== 0x04 || key.length - 1 !== 2 * len)
    return false;

  this.pub = this.ecdsa.curve.point(
    key.slice(1, 1 + len),
    key.slice(1 + len, 1 + 2 * len));

  return true;
};
