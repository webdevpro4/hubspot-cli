const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  getAccountId,
  addTestingOptions,
} = require('../../lib/commonOpts');
const { logger } = require('@hubspot/cli-lib/logger');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { loadAndValidateOptions } = require('../../lib/validation');

const { deleteSandbox } = require('@hubspot/cli-lib/sandboxes');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { getConfig } = require('@hubspot/cli-lib');
const { deleteSandboxPrompt } = require('../../lib/prompts/sandboxesPrompt');
const { removeAccountFromConfig } = require('@hubspot/cli-lib/lib/config');
const {
  selectAndSetAsDefaultAccountPrompt,
} = require('../../lib/prompts/accountsPrompt');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.sandbox.subcommands.delete';

exports.command = 'delete';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { account } = options;
  const config = getConfig();

  let accountPrompt;
  if (!account) {
    accountPrompt = await deleteSandboxPrompt(config);
  }
  const sandboxAccountId = getAccountId({
    account: account || accountPrompt.account,
  });

  trackCommandUsage('sandbox-delete', {}, sandboxAccountId);

  let parentAccountId;
  for (const portal of config.portals) {
    if (portal.portalId === sandboxAccountId) {
      if (portal.parentAccountId) {
        parentAccountId = portal.parentAccountId;
      } else {
        const parentAccountPrompt = await deleteSandboxPrompt(config, true);
        parentAccountId = getAccountId({
          account: parentAccountPrompt.account,
        });
      }
    }
  }

  logger.debug(
    i18n(`${i18nKey}.debug.deleting`, {
      account: account || accountPrompt.account,
    })
  );

  try {
    await deleteSandbox(parentAccountId, sandboxAccountId);

    logger.log('');
    logger.success(
      i18n(`${i18nKey}.success.delete`, {
        account: account || accountPrompt.account,
        sandboxHubId: sandboxAccountId,
      })
    );
    logger.log('');

    const promptDefaultAccount = removeAccountFromConfig(sandboxAccountId);
    if (promptDefaultAccount && config.portals.length > 0) {
      await selectAndSetAsDefaultAccountPrompt(config);
    }
    process.exit(EXIT_CODES.SUCCESS);
  } catch (err) {
    logger.error(err.error.message);
    process.exit(EXIT_CODES.ERROR);
  }
};

exports.builder = yargs => {
  yargs.option('account', {
    describe: i18n(`${i18nKey}.options.account.describe`),
    type: 'string',
  });

  yargs.example([
    [
      '$0 sandbox delete --account=MySandboxAccount',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);
  addTestingOptions(yargs, true);

  return yargs;
};
