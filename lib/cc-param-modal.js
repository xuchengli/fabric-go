'use babel';

export default class CCParamModal {
  constructor(params = [], submitCb, cancelCb) {
    this.element = document.createElement('div');
    this.element.classList.add('select-list', 'cc-param');

    const ol = document.createElement('ol');
    ol.classList.add('list-group');
    this.element.appendChild(ol);

    const li = document.createElement('li');
    li.classList.add('two-lines');
    ol.appendChild(li);

    const addBtn = document.createElement('div');
    addBtn.classList.add('status', 'icon', 'icon-diff-added');
    addBtn.addEventListener('click', () => {
      this.addParam();
    });
    li.appendChild(addBtn);

    const title = document.createElement('div');
    title.classList.add('primary-line');
    title.innerHTML = 'Params:';
    li.appendChild(title);

    this.input = document.createElement('div');
    this.input.classList.add('secondary-line');
    li.appendChild(this.input);
    params.forEach(param => {
      this.addParam(param);
    });

    const buttons = document.createElement('div');
    buttons.classList.add('buttons');
    li.appendChild(buttons);

    const submitBtn = document.createElement('button');
    submitBtn.classList.add('btn', 'btn-primary', 'inline-block-tight');
    submitBtn.innerHTML = 'Submit';
    submitBtn.addEventListener('click', () => {
      const inputs = this.input.getElementsByTagName('input');
      submitCb([...inputs].map(input => input.value));
    });
    buttons.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.classList.add('btn');
    cancelBtn.innerHTML = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      cancelCb();
    });
    buttons.appendChild(cancelBtn);
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

  clear() {
    while (this.input.firstChild) {
      this.input.removeChild(this.input.firstChild);
    }
  }

  addParam(value = '') {
    const inputLine = document.createElement('div');
    this.input.appendChild(inputLine);

    const inputText = document.createElement('input');
    inputText.classList.add('input-text', 'native-key-bindings');
    inputText.setAttribute('type', 'text');
    inputText.setAttribute('value', value);
    inputLine.appendChild(inputText);

    const removeBtn = document.createElement('div');
    removeBtn.classList.add('status', 'icon', 'icon-diff-removed');
    removeBtn.addEventListener('click', evt => {
      const _this = evt.target;
      _this.parentNode.remove();
    });
    inputLine.appendChild(removeBtn);
  }
}
