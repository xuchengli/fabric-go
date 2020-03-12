const waitOn = require('wait-on');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');

async function wait(resources) {
  const options = {
    resources: [].concat(resources),
    delay: 1000,
    interval: 1000,
    log: true,
    timeout: 30000,
  };
  try {
    await waitOn(options);
  } catch (err) {
    throw new Error(err);
  }
}

function removeSubDir(dir) {
  fs.readdir(dir, (err, files) => {
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        shell.rm('-rf', filePath);
      }
    });
  });
}

module.exports = { wait, removeSubDir };
