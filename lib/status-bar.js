'use babel';

import { View } from 'atom-space-pen-views';
import FabricNetwork from './fabric-network';

export default class StatusBarView extends View {
  static content() {
    return this.div({
      class: 'inline-block',
    }, () => {
      this.span({
        class: 'icon icon-globe',
        style: 'cursor: pointer',
      }, () => {
        this.text('Fabric Go');
      });
    });
  }

  attached() {
    this.on('click', () => {
      if (FabricNetwork.checkEnv()) {
        atom.workspace.toggle('atom://fabric-go');
      }
    });
  }

  detached() {
    this.remove();
  }
}
