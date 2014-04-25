var assert = require('assert');
var elliptic = require('../elliptic');
var utils = elliptic.utils;

function BN(number, base) {
  if (number instanceof BN)
    return number;

  if (!(this instanceof BN))
    return new BN(number, base);

  this.sign = false;
  this.words = null;
  this.length = 0;

  // Montgomery context
  this.mont = null;

  if (number !== null)
    this.init(number || 0, base || 10);
}
module.exports = BN;

BN.prototype.init = function init(number, base) {
  if (typeof number === 'number') {
    if (number < 0) {
      this.sign = true;
      number = -number;
    }
    this.words = [ number & 0xffffff ];
    this.length = 1;
    return;
  } else if (typeof number === 'object') {
    // Perhaps a Uint8Array
    assert(typeof number.length === 'number');
    this.length = Math.ceil(number.length / 3);
    this.words = new Array(this.length);

    if (base === 'little' || base === 'le') {
      for (var i = 0; i < this.length; i++) {
        this.words[this.length - i - 1] = number[i * 3 + 2] |
                                          (number[i * 3 + 1] << 8) |
                                          (number[i * 3] << 16);
      }
    } else {
      for (var i = 0; i < this.length; i++) {
        this.words[i] = number[i * 3] |
                        (number[i * 3 + 1] << 8) |
                        (number[i * 3 + 2] << 16);
      }
    }
    return;
  }
  assert(base <= 16);

  number = number.toString().replace(/\s+/g, '');
  var start = 0;
  if (number[0] === '-')
    start++;

  // Initialize as zero
  this.words = [ 0 ];
  this.length = 1;

  var word = 0;
  var q = 1;
  var p = 0;
  var bigQ = null;
  for (var i = start; i < number.length; i++) {
    var digit;
    var ch = number[i];
    if (base === 10 || ch <= '9')
      digit = ch | 0;
    else if (ch >= 'a')
      digit = ch.charCodeAt(0) - 97 + 10;
    else
      digit = ch.charCodeAt(0) - 65 + 10;
    word *= base;
    word += digit;
    q *= base;
    p++;

    if (q > 0xfffff) {
      assert(q <= 0xffffff);
      if (!bigQ)
        bigQ = new BN(q);
      this.mul(bigQ).copy(this);
      this.add(new BN(word)).copy(this);
      word = 0;
      q = 1;
      p = 0;
    }
  }
  if (p !== 0) {
    this.mul(new BN(q)).copy(this);
    this.add(new BN(word)).copy(this);
  }

  if (number[0] === '-')
    this.sign = true;
};

BN.prototype.copy = function copy(dest) {
  dest.words = this.words.slice();
  dest.length = this.length;
  dest.sign = this.sign;
  dest.mont = this.mont;
};

BN.prototype.clone = function clone() {
  var r = new BN(null);
  this.copy(r);
  return r;
};

// Remove leading `0` from `this`
BN.prototype.strip = function strip() {
  while (this.words.length > 1 && this.words[this.words.length - 1] === 0)
    this.words.length--;
  this.length = this.words.length;
  // -0 = 0
  if (this.length === 1 && this.words[0] === 0)
    this.sign = false;
  return this;
};

BN.prototype.inspect = function inspect() {
  return (this.mont ? '<BN-M: ' : '<BN: ') + this.toString(16) + '>';
};

BN.prototype.toString = function toString(base) {
  base = base || 10;
  if (base === 16) {
    var out = this.sign ? '-' : '';
    for (var i = this.length - 1; i >= 0; i--) {
      var word = this.words[i].toString(16);
      if (i !== this.length - 1)
        out += utils.zero6(word);
      else
        out += word;
    }
    return out;
  } else if (base === 10) {
    var out = '';
    var c = this.clone();
    c.sign = false;
    while (c.cmp(0) !== 0) {
      var r = c.mod(1000000);
      c = c.div(1000000);
      assert.equal(r.length, 1);
      if (c.cmp(0) !== 0)
        out = utils.zero6(r.words[0] + '') + out;
      else
        out = r.words[0] + out;
    }
    if (this.cmp(0) === 0)
      out = '0' + out;
    if (this.sign)
      out = '-' + out;
    return out;
  } else {
    assert(false, 'Only 16 and 10 base are supported');
  }
};

BN.prototype.toJSON = function toJSON() {
  return this.toString(16);
};

function genCountBits(bits) {
  var arr = [];

  for (var i = bits - 1; i >= 0; i--) {
    var bit = '0x' + (1 << i).toString(16);
    arr.push('(w & ' + bit + ') === ' + bit + ' ? ' + (i + 1));
  }

  return new Function('w', 'return ' + arr.join(':\n') + ':\n0;');
};

BN.prototype._countBits = genCountBits(24);

// Return number of used bits in a BN
BN.prototype.bitLength = function bitLength() {
  this.strip();
  var hi = 0;
  var w = this.words[this.length - 1];
  var hi = this._countBits(w);
  return (this.length - 1) * 24 + hi;
};

// Return negative clone of `this`
BN.prototype.neg = function neg() {
  var r = this.clone();
  r.sign = !this.sign;
  return r;
};

// Add `num` to `this`
BN.prototype.add = function add(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (num.sign && !this.sign)
    return this.sub(num.neg());
  else if (!num.sign && this.sign)
    return num.sub(this.neg());

  var max = Math.max(num.length, this.length);
  var result = new BN(null);
  result.sign = num.sign;
  result.length = max;
  result.words = new Array(max);

  var carry = 0;
  for (var i = 0; i < max; i++) {
    var a = i < this.length ? this.words[i] : 0;
    var b = i < num.length ? num.words[i] : 0;

    var r = a + b + carry;
    result.words[i] = r & 0xffffff;
    carry = r >> 24;
  }
  if (carry) {
    result.words.push(carry);
    result.length++;
  }

  return result;
};

// Subtract `num` from `this`
BN.prototype.sub = function sub(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (num.sign)
    return this.add(num.neg());
  else if (this.sign)
    return this.neg().add(num).neg();

  // At this point both numbers are positive
  var cmp = this.cmp(num);
  if (cmp === 0)
    return new BN(0);
  else if (cmp < 0)
    return num.sub(this).neg();

  // At this point `this` is > `num`
  var result = new BN(null);
  result.words = new Array(this.length);

  var carry = 0;
  for (var i = 0; i < this.length; i++) {
    var a = this.words[i];
    var b = i < num.length ? num.words[i] : 0;
    var r = a - b - carry;
    if (r < 0) {
      r += 0x1000000;
      carry = 1;
    } else {
      carry = 0;
    }
    result.words[i] = r;

    // Optimization
    if (carry === 0 && i >= num.length) {
      // Copy rest of the words
      i++;
      for (; i < this.length; i++)
        result.words[i] = this.words[i];
      break;
    }
  }
  result.length = result.words.length;

  return result.strip();
};

// Multiply `this` by `num`
BN.prototype.mul = function mul(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (this === num)
    return this.sqr();

  var result = new BN(null);
  result.sign = ((num.sign ? 1 : 0) ^ (this.sign ? 1 : 0)) ? true : false;
  result.words = new Array(this.length + num.length);
  for (var i = 0; i < result.words.length; i++)
    result.words[i] = 0;
  for (var i = 0; i < this.length; i++) {
    var a = this.words[i];
    for (var j = 0; j < num.length; j++) {
      var b = num.words[j];
      var r = a * b;
      var k = i + j;

      var lo = r & 0xffffff;
      var carry = (r - lo) / 0x1000000;
      if (result.words[k]) {
        lo = result.words[k] + lo;
        result.words[k] = lo & 0xffffff;
        carry += lo >> 24;
      } else {
        result.words[k] = lo;
      }

      // Apply carry
      k++;
      assert(carry <= 0xffffff);
      for (; carry !== 0; k++) {
        if (result.words[k]) {
          carry += result.words[k];
          result.words[k] = carry & 0xffffff;
          carry >>= 24;
        } else {
          result.words[k] = carry;
          carry = 0;
        }
      }
    }
  }
  result.length = result.words.length;

  return result.strip();
};

// `this` * `this`
BN.prototype.sqr = function sqr() {
  var res = new BN(null);
  res.words = new Array(2 * this.length);
  var r0 = 0, r1 = 0, r2 = 0;
  for (var k = 0; k < 2 * this.length - 1; k++) {
    for (var i = 0; i <= k >> 1; i++) {
      var j = k - i;
      var a = this.words[i];
      var b = this.words[j];
      var uv = a * b;
      var v = uv & 0xffffff;
      var u = (uv - v) / 0x1000000;
      if (i < j) {
        u <<= 1;
        r2 += u >> 24;
        v <<= 1;
        u |= v >> 24;
        u &= 0xffffff;
        v &= 0xffffff;
      }
      r0 += v;
      r1 += u + (r0 >> 24);
      r2 += r1 >> 24;
      r0 &= 0xffffff;
      r1 &= 0xffffff;
    }
    res.words[k] = r0;
    r0 = r1;
    r1 = r2;
    r2 = 0;
  }
  res.words[2 * this.length - 1] = r0;
  res.length = res.words.length;
  return res;
};

// Shift-left in-place
BN.prototype.ishl = function ishl(bits) {
  assert(typeof bits === 'number');
  var r = bits % 24;
  var s = (bits - r) / 24;
  var carryMask = (0xffffff >> (24 - r)) << (24 - r);

  if (r !== 0) {
    var carry = 0;
    for (var i = 0; i < this.length; i++) {
      var newCarry = this.words[i] & carryMask;
      var c = (this.words[i] - newCarry) << r;
      this.words[i] = c | carry;
      carry = newCarry >> (24 - r);
    }
    if (carry) {
      this.words[i] = carry;
      this.length++;
    }
  }

  if (s !== 0) {
    var prep = [];
    for (var i = 0; i < s; i++)
      prep.push(0);
    this.words = prep.concat(this.words);
    this.length = this.words.length;
  }

  return this;
};

// Shift-right in-place
// NOTE: `hint` is a lowest bit before trailing zeroes
BN.prototype.ishr = function ishr(bits, hint) {
  assert(typeof bits === 'number');
  if (!hint)
    hint = 0;
  else
    hint = (hint - (hint % 24)) / 24;

  var r = bits % 24;
  var s = (bits - r) / 24;
  var mask = 0xffffff ^ ((0xffffff >> r) << r);

  if (s !== 0) {
    hint -= s;
    hint = Math.max(0, hint);
    for (var i = 0; i < s; i++)
      this.words.shift();
    this.length = this.words.length;
  }

  if (r !== 0) {
    var carry = 0;
    for (var i = this.length - 1; i >= 0 && (carry !== 0 || i >= hint); i--) {
      var word = this.words[i];
      this.words[i] = (carry << (24 - r)) | (this.words[i] >> r);
      carry = word & mask;
    }
  }

  if (this.length === 0) {
    this.words = [ 0 ];
    this.length = 1;
  }

  return this.strip();
};

// Shift-left
BN.prototype.shl = function shl(bits) {
  return this.clone().ishl(bits);
};

// Shift-right
BN.prototype.shr = function shr(bits) {
  return this.clone().ishr(bits);
};

// Return only lowers bits of number (in-place)
BN.prototype.imask = function imask(bits) {
  assert(typeof bits === 'number');
  var r = bits % 24;
  var s = (bits - r) / 24;

  assert(!this.sign, 'imask works only with positive numbers');

  this.words.length = Math.min(s + 1, this.words.length);
  this.length = this.words.length;

  var mask = 0xffffff ^ ((0xffffff >> r) << r);
  this.words[this.words.length - 1] &= mask;

  return this.strip();
};

// Return only lowers bits of number
BN.prototype.mask = function mask(bits) {
  return this.clone().imask(bits);
};

// Add plain number `num` to `this`
BN.prototype.iadd = function iadd(num) {
  assert(typeof num === 'number');
  if (num < 0)
    return this.isub(num);
  this.words[0] += num;

  // Carry
  for (var i = 0; i < this.length && this.words[i] >= 0x1000000; i++) {
    this.words[i] -= 0x1000000;
    if (i == this.length - 1)
      this.words[i + 1] = 1;
    else
      this.words[i + 1]++;
  }
  this.length = this.words.length;

  return this;
};

// Subtract plain number `num` from `this`
BN.prototype.isub = function isub(num) {
  assert(typeof num === 'number');
  assert(this.cmp(num) >= 0, 'Sign change is not supported in isub');
  if (num < 0)
    return this.iadd(-num);
  this.words[0] -= num;

  // Carry
  for (var i = 0; i < this.length && this.words[i] < 0; i++) {
    this.words[i] += 0x1000000;
    this.words[i + 1] -= 1;
  }

  return this;
};

BN.prototype._div = function _div(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (this.sign && !num.sign) {
    var res = this.neg()._div(num);
    return {
      div: res.div.neg(),
      mod: res.mod.cmp(0) === 0 ? res.mod : num.sub(res.mod)
    };
  } else if (!this.sign && num.sign) {
    var res = this._div(num.neg());
    return { div: res.div.neg(), mod: res.mod };
  } else if (this.sign && num.sign) {
    return this.neg()._div(num.neg());
  }

  // Both numbers are positive at this point

  // Strip both numbers to approximate shift value
  this.strip();
  num.strip();
  if (num.length > this.length || this.cmp(num) < 0)
    return { div: new BN(0), mod: this };

  // Find maximum Q, Q * num <= this
  var shift = Math.max(0, this.bitLength() - num.bitLength());
  var max = num.shl(shift);
  if (shift > 0 && this.cmp(max) < 0) {
    max.ishr(1, shift);
    shift--;
  }
  var maxLen = max.bitLength();

  var c = this;
  var r = new BN(0);
  while (c.cmp(num) >= 0) {
    assert(shift >= 0);
    while (c.cmp(max) >= 0) {
      c = c.sub(max);
      r = r.binc(shift);
    }
    max.ishr(1, shift);
    shift -= 1;
  }
  return { mod: c, div: r };
};

// Find `this` / `num`
BN.prototype.div = function div(num, base) {
  return this._div(num, base).div;
};

// Find `this` % `num`
BN.prototype.mod = function mod(num, base) {
  return this._div(num, base).mod;
};

BN.prototype._egcd = function _egcd(x1, p) {
  assert(!p.sign);

  var a = this;
  var b = p;

  if (a.sign)
    a = a.mod(p);
  else
    a = a.clone();
  assert(a.cmp(0) !== 0);

  x1 = x1.clone();
  var x2 = new BN(0);
  while (a.cmp(1) !== 0 && b.cmp(1) !== 0) {
    while (a.isEven()) {
      a.ishr(1);
      if (x1.isEven())
        x1.ishr(1);
      else
        x1 = x1.add(p).ishr(1);
    }
    while (b.isEven()) {
      b.ishr(1);
      if (x2.isEven())
        x2.ishr(1);
      else
        x2 = x2.add(p).ishr(1);
    }
    if (a.cmp(b) >= 0) {
      a = a.sub(b);
      x1 = x1.sub(x2);
    } else {
      b = b.sub(a);
      x2 = x2.sub(x1);
    }
  }
  if (a.cmp(1) === 0)
    return x1.mod(p);
  else
    return x2.mod(p);
};

// Invert number in the field F(num)
BN.prototype.invm = function invm(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);
  return this._egcd(new BN(1), num);
};

BN.prototype.isEven = function isEven(num) {
  return (this.words[0] & 1) === 0;
};

BN.prototype.isOdd = function isOdd(num) {
  return (this.words[0] & 1) === 1;
};

// And first word and num
BN.prototype.andl = function andl(num) {
  return this.words[0] & num;
};

// Increment at the bit position in-line
BN.prototype.binc = function binc(bit) {
  assert(typeof bit === 'number');
  var r = bit % 24;
  var s = (bit - r) / 24;
  var q = 1 << r;

  // Fast case: bit is much higher than all existing words
  if (this.length <= s) {
    for (var i = this.length; i < s + 1; i++)
      this.words[i] = 0;
    this.words[s] |= q;
    this.length = this.words.length;
    return this;
  }

  // Add bit and propagate, if needed
  var carry = q;
  for (var i = s; carry != 0; i++) {
    var w = i < this.length ? this.words[i] : 0;
    w += carry;
    carry = w >> 24;
    w &= 0xffffff;
    this.words[i] = w;
  }
  this.length = this.words.length;
  return this;
};

// Compare two numbers and return:
// 1 - if `this` > `num`
// 0 - if `this` == `num`
// -1 - if `this` < `num`
BN.prototype.cmp = function cmp(num, base) {
  // Fast number checks
  if (typeof num === 'number') {
    var sign = num < 0;
    if (sign)
      num = -num;
    num &= 0xffffff;
    this.strip();

    if (this.sign && !sign)
      return -1;
    else if (!this.sign && sign)
      return 1;

    var res;
    if (this.length > 1) {
      res = 1;
    } else {
      var w = this.words[0];
      res = w === num ? 0 : w < num ? -1 : 1;
    }
    if (this.sign)
      res = -res;
    return res;
  }

  if (!(num instanceof BN))
    num = new BN(num, base);

  this.strip();
  num.strip();

  if (this.sign && !num.sign)
    return -1;
  else if (!this.sign && num.sign)
    return 1;

  // At this point both numbers have the same sign
  if (this.length > num.length)
    return this.sign ? -1 : 1;
  else if (this.length < num.length)
    return this.sign ? 1 : -1;

  var res = 0;
  for (var i = this.length - 1; i >= 0; i--) {
    var a = this.words[i];
    var b = num.words[i];

    if (a === b)
      continue;
    if (a < b)
      res = -1;
    else if (a > b)
      res = 1;
    break;
  }
  if (this.sign)
    return -res;
  else
    return res;
};

BN.prototype.forceMont = function forceMont(ctx) {
  assert(!this.mont, 'Already a montgomery number');
  this.mont = ctx;
  return this;
};

BN.prototype.toMont = function toMont(ctx) {
  assert(!this.mont, 'Already a montgomery number');
  assert(!this.sign, 'mont works only with positives');
  var res = this.shl(ctx.shift).mod(ctx.m);
  res.mont = ctx;
  return res;
};

BN.prototype.fromMont = function fromMont() {
  assert(this.mont, 'fromMont works only with mont numbers');
  var ctx = this.mont;
  return this.mul(ctx.rinv).mod(ctx.m);
};

BN.prototype.montAdd = function montAdd(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base).toMont(this.mont);
  assert(!this.sign && !num.sign, 'mont works only with positives');
  assert(this.mont && this.mont === num.mont,
         'montAdd works only with mont numbers');

  var mont = this.mont;
  var res = this.add(num);
  if (res.cmp(mont.m) >= 0)
    res = res.sub(mont.m);
  res.mont = mont;
  return res;
};

BN.prototype.montSub = function montSub(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base).toMont(this.mont);
  assert(!this.sign && !num.sign, 'mont works only with positives');
  assert(this.mont && this.mont === num.mont,
         'montSub works only with mont numbers');

  var mont = this.mont;
  var res = this.sub(num);
  if (res.cmp(0) < 0)
    res = res.add(mont.m);

  res.mont = mont;
  return res;
};

BN.prototype.montShl = function montShl(num) {
  assert(!this.sign, 'mont works only with positives');
  assert(this.mont, 'montShl works only with mont numbers');

  var mont = this.mont;
  var res = this.shl(num).mod(mont.m);

  res.mont = mont;
  return res;
};

BN.prototype.montMul = function montMul(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base).toMont(this.mont);
  assert(!this.sign && !num.sign, 'mont works only with positives');
  assert(this.mont && this.mont === num.mont,
         'montMul works only with mont numbers');

  var mont = this.mont;
  var t = this.mul(num);
  var c = t.mul(mont.minv).imask(mont.shift).mul(mont.m);
  var u = t.sub(c).ishr(mont.shift);
  var res = u;
  if (u.cmp(mont.m) >= 0)
    res = u.sub(mont.m);
  else if (u.cmp(0) < 0)
    res = u.add(mont.m);

  res.mont = mont;
  return res;
};

BN.prototype.montSqr = function montSqr() {
  return this.montMul(this);
};

BN.prototype.montInvm = function montInvm() {
  assert(!this.sign, 'mont works only with positives');
  assert(this.mont, 'montInvm works only with mont numbers');
  // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
  var res = this.invm(this.mont.m).mul(this.mont.r2).mod(this.mont.m);
  res.mont = this.mont;
  return res;
};

// Return negative clone of `this` % `mont modulo`
BN.prototype.montNeg = function montNeg() {
  assert(!this.sign, 'mont works only with positives');
  assert(this.mont, 'montNeg works only with mont numbers');
  var r = this.clone();
  r.sign = !this.sign;
  r = r.add(this.mont.m);
  r.mont = this.mont;
  return r;
};

BN.mont = function mont(num, base) {
  return new Mont(num, base);
};

function Mont(num, base) {
  this.m = new BN(num, base);
  this.shift = this.m.bitLength();
  if (this.shift % 24 !== 0)
    this.shift += 24 - (this.shift % 24);
  this.r = new BN(1).ishl(this.shift);
  this.r2 = this.r.sqr().mod(this.m);
  this.rinv = this.r.invm(this.m);

  // TODO(indutny): simplify it
  this.minv = this.rinv.mul(this.r).sub(1).div(this.m).neg().mod(this.r);
}
