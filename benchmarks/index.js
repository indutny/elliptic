var assert = require('assert');
var benchmark = require('benchmark');
var hash = require('hash.js');
var elliptic = require('../');
var eccjs = require('eccjs');

var benchmarks = [];
var maxTime = 10;

function add(op, a, b, c) {
  benchmarks.push({
    name: op,
    start: function start() {
      var suite = new benchmark.Suite;

      console.log('Benchmarking: ' + op);
      if (a)
        suite.add('elliptic#' + op, a, { maxTime: maxTime })
      if (b)
        suite.add('eccjs#' + op, b, { maxTime: maxTime })

      suite
        .on('cycle', function(event) {
          console.log(String(event.target));
        })
        .on('complete', function() {
          console.log('------------------------');
          console.log('Fastest is ' + this.filter('fastest').pluck('name'));
        })
        .run();
      console.log('========================');
    }
  });
}

function start() {
  var re = process.argv[2] ? new RegExp(process.argv[2], 'i') : /./;

  benchmarks.filter(function(b) {
    return re.test(b.name);
  }).forEach(function(b) {
    b.start();
  });
}

var str = 'big benchmark against elliptic';

var m1 = hash.sha256().update(str).digest();
var c1 = elliptic.ec(elliptic.curves.secp256k1);
var k1 = c1.genKeyPair();
var s1 = c1.sign(m1, k1);
assert(c1.verify(m1, s1, k1));

var m2 = eccjs.sjcl.hash.sha256.hash('big benchmark against elliptic');
var c2 = eccjs.sjcl.ecc.curves.k256;
var k2 = eccjs.sjcl.ecc.ecdsa.generateKeys(c2, 0);
var s2 = k2.sec.sign(m2, 0);
assert(k2.pub.verify(m2, s2));

add('sign', function() {
  c1.sign(m1, k1);
}, function() {
  k2.sec.sign(m2, 0);
});

add('verify', function() {
  c1.verify(m1, s1, k1);
}, function() {
  k2.pub.verify(m2, s2);
});

add('gen', function() {
  c1.genKeyPair().getPublic();
}, function() {
  eccjs.sjcl.ecc.ecdsa.generateKeys(c2, 0);
});

add('ecdh', function() {
  c1.genKeyPair().derive(k1.getPublic());
});

start();
