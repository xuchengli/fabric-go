'use babel';

export default class CCParamModal {
  constructor(serializedState) {
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

    const buttons = document.createElement('div');
    buttons.classList.add('buttons');
    li.appendChild(buttons);

    const submitBtn = document.createElement('button');
    submitBtn.classList.add('btn', 'btn-primary', 'inline-block-tight');
    submitBtn.innerHTML = 'Submit';
    buttons.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.classList.add('btn');
    cancelBtn.innerHTML = 'Cancel';
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

  addParam() {
    const inputText = document.createElement('input');
    inputText.classList.add('input-text');
    inputText.setAttribute('type', 'text');
    inputText.setAttribute('placeholder', 'param value');

    this.input.appendChild(inputText);
  }
}
