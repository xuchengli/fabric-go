'use babel';

export default class InstallCCModal {
  constructor(nodes, submitCb, cancelCb) {
    this.element = document.createElement('div');
    this.element.classList.add('install-cc-modal');

    // 节点列表
    const nodeDiv = document.createElement('div');
    nodeDiv.classList.add('block');
    this.element.appendChild(nodeDiv);
    const nodeLabel = document.createElement('label');
    nodeLabel.classList.add('inline-block');
    nodeLabel.innerHTML = 'Node:';
    nodeDiv.appendChild(nodeLabel);
    const nodeSelection = document.createElement('select');
    nodeSelection.classList.add('input-select', 'inline-block');
    nodeDiv.appendChild(nodeSelection);
    nodes.forEach(node => {
      const nodeOption = document.createElement('option');
      nodeOption.setAttribute('value', node);
      nodeOption.innerHTML = node;
      nodeSelection.appendChild(nodeOption);
    });

    // 创建提交，关闭按钮
    this.buttonsDiv = document.createElement('div');
    this.buttonsDiv.classList.add('block', 'buttons');
    this.element.appendChild(this.buttonsDiv);

    const submitBtn = document.createElement('button');
    submitBtn.classList.add('btn', 'btn-primary', 'inline-block-tight');
    submitBtn.innerHTML = 'Submit';
    submitBtn.addEventListener('click', () => {
      const nodeElem = this.element.getElementsByTagName('select')[0];
      submitCb(nodeElem.value);
    });
    this.buttonsDiv.appendChild(submitBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.classList.add('btn');
    cancelBtn.innerHTML = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      cancelCb();
    });
    this.buttonsDiv.appendChild(cancelBtn);
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
