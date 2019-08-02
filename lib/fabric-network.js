'use babel';

import shell from 'shelljs';
import fs from 'fs';
import path from 'path';

class FabricNetwork {
  constructor() {
    this.composeFile = path.join(__dirname, '../artifacts/docker-compose.yaml');
    this.chaincodeDir = path.join(__dirname, '../artifacts/chaincode');
    this.containerNames = [ 'orderer', 'peer', 'couchdb', 'cli', 'chaincode' ];
  }
  async waitFor(sec) {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(true), sec);
    });
  }
  async startup() {
    return new Promise((resolve, reject) => {
      shell.exec(`docker-compose -f ${this.composeFile} up -d`, { silent: true }, (code, stdout, stderr) => {
        if (code !== 0) {
          reject(stderr);
        }
        resolve(stdout.trim());
      });
    });
  }
  async shutdown() {
    return new Promise((resolve, reject) => {
      shell.exec(`docker-compose -f ${this.composeFile} down`, { silent: true }, (code, stdout, stderr) => {
        if (code !== 0) {
          reject(stderr);
        }
        resolve(stdout.trim());
      });
    });
  }
  async isAvailable() {
    return new Promise((resolve, reject) => {
      const filter = this.containerNames.map(name => `-f name=${name}`);
      shell.exec(`docker ps -a -f status=running ${filter.join(' ')} --format "{{.Names}}"`,
        { silent: true },
        (code, stdout, stderr) => {
          if (code !== 0) {
            reject(stderr);
          }
          const containers = stdout.trim().split('\n');
          const exitedContainers = this.containerNames.filter(name => !containers.includes(name));
          if (exitedContainers.length > 0) {
            reject(`${exitedContainers} is not available.`);
          }
          resolve(true);
        }
      );
    });
  }
  copyChainCode(source) {
    const dest = `${this.chaincodeDir}/${path.basename(source, '.go')}`;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);

    return shell.cp(source, `${dest}/${path.basename(source)}`);
  }
  removeChainCode(name) {
    return shell.rm('-rf', `${this.chaincodeDir}/${name}`);
  }
  listChainCode() {
    return fs.readdirSync(this.chaincodeDir);
  }
}
module.exports = FabricNetwork;
