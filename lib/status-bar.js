'use babel';

import { CompositeDisposable } from 'atom';
import { View } from 'atom-space-pen-views';

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

  initialize() {
    this.subscriptions = new CompositeDisposable();
  }

  attached() {
    this.setEvents();
  }

  detached() {
    this.dispose();
  }

  dispose() {
    this.subscriptions.dispose();
    this.remove();
  }

  setEvents() {
    this.on('click', () => {
      console.log('Activate Fabric Go!');
    });
  }
}
