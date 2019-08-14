'use babel';

import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import Docker from 'dockerode';
import { Readable } from 'stream';

class FabricNetwork {
  constructor() {
    this.composeFile = path.join(__dirname, '../artifacts/docker-compose.yaml');
    this.chaincodeDir = path.join(__dirname, '../artifacts/chaincode');
    this.containerNames = [ 'orderer', 'peer', 'couchdb', 'cli', 'chaincode' ];
    this.docker = new Docker();

    shell.config.execPath = shell.which('node').stdout;
  }
  static checkEnv() {
    const node = shell.which('node');
    if (!node) {
      alert('Requires nodejs environment.\r\n\r\nInstalling:\r\n\r\nhttps://nodejs.org/en/download/package-manager');
      return false;
    }
    const docker = shell.which('docker');
    if (!docker) {
      alert('Requires docker environment.\r\n\r\nInstalling:\r\n\r\nhttps://docs.docker.com/install');
      return false;
    }
    const dockerCompose = shell.which('docker-compose');
    if (!dockerCompose) {
      alert('Requires docker compose environment.\r\n\r\nInstalling:\r\n\r\nhttps://docs.docker.com/compose/install');
      return false;
    }
    return true;
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
  exec(target, cmd, cb) {
    const containerId = shell.exec(
      `docker ps -a -f status=running -f name=${target} --format "{{.ID}}"`,
      { silent: true }
    ).stdout.trim();
    if (!containerId) {
      cb(`${target} container is not available.`);
      return;
    }
    const container = this.docker.getContainer(containerId);
    container.exec({ Cmd: ['/bin/bash'], AttachStdin: true, AttachStdout: true, AttachStderr: true }, (err, exec) => {
      if (err) {
        cb(err);
        return;
      }
      exec.start({ hijack: true, stdin: true }, (err, stream) => {
        if (err) {
          cb(err);
          return;
        }
        const stdin = new Readable();
        stdin.push(cmd);
        stdin.push(null);
        stdin.pipe(stream);

        stream.on('data', chunk => {
          cb(null, chunk.toString('utf8'));
        });
        stream.on('end', () => {
          cb(null, '');
        });
      });
    });
  }
}
module.exports = FabricNetwork;
