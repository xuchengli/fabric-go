'use babel';

import FabricGoView from './fabric-go-view';
import { CompositeDisposable } from 'atom';

export default {

  fabricGoView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.fabricGoView = new FabricGoView(state.fabricGoViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.fabricGoView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'fabric-go:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.fabricGoView.destroy();
  },

  serialize() {
    return {
      fabricGoViewState: this.fabricGoView.serialize()
    };
  },

  toggle() {
    console.log('FabricGo was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
