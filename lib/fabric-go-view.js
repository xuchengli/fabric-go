'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import FabricNetwork from './fabric-network';
import CCParamModal from './cc-param-modal';
import IdentityModal from './enroll-identity-modal';
import path from 'path';

export default class FabricGoView {

  constructor(serializedState) {
    this.networkStatus = 'down'; // loading, up, down, exited
    this.identities = [];
    this.chaincodes = [];
    /**
     * {
     *   'mycc': {
     *     'status': 'ready', // ready, started, installed, instantiated
     *     'dom': {
     *       'root': 'xxxx',
     *       'handler': 'xxxx',
     *       'log': 'xxxx',
     *       'log-tab-1': 'yyyy',
     *       'log-tab-handler-1': 'yyyy',
     *       'log-console-1': 'yyyy',
     *       'log-body-1': 'yyyy',
     *       'log-tab-2': 'zzzz',
     *       'log-tab-handler-2': 'zzzz',
     *       'log-console-2': 'zzzz',
     *       'log-body-2': 'zzzz',
     *     },
     *     'params': {
     *       'instantiate': [],
     *       'invoke': [],
     *       'query': [],
     *     },
     *   },
     * }
    **/
    this.chaincodeMap = {};

    this.fabricNetwork = new FabricNetwork();
    this.emitter = new Emitter();

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('fabric-go');

    // Create fabric network panel
    const networkPanel = document.createElement('atom-panel');
    networkPanel.classList.add('padded');
    this.element.appendChild(networkPanel);

    const networkInsetPanel = document.createElement('div');
    networkInsetPanel.classList.add('inset-panel', 'padded');
    networkPanel.appendChild(networkInsetPanel);

    const networkInsetPanelLabel = document.createElement('span');
    networkInsetPanelLabel.classList.add('inline-block');
    networkInsetPanelLabel.innerHTML = 'Fabric Network';
    networkInsetPanel.appendChild(networkInsetPanelLabel);

    this.networkInsetPanelStatusIcon = document.createElement('span');
    this.networkInsetPanelStatusIcon.classList.add('inline-block', 'icon', 'icon-primitive-dot', 'status-icon');
    networkInsetPanel.appendChild(this.networkInsetPanelStatusIcon);

    this.networkInsetPanelStatusText = document.createElement('span');
    this.networkInsetPanelStatusText.classList.add('inline-block', 'status-text');
    this.networkInsetPanelStatusText.innerHTML = 'Down';
    networkInsetPanel.appendChild(this.networkInsetPanelStatusText);

    this.networkInsetPanelButton = document.createElement('button');
    this.networkInsetPanelButton.classList.add('btn');
    this.networkInsetPanelButton.innerHTML = 'Startup';
    this.networkInsetPanelButton.addEventListener('click', () => {
      this.changeStatus();
    });
    networkInsetPanel.appendChild(this.networkInsetPanelButton);

    // Create identity list panel
    const identityPanel = document.createElement('atom-panel');
    identityPanel.classList.add('padded');
    this.element.appendChild(identityPanel);

    const identityInsetPanel = document.createElement('div');
    identityInsetPanel.classList.add('inset-panel');
    identityPanel.appendChild(identityInsetPanel);

    const identityInsetPanelHeader = document.createElement('div');
    identityInsetPanelHeader.classList.add('panel-heading');
    identityInsetPanel.appendChild(identityInsetPanelHeader);

    const identityInsetPanelHeaderLabel = document.createElement('span');
    identityInsetPanelHeaderLabel.classList.add('inline-block');
    identityInsetPanelHeaderLabel.innerHTML = 'Fabric Identities';
    identityInsetPanelHeader.appendChild(identityInsetPanelHeaderLabel);

    this.identityInsetPanelHeaderButton = document.createElement('button');
    this.identityInsetPanelHeaderButton.classList.add('btn', 'btn-sm', 'icon', 'icon-plus');
    this.identityInsetPanelHeaderButton.innerHTML = 'Enroll';
    this.identityInsetPanelHeaderButton.setAttribute('disabled', true);
    this.identityInsetPanelHeaderButton.addEventListener('click', () => {
      //发行新身份的输入窗口
      const modalPanel = atom.workspace.addModalPanel({
        item: new IdentityModal(
          identity => {
            const { name, role, affiliation, attributes } = identity;
            if (this.identities.map(identity => identity.name).includes(name)) {
              alert('The identity name is already exist.');
              return;
            }
            this.fabricNetwork.issueIdentity(name, role, affiliation, attributes).then(() => {
              this.loadIdentities();
            }).catch(err => {
              alert(err);
              return;
            });
            modalPanel.destroy();
          },
          () => {
            modalPanel.destroy();
          }
        ).getElement(),
      });
    });
    identityInsetPanelHeader.appendChild(this.identityInsetPanelHeaderButton);

    const identityInsetPanelBody = document.createElement('div');
    identityInsetPanelBody.classList.add('panel-body', 'padded');
    identityInsetPanel.appendChild(identityInsetPanelBody);

    const identityTable = document.createElement('table');
    identityTable.classList.add('identity-table');
    identityInsetPanelBody.appendChild(identityTable);
    const identityTableHead = document.createElement('thead');
    identityTable.appendChild(identityTableHead);
    const identityTableHeadTR = document.createElement('tr');
    identityTableHead.appendChild(identityTableHeadTR);
    ['Name', 'Role', 'Affiliation', 'Attributes'].forEach(title => {
      const identityTableHeadTH = document.createElement('th');
      identityTableHeadTH.innerHTML = title;
      identityTableHeadTR.appendChild(identityTableHeadTH);
    });
    this.identityTableBody = document.createElement('tbody');
    identityTable.appendChild(this.identityTableBody);

    // Create chaincode list panel
    const chaincodePanel = document.createElement('atom-panel');
    chaincodePanel.classList.add('padded');
    this.element.appendChild(chaincodePanel);

    const chaincodeInsetPanel = document.createElement('div');
    chaincodeInsetPanel.classList.add('inset-panel');
    chaincodePanel.appendChild(chaincodeInsetPanel);

    const chaincodeInsetPanelHeader = document.createElement('div');
    chaincodeInsetPanelHeader.classList.add('panel-heading');
    chaincodeInsetPanelHeader.innerHTML = 'Fabric Chaincodes';
    chaincodeInsetPanel.appendChild(chaincodeInsetPanelHeader);

    const chaincodeInsetPanelBody = document.createElement('div');
    chaincodeInsetPanelBody.classList.add('panel-body', 'padded');
    chaincodeInsetPanel.appendChild(chaincodeInsetPanelBody);

    this.chaincodeList = document.createElement('ol');
    this.chaincodeList.classList.add('list-group');
    chaincodeInsetPanelBody.appendChild(this.chaincodeList);

    //事件订阅
    this.saveSub = null;
    this.subscriptions = new CompositeDisposable(
      this.emitter.on('change-status', () => {
        this.setStatusHandler();
      }),
      this.emitter.on('change-identities', () => {
        this.setIdentitiesHandler();
      }),
      this.emitter.on('change-chaincodes', () => {
        this.setChainCodesHandler();
      }),
      atom.workspace.getCenter().observeActivePaneItem(item => {
        if (atom.workspace.isTextEditor(item) && path.extname(item.getTitle()) === '.go') {
          this.fabricNetwork.copyChainCode(item.getPath());
          this.loadChainCodes();
          if (this.saveSub) this.saveSub.dispose();
          this.saveSub = item.onDidSave(evt => {
            this.fabricNetwork.copyChainCode(evt.path);
            this.loadChainCodes();
          });
        }
      }),
    );
    //初始化当前网络状态
    this.initStatus();

    //初始化当前的链码列表
    this.loadChainCodes();
  }

  getTitle() {
    // Used by Atom for tab text
    return 'Fabric Go';
  }

  getIconName() {
    return 'globe';
  }

  getDefaultLocation() {
    // This location will be used if the user hasn't overridden it by dragging the item elsewhere.
    // Valid values are "left", "right", "bottom", and "center" (the default).
    return 'right';
  }

  getAllowedLocations() {
    // The locations into which the item can be moved.
    return ['left', 'right'];
  }

  getPreferredWidth() {
    return 460;
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://fabric-go';
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.networkInsetPanelStatusIcon.remove();
    this.networkInsetPanelStatusText.remove();
    this.networkInsetPanelButton.remove();
    this.identityInsetPanelHeaderButton.remove();
    this.identityTableBody.remove();
    this.chaincodeList.remove();
    this.element.remove();
    this.subscriptions.dispose();
  }

  getElement() {
    return this.element;
  }

  initStatus() {
    this.fabricNetwork.isAvailable().then(() => {
      this.networkStatus = 'up';
      this.emitter.emit('change-status');
    }).catch(err => {
      this.networkStatus = 'down';
      this.emitter.emit('change-status');
    });
  }

  changeStatus() {
    if (this.networkStatus === 'up') {
      this.networkStatus = 'loading';
      this.emitter.emit('change-status');
      // TODO: 停止网络
      this.fabricNetwork.shutdown().then(() => {
        this.networkStatus = 'down';
        this.emitter.emit('change-status');
      }).catch(err => {
        alert(err);
        this.networkStatus = 'exited';
        this.emitter.emit('change-status');
      });
    } else if (this.networkStatus === 'down') {
      this.networkStatus = 'loading';
      this.emitter.emit('change-status');
      // TODO: 启动网络
      this.fabricNetwork.startup().then(() => {
        return this.fabricNetwork.isAvailable();
      }).then(() => {
        this.networkStatus = 'up';
        this.emitter.emit('change-status');
      }).catch(err => {
        alert(err);
        this.networkStatus = 'exited';
        this.emitter.emit('change-status');
      });
    } else if (this.networkStatus === 'exited') {
      this.networkStatus = 'loading';
      this.emitter.emit('change-status');
      // TODO: 重新启动网络
      this.fabricNetwork.shutdown().then(() => {
        return this.fabricNetwork.startup();
      }).then(() => {
        return this.fabricNetwork.isAvailable();
      }).then(() => {
        this.networkStatus = 'up';
        this.emitter.emit('change-status');
      }).catch(err => {
        alert(err);
        this.networkStatus = 'exited';
        this.emitter.emit('change-status');
      });
    }
  }

  setStatusHandler() {
    this.networkInsetPanelStatusIcon.classList.remove('icon', 'icon-primitive-dot', 'loading', 'loading-spinner-tiny', 'text-success', 'text-error');
    this.networkInsetPanelStatusText.classList.remove('text-success', 'text-error');
    this.networkInsetPanelButton.removeAttribute('disabled');
    this.identityInsetPanelHeaderButton.removeAttribute('disabled');

    if (this.networkStatus === 'loading') {
      this.networkInsetPanelStatusIcon.classList.add('loading', 'loading-spinner-tiny');
      this.networkInsetPanelStatusText.innerHTML = '';
      this.networkInsetPanelButton.innerHTML = 'Loading';
      this.networkInsetPanelButton.setAttribute('disabled', true);

      this.identityInsetPanelHeaderButton.setAttribute('disabled', true);
    } else if (this.networkStatus === 'up') {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot', 'text-success');
      this.networkInsetPanelStatusText.classList.add('text-success');
      this.networkInsetPanelStatusText.innerHTML = 'Up';
      this.networkInsetPanelButton.innerHTML = 'Shutdown';

      //初始化当前网络的身份列表
      this.loadIdentities();
    } else if (this.networkStatus === 'down') {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot');
      this.networkInsetPanelStatusText.innerHTML = 'Down';
      this.networkInsetPanelButton.innerHTML = 'Startup';

      //清除当前网络的身份列表
      this.clearIdentities();
      this.identityInsetPanelHeaderButton.setAttribute('disabled', true);
    } else {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot', 'text-error');
      this.networkInsetPanelStatusText.classList.add('text-error');
      this.networkInsetPanelStatusText.innerHTML = 'Exited';
      this.networkInsetPanelButton.innerHTML = 'Restart';

      //清除当前网络的身份列表
      this.clearIdentities();
      this.identityInsetPanelHeaderButton.setAttribute('disabled', true);
    }
  }

  loadIdentities() {
    this.identities = this.fabricNetwork.listIdentity();
    this.emitter.emit('change-identities');
  }

  clearIdentities() {
    this.identities = [];
    this.emitter.emit('change-identities');
  }

  setIdentitiesHandler() {
    this.identityTableBody.innerHTML = '';
    this.identities.forEach(identity => {
      const { name, type, affiliation, attributes } = identity;
      const identityItemTR = document.createElement('tr');
      this.identityTableBody.appendChild(identityItemTR);

      [ name, type, affiliation, attributes ].forEach((td, i) => {
        const identityItemTD = document.createElement('td');
        identityItemTD.innerHTML = td;
        if (i !== 3) atom.tooltips.add(identityItemTD, { title: td });
        else atom.tooltips.add(identityItemTD, { title: td.replace(/\n/g, '<br><br>') });
        identityItemTR.appendChild(identityItemTD);
      });
    });
  }

  loadChainCodes() {
    this.chaincodes = this.fabricNetwork.listChainCode();
    this.emitter.emit('change-chaincodes');
  }

  setChainCodesHandler() {
    this.chaincodes.forEach(chaincode => {
      if (!this.chaincodeMap[chaincode]) {
        const chaincodeItem = document.createElement('li');
        chaincodeItem.classList.add('two-lines');
        this.chaincodeList.appendChild(chaincodeItem);

        // 标题栏
        const chaincodeItemTitle = document.createElement('div');
        chaincodeItemTitle.classList.add('primary-line', 'primary-line-block');
        chaincodeItem.appendChild(chaincodeItemTitle);

        const chaincodeItemText = document.createElement('span');
        chaincodeItemText.classList.add('icon', 'icon-file-text');
        chaincodeItemText.innerHTML = chaincode;
        chaincodeItemTitle.appendChild(chaincodeItemText);

        // 标题栏右侧按钮组
        const chaincodeItemTextButtons = document.createElement('div');
        chaincodeItemTextButtons.classList.add('block');
        chaincodeItemTitle.appendChild(chaincodeItemTextButtons);

        // 最小化合约按钮
        const chaincodeItemMinButton = document.createElement('span');
        chaincodeItemMinButton.classList.add('icon', 'icon-screen-normal', 'inline-block-tight');
        chaincodeItemMinButton.addEventListener('click', evt => {
          const _this = evt.target;
          if (_this.classList.contains('icon-screen-normal')) {
            this.chaincodeMap[chaincode]['dom']['handler'].setAttribute('style', 'display:none');
            this.chaincodeMap[chaincode]['dom']['log'].setAttribute('style', 'display:none');
            _this.classList.replace('icon-screen-normal', 'icon-screen-full');
          } else {
            this.chaincodeMap[chaincode]['dom']['handler'].removeAttribute('style');
            this.chaincodeMap[chaincode]['dom']['log'].removeAttribute('style');
            _this.classList.replace('icon-screen-full', 'icon-screen-normal');
          }
        });
        chaincodeItemTextButtons.appendChild(chaincodeItemMinButton);

        // 删除合约按钮
        const chaincodeItemDeleteButton = document.createElement('span');
        chaincodeItemDeleteButton.classList.add('icon', 'icon-x', 'inline-block-tight');
        chaincodeItemDeleteButton.addEventListener('click', () => {
          this.fabricNetwork.removeChainCode(chaincode);
          this.chaincodeMap[chaincode]['dom']['root'].remove();
          delete this.chaincodeMap[chaincode];
        });
        chaincodeItemTextButtons.appendChild(chaincodeItemDeleteButton);

        // 按钮组
        const chaincodeItemButtons = document.createElement('div');
        chaincodeItemButtons.classList.add('secondary-line', 'no-icon');
        chaincodeItem.appendChild(chaincodeItemButtons);

        // 编译和启动
        const chaincodeItemBuildButton = document.createElement('button');
        chaincodeItemBuildButton.classList.add('btn', 'inline-block-tight');
        chaincodeItemBuildButton.innerHTML = 'Build & start';
        chaincodeItemBuildButton.addEventListener('click', () => {
          if (this.networkStatus !== 'up') {
            alert('Please startup fabric network first.');
            return;
          }
          chaincodeItemBuildButton.innerHTML = `<span class='loading loading-spinner-tiny inline-block-tight'></span>Build & start`;
          chaincodeItemBuildButton.setAttribute('disabled', true);

          const cmd = `pgrep ${chaincode} | xargs -r kill -9 && cd ${chaincode} && go build && CORE_PEER_ADDRESS=peer:7052 CORE_CHAINCODE_ID_NAME=${chaincode}:0 ./${chaincode}`;
          this.fabricNetwork.exec('chaincode', cmd, (err, msg) => {
            if (err) {
              chaincodeItemBuildButton.innerHTML = 'Build & start';
              chaincodeItemBuildButton.removeAttribute('disabled');
              alert(err);
              return;
            }
            if (this.chaincodeMap[chaincode]) {
              this.chaincodeMap[chaincode]['dom']['log-tab-1'].click();
              if (this.chaincodeMap[chaincode]['dom']['log-body-1'].innerHTML !== '' && msg !== '') {
                this.chaincodeMap[chaincode]['dom']['log-body-1'].innerHTML += '\r\n';
              }
              this.chaincodeMap[chaincode]['dom']['log-body-1'].innerHTML += msg;
              this.chaincodeMap[chaincode]['dom']['log-body-1'].scrollTop = this.chaincodeMap[chaincode]['dom']['log-body-1'].scrollHeight;
            }
            if (msg !== '' && !msg.includes('Killed')) {
              chaincodeItemBuildButton.innerHTML = 'Build & start';
              chaincodeItemBuildButton.removeAttribute('disabled');
              if (msg.includes('starting up')) this.chaincodeMap[chaincode]['status'] = 'started';
            }
          });
        });
        chaincodeItemButtons.appendChild(chaincodeItemBuildButton);

        // 安装
        const chaincodeItemInstallButton = document.createElement('button');
        chaincodeItemInstallButton.classList.add('btn', 'inline-block-tight');
        chaincodeItemInstallButton.innerHTML = 'Install';
        chaincodeItemInstallButton.addEventListener('click', () => {
          if (this.networkStatus !== 'up') {
            alert('Please startup fabric network first.');
            return;
          }
          chaincodeItemInstallButton.innerHTML = `<span class='loading loading-spinner-tiny inline-block-tight'></span>Install`;
          chaincodeItemInstallButton.setAttribute('disabled', true);

          // 先删除已经安装的链码
          this.fabricNetwork.exec('peer', `rm -rf /var/hyperledger/production/chaincodes/${chaincode}.0`, (err, msg) => {
            if (err) {
              chaincodeItemInstallButton.innerHTML = 'Install';
              chaincodeItemInstallButton.removeAttribute('disabled');
              alert(err);
              return;
            }
            // 再安装当前的链码
            const cmd = 'CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/admin/msp' +
                        `&& peer chaincode package chaincode/${chaincode}/${chaincode}_pack.out -n ${chaincode} -p chaincodedev/chaincode/${chaincode} -v 0 -s -S` +
                        `&& peer chaincode install chaincode/${chaincode}/${chaincode}_pack.out`;
            this.fabricNetwork.exec('cli', cmd, (err, msg) => {
              if (err) {
                chaincodeItemInstallButton.innerHTML = 'Install';
                chaincodeItemInstallButton.removeAttribute('disabled');
                alert(err);
                return;
              }
              this.chaincodeMap[chaincode]['dom']['log-tab-2'].click();
              if (this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML !== '' && msg !== '') {
                this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += '\r\n';
              }
              this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += msg;
              this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollTop = this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollHeight;

              if (msg.includes('Installed')) {
                chaincodeItemInstallButton.innerHTML = 'Install';
                chaincodeItemInstallButton.removeAttribute('disabled');
                this.chaincodeMap[chaincode]['status'] = 'installed';
              }
            });
          });
        });
        chaincodeItemButtons.appendChild(chaincodeItemInstallButton);

        // 部署
        const chaincodeItemInstantiateButton = document.createElement('button');
        chaincodeItemInstantiateButton.classList.add('btn', 'inline-block-tight');
        chaincodeItemInstantiateButton.innerHTML = 'Instantiate';
        chaincodeItemInstantiateButton.addEventListener('click', () => {
          if (this.networkStatus !== 'up') {
            alert('Please startup fabric network first.');
            return;
          }
          //链码部署的参数输入窗口
          const modalPanel = atom.workspace.addModalPanel({
            item: new CCParamModal(
              this.chaincodeMap[chaincode]['params']['instantiate'],
              params => {
                this.chaincodeMap[chaincode]['params']['instantiate'] = params;
                modalPanel.destroy();

                chaincodeItemInstantiateButton.innerHTML = `<span class='loading loading-spinner-tiny inline-block-tight'></span>Instantiate`;
                chaincodeItemInstantiateButton.setAttribute('disabled', true);

                const cmd = 'CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/admin/msp' +
                            `&& peer chaincode instantiate -n ${chaincode} -v 0 -c '{"Args":${JSON.stringify(params)}}' -C mychannel`;
                this.fabricNetwork.exec('cli', cmd, (err, msg) => {
                  if (err) {
                    chaincodeItemInstantiateButton.innerHTML = 'Instantiate';
                    chaincodeItemInstantiateButton.removeAttribute('disabled');
                    alert(err);
                    return;
                  }
                  this.chaincodeMap[chaincode]['dom']['log-tab-2'].click();
                  if (this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML !== '' && msg !== '') {
                    this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += '\r\n';
                  }
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += msg;
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollTop = this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollHeight;

                  chaincodeItemInstantiateButton.innerHTML = 'Instantiate';
                  chaincodeItemInstantiateButton.removeAttribute('disabled');
                  this.chaincodeMap[chaincode]['status'] = 'instantiated';
                });
              },
              () => {
                modalPanel.destroy();
              }
            ).getElement(),
          });
        });
        chaincodeItemButtons.appendChild(chaincodeItemInstantiateButton);

        // 调用
        const chaincodeItemInvokeButton = document.createElement('button');
        chaincodeItemInvokeButton.classList.add('btn', 'inline-block-tight');
        chaincodeItemInvokeButton.innerHTML = 'Invoke';
        chaincodeItemInvokeButton.addEventListener('click', () => {
          if (this.networkStatus !== 'up') {
            alert('Please startup fabric network first.');
            return;
          }
          //链码调用的参数输入窗口
          const modalPanel = atom.workspace.addModalPanel({
            item: new CCParamModal(
              this.chaincodeMap[chaincode]['params']['invoke'],
              params => {
                this.chaincodeMap[chaincode]['params']['invoke'] = params;
                modalPanel.destroy();

                chaincodeItemInvokeButton.innerHTML = `<span class='loading loading-spinner-tiny inline-block-tight'></span>Invoke`;
                chaincodeItemInvokeButton.setAttribute('disabled', true);

                const cmd = 'CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/user/msp' +
                            `&& peer chaincode invoke -n ${chaincode} -c '{"Args":${JSON.stringify(params)}}' -C mychannel`;
                this.fabricNetwork.exec('cli', cmd, (err, msg) => {
                  if (err) {
                    chaincodeItemInvokeButton.innerHTML = 'Invoke';
                    chaincodeItemInvokeButton.removeAttribute('disabled');
                    alert(err);
                    return;
                  }
                  this.chaincodeMap[chaincode]['dom']['log-tab-2'].click();
                  if (this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML !== '' && msg !== '') {
                    this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += '\r\n';
                  }
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += msg;
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollTop = this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollHeight;

                  chaincodeItemInvokeButton.innerHTML = 'Invoke';
                  chaincodeItemInvokeButton.removeAttribute('disabled');
                });
              },
              () => {
                modalPanel.destroy();
              }
            ).getElement(),
          });
        });
        chaincodeItemButtons.appendChild(chaincodeItemInvokeButton);

        // 查询
        const chaincodeItemQueryButton = document.createElement('button');
        chaincodeItemQueryButton.classList.add('btn', 'inline-block-tight');
        chaincodeItemQueryButton.innerHTML = 'Query';
        chaincodeItemQueryButton.addEventListener('click', () => {
          if (this.networkStatus !== 'up') {
            alert('Please startup fabric network first.');
            return;
          }
          //链码查询的参数输入窗口
          const modalPanel = atom.workspace.addModalPanel({
            item: new CCParamModal(
              this.chaincodeMap[chaincode]['params']['query'],
              params => {
                this.chaincodeMap[chaincode]['params']['query'] = params;
                modalPanel.destroy();

                chaincodeItemQueryButton.innerHTML = `<span class='loading loading-spinner-tiny inline-block-tight'></span>Query`;
                chaincodeItemQueryButton.setAttribute('disabled', true);

                const cmd = 'CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/user/msp' +
                            `&& peer chaincode query -n ${chaincode} -c '{"Args":${JSON.stringify(params)}}' -C mychannel`;
                this.fabricNetwork.exec('cli', cmd, (err, msg) => {
                  if (err) {
                    chaincodeItemQueryButton.innerHTML = 'Query';
                    chaincodeItemQueryButton.removeAttribute('disabled');
                    alert(err);
                    return;
                  }
                  this.chaincodeMap[chaincode]['dom']['log-tab-2'].click();
                  if (this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML !== '' && msg !== '') {
                    this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += '\r\n';
                  }
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML += msg;
                  this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollTop = this.chaincodeMap[chaincode]['dom']['log-body-2'].scrollHeight;

                  chaincodeItemQueryButton.innerHTML = 'Query';
                  chaincodeItemQueryButton.removeAttribute('disabled');
                });
              },
              () => {
                modalPanel.destroy();
              }
            ).getElement(),
          });
        });
        chaincodeItemButtons.appendChild(chaincodeItemQueryButton);

        // 日志Tab组
        const chaincodeItemLogs = document.createElement('div');
        chaincodeItemLogs.classList.add('third-line');
        chaincodeItem.appendChild(chaincodeItemLogs);

        const logPanel = document.createElement('atom-panel');
        logPanel.classList.add('pane');
        chaincodeItemLogs.appendChild(logPanel);

        const logTabBar = document.createElement('ul');
        logTabBar.classList.add('tab-bar');
        logPanel.appendChild(logTabBar);

        // 编译和启动的日志Tab
        const logTab1 = document.createElement('li');
        logTab1.classList.add('tab', 'active');
        logTab1.innerHTML = 'Build & start Log';
        logTab1.addEventListener('click', () => {
          this.chaincodeMap[chaincode]['dom']['log-tab-1'].classList.add('active');
          this.chaincodeMap[chaincode]['dom']['log-tab-2'].classList.remove('active');
          this.chaincodeMap[chaincode]['dom']['log-tab-handler-1'].classList.remove('invisible');
          this.chaincodeMap[chaincode]['dom']['log-tab-handler-2'].classList.add('invisible');
          this.chaincodeMap[chaincode]['dom']['log-console-1'].classList.remove('invisible');
          this.chaincodeMap[chaincode]['dom']['log-console-2'].classList.add('invisible');
        });
        logTabBar.appendChild(logTab1);

        const logTabIcon1 = document.createElement('span');
        logTabIcon1.classList.add('icon', 'icon-sync');
        logTabIcon1.addEventListener('click', evt => {
          evt.stopPropagation();
          this.chaincodeMap[chaincode]['dom']['log-body-1'].innerHTML = '';
        });
        logTab1.appendChild(logTabIcon1);

        // 安装，部署，调用和查询的日志Tab
        const logTab2 = document.createElement('li');
        logTab2.classList.add('tab');
        logTab2.innerHTML = 'Action Log';
        logTab2.addEventListener('click', () => {
          this.chaincodeMap[chaincode]['dom']['log-tab-1'].classList.remove('active');
          this.chaincodeMap[chaincode]['dom']['log-tab-2'].classList.add('active');
          this.chaincodeMap[chaincode]['dom']['log-tab-handler-1'].classList.add('invisible');
          this.chaincodeMap[chaincode]['dom']['log-tab-handler-2'].classList.remove('invisible');
          this.chaincodeMap[chaincode]['dom']['log-console-1'].classList.add('invisible');
          this.chaincodeMap[chaincode]['dom']['log-console-2'].classList.remove('invisible');
        });
        logTabBar.appendChild(logTab2);

        const logTabIcon2 = document.createElement('span');
        logTabIcon2.classList.add('icon', 'icon-sync', 'invisible');
        logTabIcon2.addEventListener('click', evt => {
          evt.stopPropagation();
          this.chaincodeMap[chaincode]['dom']['log-body-2'].innerHTML = '';
        });
        logTab2.appendChild(logTabIcon2);

        // 编译和启动的日志面板
        const logConsole1 = document.createElement('div');
        logConsole1.classList.add('console');
        logPanel.appendChild(logConsole1);

        const logConsoleBody1 = document.createElement('textarea');
        logConsoleBody1.classList.add('console-body');
        logConsoleBody1.setAttribute('readonly', true);
        logConsoleBody1.innerHTML = '';
        logConsole1.appendChild(logConsoleBody1);

        // 安装，部署，调用和查询的日志面板
        const logConsole2 = document.createElement('div');
        logConsole2.classList.add('console', 'invisible');
        logPanel.appendChild(logConsole2);

        const logConsoleBody2 = document.createElement('textarea');
        logConsoleBody2.classList.add('console-body');
        logConsoleBody2.setAttribute('readonly', true);
        logConsoleBody2.innerHTML = '';
        logConsole2.appendChild(logConsoleBody2);

        /**
         * 将链码状态和dom元素添加到链码索引中
        **/
        Object.assign(this.chaincodeMap, {
          [chaincode]: {
            'status': 'ready',
            'dom': {
              'root': chaincodeItem,
              'handler': chaincodeItemButtons,
              'log': chaincodeItemLogs,
              'log-tab-1': logTab1,
              'log-tab-handler-1': logTabIcon1,
              'log-console-1': logConsole1,
              'log-body-1': logConsoleBody1,
              'log-tab-2': logTab2,
              'log-tab-handler-2': logTabIcon2,
              'log-console-2': logConsole2,
              'log-body-2': logConsoleBody2,
            },
            'params': {
              'instantiate': [],
              'invoke': [],
              'query': [],
            },
          }
        });
      }
    });
  }
}
