
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var elliptic = require('..');

describe('validate preset curves', function() {
  it('validates preset curves', function () {
    var curves = elliptic.curves;

    for (var key in curves) {
      if (key !== 'PresetCurve') {
        console.log(`validating preset curve ${key}`)
        curves[key].validate();
      }
    }
  });
});
