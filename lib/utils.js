const waitOn = require('wait-on');
const request = require('request');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const shell = require('shelljs');

function postFormRequest(url, formData) {
  return new Promise((resolve, reject) => {
    request({
      url: url,
      method: 'POST',
      encoding: null,
      headers: {
        accept: '/',
        expect: '100-continue'
      },
      formData: formData
    }, (err, res, body) => {
      if (!err && res.statusCode === 200) {
        resolve(Buffer.from(body, 'binary'));
      } else if (err) {
        reject(err);
      } else {
        reject(res);
      }
    });
  });
}

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

async function zipDirectoryFiles(dirName) {
  return new Promise((resolve, reject) => {
    const archiveFileName = `${dirName}.zip`;
    const output = fs.createWriteStream(archiveFileName);
    const archive = archiver('zip', {
      zlib: {level: 9}
    });
    archive.pipe(output);
    archive.directory(dirName, false);
    output.on('close', () => {
      resolve(archiveFileName);
    });
    archive.on('error', err => {
      reject(err);
    });
    archive.finalize();
  });
}

async function upload(destination, archive) {
  const formData = {
    destination: destination,
    msp: {
      value: fs.createReadStream(archive),
      options: {
        contentType: 'multipart/form-data'
      }
    }
  };
  return await postFormRequest('http://localhost:7059/configtxlator/upload', formData);
}

async function outputGenesisBlock(profile, channelID, configtx, configPath, outputBlock) {
  const formData = {
    'profile': profile,
    'channelID': channelID,
    'configtx': configtx,
    'configPath': configPath,
    'outputBlock': outputBlock
  };
  return await postFormRequest('http://localhost:7059/configtxgen/genesis-block', formData);
}

async function outputChannelCreateTx(profile, channelID, configtx, configPath, outputCreateChannelTx) {
  const formData = {
    'profile': profile,
    'channelID': channelID,
    'configtx': configtx,
    'configPath': configPath,
    'outputCreateChannelTx': outputCreateChannelTx
  };
  return await postFormRequest('http://localhost:7059/configtxgen/channel-create-tx', formData);
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

module.exports = { wait, zipDirectoryFiles, upload, outputGenesisBlock, outputChannelCreateTx, removeSubDir };
