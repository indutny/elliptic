module.exports = {
  "env": {
    "node": true,
    "es6": true
  },
  "extends": [
    "eslint:recommended",
  ],
  "globals": {
    "Atomics": "readonly",
    "SharedArrayBuffer": "readonly",
    "BigInt": "readonly",
  },
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "indent": [
      "error",
      2
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "array-bracket-spacing": [ "error", "always" ],
    "brace-style": [ "error" ],
    "camelcase": [ "error" ],
    "comma-spacing": [ "error" ],
    "comma-style": [ "error" ],
    "eol-last": [ "error" ],
    "func-call-spacing": [ "error" ],
    "func-name-matching": [ "error" ],
    "no-multiple-empty-lines": [ "error" ],
    "no-tabs": [ "error" ],
    "no-trailing-spaces": [ "error" ],
    "no-whitespace-before-property": [ "error" ],
    "object-curly-newline": [ "error" ],
    "object-curly-spacing": [ "error", "always" ],
    "padded-blocks": [ "error", "never" ],
    "quotes": [ "error", "single", { "avoidEscape": true } ],
    "semi-spacing": [ "error" ],
    "semi-style": [ "error" ],
    "space-before-blocks": [ "error" ],
    "space-in-parens": [ "error" ],
    "space-infix-ops": [ "error" ],
    "space-unary-ops": [ "error" ],
    "switch-colon-spacing": [ "error" ],
    "comma-dangle": [ "error", "always-multiline" ],
  },
  "settings": {
    "react": {
      "version": "detect",
    },
  }
};
