const waitOn = require('wait-on');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const yaml = require('js-yaml');

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

function removeSubDir(dir, exclude = []) {
  fs.readdir(dir, (err, files) => {
    files.forEach(file => {
      if (!exclude.includes(file)) {
        const filePath = path.join(dir, file);
        shell.rm('-rf', filePath);
      }
    });
  });
}

function buildMSPConfigYaml(targetPath, certificate) {
  const config = {
    NodeOUs: {
      Enable: true,
      ClientOUIdentifier: {
        Certificate: certificate,
        OrganizationalUnitIdentifier: 'client',
      },
      PeerOUIdentifier: {
        Certificate: certificate,
        OrganizationalUnitIdentifier: 'peer',
      },
      AdminOUIdentifier: {
        Certificate: certificate,
        OrganizationalUnitIdentifier: 'admin',
      },
      OrdererOUIdentifier: {
        Certificate: certificate,
        OrganizationalUnitIdentifier: 'orderer',
      },
    }
  };
  const yamlData = yaml.safeDump(config);
  fs.writeFileSync(path.join(targetPath, 'config.yaml'), yamlData);
  return yamlData;
}

function loadYaml(configYaml) {
  try {
    const doc = yaml.safeLoad(fs.readFileSync(configYaml, 'utf8'));
    return doc;
  } catch (err) {
    throw new Error(err);
  }
}

module.exports = { wait, removeSubDir, buildMSPConfigYaml, loadYaml };
