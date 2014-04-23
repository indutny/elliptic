var assert = require('assert');

function BN(number, base) {
  if (number instanceof BN)
    return number;

  if (!(this instanceof BN))
    return new BN(number, base);

  this.sign = false;
  this.words = [];
  this.length = 0;
  this.init(number || 0, base || 10);
}
module.exports = BN;

BN.prototype.init = function init(number, base) {
  if (typeof number === 'number') {
    if (number < 0) {
      this.sign = true;
      number = -number;
    }
    this.words.push(number & 0xffff);
    this.length = 1;
    return;
  }
  assert(base <= 16);

  number = number.toString().replace(/\s+/g, '');
  var start = 0;
  if (number[0] === '-')
    start++;

  // Initialize as zero
  this.words.push(0);
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

    if (q > 0xfff) {
      assert(q <= 0xffff);
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
};

BN.prototype.clone = function clone() {
  var r = new BN();
  this.copy(r);
  return r;
};

BN.prototype.strip = function strip() {
  while (this.words.length > 1 && this.words[this.words.length - 1] === 0)
    this.words.pop();
  this.length = this.words.length;
  // -0 = 0
  if (this.length === 1 && this.words[0] === 0)
    this.sign = false;
  return this;
};

function zero4(word) {
  if (word.length === 3)
    return '0' + word;
  else if (word.length === 2)
    return '00' + word;
  else if (word.length === 1)
    return '000' + word;
  else
    return word;
}

BN.prototype.toString = function toString(base) {
  base = base || 10;
  if (base === 16) {
    var out = this.sign ? '-' : '';
    for (var i = this.length - 1; i >= 0; i--) {
      var word = this.words[i].toString(16);
      if (i !== this.length - 1)
        out += zero4(word);
      else
        out += word;
    }
    return out;
  } else if (base === 10) {
    var out = '';
    var c = this.clone();
    c.sign = false;
    while (c.cmp(0) !== 0) {
      var r = c.mod(10000);
      c = c.div(10000);
      assert.equal(r.length, 1);
      if (c.cmp(0) !== 0)
        out = zero4(r.words[0] + '') + out;
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

BN.prototype.neg = function neg() {
  var r = this.clone();
  r.sign = !this.sign;
  return r;
};

BN.prototype.add = function add(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (num.sign && !this.sign)
    return this.sub(num.neg());
  else if (!num.sign && this.sign)
    return num.sub(this.neg());

  var max = Math.max(num.length, this.length);
  var min = Math.min(num.length, this.length);
  var result = new BN(0);
  result.sign = num.sign;
  result.length = max;

  var carry = 0;
  for (var i = 0; i < max; i++) {
    var a = i < this.length ? this.words[i] : 0;
    var b = i < num.length ? num.words[i] : 0;

    var r = a + b + carry;
    result.words[i] = r & 0xffff;
    carry = r >> 16;
  }
  if (carry) {
    result.words.push(carry);
    result.length++;
  }

  return result;
};

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
  var result = new BN();
  var carry = 0;
  for (var i = 0; i < this.length; i++) {
    var a = this.words[i];
    var b = i < num.length ? num.words[i] : 0;
    var r = a - b - carry;
    if (r < 0) {
      r += 0x10000;
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
        result.words.push(this.words[i]);
      break;
    }
  }
  result.length = result.words.length;

  return result.strip();
};

BN.prototype.mul = function mul(num, base) {
  if (!(num instanceof BN))
    num = new BN(num, base);

  if (this === num)
    return this.sqr();

  var result = new BN(0);
  result.sign = ((num.sign ? 1 : 0) ^ (this.sign ? 1 : 0)) ? true : false;
  for (var i = 0; i < this.length; i++) {
    var a = this.words[i];
    for (var j = 0; j < num.length; j++) {
      var b = num.words[j];
      var r = a * b;
      var k = i + j;

      var lo = r & 0xffff;
      var carry = (r - lo) / 0x10000;
      if (result.words[k]) {
        lo = result.words[k] + lo;
        result.words[k] = lo & 0xffff;
        carry += lo >> 16;
      } else {
        result.words[k] = lo;
      }

      // Apply carry
      k++;
      assert(carry <= 0xffff);
      for (; carry !== 0; k++) {
        if (result.words[k]) {
          carry = result.words[k] + carry;
          result.words[k] = carry & 0xffff;
          carry >>= 16;
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

BN.prototype.sqr = function sqr() {
  var res = new BN(0);
  var r0 = 0, r1 = 0, r2 = 0;
  for (var k = 0; k < 2 * this.length - 1; k++) {
    for (var i = 0; i <= k >> 1; i++) {
      var j = k - i;
      var a = this.words[i];
      var b = this.words[j];
      var uv = a * b;
      var v = uv & 0xffff;
      var u = (uv - v) / 0x10000;
      if (i < j) {
        u <<= 1;
        r2 += u >> 16;
        v <<= 1;
        u |= v >> 16;
        u &= 0xffff;
        v &= 0xffff;
      }
      r0 += v;
      r1 += u + (r0 >> 16);
      r2 += r1 >> 16;
      r0 &= 0xffff;
      r1 &= 0xffff;
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

BN.prototype.shl = function shl(bits) {
  var result = this.clone();
  var r = bits % 16;
  var s = bits >> 4;

  if (r !== 0) {
    var carry = 0;
    for (var i = 0; i < result.length; i++) {
      var c = result.words[i] << r;
      result.words[i] = (c & 0xffff) | carry;
      carry = c >> 16;
    }
    if (carry) {
      result.words[i] = carry;
      result.length++;
    }
  }

  if (s !== 0) {
    var prep = [];
    for (var i = 0; i < s; i++)
      prep.push(0);
    result.words = prep.concat(result.words);
    result.length = result.words.length;
  }

  return result;
};

BN.prototype.shr = function shr(bits) {
  var result = this.clone();
  var r = bits % 16;
  var s = bits >> 4;

  var mask = 0xffff ^ ((0xffff >> r) << r);

  if (r !== 0) {
    var carry = 0;
    for (var i = result.length - 1; i >= 0; i--) {
      var word = result.words[i];
      result.words[i] = (carry << (16 - r)) | (result.words[i] >> r);
      carry = word & mask;
    }
  }

  if (s !== 0) {
    for (var i = 0; i < s; i++)
      result.words.shift();
    result.length = result.words.length;
  }

  if (result.length === 0) {
    result.words = [ 0 ];
    result.length = 1;
  }

  return result.strip();
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
  var shift = (this.length - num.length) * 16 + 17;
  var q = new BN(1).shl(shift);
  var max = num.shl(shift);
  while (this.cmp(max) < 0) {
    q = q.shr(1);
    max = max.shr(1);
    shift--;
  }

  var c = this;
  var r = new BN(0);
  while (c.cmp(num) >= 0) {
    assert(shift >= 0);
    while (c.cmp(max) >= 0) {
      c = c.sub(max);
      r = r.add(q);
    }
    q = q.shr(1);
    max = max.shr(1);
    shift--;
  }
  return { mod: c, div: r };
};

BN.prototype.div = function div(num, base) {
  return this._div(num, base).div;
};

BN.prototype.mod = function mod(num, base) {
  return this._div(num, base).mod;
};

BN.prototype.divm = function divm(num0, base0, num1, base1) {
  if (typeof base0 !== 'number') {
    var x1 = new BN(num0);
    var p = new BN(base0, num1);
  } else {
    var x1 = new BN(num0, base0);
    var p = new BN(num1, base1);
  }

  assert(!p.sign && p.isOdd());

  var a = this;
  var b = p;

  if (a.sign)
    a = a.mod(p);

  var x2 = new BN(0);
  while (a.cmp(1) !== 0 && b.cmp(1) !== 0) {
    while (a.isEven()) {
      a = a.shr(1);
      if (x1.isEven())
        x1 = x1.shr(1);
      else
        x1 = x1.add(p).shr(1);
    }
    while (b.isEven()) {
      b = b.shr(1);
      if (x2.isEven())
        x2 = x2.shr(1);
      else
        x2 = x2.add(p).shr(1);
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

BN.prototype.invm = function invm(num, base) {
  return this.divm(1, num, base);
};

BN.prototype.isEven = function isEven(num) {
  return (this.words[0] & 1) === 0;
};

BN.prototype.isOdd = function isOdd(num) {
  return (this.words[0] & 1) === 1;
};

BN.prototype.cmp = function cmp(num, base) {
  // Fast number checks
  if (typeof num === 'number') {
    var sign = num < 0;
    if (sign)
      num = -num;
    num &= 0xffff;
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
