const path = require('path');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getCwd } = require('@hubspot/cms-lib/path');
const { createHubDbTable } = require('@hubspot/cms-lib/hubdb');

const { validateAccount, isFileValidJSON } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');

exports.command = 'create <src>';
exports.describe = 'Create a HubDB table';

exports.handler = async options => {
  const { config: configPath, src } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('hubdb-create', {}, accountId);

  try {
    const filePath = path.resolve(getCwd(), src);
    if (!isFileValidJSON(filePath)) {
      process.exit(1);
    }

    const table = await createHubDbTable(
      accountId,
      path.resolve(getCwd(), src)
    );
    logger.log(
      `The table ${table.tableId} was created in ${accountId} with ${table.rowCount} rows`
    );
  } catch (e) {
    logger.error(`Creating the table at "${src}" failed`);
    logErrorInstance(e);
  }
};

exports.builder = yargs => {
  addAccountOptions(yargs, true);
  addConfigOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe: 'local path to file used for import',
    type: 'string',
  });
};
