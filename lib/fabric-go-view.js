'use babel';

export default class FabricGoView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('fabric-go');

    // Create message element
    const message = document.createElement('div');
    message.textContent = 'The FabricGo package is Alive! It\'s ALIVE!';
    message.classList.add('message');
    this.element.appendChild(message);
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
    return ['left', 'right', 'bottom'];
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
  }

  getElement() {
    return this.element;
  }

}
