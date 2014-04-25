var elliptic = require('../elliptic');

function HmacDRBG(msg, key) {
  this.msg = msg;
  this.key = key;
}
module.exports = HmacDRBG;

HmacDRBG.prototype.get = function get(n) {
  return elliptic.rand(1, n);
};
