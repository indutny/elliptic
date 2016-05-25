module.exports = function(grunt) {
  grunt.initConfig({
    browserify: {
      unittests: {
        files: {
          'test/lib/unittests-bundle.js': [ 'test/index.js']
        },
        options: {
          transform: ['brfs']
        }
      },
      dist: {
        files: {
          'dist/elliptic.js': [ 'lib/elliptic.js' ]
        },
        options: {
          browserifyOptions: {
            standalone: 'elliptic'
          }
        }
      }
    },
    connect: {
      server: {
        options: {
          port: 3000,
          base: './test'
        }
      }
    },
    copy: {
      test: {
        expand: true,
        flatten: true,
        cwd: 'node_modules/',
        src: ['mocha/mocha.css', 'mocha/mocha.js'],
        dest: 'test/lib/'
      }
    },
    mocha_istanbul: {
      coverage: {
        src: ['test'],
        options: {
          coverage: false,
          timeout: 6000,
          reportFormats: ['cobertura','lcovonly']
        }
      },
      coveralls: {
        src: ['test'],
        options: {
          coverage: true,
          timeout: 6000,
          reportFormats: ['cobertura','lcovonly']
        }
      }
    },
    'saucelabs-mocha': {
      all: {
        options: {
          username: process.env.SAUCE_USERNAME,
          key: process.env.SAUCE_ACCESS_KEY,
          urls: ['http://127.0.0.1:3000/unittests.html'],
          build: process.env.TRAVIS_JOB_ID,
          testname: 'Sauce Unit Test for ellipticjs',
          browsers: [
            {
              browserName: "safari",
              platform: "OS X 10.11",
              version: "9"
            },
            {
              browserName: "safari",
              platform: "OS X 10.10",
              version: "8"
            },
            {
              browserName: "microsoftedge",
              version: "13.10586",
              platform: "Windows 10"
            },
            {
              browserName: "internet explorer",
              version: "11",
              platform: "Windows 8.1"
            },
            {
              browserName: "internet explorer",
              version: "10",
              platform: "Windows 8"
            },
            {
              browserName: "internet explorer",
              version: "9",
              platform: "Windows 7"
            },
            {
              browserName: "internet explorer",
              version: "8",
              platform: "Windows 7"
            },
            {
              browserName: "android",
              platform: "Linux",
              version: "5.1"
            },
            {
              browserName: "android",
              platform: "Linux",
              version: "4.4"
            },
            {
              browserName: "iphone",
              platform: "OS X 10.10",
              version: "7.1"
            },
            {
              browserName: "iphone",
              platform: "OS X 10.10",
              version: "9.2"
            },
            {
              browserName: "chrome",
              platform: "Linux",
              version: "38"
            },
            {
              browserName: "chrome",
              platform: "Linux",
              version: "47"
            },
            {
              browserName: "chrome",
              platform: "Linux",
              version: "beta"
            },
            {
              browserName: "firefox",
              platform: "Linux",
              version: "38"
            },
            {
              browserName: "firefox",
              platform: "Linux",
              version: "43"
            },
            {
              browserName: "firefox",
              platform: "Linux",
              version: "beta"
            }
          ],
          public: "public",
          maxRetries: 3,
          throttled: 2,
          pollInterval: 4000,
          statusCheckAttempts: 200
        }
      },
    },
    uglify: {
      dist: {
        files: {
          'dist/elliptic.min.js' : [ 'dist/elliptic.js' ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mocha-istanbul');
  grunt.loadNpmTasks('grunt-saucelabs');

  grunt.event.on('coverage', function(lcov, done){
    require('coveralls').handleInput(lcov, function(err){
      if (err) {
        return done(err);
      }
      done();
    });
  });

  grunt.registerTask('dist', ['browserify', 'uglify']);
  grunt.registerTask('coverage', ['browserify', 'copy:test', 'mocha_istanbul:coverage']);
  grunt.registerTask('coveralls', ['browserify', 'copy:test', 'mocha_istanbul:coveralls']);
  grunt.registerTask('saucelabs', ['browserify', 'copy:test', 'connect', 'saucelabs-mocha']);
};
