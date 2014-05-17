var assert = require('assert');
var elliptic = require('../elliptic');
var bn = require('bn.js');

function Curve(conf) {
  this.p = new bn(conf.p, 16);
  this.mont = bn.mont(this.p);
  this.a = new bn(conf.a, 16).toMont(this.mont);
  this.b = new bn(conf.b, 16).toMont(this.mont);
  this.tinv = new bn(2).invm(this.p).toMont(this.mont);
}
module.exports = Curve;

Curve.prototype.point = function point(x, y, isMont) {
  return new Point(this, x, y, isMont);
};

Curve.prototype.pointFromX = function pointFromX(odd, x) {
  x = new bn(x, 16);
  if (!x.mont)
    x = x.toMont(this.mont);

  var y2 = x.montSqr().montMul(x).montAdd(x.montMul(this.a)).montAdd(this.b);
  var y = y2.montSqrt();

  // XXX Is there any way to tell if the number is odd without converting it
  // to non-mont form?
  var isOdd = y.fromMont().isOdd();
  if (odd && !isOdd || !odd && isOdd)
    y = y.montNeg();

  return this.point(x, y);
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
  var rhs = x.montSqr().montMul(x).montIAdd(ax).montIAdd(this.b);
  return y.montSqr().montISub(rhs).cmpn(0) === 0;
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
  if (p.type === 'affine')
    for (var i = 0; i < wnd.length; i++)
      wnd[i] = wnd[i].toJ();

  // Add `this`*(N+1) for every w-NAF index
  var acc = this.jpoint(null, null, null);
  for (var i = naf.length - 1; i >= 0; i--) {
    // Count zeroes
    for (var k = 0; i >= 0 && naf[i] === 0; i--)
      k++;
    if (i >= 0)
      k++;
    acc = acc.dbl(k);

    if (i < 0)
      break;
    var z = naf[i];
    assert(z !== 0);
    if (z > 0)
      acc = acc.add(wnd[(z - 1) >> 1]);
    else
      acc = acc.add(wnd[(-z - 1) >> 1].neg());
  }
  return p.type === 'affine' ? acc.toP() : acc;
};

function Point(curve, x, y, isMont) {
  this.type = 'affine';
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
  this.precomputedW = null;
}

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
  if (p.type === 'jacobian')
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
  var nx = c.montSqr().montISub(this.x).montISub(p.x);
  var ny = c.montMul(this.x.montSub(nx)).montISub(this.y);
  return this.curve.point(nx, ny);
};

Point.prototype.dbl = function dbl(pow) {
  assert(!pow, 'Power in supported in regular point .dbl()');
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
  var ys1 = this.y.montAdd(this.y);
  if (ys1.cmpn(0) === 0)
    return this.curve.point(null, null);

  var a = this.curve.a;

  var x2 = this.x.montSqr();
  var dyinv = ys1.montInvm();
  var c = x2.montAdd(x2).montIAdd(x2).montIAdd(a).montMul(dyinv);

  var nx = c.montSqr().montISub(this.x.montAdd(this.x));
  var ny = c.montMul(this.x.montSub(nx)).montISub(this.y);
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
  while (k.cmpn(1) >= 0) {
    var z;
    if (k.isOdd()) {
      var mod = k.andln(ws - 1);
      if (mod > (ws >> 1) - 1)
        z = (ws >> 1) - mod;
      else
        z = mod;
      k.isubn(z);
    } else {
      z = 0;
    }
    naf.push(z);

    // Optimization, shift by word if possible
    var shift = (k.cmpn(0) !== 0 && k.andln(ws - 1) === 0) ? w : 1;
    for (var i = 1; i < shift; i++)
      naf.push(0);
    k.ishrn(shift);
  }

  return naf;
}

Point.prototype.mul = function mul(k) {
  k = new bn(k, 16);

  if (this.precomputed && this.precomputed.length)
    return this.curve._nafMul(this, k);
  else
    return this.curve._wnafMul(this, k);
};

Point.prototype.mulAdd = function mulAdd(k1, p2, k2) {
  var a = this;
  var b = p2;
  assert.equal(b.type, 'affine');

  var w = {
    a: 8,
    b: 4
  };
  var naf = {
    a: getNAF(k1, w.a),
    b: getNAF(k2, w.b)
  };

  // Precompute window
  var dbl = {
    a: a.dbl(),
    b: b.dbl()
  };
  var wnd = {
    a: [ a ],
    b: [ b ]
  };
  if (a.precomputed && a.precomputed.length) {
    if (a.precomputedW) {
      wnd.a = wnd.a.concat(a.precomputedW);
    } else {
      for (var i = 1; i < (1 << (w.a - 1)); i++)
        wnd.a[i] = wnd.a[i - 1].add(dbl.a);
      a.precomputedW = wnd.a.slice(1);
    }
  } else {
    for (var i = 1; i < (1 << (w.a - 1)); i++)
      wnd.a[i] = wnd.a[i - 1].add(dbl.a);
  }
  for (var i = 1; i < (1 << (w.b - 1)); i++)
    wnd.b[i] = wnd.b[i - 1].add(dbl.b);

  // Add `this`*(N+1) for every w-NAF index
  var acc = this.curve.jpoint(null, null, null);
  var zc = 0;
  for (var i = Math.max(naf.b.length - 1, naf.a.length - 1); i >= 0; i--) {
    acc = acc.dbl();

    if ((naf.a[i] | 0) === (naf.b[i] | 0) && (naf.a[i] | 0) === 0)
      zc++;
    var z = naf.a[i] | 0;
    if (z > 0)
      acc = acc.mixedAdd(wnd.a[(z - 1) >> 1]);
    else if (z < 0)
      acc = acc.mixedAdd(wnd.a[(-z - 1) >> 1].neg());
    var z = naf.b[i] | 0;
    if (z > 0)
      acc = acc.mixedAdd(wnd.b[(z - 1) >> 1]);
    else if (z < 0)
      acc = acc.mixedAdd(wnd.b[(-z - 1) >> 1].neg());
  }
  return acc.toP();
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
  this.type = 'jacobian';
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
}

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
  if (p.type !== 'jacobian')
    return this.mixedAdd(p);

  // O + P = P
  if (this.isInfinity())
    return p;

  // P + O = P
  if (p.isInfinity())
    return this;

  var pz2 = p.z.montSqr();
  var z2 = this.z.montSqr();
  var u1 = this.x.montMul(pz2);
  var u2 = p.x.montMul(z2);
  var s1 = this.y.montMul(pz2.montMul(p.z));
  var s2 = p.y.montMul(z2.montMul(this.z));
  if (u1.cmp(u2) === 0) {
    if (s1.cmp(s2) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h = u1.montSub(u2);
  var r = s1.montSub(s2);

  var h2 = h.montSqr();
  var h3 = h2.montMul(h);
  var v = u1.montMul(h2);

  var nx = r.montSqr().montIAdd(h3).montISub(v.montAdd(v));
  var ny = r.montMul(v.montISub(nx)).montISub(s1.montMul(h3));
  var nz = this.z.montMul(p.z).montMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mixedAdd = function mixedAdd(p) {
  assert(p.type === 'affine');

  // O + P = P
  if (this.isInfinity())
    return p.toJ();

  // P + O = P
  if (p.isInfinity())
    return this;

  var z2 = this.z.montSqr();
  var u1 = this.x;
  var u2 = p.x.montMul(z2);
  var s1 = this.y;
  var s2 = p.y.montMul(z2.montMul(this.z));
  if (u1.cmp(u2) === 0) {
    if (s1.cmp(s2) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h = u1.montSub(u2);
  var r = s1.montSub(s2);

  var h2 = h.montSqr();
  var h3 = h2.montMul(h);
  var v = u1.montMul(h2);

  var nx = r.montSqr().montIAdd(h3).montISub(v.montAdd(v));
  var ny = r.montMul(v.montISub(nx)).montISub(s1.montMul(h3));
  var nz = this.z.montMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.dbl = function dbl(pow) {
  if (pow === 0)
    return this;
  if (this.isInfinity())
    return this;
  if (!pow)
    pow = 1;
  if (this.precomputed && this.precomputed.length) {
    var i = Math.min(this.precomputed.length, pow);
    var cached = this.precomputed[i - 1];
    var res = this.curve.point(cached.x, cached.y);
    if (this.precomputed.length > 1)
      res.precomputed = this.precomputed.slice(1);
    return res.toJ().dbl(pow - i);
  }

  var a = this.curve.a;
  var tinv = this.curve.tinv;

  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.montSqr().montSqr();

  if (pow === 1) {
    var jx2 = jx.montSqr();
    var jy2 = jy.montSqr();

    var c = jx2.montAdd(jx2).montIAdd(jx2).montAdd(a.montMul(jz4));

    var jxd4 = jx.montAdd(jx);
    jxd4 = jxd4.montIAdd(jxd4);
    var t1 = jxd4.montMul(jy2);
    var nx = c.montSqr().montISub(t1.montAdd(t1));
    var t2 = t1.montISub(nx);

    var jyd8 = jy2.montSqr();
    jyd8 = jyd8.montAdd(jyd8);
    jyd8 = jyd8.montAdd(jyd8);
    jyd8 = jyd8.montAdd(jyd8);
    var ny = c.montMul(t2).montISub(jyd8);
    var nz = jy.montAdd(jy).montMul(jz);

    return this.curve.jpoint(nx, ny, nz);
  }

  // Reuse results
  var jyd = jy.montAdd(jy);
  for (var i = 0; i < pow; i++) {
    var jx2 = jx.montSqr();
    var jyd2 = jyd.montSqr();
    var jyd4 = jyd2.montSqr();
    var c = jx2.montAdd(jx2).montIAdd(jx2).montIAdd(a.montMul(jz4));

    var t1 = jx.montMul(jyd2);
    var nx = c.montSqr().montISub(t1.montAdd(t1));
    var t2 = t1.montISub(nx);
    var dny = c.montMul(t2);
    dny = dny.montIAdd(dny).montISub(jyd4);
    var nz = jyd.montMul(jz);
    if (i + 1 < pow)
      jz4 = jz4.montMul(jyd4);

    jx = nx;
    jz = nz;
    jyd = dny;
  }

  return this.curve.jpoint(jx, jyd.montMul(tinv), jz);
};

JPoint.prototype.mul = function mul(k, kbase) {
  k = new bn(k, kbase);

  return this.curve._wnafMul(this, k);
};

JPoint.prototype.eq = function eq(p) {
  if (p.type === 'affine')
    return this.eq(p.toJ());

  var m = this.curve.p;
  var z2 = this.z.sqr();
  var pz2 = p.z.sqr();

  return this === p ||
         this.x.mul(z2).isub(p.x.mul(pz2)).mod(m).cmpn(0) === 0 ||
         this.y.mul(z2.mul(this.z))
             .isub(p.y.mul(pz2.mul(p.z))).mod(m).cmpn(0) === 0;
};

JPoint.prototype.inspect = function inspect() {
  if (this.isInfinity())
    return '<EC JPoint Infinity>';
  return '<EC JPoint x: ' + this.x.toString(16) +
      ' y: ' + this.y.toString(16) +
      ' z: ' + this.z.toString(16) + '>';
};

JPoint.prototype.isInfinity = function isInfinity() {
  return this.z.cmpn(0) === 0;
};
