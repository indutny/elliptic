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

Curve.prototype.jpoint = function jpoint(x, y, z) {
  return new JPoint(this, x, y, z);
};

Curve.prototype.pointFromJSON = function pointFromJSON(obj) {
  return Point.fromJSON(this, obj);
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

Point.fromJSON = function fromJSON(curve, obj) {
  if (typeof obj === 'string')
    obj = JSON.parse(obj);
  var res = curve.point(obj[0], obj[1]);
  if (!obj[2])
    return res;
  res.precomputed = obj[2].map(function(obj) {
    return curve.point(obj[0], obj[1]);
  });
  return res;
};

Point.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC Point Infinity>';
  return '<EC Point x: ' + this.x.toString(16) +
      ' y: ' + this.y.toString(16) +
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

  var m = this.curve.p;
  var c = this.y.sub(p.y).mul(this.x.sub(p.x).invm(m)).mod(m);
  var nx = c.sqr().sub(this.x).sub(p.x).mod(m);
  var ny = c.mul(this.x.sub(nx)).sub(this.y).mod(m);
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
  var a = this.curve.a;
  var p = this.curve.p;

  // 2P = O
  var ys1 = this.y.shl(1).mod(p);
  if (ys1.cmp(0) === 0)
    return this.curve.point(null, null);

  var x2 = this.x.sqr().mod(p);
  var dyinv = ys1.invm(p);
  var c = x2.mul(3).add(a).mul(dyinv).mod(p);

  var nx = c.sqr().sub(this.x.shl(1)).mod(p);
  var ny = c.mul(this.x.sub(nx)).sub(this.y).mod(p);
  return this.curve.point(nx, ny);
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
  if (!(k instanceof BN))
    k = new BN(k, kbase);

  if (this.precomputed && this.precomputed.length)
    return this._nafMul(k);
  else
    return this._wnafMul(k);
};

Point.prototype._nafMul = function _nafMul(k) {
  var naf = getNAF(k, 2);
  var acc = this.curve.point(null, null);
  var q = this;
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

Point.prototype._wnafMul = function _wnafMul(k) {
  var w = 4;
  var naf = getNAF(k, w);

  // Precompute window
  var wnd = [ this ];
  var dbl;
  for (var i = 1; i < (1 << (w - 1)); i++) {
    if (!dbl)
      dbl = this.dbl();
    wnd[i] = wnd[i - 1].add(dbl);
  }

  // Add `this`*(N+1) for every w-NAF index
  var acc = this.curve.point(null, null);
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
  return acc;
};

Point.prototype.eq = function eq(p) {
  return this === p ||
         this.inf === p.inf &&
             (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
};

Point.prototype.neg = function neg() {
  return this.curve.point(this.x, this.y.neg());
};

Point.prototype.toJ = function toJ() {
  if (this.inf)
    return this.curve.jpoint(new BN(1), new BN(1), new BN(0));

  return this.curve.jpoint(this.x, this.y, new BN(1));
};

function JPoint(curve, x, y, z) {
  this.curve = curve;
  if (x === null && y === null && z === null) {
    this.x = new BN(1);
    this.y = new BN(1);
    this.z = new BN(0);
  } else {
    this.x = new BN(x, 16);
    this.y = new BN(y, 16);
    this.z = new BN(z, 16);
  }
};

JPoint.prototype.toP = function toP() {
  if (this.isInfinity())
    return this.curve.point(null, null);

  var p = this.curve.p;
  var zinv = this.z.invm(p);
  var zinv2 = zinv.sqr();
  var ax = this.x.mul(zinv2).mod(p);
  var ay = this.y.mul(zinv2).mul(zinv).mod(p);

  return this.curve.point(ax, ay);
};

JPoint.prototype.neg = function neg() {
  return this.curve.jpoint(this.x, this.y.neg(), this.z);
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

  var pz2 = p.z.sqr().mod(this.curve.p);
  var z2 = this.z.sqr().mod(this.curve.p);

  var s1 = this.y.mul(pz2.mul(p.z));
  var s2 = p.y.mul(z2.mul(this.z));
  var u1 = this.x.mul(pz2);
  var u2 = p.x.mul(z2);
  var r = s1.sub(s2);
  var h = u1.sub(u2);
  var h2 = h.sqr();
  var g = h2.mul(h);
  var v = u1.mul(h2);

  var nx = r.sqr().add(g).sub(v.shl(1)).mod(this.curve.p);
  var ny = r.mul(v.sub(nx)).sub(s1.mul(g)).mod(this.curve.p);
  var nz = this.z.mul(p.z).mul(h).mod(this.curve.p);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mixedAdd = function mixedAdd(p) {
  throw new Error('Not implemented');
};

JPoint.prototype.dbl = function dbl() {
  var p = this.curve.p;
  var a = this.curve.a;

  var jx = this.x;
  var jy = this.y;
  var jz = this.z;

  var jx2 = jx.sqr().mod(p);
  var jy2 = jy.sqr().mod(p);
  var jz4 = jz.sqr().mod(p).sqr().mod(p);
  var c = jx2.mul(3).add(a.mul(jz4));

  var nx = c.sqr().sub(jx.shl(3).mul(jy2));
  var ny = c.mul(jx.shl(2).mul(jy2).sub(nx)).sub(jy2.sqr().shl(3));
  var nz = jy.shl(1).mul(jz);

  return this.curve.jpoint(nx.mod(p), ny.mod(p), nz.mod(p));
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
