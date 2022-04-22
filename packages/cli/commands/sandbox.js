const { addConfigOptions, addAccountOptions } = require('../lib/commonOpts');
const create = require('./sandbox/create');

// const i18nKey = 'cli.commands.sandbox';

exports.command = 'sandbox';
exports.describe = false; // i18n(`${i18nKey}.describe`);

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);

  yargs.command(create).demandCommand(1, '');

  return yargs;
};
