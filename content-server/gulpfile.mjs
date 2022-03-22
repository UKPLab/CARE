'use strict';

import fs from 'fs';
import gulp from 'gulp';
import changed from 'gulp-changed'
import glob from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
import webServer from './src/webserver/webServer.js';

import createBundle from './src/gulp/create-bundle.js';
import createStyleBundle from './src/gulp/create-style-bundles.js';
import vendorBundles from './src/gulp/vendor-bundles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BUILD_PATH = `${__dirname}/build/`;
const SRC_PATH = `${__dirname}/src/html/`;
const STYLE_DIR = path.join(BUILD_PATH, '/styles');
const SCRIPT_DIR = path.join(BUILD_PATH, '/scripts');
const IMAGES_DIR = path.join(BUILD_PATH, '/images');

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === 'production';

/** A list of all modules included in vendor bundles. */
const vendorModules = Object.keys(vendorBundles.bundles).reduce(function (
  deps,
  key
) {
  return deps.concat(vendorBundles.bundles[key]);
},
[]);

// Builds the bundles containing vendor JS code
gulp.task('build-vendor-js', function () {
  const finished = [];
  Object.keys(vendorBundles.bundles).forEach(function (name) {
    finished.push(
      createBundle({
        name: name,
        require: vendorBundles.bundles[name],
        minify: IS_PRODUCTION_BUILD,
        path: SCRIPT_DIR,
        noParse: vendorBundles.noParseModules,
      })
    );
  });
  return Promise.all(finished);
});

const appBundleBaseConfig = {
    path: SCRIPT_DIR,
    external: vendorModules,
    minify: IS_PRODUCTION_BUILD,
    noParse: vendorBundles.noParseModules,
};

const appBundles = [
    {
        // The landing page script
        name: 'landing',
        entry: './src/html/scripts/index',
        transforms: ['babel']
    },
    {
        //Annotate Script which loads pdf.js
        name: 'annotater',
        entry: './src/html/scripts/annotater',
        transforms: ['babel']
    }
];

const polyfillBundles= [];

const appBundleConfigs = appBundles.concat(polyfillBundles).map(config => {
  return Object.assign({}, appBundleBaseConfig, config);
});

gulp.task(
  'build-js',
  gulp.parallel('build-vendor-js', function () {
    return Promise.all(
      appBundleConfigs.map(function (config) {
        return createBundle(config);
      })
    );
  })
);

// Build images
const imageFiles = 'src/html/images/**/*';
gulp.task('build-images', function () {
  return gulp
    .src(imageFiles)
    .pipe(changed(IMAGES_DIR))
    .pipe(gulp.dest(IMAGES_DIR));
});

// Build CSS Files
gulp.task('build-css', function () {
    fs.mkdirSync(STYLE_DIR, { recursive: true });
    const css_files = glob.sync(path.join(SRC_PATH, '/**/*.scss'));
    const bundles = css_files.map(entry =>
    createStyleBundle({
      input: entry,
      output: `${STYLE_DIR}/${path.basename(entry, path.extname(entry))}.css`,
      minify: IS_PRODUCTION_BUILD,
    })
  );
  return Promise.all(bundles);
});

// Copy files from pdf.js
gulp.task('build-pdf.js', function(done) {
    const pdfjs_dir = path.join(SCRIPT_DIR, "/pdfjs")
    fs.mkdirSync(pdfjs_dir, {recursive: true})
    return gulp.src(['frameworks/pdf.js/build/generic/**/*'])
        .pipe(gulp.dest(pdfjs_dir))
});

// Webserver
gulp.task("start-web-server", function() {
    webServer({
        page:{
            title:"PEER",
            subtitle:"Annotation-powered peer review"},
        port:3001}
    );
});

// Build content server
gulp.task("build-all", gulp.parallel(['build-images', 'build-css', 'build-js', 'build-pdf.js']))
gulp.task('build', gulp.series(['build-all'], ['start-web-server']))