'use strict';

const fs = require('fs');
const glob = require('glob');
const mkdirp = require('mkdirp');
const autoprefixer = require('autoprefixer');
const postcss = require('postcss');
const CleanCSS = require('clean-css');

const outputDir = 'dist';
const globOptions = {
    ignore: [
        'build-scripts/**/*',
        'dist/**/*',
        'node_modules/**/*',
        'scripts/**/*'
    ]
};
const files = glob.sync('**/assets/**/css/**/*.css', globOptions);

function writeFileSync(path, contents) {
    const dir = path.substring(0, path.lastIndexOf('/'));
    mkdirp.sync(dir);
    fs.writeFileSync(path, contents);
}

for (var i = 0; i < files.length; ++i) {
    const file = files[i];
    const cssIn = fs.readFileSync(file);

    postcss([autoprefixer]).process(cssIn).then((result) => {
        result.warnings().forEach((warn) => {
            console.warn(warn.toString());
        });

        const cssOut = new CleanCSS().minify(result.css).styles;
        writeFileSync([outputDir, file].join('/'), cssOut);
    });
}
