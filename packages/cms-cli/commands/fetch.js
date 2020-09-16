const { version } = require('../package.json');

const { downloadFileOrFolder } = require('@hubspot/cms-lib/fileMapper');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');

const {
  addConfigOptions,
  addPortalOptions,
  addLoggerOptions,
  addOverwriteOptions,
  addModeOptions,
  getPortalId,
  getMode,
  setLogLevel,
} = require('../lib/commonOpts');
const { resolveLocalPath } = require('../lib/filesystem');
const { validatePortal, validateMode } = require('../lib/validation');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');

const COMMAND_NAME = 'fetch';
const DESCRIPTION =
  'Fetch a file, directory or module from HubSpot and write to a path on your computer';

const action = async ({ src, dest }, command) => {
  setLogLevel(command);
  logDebugInfo(command);

  const { config: configPath } = command;
  loadConfig(configPath);
  checkAndWarnGitInclusion();

  if (
    !(
      validateConfig() &&
      (await validatePortal(command)) &&
      validateMode(command)
    )
  ) {
    process.exit(1);
  }

  if (typeof src !== 'string') {
    logger.error('A source to fetch is required');
    process.exit(1);
  }

  dest = resolveLocalPath(dest);

  const portalId = getPortalId(command);
  const mode = getMode(command);

  trackCommandUsage(COMMAND_NAME, { mode }, command);

  // Fetch and write file/folder.
  downloadFileOrFolder({ portalId, src, dest, mode, options: command });
};

// Yargs Configuration
const command = `${COMMAND_NAME} <src> [dest]`;
const describe = DESCRIPTION;
const builder = yargs => {
  addConfigOptions(yargs, true);
  addPortalOptions(yargs, true);
  addOverwriteOptions(yargs, true);
  addModeOptions(yargs, { read: true }, true);

  yargs.positional('src', {
    describe: 'Path in HubSpot Design Tools',
    type: 'string',
    demand: true,
  });

  yargs.positional('dest', {
    describe:
      'Local directory you would like the files to be placed in, relative to your current working directory',
    type: 'string',
  });

  return yargs;
};
const handler = async argv => action({ src: argv.src, dest: argv.dest }, argv);

// Commander Configuration
const configureCommanderFetchCommand = commander => {
  commander
    .version(version)
    .description(DESCRIPTION)
    .arguments('<src> [dest]')
    .action((src, dest) => action({ src, dest }, commander));

  addConfigOptions(commander);
  addPortalOptions(commander);
  addLoggerOptions(commander);
  addOverwriteOptions(commander);
  addModeOptions(commander, { read: true });
  addHelpUsageTracking(commander, COMMAND_NAME);
};

module.exports = {
  // Yargs
  command,
  describe,
  builder,
  handler,
  // Commander
  configureCommanderFetchCommand,
};
