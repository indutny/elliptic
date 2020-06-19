var utils = require('./utils')

utils.resetCache()

if (process.env.USE_PRECOMPUTED === 'y') {
  utils.usePrecomputed()
}
