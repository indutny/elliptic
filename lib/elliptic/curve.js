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

Curve.prototype.dbl = function dbl(a) {
  var x2 = a.x.sqr();
  var dyinv = a.y.shl(1).invm(this.p);
  var c = x2.mul(3).add(this.a).mul(dyinv);

  var nx = c.sqr().sub(a.x.shl(1)).mod(this.p);
  var ny = c.mul(a.x.sub(nx)).sub(a.y).mod(this.p);
  return this.point(nx, ny);
};

Curve.prototype.add = function add(a, b) {
  // O + P = P
  if (a.inf)
    return b;

  // P + O = P
  if (b.inf)
    return a;

  // P + P = 2P
  if (a.eq(b))
    return this.dbl(a);

  // P + (-P) = O
  if (a.neg().cmp(b) === 0)
    return this.point(null, null);

  var c = a.y.sub(b.y).mul(a.x.sub(b.x).invm(this.p));
  var nx = c.sqr().sub(a.x).sub(b.x).mod(this.p);
  var ny = c.mul(a.x.sub(nx)).sub(a.y).mod(this.p);
  return this.point(nx, ny);
};

Curve.prototype.neg = function neg(point) {
  return this.point(point.x, point.y.neg());
};

Curve.prototype.validate = function validate(point) {
  if (point.inf)
    return true;

  var x = point.x;
  var y = point.y;

  var rhs = x.mul(x).mul(x).add(this.a.mul(x)).add(this.b);
  return y.mul(y).sub(rhs).mod(this.p).cmp(0) === 0;
};

function Point(curve, x, y) {
  this.curve = curve;
  if (x === null && y === null) {
    this.x = null;
    this.y = null;
    this.inf = true;
  } else {
    this.x = new BN(x, 16);
    this.y = new BN(y, 16);
    this.inf = false;
  }
};

Point.prototype.validate = function validate() {
  return this.curve.validate(this);
};

Point.prototype.add = function add(p) {
  return this.curve.add(this, p);
};

Point.prototype.dbl = function dbl() {
  return this.curve.dbl(this);
};

Point.prototype.eq = function eq(p) {
  return this === p ||
         this.inf === p.inf ||
         this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0;
};

Point.prototype.neg = function neg() {
  this.curve.neg(this);
};
