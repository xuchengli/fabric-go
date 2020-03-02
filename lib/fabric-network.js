'use babel';

import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import Docker from 'dockerode';
import { Readable } from 'stream';
import { wait } from './utils';

class FabricNetwork {
  constructor() {
    this.composeFile = path.join(__dirname, '../artifacts/docker-compose.yaml');
    this.chaincodeDir = path.join(__dirname, '../artifacts/chaincode');
    this.caDir = path.join(__dirname, '../artifacts/ca');
    this.caClientsDir = path.join(__dirname, '../artifacts/ca-clients');
    this.mspDir = path.join(__dirname, '../artifacts/msp');
    this.containerNames = [ 'ca', 'orderer', 'peer', 'couchdb', 'cli', 'chaincode', 'configtxlator' ];
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
    // 启动CA
    const ca = shell.exec(`docker-compose -f ${this.composeFile} up -d ca`, { silent: true });
    if (ca.code !== 0) {
      return ca.stderr;
    }
    await wait('http://localhost:7054/api/v1/cainfo');

    // 注册用户，生成pki
    const admin_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/admin';
    const admin_enroll_cmd = 'fabric-ca-client enroll -u http://admin:adminpw@localhost:7054';
    const register_user_cmd = 'fabric-ca-client register --id.name user1 --id.secret user1pw --id.type user --id.attrs app1Admin=true:ecert --id.attrs email=user1@gmail.com';

    const user_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/user';
    const user_enroll_cmd = 'fabric-ca-client enroll -u http://user1:user1pw@localhost:7054';

    const bootstrap = shell.exec(`docker exec ca /bin/bash -c "${admin_client_home} ${admin_enroll_cmd}"`, { silent: true });
    if (bootstrap.code !== 0) {
      return bootstrap.stderr;
    }
    await wait(path.join(this.caClientsDir, 'admin', 'msp', 'signcerts', 'cert.pem'));
    const register = shell.exec(`docker exec ca /bin/bash -c "${admin_client_home} ${register_user_cmd}"`, { silent: true });
    if (register.code !== 0) {
      return register.stderr;
    }
    const enroll = shell.exec(`docker exec ca /bin/bash -c "${user_client_home} ${user_enroll_cmd}"`, { silent: true });
    if (enroll.code !== 0) {
      return enroll.stderr;
    }
    await wait(path.join(this.caClientsDir, 'user', 'msp', 'signcerts', 'cert.pem'));

    // 生成msp
    if (!fs.existsSync(this.mspDir)) shell.mkdir('-p', this.mspDir);
    const userMSPDir = path.join(this.caClientsDir, 'user', 'msp');
    fs.readdir(userMSPDir, (err, files) => {
      files.forEach(file => {
        const filePath = path.join(userMSPDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          shell.cp('-R', filePath, this.mspDir);
        }
      });
    });
    // 在用户msp目录下添加admincerts的目录，并将管理员的证书拷贝过来
    const adminCertsDir = path.join(this.mspDir, 'admincerts');
    if (!fs.existsSync(adminCertsDir)) shell.mkdir('-p', adminCertsDir);
    shell.cp(path.join(this.caClientsDir, 'admin', 'msp', 'signcerts', 'cert.pem'), adminCertsDir);
    await wait([
      path.join(this.mspDir, 'admincerts', 'cert.pem'),
      path.join(this.mspDir, 'signcerts', 'cert.pem'),
    ]);

    // 启动Peer
    const peer = shell.exec(`docker-compose -f ${this.composeFile} up -d couchdb peer`, { silent: true });
    if (peer.code !== 0) {
      return peer.stderr;
    }

    // 启动configtxlator
    const configtxlator = shell.exec(`docker-compose -f ${this.composeFile} up -d configtxlator`, { silent: true });
    if (configtxlator.code !== 0) {
      return configtxlator.stderr;
    }

    return true;
  }
  async shutdown() {
    return new Promise((resolve, reject) => {
      shell.exec(`docker-compose -f ${this.composeFile} down`, { silent: true }, (code, stdout, stderr) => {
        if (code !== 0) {
          reject(stderr);
        }
        shell.rm('-rf', this.caDir);
        shell.rm('-rf', this.caClientsDir);
        shell.rm('-rf', this.mspDir);
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
    const dest = path.join(this.chaincodeDir, path.basename(source, '.go'));
    if (!fs.existsSync(dest)) shell.mkdir('-p', dest);
    shell.cp(source, path.join(dest, path.basename(source)));

    // 查询是否有索引或者vendor文件，如果有，拷贝所有的文件到指定目录
    const dir = path.dirname(source);
    fs.readdir(dir, (err, files) => {
      files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory() && (file === 'META-INF' || file === 'vendor')) {
          shell.cp('-R', filePath, dest);
        }
      });
    });
  }
  removeChainCode(name) {
    return shell.rm('-rf', path.join(this.chaincodeDir, name));
  }
  listChainCode() {
    if (fs.existsSync(this.chaincodeDir)) {
      return fs.readdirSync(this.chaincodeDir);
    } else {
      return [];
    }
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
