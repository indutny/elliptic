var createHash = require('create-hash');
var createHmac = require('create-hmac');

function makeHash(algo) {
  function out() {
    return createHash(algo);
  }
  if (algo === 'sha1') {
    out.hmacStrength = 80;
    out.outSize = 160;
  } else {
    out.hmacStrength = 192;
    out.outSize = parseInt(algo.toLowerCase().match(/sha(\d\d\d)/)[1], 10);
  }
  out.hashName = algo;
  return out;
}

exports.hmac = function (hash, key) {
  return new Hmac(hash.hashName, key);
};

function Hmac(algo, key) {
  if (Array.isArray(key)) {
    key = new Buffer(key);
  }
  this.hmac  = createHmac(algo, key);
}

Hmac.prototype.digest = function () {
  return this.hmac.digest();
};

Hmac.prototype.update = function (array) {
  if (!array) {
    return this;
  }
  if (Array.isArray(array)) {
    array = new Buffer(array);
  }
  this.hmac.update(new Buffer(array));
  return this;
};
exports.sha1 = makeHash('sha1');
exports.sha224 = makeHash('sha224');
exports.sha256 = makeHash('sha256');
exports.sha384 = makeHash('sha384');
exports.sha512 = makeHash('sha512');