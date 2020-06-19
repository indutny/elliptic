
module.exports = {
  resetCache: resetCache,
  usePrecomputed: usePrecomputed
}

function resetCache() {
  var cache = require.cache;
  for (var moduleId in cache) {
    delete cache[moduleId];
  }
}

function usePrecomputed() {
  console.log('USING PRECOMPUTED CURVES')
  const elliptic = require('..');
  elliptic.usePrecomputed({
    p192: require('../lib/elliptic/precomputed/p192'),
    p224: require('../lib/elliptic/precomputed/p224'),
    p256: require('../lib/elliptic/precomputed/p256'),
    p384: require('../lib/elliptic/precomputed/p384'),
    p521: require('../lib/elliptic/precomputed/p521')
  });
}
