const { version } = require('../package.json');
const ora = require('ora');
const {
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { logDebugInfo } = require('../lib/debugInfo');
const { loadConfig, checkAndWarnGitInclusion } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { logApiErrorInstance } = require('@hubspot/cms-lib/errorHandlers');
const { outputLogs } = require('@hubspot/cms-lib/lib/logs');
const { getFunctionByPath } = require('@hubspot/cms-lib/api/function');
const {
  getFunctionLogs,
  getLatestFunctionLog,
} = require('@hubspot/cms-lib/api/results');
const { base64EncodeString } = require('@hubspot/cms-lib/lib/encoding');

const COMMAND_NAME = 'logs';
const TAIL_DELAY = 5000;

const makeSpinner = (functionPath, portalIdentifier) => {
  return ora(
    `Tailing logs for '${functionPath}' on portal '${portalIdentifier}'.\n`
  );
};

const makeTailCall = (portalId, functionId) => {
  return async (after, spinner) => {
    const latestLog = await getFunctionLogs(portalId, functionId, { after });
    if (latestLog.results.length) {
      spinner.clear();
      outputLogs(latestLog);
    }

    return latestLog.paging.next.after;
  };
};

const tailLogs = async (portalId, functionId, functionPath, portalName) => {
  const tailCall = makeTailCall(portalId, functionId);
  const spinner = makeSpinner(functionPath, portalName || portalId);
  let after;

  spinner.start();

  try {
    const latestLog = await getLatestFunctionLog(portalId, functionId);
    after = base64EncodeString(latestLog.id);
  } catch (e) {
    // A 404 means no latest log exists(never executed)
    if (e.statusCode !== 404) {
      logApiErrorInstance(e, {
        functionPath,
        portalId,
      });
    }
  }

  return new Promise(() => {
    const tail = async after => {
      // eslint-disable-next-line require-atomic-updates
      after = await tailCall(after, spinner);
      setTimeout(() => {
        tail(after);
      }, TAIL_DELAY);
    };
    tail(after);
  });
};

const getLogs = program => {
  program
    .version(version)
    .description(`get logs for a function`)
    .arguments('<function_path>')
    .option('--latest', 'retrieve most recent log only')
    .option('-f, --follow', 'tail logs')
    .action(async (functionPath, options) => {
      const { config: configPath } = options;
      const portalId = getPortalId(program);
      const { latest, file, follow } = options;
      let logsResp;

      setLogLevel(options);
      logDebugInfo(options);
      loadConfig(configPath);
      checkAndWarnGitInclusion();
      trackCommandUsage(
        COMMAND_NAME,
        {
          latest,
          file,
        },
        portalId
      );

      logger.debug(
        `Getting ${
          latest ? 'latest ' : ''
        }logs for function with path: ${functionPath}`
      );

      const functionResp = await getFunctionByPath(
        portalId,
        functionPath
      ).catch(e => {
        logApiErrorInstance(e, {
          functionPath,
          portalId,
        });
        process.exit(1);
      });

      logger.debug(`Retrieving logs for functionId: ${functionResp.id}`);

      if (follow) {
        logsResp = await tailLogs(
          portalId,
          functionResp.id,
          functionPath,
          options.portal
        );
      } else if (latest) {
        logsResp = await getLatestFunctionLog(portalId, functionResp.id);
      } else {
        logsResp = await getFunctionLogs(portalId, functionResp.id);
      }

      if (logsResp) {
        return outputLogs(logsResp);
      }
    });

  addPortalOptions(program);
  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
};

module.exports = {
  getLogs,
};
