'use babel';

import FabricGoView from './fabric-go-view';
import { CompositeDisposable, Disposable } from 'atom';

export default {
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
  },

  toggle() {
    atom.workspace.toggle('atom://fabric-go');
  }
};
