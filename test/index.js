/* eslint-env node, mocha */
'use strict';

describe('Test specs', function () {
  require('./api-test.js');
  require('./curve-test.js');
  require('./ecdh-test.js');
  require('./ecdsa-test.js');
  require('./cve-2025-14505-test.js');
  require('./ed25519-test.js');
});
