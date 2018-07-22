'use strict';

const fs = require('fs');
const glob = require('glob');
const mkdirp = require('mkdirp');
const sass = require('node-sass');
const autoprefixer = require('autoprefixer');
const postcss = require('postcss');
const CleanCSS = require('clean-css');
const rimraf = require('rimraf');

const outputDir = 'dist';
const globOptions = {
    ignore: [
        'build-scripts/**/*',
        'dist/**/*',
        'node_modules/**/*',
        'scripts/**/*'
    ]
};
const files = glob.sync('**/assets/**/{sass,scss}/**/!(_)*.{sass,scss}', globOptions);
var intermediateFiles = [];

function writeFileSync(path, contents) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    mkdirp.sync(dir);
    fs.writeFileSync(path, contents);
}

for (var i = 0; i < files.length; ++i) {
    var file = files[i];
    const result = sass.renderSync({
        file: file
    });

    file = file.replace(/(sass|scss)/g, 'css');
    writeFileSync(file, result.css);
    intermediateFiles.push(file);
}

for (var i = 0; i < intermediateFiles.length; ++i) {
    const file = intermediateFiles[i];
    const cssIn = fs.readFileSync(file);

    postcss([autoprefixer]).process(cssIn).then((result) => {
        result.warnings().forEach((warn) => {
            console.warn(warn.toString());
        });

        const cssOut = new CleanCSS().minify(result.css).styles;
        writeFileSync([outputDir, file].join('/'), cssOut);
    });

    rimraf.sync(file);
}
