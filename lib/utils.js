const waitOn = require('wait-on');

async function wait(resources) {
  const options = {
    resources: [].concat(resources),
    delay: 1000,
    interval: 1000,
    log: true,
    timeout: 30000,
  };
  try {
    await waitOn(options);
  } catch (err) {
    throw new Error(err);
  }
}
module.exports = { wait };
