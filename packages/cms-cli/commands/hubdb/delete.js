const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { deleteTable } = require('@hubspot/cms-lib/api/hubdb');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'delete <tableId>';
exports.describe = 'delete a HubDB table';

exports.handler = async options => {
  const { config: configPath, tableId } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-delete', {}, accountId);

  try {
    await deleteTable(accountId, tableId);
    logger.log(`The table ${tableId} was deleted from ${accountId}`);
  } catch (e) {
    logger.error(`Deleting the table ${tableId} failed`);
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('tableId', {
    describe: 'HubDB Table ID',
    type: 'string',
  });
};
