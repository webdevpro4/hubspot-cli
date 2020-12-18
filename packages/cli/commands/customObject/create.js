const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { getAbsoluteFilePath } = require('@hubspot/cms-lib/path');
const { validateAccount, isFileValidJSON } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { setLogLevel, getAccountId } = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { batchCreateObjects } = require('@hubspot/cms-lib/api/customObject');

exports.command = 'create <name> <definition>';
exports.describe = 'Create custom object instances';

exports.handler = async options => {
  const { definition, name } = options;
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
  const accountId = getAccountId(options);

  trackCommandUsage('custom-object-batch-create', null, accountId);

  const filePath = getAbsoluteFilePath(definition);
  if (!isFileValidJSON(filePath)) {
    process.exit(1);
  }

  try {
    await batchCreateObjects(accountId, name, filePath);
    logger.success(`Objects created`);
  } catch (e) {
    logErrorInstance(e, { accountId });
    logger.error(`Object creation from ${definition} failed`);
  }
};

exports.builder = yargs => {
  yargs.positional('name', {
    describe: 'Schema name to add the object instance to',
    type: 'string',
  });

  yargs.positional('definition', {
    describe:
      'Local path to the JSON file containing an array of object definitions',
    type: 'string',
  });
};
