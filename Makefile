BROWSERIFY ?= ./node_modules/.bin/browserify

all: dist/elliptic.js

dist/elliptic.js: lib/elliptic.js
	$(BROWSERIFY) $< -o $@

.PHONY: all
