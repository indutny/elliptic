var assert = require('assert');
var elliptic = require('../elliptic');
var BN = elliptic.bn;

function Curve(conf) {
  this.p = new BN(conf.p, 16);
  this.a = new BN(conf.a, 16);
  this.b = new BN(conf.b, 16);
}
module.exports = Curve;

Curve.prototype.point = function point(x, y) {
  return new Point(this, x, y);
};

Curve.prototype.add = function add(a, b) {
};

Curve.prototype.validate = function validate(point) {
  var x = point.x;
  var y = point.y;

  var rhs = x.mul(x).mul(x).add(this.a.mul(x)).add(this.b);
  return y.mul(y).sub(rhs).mod(this.p).cmp(0) === 0;
};

function Point(curve, x, y) {
  this.curve = curve;
  this.x = new BN(x, 16);
  this.y = new BN(y, 16);
};

Point.prototype.validate = function validate() {
  return this.curve.validate(this);
};

Point.prototype.add = function add(p) {
  return this.curve.add(this, p);
};
