const { version } = require('../package.json');
const { loadConfig } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { AUTH_METHODS } = require('@hubspot/cms-lib/lib/constants');
const {
  setupOauth,
  addOauthToPortalConfig,
} = require('@hubspot/cms-lib/oauth');

const { validateConfig } = require('../lib/validation');
const {
  addConfigOptions,
  addLoggerOptions,
  setLogLevel,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { promptUser, OAUTH_FLOW } = require('../lib/prompts');

const COMMAND_NAME = 'auth';
const REQUIRED_SCOPES = ['content'];

const addNewAuthorizedOauthToConfig = async configData => {
  const portalId = parseInt(configData.portalId, 10);
  const oauth = setupOauth(portalId, {
    ...configData,
    scopes: REQUIRED_SCOPES,
  });
  logger.log('Authorizing');
  await oauth.authorize();
  addOauthToPortalConfig(portalId, oauth);
};

async function authAction(type, options) {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath);

  if (!validateConfig()) {
    process.exit(1);
  }

  if (type !== AUTH_METHODS.oauth.value) {
    logger.error(
      `The only supported authentication protocol is '${AUTH_METHODS.oauth.value}'`
    );
    return;
  }

  const configData = await promptUser(OAUTH_FLOW);
  trackCommandUsage(COMMAND_NAME);
  await addNewAuthorizedOauthToConfig(configData);
}

function configureAuthCommand(program) {
  program
    .version(version)
    .description('Configure authentication for a HubSpot account')
    .arguments('<type>')
    .action(authAction);

  addLoggerOptions(program);
  addConfigOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureAuthCommand,
  addNewAuthorizedOauthToConfig,
};
