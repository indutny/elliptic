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

  // KeyPair(DER, enc)
  if (this._importDER(priv, pub))
    return;

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

KeyPair.prototype._importDER = function _importDER(data, enc) {
  /*
   ECPrivateKey ::= SEQUENCE {
     version        INTEGER { ecPrivkeyVer1(1) } (ecPrivkeyVer1),
     privateKey     OCTET STRING,
     parameters [0] ECParameters {{ NamedCurve }} OPTIONAL,
     publicKey  [1] BIT STRING OPTIONAL
   }
  */
  data = utils.toArray(data, enc);
  if (data.length < 6 || data[0] !== 0x30 || data[2] !== 0x02)
    return false;
  var total = data[1];
  if (1 + total > data.length)
    return false;
  var rlen = data[3];
  if (4 + rlen + 2 >= data.length)
    return false;
  if (data[4 + rlen] !== 0x02)
    return false;
  var slen = data[5 + rlen];
  if (4 + rlen + 2 + slen > data.length)
    return false;
};

KeyPair.prototype._importPublic = function _importPublic(key) {
  this.pub = this.ecdsa.curve.point(key.x, key.y);
};
