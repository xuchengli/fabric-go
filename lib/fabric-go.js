'use babel';

import StatusBarView from './status-bar';
import FabricGoView from './fabric-go-view';
import FabricNetwork from './fabric-network';
import { CompositeDisposable, Disposable } from 'atom';

export default {
  statusBarTile: null,
  statusBarView: null,
  subscriptions: null,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable(
      // Add an opener for our view.
      atom.workspace.addOpener(uri => {
        if (uri === 'atom://fabric-go') {
          return new FabricGoView();
        }
      }),
      // Register command that toggles this view
      atom.commands.add('atom-workspace', {
        'fabric-go:toggle': () => this.toggle()
      }),
      // Destroy any FabricGoViews when the package is deactivated.
      new Disposable(() => {
        atom.workspace.getPaneItems().forEach(item => {
          if (item instanceof FabricGoView) {
            item.destroy();
          }
        });
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    this.destroyStatusBar();
  },

  toggle() {
    if (FabricNetwork.checkEnv()) {
      atom.workspace.toggle('atom://fabric-go');
    }
  },

  setStatusbar(statusBar) {
    this.destroyStatusBar(statusBar);

    this.statusBarView = new StatusBarView();
    this.statusBarTile = statusBar.addRightTile({
      item: this.statusBarView,
      priority: -1000,
    });
  },

  destroyStatusBar() {
    if (this.statusBarView) {
      this.statusBarView.dispose();
      this.statusBarView = null;
    }
    if (this.statusBarTile) {
      this.statusBarTile.destroy();
      this.statusBarTile = null;
    }
  },

  consumeStatusBar(statusBar) {
    this.setStatusbar(statusBar);
  },
};
