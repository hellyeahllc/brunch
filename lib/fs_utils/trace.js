'use strict';
const sysPath = require('../path');
const fs = require('fs');
const promisify = require('micro-promisify');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const TRACE_FILE = '.brunch-output';

const arrayMinus = (a, b) => {
  const setA = new Set(a);
  const setB = new Set(b);
  return Array.from(setA).filter(x => !setB.has(x));
};

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

const writeTrace = (trace) => {
  return writeFile(TRACE_FILE, JSON.stringify(trace));
};

const diffTraces = (prevTrace, trace, sourceMaps) => {
  return Object.keys(prevTrace).reduce((diff, type) => {
    const prevItems = prevTrace[type];
    const currItems = trace[type] || [];
    if (!sourceMaps && type.indexOf('-maps') !== -1) {
      diff[type] = prevItems;
    } else {
      diff[type] = arrayMinus(prevItems, currItems);
    }
    return diff;
  }, {});
};

const removeNotNeededPublicFiles = (trace, config, leftoverFiles) => {
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

const processTrace = (files, fileList, config) => {
  const mode = 'brunch-files';

  if (mode === 'brunch-files' || isArray(mode)) {
    const outputTrace = generateOutputTrace(files, fileList, config);
    return readPreviousTrace().then(previousTrace => {
      const leftoverFiles = diffTraces(previousTrace, outputTrace, config.sourceMaps, isArray(mode) ? mode : null);
      return removeNotNeededPublicFiles(outputTrace, config, leftoverFiles);
    }).then(() => {
      return writeTrace(outputTrace);
    });
  } else if (mode === 'all') {
    // TODO
  } else {
    // 'none' - do nothing
  }
};

module.exports = processTrace;
