var assert = require('assert');
var elliptic = require('../elliptic');
var bn = require('bn.js');

function Curve(conf) {
  this.p = new bn(conf.p, 16);
  this.mont = bn.mont(this.p);
  this.a = new bn(conf.a, 16).toMont(this.mont);
  this.b = new bn(conf.b, 16).toMont(this.mont);
}
module.exports = Curve;

Curve.prototype.point = function point(x, y, isMont) {
  return new Point(this, x, y, isMont);
};

Curve.prototype.jpoint = function jpoint(x, y, z) {
  return new JPoint(this, x, y, z);
};

Curve.prototype.pointFromJSON = function pointFromJSON(obj, mont) {
  return Point.fromJSON(this, obj, mont);
};

Curve.prototype.validate = function validate(point) {
  if (point.inf)
    return true;

  var x = point.x;
  var y = point.y;

  var ax = this.a.montMul(x);
  var rhs = x.montSqr().montMul(x).montAdd(ax).montAdd(this.b);
  return y.montSqr().montSub(rhs).cmp(0) === 0;
};

Curve.prototype._nafMul = function _nafMul(p, k) {
  var naf = getNAF(k, 2);
  var acc = this.point(null, null);
  var q = p;
  for (var i = 0; i < naf.length; i++, q = q.dbl()) {
    var z = naf[i];
    if (z === 1)
      acc = acc.add(q);
    else if (z === -1)
      acc = acc.add(q.neg());
    else
      continue;
  }
  return acc;
};

Curve.prototype._wnafMul = function _wnafMul(p, k) {
  var w = 4;
  var naf = getNAF(k, w);

  // Precompute window
  var wnd = [ p ];
  var dbl;
  for (var i = 1; i < (1 << (w - 1)); i++) {
    if (!dbl)
      dbl = p.dbl();
    wnd[i] = wnd[i - 1].add(dbl);
  }

  // Convert everything to J, if needed
  if (p instanceof Point)
    for (var i = 0; i < wnd.length; i++)
      wnd[i] = wnd[i].toJ();

  // Add `this`*(N+1) for every w-NAF index
  var acc = this.jpoint(null, null, null);
  for (var i = naf.length - 1; i >= 0; i--) {
    var z = naf[i];
    acc = acc.dbl();
    if (z === 0)
      continue;

    if (z > 0)
      acc = acc.add(wnd[(z - 1) >> 1]);
    else
      acc = acc.add(wnd[(-z - 1) >> 1].neg());
  }
  return p instanceof Point ? acc.toP() : acc;
};

function Point(curve, x, y, isMont) {
  this.curve = curve;
  if (x === null && y === null) {
    this.x = null;
    this.y = null;
    this.inf = true;
  } else {
    this.x = new bn(x, 16);
    this.y = new bn(y, 16);
    // Force montgomery representation when loading from JSON
    if (isMont) {
      this.x.forceMont(this.curve.mont);
      this.y.forceMont(this.curve.mont);
    }
    if (!this.x.mont)
      this.x = this.x.toMont(this.curve.mont);
    if (!this.y.mont)
      this.y = this.y.toMont(this.curve.mont);
    this.inf = false;
  }
  this.precomputed = null;
};

Point.prototype.validate = function validate() {
  return this.curve.validate(this);
};

Point.prototype.precompute = function precompute(power) {
  if (!this.precomputed)
    this.precomputed = [];
  for (var i = this.precomputed.length; i < power; i++) {
    var q = (i === 0 ? this : this.precomputed[i - 1]).dbl();
    this.precomputed.push(q);
  }
};

Point.prototype.toJSON = function toJSON() {
  return this.precomputed ? [ this.x, this.y, this.precomputed ] :
                            [ this.x, this.y ];
};

Point.fromJSON = function fromJSON(curve, obj, mont) {
  if (typeof obj === 'string')
    obj = JSON.parse(obj);
  var res = curve.point(obj[0], obj[1], mont);
  if (!obj[2])
    return res;
  res.precomputed = obj[2].map(function(obj) {
    return curve.point(obj[0], obj[1], mont);
  });
  return res;
};

Point.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC Point Infinity>';
  return '<EC Point x: ' + this.x.fromMont().toString(16) +
      ' y: ' + this.y.fromMont().toString(16) +
      ' pc: ' + (this.precomputed && this.precomputed.length || 0) + '>';
};

Point.prototype.isInfinity = function isInfinity() {
  return this.inf;
};

Point.prototype.add = function add(p) {
  // Mixed addition
  if (p instanceof JPoint)
    return p.mixedAdd(this);

  // O + P = P
  if (this.inf)
    return p;

  // P + O = P
  if (p.inf)
    return this;

  // P + P = 2P
  if (this.eq(p))
    return this.dbl();

  // P + (-P) = O
  if (this.neg().eq(p))
    return this.curve.point(null, null);

  // P + Q = O
  if (this.x.cmp(p.x) === 0)
    return this.curve.point(null, null);

  var c = this.y.montSub(p.y).montMul(this.x.montSub(p.x).montInvm());
  var nx = c.montSqr().montSub(this.x).montSub(p.x);
  var ny = c.montMul(this.x.montSub(nx)).montSub(this.y);
  return this.curve.point(nx, ny);
};

Point.prototype.dbl = function dbl() {
  if (this.inf)
    return this;
  if (this.precomputed && this.precomputed.length) {
    var cached = this.precomputed[0];
    var res = this.curve.point(cached.x, cached.y);
    if (this.precomputed.length > 1)
      res.precomputed = this.precomputed.slice(1);
    return res;
  }

  // 2P = O
  var ys1 = this.y.montShl(1);
  if (ys1.cmp(0) === 0)
    return this.curve.point(null, null);

  var a = this.curve.a;

  var x2 = this.x.montSqr();
  var dyinv = ys1.montInvm();
  var c = x2.montMul(3).montAdd(a).montMul(dyinv);

  var nx = c.montSqr().montSub(this.x.montShl(1));
  var ny = c.montMul(this.x.montSub(nx)).montSub(this.y);
  return this.curve.point(nx, ny);
};

Point.prototype.getX = function getX() {
  return this.x.fromMont();
};

Point.prototype.getY = function getY() {
  return this.y.fromMont();
};

function getNAF(num, w) {
  // Represent k in a w-NAF form
  var naf = [];
  var ws = 1 << w;
  var k = num.clone();
  while (k.cmp(1) >= 0) {
    var z;
    if (k.isOdd()) {
      var mod = k.andl(ws - 1);
      if (mod > (ws >> 1) - 1)
        z = (ws >> 1) - mod;
      else
        z = mod;
      k.isub(z);
    } else {
      z = 0;
    }
    naf.push(z);

    // Optimization, shift by word if possible
    var shift = (k.cmp(0) !== 0 && k.andl(ws - 1) === 0) ? w : 1;
    for (var i = 1; i < shift; i++)
      naf.push(0);
    k.ishr(shift);
  }

  return naf;
}

Point.prototype.mul = function mul(k, kbase) {
  if (!(k instanceof bn))
    k = new bn(k, kbase);

  if (this.precomputed && this.precomputed.length)
    return this.curve._nafMul(this, k);
  else
    return this.curve._wnafMul(this, k);
};

Point.prototype.eq = function eq(p) {
  return this === p ||
         this.inf === p.inf &&
             (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
};

Point.prototype.neg = function neg() {
  return this.curve.point(this.x, this.y.montNeg());
};

Point.prototype.toJ = function toJ() {
  if (this.inf)
    return this.curve.jpoint(null, null, null);

  var res = this.curve.jpoint(this.x, this.y, new bn(1));
  res.precomputed = this.precomputed;
  return res;
};

function JPoint(curve, x, y, z) {
  this.curve = curve;
  if (x === null && y === null && z === null) {
    this.x = new bn(1);
    this.y = new bn(1);
    this.z = new bn(0);
  } else {
    this.x = new bn(x, 16);
    this.y = new bn(y, 16);
    this.z = new bn(z, 16);
  }
  if (!this.x.mont)
    this.x = this.x.toMont(this.curve.mont);
  if (!this.y.mont)
    this.y = this.y.toMont(this.curve.mont);
  if (!this.z.mont)
    this.z = this.z.toMont(this.curve.mont);
  this.precomputed = null;
};

JPoint.prototype.toP = function toP() {
  if (this.isInfinity())
    return this.curve.point(null, null);

  var zinv = this.z.montInvm();
  var zinv2 = zinv.montSqr();
  var ax = this.x.montMul(zinv2);
  var ay = this.y.montMul(zinv2).montMul(zinv);

  return this.curve.point(ax, ay);
};

JPoint.prototype.neg = function neg() {
  return this.curve.jpoint(this.x, this.y.montNeg(), this.z);
};

JPoint.prototype.add = function add(p) {
  // Mixed addition
  if (!(p instanceof JPoint))
    return this.mixedAdd(p);

  // O + P = P
  if (this.isInfinity())
    return p;

  // P + O = P
  if (p.isInfinity())
    return this;

  // Use .dbl() explicitly
  assert(this !== p)

  var pz2 = p.z.montSqr();
  var z2 = this.z.montSqr();

  var s1 = this.y.montMul(pz2.montMul(p.z));
  var s2 = p.y.montMul(z2.montMul(this.z));
  var u1 = this.x.montMul(pz2);
  var u2 = p.x.montMul(z2);
  var r = s1.montSub(s2);
  var h = u1.montSub(u2);
  var h2 = h.montSqr();
  var g = h2.montMul(h);
  var v = u1.montMul(h2);

  var nx = r.montSqr().montAdd(g).montSub(v.montShl(1));
  var ny = r.montMul(v.montSub(nx)).montSub(s1.montMul(g));
  var nz = this.z.montMul(p.z).montMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mixedAdd = function mixedAdd(p) {
  throw new Error('Not implemented');
};

JPoint.prototype.dbl = function dbl() {
  if (this.isInfinity())
    return this;
  if (this.precomputed && this.precomputed.length) {
    var cached = this.precomputed[0];
    var res = this.curve.point(cached.x, cached.y);
    if (this.precomputed.length > 1)
      res.precomputed = this.precomputed.slice(1);
    return res.toJ();
  }

  var a = this.curve.a;

  var jx = this.x;
  var jy = this.y;
  var jz = this.z;

  var jx2 = jx.montSqr();
  var jy2 = jy.montSqr();
  var jz4 = jz.montSqr().montSqr();
  var c = jx2.montMul(3).montAdd(a.montMul(jz4));

  var t1 = jx.montShl(2).montMul(jy2);
  var nx = c.montSqr().montSub(t1.montShl(1));
  var t2 = t1.montSub(nx);
  var ny = c.montMul(t2).montSub(jy2.montSqr().montShl(3));
  var nz = jy.montShl(1).montMul(jz);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mul = function mul(k, kbase) {
  k = new bn(k, kbase);

  return this.curve._wnafMul(this, k);
};

JPoint.prototype.eq = function eq(p) {
  if (p instanceof Point)
    return this.eq(p.toJ());

  var m = this.curve.p;
  var z2 = this.z.sqr();
  var pz2 = p.z.sqr();

  return this === p ||
         this.x.mul(z2).sub(p.x.mul(pz2)).mod(m).cmp(0) === 0 ||
         this.y.mul(z2.mul(this.z))
             .sub(p.y.mul(pz2.mul(p.z))).mod(m).cmp(0) === 0;
};

JPoint.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC JPoint Infinity>';
  return '<EC JPoint x: ' + this.x.toString(16) +
      ' y: ' + this.y.toString(16) +
      ' z: ' + this.z.toString(16) + '>';
};

JPoint.prototype.isInfinity = function isInfinity() {
  return this.z.cmp(0) === 0;
};
