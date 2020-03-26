'use babel';

import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import Docker from 'dockerode';
import { Readable } from 'stream';
import { wait, removeSubDir, buildMSPConfigYaml, loadYaml } from './utils';

class FabricNetwork {
  constructor() {
    this.artifacts = path.join(__dirname, '../artifacts');
    this.composeFile = path.join(this.artifacts, 'docker-compose.yaml');
    this.chaincodeDir = path.join(this.artifacts, 'chaincode');
    this.caDir = path.join(this.artifacts, 'ca');
    this.caClientsDir = path.join(this.artifacts, 'ca-clients');
    this.configtxFile = path.join(this.artifacts, 'configtx.yaml');
    this.genesisBlock = path.join(this.artifacts, 'genesis.block');
    this.channelTx = path.join(this.artifacts, 'mychannel.tx');
    this.mychannelBlock = path.join(this.artifacts, 'mychannel.block');
    this.configtxgen = path.join(this.artifacts, 'bin/configtxgen');

    this.containerNames = [ 'ca', 'orderer',
      'peer0.zhigui.com', 'couchdb0', 'peer1.zhigui.com', 'couchdb1',
      'peer0.ibm.com', 'couchdb2', 'peer1.ibm.com', 'couchdb3',
      'cli', 'chaincode' ];
    this.docker = new Docker();

    shell.config.execPath = shell.which('node').stdout;

    this.caServerConfig = loadYaml(path.join(this.caDir, 'fabric-ca-server-config.yaml'));
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
  clean() {
    if (fs.existsSync(this.caDir)) removeSubDir(this.caDir, ['fabric-ca-server-config.yaml', 'fabric-ca-client-config.yaml']);
    if (fs.existsSync(this.caClientsDir)) shell.rm('-rf', this.caClientsDir);
    if (fs.existsSync(this.genesisBlock)) shell.rm(this.genesisBlock);
    if (fs.existsSync(this.channelTx)) shell.rm(this.channelTx);
    if (fs.existsSync(this.mychannelBlock)) shell.rm(this.mychannelBlock);
  }
  async startup() {
    // 启动CA
    const ca = shell.exec(`docker-compose -f ${this.composeFile} up -d ca`, { silent: true });
    if (ca.code !== 0) {
      throw new Error(ca.stderr);
    }
    await wait('http://localhost:7054/api/v1/cainfo');

    // 系统引导身份（OU=client）登陆，下面需要以引导身份注册，发行证书
    const bootstrap_enroll_cmd = 'fabric-ca-client enroll -u http://bootstrap:bootstrappw@localhost:7054';
    const bootstrap = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_enroll_cmd}"`, { silent: true });
    if (bootstrap.code !== 0) {
      throw new Error(bootstrap.stderr);
    }
    await wait(path.join(this.caDir, 'bootstrap/msp/signcerts/cert.pem'));

    // 注册，发行身份证书，生成pki
    await this.issueIdentity('orderer', 'orderer', 'ibm.crl.it');

    await this.issueIdentity('admin@zhigui', 'admin', 'zhigui');
    await this.issueIdentity('peer0@zhigui', 'peer', 'zhigui.beijing');
    await this.issueIdentity('peer1@zhigui', 'peer', 'zhigui.wuhan');
    await this.issueIdentity('user@zhigui', 'client', 'zhigui.xian', [{ name: 'email', value: 'user@zhigui.com' }]);

    await this.issueIdentity('admin@ibm', 'admin', 'ibm');
    await this.issueIdentity('peer0@ibm', 'peer', 'ibm.crl');
    await this.issueIdentity('peer1@ibm', 'peer', 'ibm.cdl');
    await this.issueIdentity('user@ibm', 'client', 'ibm.cdl.dev', [{
      name: 'appAdmin',
      value: true,
    }, {
      name: 'email',
      value: 'user@ibm.com',
    }]);

    // 启动Peer
    const peerContainers = 'couchdb0 couchdb1 couchdb2 couchdb3 peer0.zhigui.com peer1.zhigui.com peer0.ibm.com peer1.ibm.com';
    const peer = shell.exec(`docker-compose -f ${this.composeFile} up -d ${peerContainers}`, { silent: true });
    if (peer.code !== 0) {
      throw new Error(peer.stderr);
    }

    // 生成排序组织创世块
    const genesis = shell.exec(`FABRIC_CFG_PATH=${this.artifacts} ${this.configtxgen} -profile OneOrgOrdererGenesis -channelID systemchainid -outputBlock ${this.genesisBlock}`);
    if (genesis.code !== 0) {
      throw new Error(genesis.stderr);
    }
    await wait(this.genesisBlock);
    // 生成创建通道交易
    const envelope = shell.exec(`FABRIC_CFG_PATH=${this.artifacts} ${this.configtxgen} -profile OneOrgChannel -outputCreateChannelTx ${this.channelTx} -channelID mychannel`);
    if (envelope.code !== 0) {
      throw new Error(envelope.stderr);
    }
    await wait(this.channelTx);

    // 启动排序服务
    const orderer = shell.exec(`docker-compose -f ${this.composeFile} up -d orderer`, { silent: true });
    if (orderer.code !== 0) {
      throw new Error(orderer.stderr);
    }
    // 启动cli和chaincode容器
    const cc = shell.exec(`docker-compose -f ${this.composeFile} up -d cli chaincode`, { silent: true });
    if (cc.code !== 0) {
      throw new Error(cc.stderr);
    }
    return true;
  }
  async shutdown() {
    return new Promise((resolve, reject) => {
      shell.exec(`docker-compose -f ${this.composeFile} down`, { silent: true }, (code, stdout, stderr) => {
        if (code !== 0) {
          reject(stderr);
        }
        this.clean();
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
  async issueIdentity(name, role, affiliation, attrs = []) {
    // 身份注册
    const attrstr = attrs.map(attr => `${attr.name}=${attr.value}:ecert`).join(',');
    let register_cmd = `fabric-ca-client register --id.name ${name} --id.secret ${name} --id.type ${role}`;
    if (affiliation) register_cmd += ` --id.affiliation ${affiliation}`;
    if (attrstr) register_cmd += ` --id.attrs '${attrstr}'`;

    const register = shell.exec(`docker exec ca /bin/bash -c "${register_cmd}"`, { silent: true });
    if (register.code !== 0) {
      throw new Error(register.stderr);
    }

    // 发行证书
    const org = affiliation.split('.')[0];
    let mspDir = `${name}/msp`;
    if (role === 'peer') {
      mspDir = `${org}.com/peers/${name.split('@')[0]}.${org}.com/msp`;

      // 创建组织的msp目录
      const orgMSPDir = path.join(this.caClientsDir, `${org}.com/msp`);
      if (!fs.existsSync(orgMSPDir)) {
        const orgMSPCertDir = path.join(orgMSPDir, 'cacerts');
        shell.mkdir('-p', orgMSPCertDir);
        shell.cp(path.join(this.caDir, 'ca-cert.pem'), orgMSPCertDir);

        // 在msp目录创建node OU configuration（msp/config.yaml）
        buildMSPConfigYaml(orgMSPDir, 'cacerts/ca-cert.pem');
      }
    } else if (role === 'admin' || role === 'client') {
      mspDir = `${org}.com/users/${name}/msp`;
    }
    const enroll_cmd = `fabric-ca-client enroll -u http://${name}:${name}@localhost:7054 -M /root/ca-clients/${mspDir}`;

    const enroll = shell.exec(`docker exec ca /bin/bash -c "${enroll_cmd}"`, { silent: true });
    if (enroll.code !== 0) {
      throw new Error(enroll.stderr);
    }
    await wait(path.join(this.caClientsDir, `${mspDir}/signcerts/cert.pem`));

    // 在msp目录创建node OU configuration（msp/config.yaml）
    buildMSPConfigYaml(path.join(this.caClientsDir, mspDir), 'cacerts/localhost-7054.pem');
  }
  listIdentity() {
    const list_cmd = 'fabric-ca-client identity list';
    const identities = shell.exec(`docker exec ca /bin/bash -c "${list_cmd}"`, { silent: true });
    if (identities.code !== 0) {
      throw new Error(identities.stderr);
    }
    const identityArray = identities.stdout.trim().split('\n');
    return identityArray.map(identity => {
      const nameIdx = identity.indexOf('Name: ');
      const typeIdx = identity.indexOf(', Type: ');
      const affiIdx = identity.indexOf(', Affiliation: ');
      const maxEnrollIdx = identity.indexOf(', Max Enrollments: ');
      const attrIdx = identity.indexOf(', Attributes: ');

      const attributes = identity.substring(attrIdx + ', Attributes: '.length);

      return {
        name: identity.substring(nameIdx + 'Name: '.length, typeIdx),
        type: identity.substring(typeIdx + ', Type: '.length, affiIdx),
        affiliation: identity.substring(affiIdx + ', Affiliation: '.length, maxEnrollIdx),
        attributes: attributes.substr(2, attributes.length - 4).split('} {').map(attr => {
          const nameIdx = attr.indexOf('Name:');
          const valueIdx = attr.indexOf(' Value:');
          const ecertIdx = attr.indexOf(' ECert:');

          const name = attr.substring(nameIdx + 'Name:'.length, valueIdx);
          const value = attr.substring(valueIdx + ' Value:'.length, ecertIdx);
          const ecert = attr.substring(ecertIdx + ' ECert:'.length);

          return `${name}=${value}(ecert:${ecert})`;
        }).join('\n'),
      };
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
