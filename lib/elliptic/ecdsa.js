var assert = require('assert');
var elliptic = require('../elliptic');
var utils = elliptic.utils;

function ECDSA(options) {
  if (!(this instanceof ECDSA))
    return new ECDSA(options);

  // Shortcut for `elliptic.ecdsa(elliptic.nist.curve)`
  if (options instanceof elliptic.nist.NISTCurve)
    options = { curve: options };

  this.curve = options.curve.curve;
  // Point on curve
  this.g = options.curve.g;
  this.g.precompute(options.curve.n.bitLength());
  // Order of the point
  this.n = options.curve.n;
  // Hash for function for DRBG
  this.hash = options.hash || options.curve.hash;
}
module.exports = ECDSA;

ECDSA.prototype.genKeyPair = function genKeyPair() {
  // Instantiate Hmac_DRBG
  var drbg = new elliptic.hmacDRBG({
    hash: this.hash,
    entropy: elliptic.rand(this.hash.hmacStrength),
    nonce: this.n
  });

  var bytes = Math.ceil(this.n.bitLength() / 8);
  var ns2 = this.n.sub(2);
  do {
    var priv = new elliptic.bn(drbg.generate(bytes));
    if (priv.cmp(ns2) > 0)
      continue;

    priv.iadd(1);
    return {
      priv: priv,
      pub: this.g.mul(priv)
    };
  } while (true);
};

ECDSA.prototype._truncateMessage = function truncateMessage(msg) {
  var bits = Math.ceil(this.n.bitLength() / 8) * 8;
  return msg.clone().imask(bits);
};

ECDSA.prototype.sign = function sign(msg, key, enc) {
  msg = new elliptic.bn(msg, 16);
  key = new elliptic.bn(key, 16);
  msg = this._truncateMessage(msg);

  // Zero-extend key to provide enough entropy
  var bytes = Math.ceil(this.n.bitLength() / 8);
  var bkey = key.toArray();
  for (var i = bkey.length; i < (this.hash.hmacStrength / 8); i++)
    bkey.push(0);

  // Zero-extend nonce to have the same byte size as N
  var nonce = (msg.cmp(this.n) >= 0 ? msg.sub(this.n) : msg).toArray();
  for (var i = nonce.length; i < bytes; i++)
    nonce.push(0);

  // Instantiate Hmac_DRBG
  var drbg = new elliptic.hmacDRBG({
    hash: this.hash,
    entropy: bkey,
    nonce: nonce
  });

  // Number of bytes to generate
  var ns1 = this.n.sub(1);
  do {
    // Add additional 64 bits to neglect bias of `.mod(this.n)`
    var k = new elliptic.bn(drbg.generate(bytes) + 8);
    k = k.mod(ns1).iadd(1);
    if (k.cmp(0) === 0)
      continue;

    var kp = this.g.mul(k);
    if (kp.isInfinity())
      continue;

    var r = kp.getX().mod(this.n);
    if (r.cmp(0) === 0)
      continue;

    var s = k.invm(this.n).mul(msg.add(r.mul(key))).mod(this.n);
    if (s.cmp(0) === 0)
      continue;

    if (enc === 'hex' || enc === 'der')
      return this._encodeDERSign(r, s, enc);
    else
      return { r: r, s: s };
  } while (true);
};

ECDSA.prototype._encodeDERSign = function encodeDERSign(r, s, enc) {
  var rlen = Math.ceil(r.bitLength() / 8);
  var slen = Math.ceil(s.bitLength() / 8);
  assert(rlen + slen + 4 < 0xff, 'Can\'t encode signature');
  var res = [ 0x30, rlen + slen + 4, 0x02, rlen ].concat(
    r.toArray(),
    [ 0x02, slen ],
    s.toArray()
  );

  if (enc === 'hex')
    return utils.toHex(res);
  else
    return res;
};

ECDSA.prototype._decodeDERSign = function decodeDERSign(sign, enc) {
  sign = utils.toArray(sign, enc);
  assert(sign.length >= 5 && sign[0] === 0x30, 'Invalid DER signature');

  var total = sign[1];
  assert.equal(sign.length, total + 2, 'DER SEQ length overflow');

  assert.equal(sign[2], 0x02, 'DER-encoded r is not a number');
  var rlen = sign[3];
  assert(4 + rlen + 2 <= sign.length, 'DER r length overflow');
  var r = sign.slice(4, 4 + rlen);

  assert.equal(sign[4 + rlen], 0x02, 'DER-encoded s is not a number');
  var slen = sign[4 + rlen + 1];
  assert(4 + rlen + 2 + slen <= sign.length, 'DER s length overflow');
  var s = sign.slice(4 + rlen + 2, 4 + rlen + 2 + slen);

  return {
    r: new elliptic.bn(r),
    s: new elliptic.bn(s)
  };
};

ECDSA.prototype.validateKey = function validateKey(key) {
  assert(typeof key === 'object' && key.x && key.y);
  key = this.curve.point(key.x, key.y);

  if (key.isInfinity())
    return { result: false, reason: 'Invalid key' };
  if (!key.validate())
    return { result: false, reason: 'Key is not a point' };
  if (!key.mul(this.n).isInfinity())
    return { result: false, reason: 'Key*N != O' };

  return { result: true, reason: null };
};

ECDSA.prototype.verify = function verify(msg, signature, key) {
  msg = new elliptic.bn(msg, 16);
  msg = this._truncateMessage(msg);

  assert(typeof key === 'object' && key.x && key.y);
  key = this.curve.point(key.x, key.y);

  // Decode signature if needed
  if (Array.isArray(signature) || typeof signature !== 'object')
    signature = this._decodeDERSign(signature);
  assert(typeof signature === 'object' && signature.r && signature.s);

  // Perform primitive values validation
  var r = new elliptic.bn(signature.r, 16);
  var s = new elliptic.bn(signature.s, 16);
  if (r.cmp(1) < 0 || r.cmp(this.n) >= 0)
    return false;
  if (s.cmp(1) < 0 || s.cmp(this.n) >= 0)
    return false;

  // Validate signature
  var sinv = s.invm(this.n);
  var u1 = sinv.mul(msg).mod(this.n);
  var u2 = sinv.mul(r).mod(this.n);

  var p = this.g.mul(u1).add(key.mul(u2));
  if (p.isInfinity())
    return false;

  return p.getX().mod(this.n).cmp(r) === 0;
};
