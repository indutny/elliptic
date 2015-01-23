var bn = require('bn.js');
var hash = require('hash.js');
var elliptic = require('../../elliptic');
var CryptoJS = require('../../cryptojs/aes.js')
var utils = elliptic.utils;
var assert = utils.assert;

var KeyPair = require('./key');
var Signature = require('./signature');

function EC(options) {
  if (!(this instanceof EC))
    return new EC(options);

  // Shortcut `elliptic.ec(curve-name)`
  if (typeof options === 'string') {
    assert(elliptic.curves.hasOwnProperty(options), 'Unknown curve ' + options);

    options = elliptic.curves[options];
  }

  // Shortcut for `elliptic.ec(elliptic.curves.curveName)`
  if (options instanceof elliptic.curves.PresetCurve)
    options = { curve: options };

  this.curve = options.curve.curve;
  this.n = this.curve.n;
  this.nh = this.n.shrn(1);
  this.g = this.curve.g;

  // Point on curve
  this.g = options.curve.g;
  this.g.precompute(options.curve.n.bitLength() + 1);

  // Hash for function for DRBG
  this.hash = options.hash || options.curve.hash;
}
module.exports = EC;

EC.prototype.keyPair = function keyPair(options) {
  return new KeyPair(this, options);
};

EC.prototype.keyFromPrivate = function keyFromPrivate(priv, enc) {
  return KeyPair.fromPrivate(this, priv, enc);
};

EC.prototype.keyFromPublic = function keyFromPublic(pub, enc) {
  return KeyPair.fromPublic(this, pub, enc);
};

EC.prototype.genKeyPair = function genKeyPair(options) {
  if (!options)
    options = {};

  // Instantiate Hmac_DRBG
  var drbg = new elliptic.hmacDRBG({
    hash: this.hash,
    pers: options.pers,
    entropy: options.entropy || elliptic.rand(this.hash.hmacStrength),
    nonce: this.n.toArray()
  });

  var bytes = this.n.byteLength();
  var ns2 = this.n.sub(new bn(2));
  do {
    var priv = new bn(drbg.generate(bytes));
    if (priv.cmp(ns2) > 0)
      continue;

    priv.iaddn(1);
    return this.keyFromPrivate(priv);
  } while (true);
};

EC.prototype._truncateToN = function truncateToN(msg, truncOnly) {
  var delta = msg.byteLength() * 8 - this.n.bitLength();
  if (delta > 0)
    msg = msg.shrn(delta);
  if (!truncOnly && msg.cmp(this.n) >= 0)
    return msg.sub(this.n);
  else
    return msg;
};

EC.prototype.sign = function sign(msg, key, enc, options) {
  if (typeof enc === 'object') {
    options = enc;
    enc = null;
  }
  if (!options)
    options = {};

  key = this.keyFromPrivate(key, enc);
  msg = this._truncateToN(new bn(msg, 16));

  // Zero-extend key to provide enough entropy
  var bytes = this.n.byteLength();
  var bkey = key.getPrivate().toArray();
  for (var i = bkey.length; i < 21; i++)
    bkey.unshift(0);

  // Zero-extend nonce to have the same byte size as N
  var nonce = msg.toArray();
  for (var i = nonce.length; i < bytes; i++)
    nonce.unshift(0);

  // Instantiate Hmac_DRBG
  var drbg = new elliptic.hmacDRBG({
    hash: this.hash,
    entropy: bkey,
    nonce: nonce
  });

  // Number of bytes to generate
  var ns1 = this.n.sub(new bn(1));
  do {
    var k = new bn(drbg.generate(this.n.byteLength()));
    k = this._truncateToN(k, true);
    if (k.cmpn(1) <= 0 || k.cmp(ns1) >= 0)
      continue;

    var kp = this.g.mul(k);
    if (kp.isInfinity())
      continue;

    var r = kp.getX().mod(this.n);
    if (r.cmpn(0) === 0)
      continue;

    var s = k.invm(this.n).mul(r.mul(key.getPrivate()).iadd(msg)).mod(this.n);
    if (s.cmpn(0) === 0)
      continue;

    // Use complement of `s`, if it is > `n / 2`
    if (options.canonical && s.cmp(this.nh) > 0)
      s = this.n.sub(s);

    return new Signature(r, s);
  } while (true);
};

EC.prototype.verify = function verify(msg, signature, key, enc) {
  msg = this._truncateToN(new bn(msg, 16));
  key = this.keyFromPublic(key, enc);
  signature = new Signature(signature, 'hex');

  // Perform primitive values validation
  var r = signature.r;
  var s = signature.s;
  if (r.cmpn(1) < 0 || r.cmp(this.n) >= 0)
    return false;
  if (s.cmpn(1) < 0 || s.cmp(this.n) >= 0)
    return false;

  // Validate signature
  var sinv = s.invm(this.n);
  var u1 = sinv.mul(msg).mod(this.n);
  var u2 = sinv.mul(r).mod(this.n);

  var p = this.g.mulAdd(u1, key.getPublic(), u2);
  if (p.isInfinity())
    return false;

  return p.getX().mod(this.n).cmp(r) === 0;
};

/**
  * ECIES encryption implemented using AES from CryptoJS library
**/
EC.prototype.encrypt = function(msg, pub) {

  //start off by generating an ephemeral key pair
  var eKeyPair = this.genKeyPair();

  //get get the public/private key of this ephemeral pair
  var ePub = eKeyPair.getPublic(true, 'hex');

  //generate the key pair for encryption
  var newPoint = eKeyPair.derive(pub);

  //get the sha512 hash of the new public key
  var h = hash.sha512().update(newPoint.toString(16), 'hex').digest('hex');

  //new symmetric key
  sK = h.slice(0, 32);

  //new hmac key
  hK = h.slice(32,64);

  //make our own iv and salt
  var iv = CryptoJS.lib.WordArray.random(128/8);
  var salt = CryptoJS.lib.WordArray.random(128/8);

  //encrypt our message
  var cipher = CryptoJS.AES.encrypt(msg, sK, {iv : iv, salt: salt});

  //get hmac of message
  var hmac = hash.hmac(hash.sha256, hK, 'hex').update(msg).digest("hex");

  //return public key, cipher, and hmac
  return ePub.concat(cipher, hmac);
}

/**
* ECIES encryption implemented using AES from CryptoJS library
**/
EC.prototype.decrypt = function(msg, priv) {
  //extract public key from message
  var pK = msg.slice(0,66);

  //get cipher text from message
  var c = msg.slice(66, msg.length-64);

  //get the digest
  var digest = msg.slice(msg.length-64, msg.length);

  //derive the keypair from the public key provided in message
  var kp = this.keyFromPublic(pK, 'hex');

  //build the key pair for the private key of the recipient
  var kpRecip = this.keyFromPrivate(priv);

  //derive the shared secret and hmac secret
  var oP = kpRecip.derive(kp.getPublic());

  //get the sha512 hash of the "new" public key
  var h = hash.sha512().update(oP.toString(16), 'hex').digest('hex');

  //symmetric key
  sK = h.slice(0, 32);

  //hmac key
  hK = h.slice(32,64);


  //decrypt our message
  var plaintext = CryptoJS.AES.decrypt(c, sK).toString(CryptoJS.enc.Utf8);

  //check the hmac
  var hmac = hash.hmac(hash.sha256, hK, 'hex').update(plaintext).digest("hex");
  if (hmac != digest) {
    return null; //digest don't match, message has been tampered with
  } else {
    return plaintext;
  }

}
