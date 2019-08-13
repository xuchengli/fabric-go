'use babel';

import { CompositeDisposable, Emitter } from 'atom';
import FabricNetwork from './fabric-network';
import path from 'path';

export default class FabricGoView {

  constructor(serializedState) {
    this.networkStatus = 'down'; // loading, up, down, exited
    this.chaincodeStatus = 'ready'; // ready, started, installed, instantiated
    this.chaincodes = [];

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
    this.subscriptions = new CompositeDisposable(
      this.emitter.on('change-status', () => {
        this.setStatusHandler();
      }),
      this.emitter.on('change-chaincodes', () => {
        this.setChainCodesHandler();
      }),
      atom.workspace.getCenter().observeActivePaneItem(item => {
        if (atom.workspace.isTextEditor(item) && path.extname(item.getTitle()) === '.go') {
          this.fabricNetwork.copyChainCode(item.getPath());
          this.loadChainCodes();
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
    return 445;
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
        return this.fabricNetwork.waitFor(5000);
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
    } else if (this.networkStatus === 'exited') {
      this.networkStatus = 'loading';
      this.emitter.emit('change-status');
      // TODO: 重新启动网络
      this.fabricNetwork.shutdown().then(() => {
        return this.fabricNetwork.waitFor(2000);
      }).then(() => {
        return this.fabricNetwork.startup();
      }).then(() => {
        return this.fabricNetwork.waitFor(5000);
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

    if (this.networkStatus === 'loading') {
      this.networkInsetPanelStatusIcon.classList.add('loading', 'loading-spinner-tiny');
      this.networkInsetPanelStatusText.innerHTML = '';
      this.networkInsetPanelButton.innerHTML = 'Loading';
      this.networkInsetPanelButton.setAttribute('disabled', true);
    } else if (this.networkStatus === 'up') {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot', 'text-success');
      this.networkInsetPanelStatusText.classList.add('text-success');
      this.networkInsetPanelStatusText.innerHTML = 'Up';
      this.networkInsetPanelButton.innerHTML = 'Shutdown';
    } else if (this.networkStatus === 'down') {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot');
      this.networkInsetPanelStatusText.innerHTML = 'Down';
      this.networkInsetPanelButton.innerHTML = 'Startup';
    } else {
      this.networkInsetPanelStatusIcon.classList.add('icon', 'icon-primitive-dot', 'text-error');
      this.networkInsetPanelStatusText.classList.add('text-error');
      this.networkInsetPanelStatusText.innerHTML = 'Exited';
      this.networkInsetPanelButton.innerHTML = 'Restart';
    }
  }

  loadChainCodes() {
    this.chaincodes = this.fabricNetwork.listChainCode();
    this.emitter.emit('change-chaincodes');
  }

  setChainCodesHandler() {
    while(this.chaincodeList.firstChild) {
      this.chaincodeList.removeChild(this.chaincodeList.firstChild);
    }
    this.chaincodes.forEach(chaincode => {
      const chaincodeItem = document.createElement('li');
      chaincodeItem.classList.add('two-lines');
      this.chaincodeList.appendChild(chaincodeItem);

      const chaincodeItemText = document.createElement('div');
      chaincodeItemText.classList.add('primary-line', 'icon', 'icon-file-text', 'primary-line-block');
      chaincodeItemText.innerHTML = chaincode;
      chaincodeItem.appendChild(chaincodeItemText);

      const chaincodeItemDeleteButton = document.createElement('span');
      chaincodeItemDeleteButton.classList.add('icon', 'icon-x');
      chaincodeItemDeleteButton.addEventListener('click', () => {
        this.fabricNetwork.removeChainCode(chaincode);
        this.loadChainCodes();
      });
      chaincodeItemText.appendChild(chaincodeItemDeleteButton);

      // 按钮
      const chaincodeItemButtons = document.createElement('div');
      chaincodeItemButtons.classList.add('secondary-line', 'no-icon');
      chaincodeItem.appendChild(chaincodeItemButtons);

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

        const cmd = `cd ${chaincode} && go build && CORE_PEER_ADDRESS=peer:7052 CORE_CHAINCODE_ID_NAME=${chaincode}:0 ./${chaincode}`;
        this.fabricNetwork.exec('chaincode', cmd, (err, msg) => {
          chaincodeItemBuildButton.innerHTML = 'Build & start';
          if (err) {
            chaincodeItemBuildButton.removeAttribute('disabled');
            alert(err);
            return;
          }
          this.logConsoleBody1.innerHTML += msg;
        });
      });
      chaincodeItemButtons.appendChild(chaincodeItemBuildButton);

      const chaincodeItemInstallButton = document.createElement('button');
      chaincodeItemInstallButton.classList.add('btn', 'inline-block-tight');
      chaincodeItemInstallButton.innerHTML = 'Install';
      chaincodeItemButtons.appendChild(chaincodeItemInstallButton);

      const chaincodeItemInstantiateButton = document.createElement('button');
      chaincodeItemInstantiateButton.classList.add('btn', 'inline-block-tight');
      chaincodeItemInstantiateButton.innerHTML = 'Instantiate';
      chaincodeItemButtons.appendChild(chaincodeItemInstantiateButton);

      const chaincodeItemInvokeButton = document.createElement('button');
      chaincodeItemInvokeButton.classList.add('btn', 'inline-block-tight');
      chaincodeItemInvokeButton.innerHTML = 'Invoke';
      chaincodeItemButtons.appendChild(chaincodeItemInvokeButton);

      const chaincodeItemQueryButton = document.createElement('button');
      chaincodeItemQueryButton.classList.add('btn', 'inline-block-tight');
      chaincodeItemQueryButton.innerHTML = 'Query';
      chaincodeItemButtons.appendChild(chaincodeItemQueryButton);

      // 日志
      const chaincodeItemLogs = document.createElement('div');
      chaincodeItemLogs.classList.add('third-line');
      chaincodeItem.appendChild(chaincodeItemLogs);

      const logPanel = document.createElement('atom-panel');
      logPanel.classList.add('pane');
      chaincodeItemLogs.appendChild(logPanel);

      const logTabBar = document.createElement('ul');
      logTabBar.classList.add('tab-bar');
      logPanel.appendChild(logTabBar);

      this.logTab1 = document.createElement('li');
      this.logTab1.classList.add('tab', 'active');
      this.logTab1.innerHTML = 'Build & start Log';
      this.logTab1.addEventListener('click', () => {
        this.logTab1.classList.add('active');
        this.logTab2.classList.remove('active');
        this.logConsole1.classList.remove('invisible');
        this.logConsole2.classList.add('invisible');
      });
      logTabBar.appendChild(this.logTab1);

      this.logTab2 = document.createElement('li');
      this.logTab2.classList.add('tab');
      this.logTab2.innerHTML = 'Action Log';
      this.logTab2.addEventListener('click', () => {
        this.logTab1.classList.remove('active');
        this.logTab2.classList.add('active');
        this.logConsole1.classList.add('invisible');
        this.logConsole2.classList.remove('invisible');
      });
      logTabBar.appendChild(this.logTab2);

      this.logConsole1 = document.createElement('div');
      this.logConsole1.classList.add('console');
      logPanel.appendChild(this.logConsole1);

      this.logConsoleBody1 = document.createElement('span');
      this.logConsoleBody1.classList.add('console-body');
      this.logConsoleBody1.innerHTML = '';
      this.logConsole1.appendChild(this.logConsoleBody1);

      this.logConsole2 = document.createElement('div');
      this.logConsole2.classList.add('console', 'invisible');
      logPanel.appendChild(this.logConsole2);

      this.logConsoleBody2 = document.createElement('span');
      this.logConsoleBody2.classList.add('console-body');
      this.logConsoleBody2.innerHTML = '';
      this.logConsole2.appendChild(this.logConsoleBody2);
    });
  }
}
