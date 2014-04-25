var elliptic = require('../elliptic');

function HmacDRBG(options) {
  this.msg = options.msg;
  this.key = options.key;
  this.hash = options.hash;
}
module.exports = HmacDRBG;

HmacDRBG.prototype.get = function get(n) {
  return elliptic.rand(1, n);
};
