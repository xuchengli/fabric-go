'use babel';

import fs from 'fs';
import path from 'path';
import shell from 'shelljs';
import Docker from 'dockerode';
import { Readable } from 'stream';
import { wait, zipDirectoryFiles, upload, outputGenesisBlock, outputChannelCreateTx, removeSubDir } from './utils';

class FabricNetwork {
  constructor() {
    this.composeFile = path.join(__dirname, '../artifacts/docker-compose.yaml');
    this.chaincodeDir = path.join(__dirname, '../artifacts/chaincode');
    this.caDir = path.join(__dirname, '../artifacts/ca');
    this.caClientsDir = path.join(__dirname, '../artifacts/ca-clients');
    this.peerMSPDir = path.join(__dirname, '../artifacts/peer-msp');
    this.ordererMSPDir = path.join(__dirname, '../artifacts/orderer-msp');
    this.configtxFile = path.join(__dirname, '../artifacts/configtx.yaml');
    this.genesisBlock = path.join(__dirname, '../artifacts/genesis.block');
    this.channelTx = path.join(__dirname, '../artifacts/mychannel.tx');

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
  clean() {
    if (fs.existsSync(this.caDir)) shell.rm('-rf', this.caDir);
    if (fs.existsSync(this.caClientsDir)) shell.rm('-rf', this.caClientsDir);
    removeSubDir(this.peerMSPDir);
    removeSubDir(this.ordererMSPDir);
    if (fs.existsSync(`${this.peerMSPDir}.zip`)) shell.rm(`${this.peerMSPDir}.zip`);
    if (fs.existsSync(`${this.ordererMSPDir}.zip`)) shell.rm(`${this.ordererMSPDir}.zip`);
    if (fs.existsSync(this.genesisBlock)) shell.rm(this.genesisBlock);
    if (fs.existsSync(this.channelTx)) shell.rm(this.channelTx);
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
    const register_user_cmd = 'fabric-ca-client register --id.name user1 --id.secret user1pw --id.type user --id.attrs app1Admin=true:ecert --id.attrs email=user1@gmail.com';
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

    // 管理员登陆，签发msp证书
    const enrollAdmin = shell.exec(`docker exec ca /bin/bash -c "${admin_client_home} ${admin_enroll_cmd}"`, { silent: true });
    if (enrollAdmin.code !== 0) {
      return enrollAdmin.stderr;
    }
    // 普通用户登陆，签发msp证书
    const enrollUser = shell.exec(`docker exec ca /bin/bash -c "${user_client_home} ${user_enroll_cmd}"`, { silent: true });
    if (enrollUser.code !== 0) {
      return enrollUser.stderr;
    }
    // peer登陆，签发msp证书
    const enrollPeer = shell.exec(`docker exec ca /bin/bash -c "${peer_client_home} ${peer_enroll_cmd}"`, { silent: true });
    if (enrollPeer.code !== 0) {
      return enrollPeer.stderr;
    }
    // orderer登陆，签发msp证书
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

    // 生成peer msp相关证书，私钥
    // 1) CA证书
    const peerCACerts = path.join(this.peerMSPDir, 'cacerts');
    if (!fs.existsSync(peerCACerts)) shell.mkdir('-p', peerCACerts);
    shell.cp(path.join(this.caDir, 'ca-cert.pem'), peerCACerts);
    // 2) keystore
    const peerKeystore = path.join(this.peerMSPDir, 'keystore');
    if (!fs.existsSync(peerKeystore)) shell.mkdir('-p', peerKeystore);
    shell.cp(path.join(this.caClientsDir, 'peer/msp/keystore/*'), peerKeystore);
    // 3) signcerts
    const peerSignCerts = path.join(this.peerMSPDir, 'signcerts');
    if (!fs.existsSync(peerSignCerts)) shell.mkdir('-p', peerSignCerts);
    shell.cp(path.join(this.caClientsDir, 'peer/msp/signcerts/*'), peerSignCerts);
    // 4) admincerts目录（为了适配zhigui/configtxlator服务，官方推荐可以不需要）
    const peerAdminCerts = path.join(this.peerMSPDir, 'admincerts');
    if (!fs.existsSync(peerAdminCerts)) shell.mkdir('-p', peerAdminCerts);
    shell.cp(path.join(this.caClientsDir, 'admin/msp/signcerts/*'), peerAdminCerts);

    // 生成orderer msp相关证书，私钥
    // 1) CA证书
    const ordererCACerts = path.join(this.ordererMSPDir, 'cacerts');
    if (!fs.existsSync(ordererCACerts)) shell.mkdir('-p', ordererCACerts);
    shell.cp(path.join(this.caDir, 'ca-cert.pem'), ordererCACerts);
    // 2) keystore
    const ordererKeystore = path.join(this.ordererMSPDir, 'keystore');
    if (!fs.existsSync(ordererKeystore)) shell.mkdir('-p', ordererKeystore);
    shell.cp(path.join(this.caClientsDir, 'orderer/msp/keystore/*'), ordererKeystore);
    // 3) signcerts
    const ordererSignCerts = path.join(this.ordererMSPDir, 'signcerts');
    if (!fs.existsSync(ordererSignCerts)) shell.mkdir('-p', ordererSignCerts);
    shell.cp(path.join(this.caClientsDir, 'orderer/msp/signcerts/*'), ordererSignCerts);
    // 4) admincerts目录（为了适配zhigui/configtxlator服务，官方推荐可以不需要）
    const ordererAdminCerts = path.join(this.ordererMSPDir, 'admincerts');
    if (!fs.existsSync(ordererAdminCerts)) shell.mkdir('-p', ordererAdminCerts);
    shell.cp(path.join(this.caClientsDir, 'admin/msp/signcerts/*'), ordererAdminCerts);

    // 将msp压缩，为了下面上传到configtxlator，用来创建排序组织创世块
    const archivePeerMSP = await zipDirectoryFiles(this.peerMSPDir);
    const archiveOrdererMSP = await zipDirectoryFiles(this.ordererMSPDir);

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
    // 上传msp文件
    await upload('./peer-msp', archivePeerMSP);
    await upload('./orderer-msp', archiveOrdererMSP);

    // 生成排序组织创世块
    const configtx = fs.readFileSync(this.configtxFile, 'utf8');
    const genesis = await outputGenesisBlock('OneOrgOrdererGenesis', 'systemchainid', configtx, '', '');
    fs.writeFileSync(this.genesisBlock, genesis);
    await wait(this.genesisBlock);

    // 启动排序服务
    const orderer = shell.exec(`docker-compose -f ${this.composeFile} up -d orderer`, { silent: true });
    if (orderer.code !== 0) {
      return orderer.stderr;
    }

    // 生成创建通道交易
    const envelope = await outputChannelCreateTx('OneOrgChannel', 'mychannel', configtx, '.', '');
    fs.writeFileSync(this.channelTx, envelope);
    await wait(this.channelTx);

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
