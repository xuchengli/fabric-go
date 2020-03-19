'use babel';

export default class IdentityModal {
  constructor(submitCb, cancelCb) {
    this.element = document.createElement('div');
    this.element.classList.add('identity-modal');

    // 创建名称
    const nameDiv = document.createElement('div');
    nameDiv.classList.add('block');
    this.element.appendChild(nameDiv);
    const nameLabel = document.createElement('label');
    nameLabel.classList.add('inline-block');
    nameLabel.innerHTML = 'Name:';
    nameDiv.appendChild(nameLabel);
    const nameInput = document.createElement('input');
    nameInput.classList.add('input-text', 'inline-block', 'native-key-bindings', 'name-input');
    nameInput.setAttribute('type', 'text');
    nameDiv.appendChild(nameInput);

    // 创建角色
    const roleDiv = document.createElement('div');
    roleDiv.classList.add('block');
    this.element.appendChild(roleDiv);
    const roleLabel = document.createElement('label');
    roleLabel.classList.add('inline-block');
    roleLabel.innerHTML = 'Role:';
    roleDiv.appendChild(roleLabel);
    const roleSelection = document.createElement('select');
    roleSelection.classList.add('input-select', 'inline-block');
    roleDiv.appendChild(roleSelection);
    ['admin', 'peer', 'orderer', 'client'].forEach(role => {
      const roleOption = document.createElement('option');
      roleOption.setAttribute('value', role);
      roleOption.innerHTML = role;
      roleSelection.appendChild(roleOption);
    });

    // 创建affiliation
    const affiliationDiv = document.createElement('div');
    affiliationDiv.classList.add('block');
    this.element.appendChild(affiliationDiv);
    const affiliationLabel = document.createElement('label');
    affiliationLabel.classList.add('inline-block');
    affiliationLabel.innerHTML = 'Affiliation:';
    affiliationDiv.appendChild(affiliationLabel);
    const affiliationInput = document.createElement('input');
    affiliationInput.classList.add('input-text', 'inline-block', 'native-key-bindings', 'affiliation-input');
    affiliationInput.setAttribute('type', 'text');
    affiliationDiv.appendChild(affiliationInput);

    // 创建属性
    const attributeDiv = document.createElement('div');
    attributeDiv.classList.add('block');
    this.element.appendChild(attributeDiv);
    const attributeLabel = document.createElement('label');
    attributeLabel.classList.add('inline-block', 'attr-label');
    attributeLabel.innerHTML = 'Attribute:';
    attributeDiv.appendChild(attributeLabel);
    const addDiv = document.createElement('div');
    addDiv.classList.add('inline-block', 'add-div');
    attributeDiv.appendChild(addDiv);
    const addBtn = document.createElement('span');
    addBtn.classList.add('icon', 'icon-diff-added');
    addBtn.addEventListener('click', () => {
      this.addAttribute();
    });
    addDiv.appendChild(addBtn);
    this.lineDiv = document.createElement('div');
    this.lineDiv.classList.add('line-div');
    addDiv.appendChild(this.lineDiv);

    // 创建提交，关闭按钮
    const buttons = document.createElement('div');
    buttons.classList.add('block', 'buttons');
    this.element.appendChild(buttons);

    const submitBtn = document.createElement('button');
    submitBtn.classList.add('btn', 'btn-primary', 'inline-block-tight');
    submitBtn.innerHTML = 'Submit';
    submitBtn.addEventListener('click', () => {
      const identity = {};

      const nameElem = this.element.getElementsByClassName('name-input')[0];
      if (nameElem.value === '') {
        alert('Please input identity name.');
        nameElem.focus();
        return;
      }
      Object.assign(identity, { name: nameElem.value });

      const roleElem = this.element.getElementsByTagName('select')[0];
      Object.assign(identity, { role: roleElem.value });

      const affiliationElem = this.element.getElementsByClassName('affiliation-input')[0];
      if (affiliationElem.value === '') {
        alert('Please input identity affiliation.');
        affiliationElem.focus();
        return;
      }
      Object.assign(identity, { affiliation: affiliationElem.value });

      const keyElem = this.element.getElementsByClassName('key-input');
      const keys = [...keyElem].map(key => key.value);
      const valueElem = this.element.getElementsByClassName('value-input');
      const values = [...valueElem].map(val => val.value);
      const attributes = keys.map((k, i) => ({
        key: k,
        value: values[i],
      }));
      Object.assign(identity, { attributes });

      submitCb(identity);
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

  addAttribute() {
    const inputLine = document.createElement('div');
    inputLine.classList.add('attr-input');
    this.lineDiv.appendChild(inputLine);

    const num = document.createElement('span');
    num.classList.add('inline-block');
    num.innerHTML = [...this.lineDiv.children].indexOf(inputLine) + 1;
    inputLine.appendChild(num);

    const inputKey = document.createElement('input');
    inputKey.classList.add('input-text', 'native-key-bindings', 'inline-block', 'key-input');
    inputKey.setAttribute('type', 'text');
    inputKey.setAttribute('placeholder', 'Key');
    inputLine.appendChild(inputKey);

    const colon = document.createElement('span');
    colon.classList.add('inline-block');
    colon.innerHTML = ':';
    inputLine.appendChild(colon);

    const inputValue = document.createElement('input');
    inputValue.classList.add('input-text', 'native-key-bindings', 'inline-block', 'value-input');
    inputValue.setAttribute('type', 'text');
    inputValue.setAttribute('placeholder', 'Value');
    inputLine.appendChild(inputValue);

    const removeBtn = document.createElement('span');
    removeBtn.classList.add('icon', 'icon-diff-removed');
    removeBtn.addEventListener('click', evt => {
      const _this = evt.target;
      // TODO: 修改行号
      let line = _this.parentNode;
      while((line = line.nextSibling) !== null) {
        line.firstChild.innerHTML = parseInt(line.firstChild.innerHTML) - 1;
      }
      _this.parentNode.remove();
    });
    inputLine.appendChild(removeBtn);
  }
}
