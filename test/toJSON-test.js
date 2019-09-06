'use strict';

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var elliptic = require('../lib/elliptic');
var curves = elliptic.curves;
var compare = assert.deepStrictEqual || assert.deepEqual;

function exportPoint (p) {
  return JSON.parse(JSON.stringify(p.toJSON()));
}

describe('toJSON <-> pointFromJSON symmetry', function() {
  it('toJSON matches pointFromJSON', function () {
    for (var key in curves) {
      if (key === 'PresetCurve') continue;

      var curve = curves[key];
      if (!curve.g.toJSON) continue;

      var exported = exportPoint(curve.g);
      var reimported = curve.curve.pointFromJSON(exported);
      var reexported = exportPoint(reimported);
      compare(exported, reexported, 'toJSON is the inverse of pointFromJSON');
    }
  });
})
