'use strict';
const sysPath = require('../path');
const fs = require('fs');
const rimraf = require('rimraf');
const promisify = require('micro-promisify');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const rmrf = promisify(rimraf);

const TRACE_FILE = '.brunch-output';

const generateOutputTrace = (files, fileList, config) => {
  const staticFiles = Array.from(fileList.staticFiles.values()).filter(f => !f.removed);
  const assets = fileList.assets;

  const staticOuts = staticFiles.map(stFile => {
    return { type: 'compiled-asset', path: stFile.destinationPath };
  });

  const assetOuts = assets.map(asset => {
    return { type: 'asset', path: asset.destinationPath };
  });

  const joinOuts = files.map(file => {
    return [
      { type: file.type, path: file.path },
      { type: file.type + '-map', path: file.path + '.map' }
    ];
  }).reduce((all, xs) => all.concat(xs), []);

  return joinOuts.concat(staticOuts).concat(assetOuts).reduce((output, out) => {
    const type = out.type + 's';
    const path = sysPath.relative(config.paths.public, out.path);
    if (!output[type]) output[type] = [];
    output[type].push(path);
    return output;
  }, {});
};

const readPreviousTrace = () => {
  return readFile(TRACE_FILE).then(raw => {
    return JSON.parse(raw);
  }, () => {
    return {};
  });
};

const _writeTrace = (trace) => {
  return writeFile(TRACE_FILE, JSON.stringify(trace));
};

const removeFiles = (config, leftoverFiles) => {
  const publicPath = config.paths.public;

  const filesToRemove = Object.keys(leftoverFiles).map(type => {
    return leftoverFiles[type];
  }).reduce((acc, xs) => acc.concat(xs), []);

  const promises = filesToRemove.map(file => {
    const fullPath = sysPath.join(publicPath, file);
    return unlink(fullPath).then(null, () => true);
  });

  return Promise.all(promises);
};

const isArray = x => Object.prototype.toString.call(x) === '[object Array]';

// executed after the build
const writeTrace = (files, fileList, config) => {
  const mode = config.clean;

  if (mode === 'brunch-files' || isArray(mode)) {
    const outputTrace = generateOutputTrace(files, fileList, config);
    return _writeTrace(outputTrace);
  }
};

// executed before the build
const clean = (config) => {
  const mode = config.clean;

  if (mode === 'brunch-files' || isArray(mode)) {
    return readPreviousTrace().then(previousTrace => removeFiles(config, previousTrace));
  } else if (mode === 'all') {
    const isRootInPublic = sysPath.relative(process.cwd(), config.paths.public).slice(0, 2) === '..';
    let glob = config.paths.public;
    if (isRootInPublic) {
      const rootRelToPublic = sysPath.relative(config.paths.public, process.cwd());
      glob = glob + `/!(${rootRelToPublic})`;
    }
    return rmrf(glob);
  } else {
    // 'none' - do nothing
    return Promise.resolve();
  }
};

module.exports = {writeTrace, clean};
