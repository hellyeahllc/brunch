const sysPath = require('../path');
const fs = require('fs');

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
  }).reduce((all, xs) => all.concat(xs));

  return joinOuts.concat(staticOuts).concat(assetOuts).reduce((output, out) => {
    const type = out.type + 's';
    const path = sysPath.relative(config.paths.public, out.path);
    if (!output[type]) output[type] = [];
    output[type].push(path);
    return output;
  }, {});
};

const readPreviousTrace = () => {
  try {
    const raw = fs.readFileSync(TRACE_FILE);
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
};

const diffTraces = (prevTrace, trace) => {
  return Object.keys(prevTrace).reduce((diff, type) => {
    const prevItems = prevTrace[type];
    const currItems = trace[type] || [];
    diff[type] = arrayMinus(prevItems, currItems);
    return diff;
  }, {});
};

const removeNotNeededPublicFiles = (trace, config) => {
  const previousTrace = readPreviousTrace();
  const publicPath = config.paths.public;
  const leftoverFiles = diffTraces(previousTrace, trace);

  Object.keys(leftoverFiles).forEach(type => {
    leftoverFiles[type].forEach(file => {
      const fullPath = sysPath.join(publicPath, file);
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        // no-op
      }
    });
  });

  fs.writeFileSync(TRACE_FILE, JSON.stringify(trace));
};

const processTrace = (files, fileList, config) => {
  const outputTrace = generateOutputTrace(files, fileList, config);
  removeNotNeededPublicFiles(outputTrace, config);
};

module.exports = processTrace;
