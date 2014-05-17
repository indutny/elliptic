var assert = require('assert');
var elliptic = require('../elliptic');
var bn = require('bn.js');

function Curve(conf) {
  this.p = new bn(conf.p, 16);
  this.mont = bn.mont(this.p);
  this.a = new bn(conf.a, 16).toMont(this.mont);
  this.b = new bn(conf.b, 16).toMont(this.mont);
  this.tinv = new bn(2).invm(this.p).toMont(this.mont);
  this.mOne = new bn(1).toMont(this.mont);

  this.zeroA = this.a.cmpn(0) === 0;
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
    acc = acc.dblp(k);

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

// Hybrid Binary-Ternary Joint Sparse Form
function HBTJSF(k1, k2) {
  var hbt1 = [];
  var hbt2 = [];
  var base = [];
  while (k1.cmpn(0) > 0 || k2.cmpn(0) > 0) {
    var b = 2;
    var h1 = 0;
    var h2 = 0;
    if (k1.modn(3) === 0 && k2.modn(3) === 0) {
      b = 3;
      k1.idivn(3);
      k2.idivn(3);
    } else if (k1.andln(1) === 0 && k2.andln(1) === 0) {
      k1.ishrn(1);
      k2.ishrn(1);
    } else {
      h1 = k1.modn(6);
      h2 = k2.modn(6);
      if (h1 > 3)
        h1 = h1 - 6;
      if (h2 > 3)
        h2 = h2 - 6;
      k1.isubn(h1).ishrn(1);
      k2.isubn(h2).ishrn(1);
    }
    base.push(b);
    hbt1.push(h1);
    hbt2.push(h2);
  }
  return { h1: hbt1, h2: hbt2, base: base };
}

Point.prototype.mul = function mul(k) {
  k = new bn(k, 16);

  if (this.precomputed && this.precomputed.length)
    return this.curve._nafMul(this, k);
  else
    return this.curve._wnafMul(this, k);
};

function HBTWindow(curve, p1, p2) {
  this.curve = curve;
  this.p1 = p1;
  this.p2 = p2;

  this.cache = new Array(25);
}

HBTWindow.prototype.get = function(k1, k2) {
  if (k1 === 0 && k2 === 0)
    return this.curve.point(null, null, null);

  var index = (k1 + 2) * 6 + (k2 + 2);
  if (this.cache[index])
    return this.cache[index];

  var acc = this.curve.point(null, null, null);
  if (k1 === 3)
    acc = acc.add(this.p1.dbl().add(this.p1));
  else if (k1 === 2)
    acc = acc.add(this.p1.dbl());
  else if (k1 === 1)
    acc = acc.add(this.p1);
  else if (k1 === -1)
    acc = acc.add(this.p1.neg());
  else if (k1 === -2)
    acc = acc.add(this.p1.dbl().neg());

  if (k2 === 3)
    acc = acc.add(this.p2.dbl().add(this.p2));
  else if (k2 === 2)
    acc = acc.add(this.p2.dbl());
  else if (k2 === 1)
    acc = acc.add(this.p2);
  else if (k2 === -1)
    acc = acc.add(this.p2.neg());
  else if (k2 === -2)
    acc = acc.add(this.p2.dbl().neg());

  this.cache[index] = acc;

  return acc;
};

Point.prototype._hbtMulAdd = function _hbtMulAdd(k1, p2, k2) {
  assert.equal(p2.type, 'affine');

  var hbt = HBTJSF(k1, k2);
  var w = new HBTWindow(this.curve, this, p2);

  var acc = this.curve.jpoint(null, null, null);
  for (var i = hbt.h1.length - 1; i >= 0; ) {
    var twos = 0;
    var threes = 0;
    do {
      var h1 = hbt.h1[i];
      var h2 = hbt.h2[i];
      var base = hbt.base[i];

      if (base === 2)
        twos++;
      else
        threes++;
      i--;
    } while (i >= 0 && h1 === 0 && h2 === 0);

    acc = acc.dblp(twos);
    for (var j = 0; j < threes; j++)
      acc = acc.trpl();
    acc = acc.mixedAdd(w.get(h1, h2));
  }
  return acc.toP();
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
  for (var i = Math.max(naf.b.length - 1, naf.a.length - 1); i >= 0; i--) {
    var k = 0;
    var za = naf.a[i] | 0;
    var zb = naf.b[i] | 0;

    while (i >= 0 && za === 0 && zb === 0) {
      k++;
      i--;
      var za = naf.a[i] | 0;
      var zb = naf.b[i] | 0;
    }
    if (i >= 0)
      k++;
    acc = acc.dblp(k);
    if (i < 0)
      break;

    if (za > 0)
      acc = acc.mixedAdd(wnd.a[(za - 1) >> 1]);
    else if (za < 0)
      acc = acc.mixedAdd(wnd.a[(-za - 1) >> 1].neg());
    if (zb > 0)
      acc = acc.mixedAdd(wnd.b[(zb - 1) >> 1]);
    else if (zb < 0)
      acc = acc.mixedAdd(wnd.b[(-zb - 1) >> 1].neg());
  }
  return acc.toP();
};

Point.prototype.eq = function eq(p) {
  return this === p ||
         this.inf === p.inf &&
             (this.inf || this.x.cmp(p.x) === 0 && this.y.cmp(p.y) === 0);
};

Point.prototype.neg = function neg() {
  if (this.inf)
    return this;

  return this.curve.point(this.x, this.y.montNeg());
};

Point.prototype.toJ = function toJ() {
  if (this.inf)
    return this.curve.jpoint(null, null, null);

  var res = this.curve.jpoint(this.x, this.y, this.curve.mOne);
  return res;
};

function JPoint(curve, x, y, z) {
  this.type = 'jacobian';
  this.curve = curve;
  if (x === null && y === null && z === null) {
    this.x = this.curve.mOne;
    this.y = this.curve.mOne;
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

  this.zOne = this.z === this.curve.mOne;
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
  // O + P = P
  if (this.isInfinity())
    return p;

  // P + O = P
  if (p.isInfinity())
    return this;

  // 12M + 4S + 7A
  var pz2 = p.z.montSqr();
  var z2 = this.z.montSqr();
  var u1 = this.x.montMul(pz2);
  var u2 = p.x.montMul(z2);
  var s1 = this.y.montMul(pz2.montMul(p.z));
  var s2 = p.y.montMul(z2.montMul(this.z));

  var h = u1.montSub(u2);
  var r = s1.montSub(s2);
  if (h.cmpn(0) === 0) {
    if (r.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h2 = h.montSqr();
  var h3 = h2.montMul(h);
  var v = u1.montMul(h2);

  var nx = r.montSqr().montIAdd(h3).montISub(v).montISub(v);
  var ny = r.montMul(v.montISub(nx)).montISub(s1.montMul(h3));
  var nz = this.z.montMul(p.z).montMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mixedAdd = function mixedAdd(p) {
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
  var s2 = p.y.montMul(z2).montMul(this.z);

  var h = u1.montSub(u2);
  var r = s1.montSub(s2);
  if (h.cmpn(0) === 0) {
    if (r.cmpn(0) !== 0)
      return this.curve.jpoint(null, null, null);
    else
      return this.dbl();
  }

  var h2 = h.montSqr();
  var h3 = h2.montMul(h);
  var v = u1.montMul(h2);

  var nx = r.montSqr().montIAdd(h3).montISub(v).montISub(v);
  var ny = r.montMul(v.montISub(nx)).montISub(s1.montMul(h3));
  var nz = this.z.montMul(h);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.dblp = function dblp(pow) {
  if (pow === 0)
    return this;
  if (this.isInfinity())
    return this;
  if (!pow)
    return this.dbl();

  if (this.precomputed && this.precomputed.length) {
    var i = Math.min(this.precomputed.length, pow);
    var cached = this.precomputed[i - 1];
    var res = this.curve.point(cached.x, cached.y);
    if (this.precomputed.length > i)
      res.precomputed = this.precomputed.slice(i);
    return res.toJ().dblw(pow - i);
  }

  if (this.curve.zeroA) {
    var r = this;
    for (var i = 0; i < pow; i++)
      r = r.dbl();
    return r;
  }

  var a = this.curve.a;
  var tinv = this.curve.tinv;

  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.montSqr().montSqr();

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

JPoint.prototype.dbl = function dbl() {
  if (this.isInfinity())
    return this;
  if (this.precomputed && this.precomputed.length) {
    var cached = this.precomputed[0];
    var res = this.curve.point(cached.x, cached.y);
    if (this.precomputed.length > 1)
      res.precomputed = this.precomputed.slice(1);
    return res.toJ().dbl();
  }

  if (this.curve.zeroA)
    return this._zeroDbl();
  else
    return this._dbl();
};

JPoint.prototype._zeroDbl = function _zeroDbl() {
  // Z = 1
  if (this.zOne) {
    // http://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#doubling-mdbl-2007-bl
    // 1M + 5S + 14A

    // XX = X1^2
    var xx = this.x.montSqr();
    // YY = Y1^2
    var yy = this.y.montSqr();
    // YYYY = YY^2
    var yyyy = yy.montSqr();
    // S = 2 * ((X1 + YY)^2 - XX - YYYY)
    var s = this.x.montAdd(yy).montSqr().montISub(xx).montISub(yyyy);
    s = s.montIAdd(s);
    // M = 3 * XX + a; a = 0
    var m = xx.montAdd(xx).montIAdd(xx);
    // T = M ^ 2 - 2*S
    var t = m.montSqr().montISub(s).montISub(s);

    // 8 * YYYY
    var yyyy8 = yyyy.montIAdd(yyyy);
    yyyy8 = yyyy8.montIAdd(yyyy8);
    yyyy8 = yyyy8.montIAdd(yyyy8);

    // X3 = T
    var nx = t;
    // Y3 = M * (S - T) - 8 * YYYY
    var ny = m.montMul(s.montISub(t)).montISub(yyyy8);
    // Z3 = 2*Y1
    var nz = this.y.montAdd(this.y);
  } else {
    // http://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#doubling-dbl-2009-l
    // 2M + 5S + 13A

    // A = X1^2
    var a = this.x.montSqr();
    // B = Y1^2
    var b = this.y.montSqr();
    // C = B^2
    var c = b.montSqr();
    // D = 2 * ((X1 + B)^2 - A - C)
    var d = this.x.montAdd(b).montSqr().montISub(a).montISub(c);
    d = d.montIAdd(d);
    // E = 3 * A
    var e = a.montAdd(a).montIAdd(a);
    // F = E^2
    var f = e.montSqr();

    // 8 * C
    var c8 = c.montIAdd(c);
    c8 = c8.montIAdd(c8);
    c8 = c8.montIAdd(c8);

    // X3 = F - 2 * D
    var nx = f.montISub(d).montISub(d);
    // Y3 = E * (D - X3) - 8 * C
    var ny = e.montMul(d.montISub(nx)).montISub(c8);
    // Z3 = 2 * Y1 * Z1
    var nz = this.y.montMul(this.z);
    nz = nz.montIAdd(nz);
  }

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype._dbl = function _dbl() {
  var a = this.curve.a;
  var tinv = this.curve.tinv;

  // 4M + 6S + 10A
  var jx = this.x;
  var jy = this.y;
  var jz = this.z;
  var jz4 = jz.montSqr().montSqr();

  var jx2 = jx.montSqr();
  var jy2 = jy.montSqr();

  var c = jx2.montAdd(jx2).montIAdd(jx2).montIAdd(a.montMul(jz4));

  var jxd4 = jx.montAdd(jx);
  jxd4 = jxd4.montIAdd(jxd4);
  var t1 = jxd4.montMul(jy2);
  var nx = c.montSqr().montISub(t1.montAdd(t1));
  var t2 = t1.montISub(nx);

  var jyd8 = jy2.montSqr();
  jyd8 = jyd8.montIAdd(jyd8);
  jyd8 = jyd8.montIAdd(jyd8);
  jyd8 = jyd8.montIAdd(jyd8);
  var ny = c.montMul(t2).montISub(jyd8);
  var nz = jy.montAdd(jy).montMul(jz);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.trpl = function trpl() {
  if (!this.curve.zeroA)
    return this.dbl().add(this);

  // http://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#tripling-tpl-2007-bl
  // 5M + 10S + ...

  // XX = X1^2
  var xx = this.x.montSqr();
  // YY = Y1^2
  var yy = this.y.montSqr();
  // ZZ = Z1^2
  var zz = this.z.montSqr();
  // YYYY = YY^2
  var yyyy = yy.montSqr();
  // M = 3 * XX + a * ZZ2; a = 0
  var m = xx.montAdd(xx).montIAdd(xx);
  // MM = M^2
  var mm = m.montSqr();
  // E = 6 * ((X1 + YY)^2 - XX - YYYY) - MM
  var e = this.x.montAdd(yy).montSqr().montISub(xx).montISub(yyyy);
  e = e.montIAdd(e);
  e = e.montAdd(e).montIAdd(e);
  e = e.montISub(mm);
  // EE = E^2
  var ee = e.montSqr();
  // T = 16*YYYY
  var t = yyyy.montIAdd(yyyy);
  t = t.montIAdd(t);
  t = t.montIAdd(t);
  t = t.montIAdd(t);
  // U = (M + E)^2 - MM - EE - T
  var u = m.montIAdd(e).montSqr().montISub(mm).montISub(ee).montISub(t);
  // X3 = 4 * (X1 * EE - 4 * YY * U)
  var yyu4 = yy.montMul(u);
  yyu4 = yyu4.montIAdd(yyu4);
  yyu4 = yyu4.montIAdd(yyu4);
  var nx = this.x.montMul(ee).montISub(yyu4);
  nx = nx.montIAdd(nx);
  nx = nx.montIAdd(nx);
  // Y3 = 8 * Y1 * (U * (T - U) - E * EE)
  var ny = this.y.montMul(u.montMul(t.montISub(u)).montISub(e.montMul(ee)));
  ny = ny.montIAdd(ny);
  ny = ny.montIAdd(ny);
  ny = ny.montIAdd(ny);
  // Z3 = (Z1 + E)^2 - ZZ - EE
  var nz = this.z.montAdd(e).montSqr().montISub(zz).montISub(ee);

  return this.curve.jpoint(nx, ny, nz);
};

JPoint.prototype.mul = function mul(k, kbase) {
  k = new bn(k, kbase);

  return this.curve._wnafMul(this, k);
};

JPoint.prototype.eq = function eq(p) {
  if (p.type === 'affine')
    return this.eq(p.toJ());

  if (this === p)
    return true;

  // x1 * z2^2 == x2 * z1^2
  var z2 = this.z.montSqr();
  var pz2 = p.z.montSqr();
  if (this.x.montMul(pz2).montISub(p.x.montMul(z2)).cmpn(0) !== 0)
    return false;

  // y1 * z2^3 == y2 * z1^3
  var z3 = z2.montMul(this.z);
  var pz3 = pz2.montMul(p.z);
  return this.y.montMul(pz3).montISub(p.y.montMul(z3)).cmpn(0) === 0;
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
