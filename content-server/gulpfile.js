'use strict';

const gulp = require('gulp');
const webServer = require('./src/webserver/webServer');


gulp.task('buildServer', function(done) {
    done();
})

gulp.task("startWebServer", function() {
    webServer(3000);
});

// Build content server
gulp.task('build', gulp.series(['buildServer'], ['startWebServer']))