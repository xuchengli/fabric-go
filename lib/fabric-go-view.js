'use babel';

import { CompositeDisposable, Emitter } from 'atom';

export default class FabricGoView {

  constructor(serializedState) {
    this.status = 'down';

    this.emitter = new Emitter();
    this.subscriptions = new CompositeDisposable(
      this.emitter.on('change-status', () => {
        this.setStatusHandler();
      }),
    );

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('fabric-go');

    // Create fabric network panel
    const networkPanel = document.createElement('atom-panel');
    networkPanel.classList.add('padded');
    networkPanel.innerHTML = `
      <div class='inset-panel padded'>
        <span class='inline-block'>Fabric Network</span>
        <span class='inline-block icon icon-primitive-dot status-icon'></span>
        <span class='inline-block status-text'>Down</span>
        <button name='network-toggle' class='btn'>Startup</button>
      </div>
    `;

    this.element.appendChild(networkPanel);
    this.element.addEventListener('click', evt => {
      const target = evt.target;
      if (target.getAttribute('name') === 'network-toggle') {
        this.changeStatus();
      }
    });
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

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://fabric-go';
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.subscriptions.dispose();
  }

  getElement() {
    return this.element;
  }

  changeStatus() {
    this.status = this.status === 'up' ? 'down' : 'up';
    this.emitter.emit('change-status');
  }

  setStatusHandler() {
    if (this.status === 'up') {
      this.element.querySelector('.status-icon').classList.add('text-success');
      this.element.querySelector('.status-text').classList.add('text-success');
      this.element.querySelector('.status-text').innerHTML = 'Up';
      this.element.querySelector('[name="network-toggle"]').innerHTML = 'Shutdown';
    } else if (this.status === 'down') {
      this.element.querySelector('.status-icon').classList.remove('text-success');
      this.element.querySelector('.status-text').classList.remove('text-success');
      this.element.querySelector('.status-text').innerHTML = 'Down';
      this.element.querySelector('[name="network-toggle"]').innerHTML = 'Startup';
    } else {

    }
  }
}
