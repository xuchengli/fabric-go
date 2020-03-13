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

function buildMSPConfigYaml(targetPath) {
  const config = {
    NodeOUs: {
      Enable: true,
      ClientOUIdentifier: {
        Certificate: 'cacerts/localhost-7054.pem',
        OrganizationalUnitIdentifier: 'client',
      },
      PeerOUIdentifier: {
        Certificate: 'cacerts/localhost-7054.pem',
        OrganizationalUnitIdentifier: 'peer',
      },
      AdminOUIdentifier: {
        Certificate: 'cacerts/localhost-7054.pem',
        OrganizationalUnitIdentifier: 'admin',
      },
      OrdererOUIdentifier: {
        Certificate: 'cacerts/localhost-7054.pem',
        OrganizationalUnitIdentifier: 'orderer',
      },
    }
  };
  const yamlData = yaml.safeDump(config);
  fs.writeFileSync(path.join(targetPath, 'config.yaml'), yamlData);
  return yamlData;
}

module.exports = { wait, removeSubDir, buildMSPConfigYaml };
