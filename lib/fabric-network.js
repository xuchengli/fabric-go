'use babel';

import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import Docker from 'dockerode';
import { Readable } from 'stream';
import { wait } from './utils';

class FabricNetwork {
  constructor() {
    this.artifacts = path.join(__dirname, '../artifacts');
    this.composeFile = path.join(this.artifacts, 'docker-compose.yaml');
    this.chaincodeDir = path.join(this.artifacts, 'chaincode');
    this.caDir = path.join(this.artifacts, 'ca');
    this.caClientsDir = path.join(this.artifacts, 'ca-clients');
    this.mspConfigFile = path.join(this.artifacts, 'msp/config.yaml');
    this.configtxFile = path.join(this.artifacts, 'configtx.yaml');
    this.genesisBlock = path.join(this.artifacts, 'genesis.block');
    this.channelTx = path.join(this.artifacts, 'mychannel.tx');
    this.mychannelBlock = path.join(this.artifacts, 'mychannel.block');
    this.configtxgen = path.join(this.artifacts, 'bin/configtxgen');

    this.containerNames = [ 'ca', 'orderer', 'peer', 'couchdb', 'cli', 'chaincode' ];
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
  clean() {
    if (fs.existsSync(this.caDir)) shell.rm('-rf', this.caDir);
    if (fs.existsSync(this.caClientsDir)) shell.rm('-rf', this.caClientsDir);
    if (fs.existsSync(this.genesisBlock)) shell.rm(this.genesisBlock);
    if (fs.existsSync(this.channelTx)) shell.rm(this.channelTx);
    if (fs.existsSync(this.mychannelBlock)) shell.rm(this.mychannelBlock);
  }
  async startup() {
    // 启动CA
    const ca = shell.exec(`docker-compose -f ${this.composeFile} up -d ca`, { silent: true });
    if (ca.code !== 0) {
      return ca.stderr;
    }
    await wait('http://localhost:7054/api/v1/cainfo');

    // 注册用户，生成pki
    const bootstrap_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/bootstrap';
    const admin_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/admin';
    const user_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/user';
    const peer_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/peer';
    const orderer_client_home = 'FABRIC_CA_CLIENT_HOME=/root/ca-clients/orderer';

    const bootstrap_enroll_cmd = 'fabric-ca-client enroll -u http://admin:adminpw@localhost:7054';
    const admin_enroll_cmd = 'fabric-ca-client enroll -u http://admin1:admin1pw@localhost:7054';
    const user_enroll_cmd = 'fabric-ca-client enroll -u http://user1:user1pw@localhost:7054';
    const peer_enroll_cmd = 'fabric-ca-client enroll -u http://peer1:peer1pw@localhost:7054';
    const orderer_enroll_cmd = 'fabric-ca-client enroll -u http://orderer1:orderer1pw@localhost:7054';

    const register_admin_cmd = 'fabric-ca-client register --id.name admin1 --id.secret admin1pw --id.type admin';
    const register_user_cmd = 'fabric-ca-client register --id.name user1 --id.secret user1pw --id.type client --id.attrs app1Admin=true:ecert --id.attrs email=user1@gmail.com';
    const register_peer_cmd = 'fabric-ca-client register --id.name peer1 --id.secret peer1pw --id.type peer';
    const register_orderer_cmd = 'fabric-ca-client register --id.name orderer1 --id.secret orderer1pw --id.type orderer';

    // 系统引导身份（OU=client）登陆
    const bootstrap = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_client_home} ${bootstrap_enroll_cmd}"`, { silent: true });
    if (bootstrap.code !== 0) {
      return bootstrap.stderr;
    }
    await wait(path.join(this.caClientsDir, 'bootstrap/msp/signcerts/cert.pem'));

    // 注册管理员（OU=admin）
    const registerAdmin = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_client_home} ${register_admin_cmd}"`, { silent: true });
    if (registerAdmin.code !== 0) {
      return registerAdmin.stderr;
    }
    // 注册普通用户（OU=user）
    const registerUser = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_client_home} ${register_user_cmd}"`, { silent: true });
    if (registerUser.code !== 0) {
      return registerUser.stderr;
    }
    // 注册peer（OU=peer）
    const registerPeer = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_client_home} ${register_peer_cmd}"`, { silent: true });
    if (registerPeer.code !== 0) {
      return registerPeer.stderr;
    }
    // 注册orderer（OU=orderer）
    const registerOrderer = shell.exec(`docker exec ca /bin/bash -c "${bootstrap_client_home} ${register_orderer_cmd}"`, { silent: true });
    if (registerOrderer.code !== 0) {
      return registerOrderer.stderr;
    }

    // 签发管理员 msp 证书
    const enrollAdmin = shell.exec(`docker exec ca /bin/bash -c "${admin_client_home} ${admin_enroll_cmd}"`, { silent: true });
    if (enrollAdmin.code !== 0) {
      return enrollAdmin.stderr;
    }
    // 签发普通用户 msp 证书
    const enrollUser = shell.exec(`docker exec ca /bin/bash -c "${user_client_home} ${user_enroll_cmd}"`, { silent: true });
    if (enrollUser.code !== 0) {
      return enrollUser.stderr;
    }
    // 签发peer msp证书
    const enrollPeer = shell.exec(`docker exec ca /bin/bash -c "${peer_client_home} ${peer_enroll_cmd}"`, { silent: true });
    if (enrollPeer.code !== 0) {
      return enrollPeer.stderr;
    }
    // 签发orderer msp证书
    const enrollOrderer = shell.exec(`docker exec ca /bin/bash -c "${orderer_client_home} ${orderer_enroll_cmd}"`, { silent: true });
    if (enrollOrderer.code !== 0) {
      return enrollOrderer.stderr;
    }
    await wait([
      path.join(this.caClientsDir, 'admin/msp/signcerts/cert.pem'),
      path.join(this.caClientsDir, 'user/msp/signcerts/cert.pem'),
      path.join(this.caClientsDir, 'peer/msp/signcerts/cert.pem'),
      path.join(this.caClientsDir, 'orderer/msp/signcerts/cert.pem'),
    ]);

    // 拷贝node OU configuration（msp/config.yaml）到admin, user, peer, orderer的msp目录
    shell.cp(this.mspConfigFile, path.join(this.caClientsDir, 'admin/msp'));
    shell.cp(this.mspConfigFile, path.join(this.caClientsDir, 'user/msp'));
    shell.cp(this.mspConfigFile, path.join(this.caClientsDir, 'peer/msp'));
    shell.cp(this.mspConfigFile, path.join(this.caClientsDir, 'orderer/msp'));

    // 启动Peer
    const peer = shell.exec(`docker-compose -f ${this.composeFile} up -d couchdb peer`, { silent: true });
    if (peer.code !== 0) {
      return peer.stderr;
    }

    // 生成排序组织创世块
    const genesis = shell.exec(`FABRIC_CFG_PATH=${this.artifacts} ${this.configtxgen} -profile OneOrgOrdererGenesis -channelID systemchainid -outputBlock ${this.genesisBlock}`);
    if (genesis.code !== 0) {
      return genesis.stderr;
    }
    await wait(this.genesisBlock);
    // 生成创建通道交易
    const envelope = shell.exec(`FABRIC_CFG_PATH=${this.artifacts} ${this.configtxgen} -profile OneOrgChannel -outputCreateChannelTx ${this.channelTx} -channelID mychannel`);
    if (envelope.code !== 0) {
      return envelope.stderr;
    }
    await wait(this.channelTx);

    // 启动排序服务
    const orderer = shell.exec(`docker-compose -f ${this.composeFile} up -d orderer`, { silent: true });
    if (orderer.code !== 0) {
      return orderer.stderr;
    }
    // 启动cli和chaincode容器
    const cc = shell.exec(`docker-compose -f ${this.composeFile} up -d cli chaincode`, { silent: true });
    if (cc.code !== 0) {
      return cc.stderr;
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
