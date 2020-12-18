const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  uploadFolder,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const {
  getFileMapperApiQueryFromMode,
} = require('@hubspot/cms-lib/fileMapper');
const { upload } = require('@hubspot/cms-lib/api/fileMapper');
const {
  getCwd,
  convertToUnixPath,
  isAllowedExtension,
} = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logErrorInstance,
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { validateSrcAndDestPaths } = require('@hubspot/cms-lib/modules');
const { shouldIgnoreFile } = require('@hubspot/cms-lib/ignoreRules');

const {
  addConfigOptions,
  addAccountOptions,
  addModeOptions,
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
  getMode,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { validateAccount, validateMode } = require('../lib/validation');
const { trackCommandUsage } = require('../lib/usageTracking');

exports.command = 'upload <src> <dest>';
exports.describe =
  'Upload a folder or file from your computer to the HubSpot CMS';

exports.handler = async options => {
  const { src, dest, config: configPath } = options;
  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (
    !(
      validateConfig() &&
      (await validateAccount(options)) &&
      validateMode(options)
    )
  ) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
  const mode = getMode(options);
  const absoluteSrcPath = path.resolve(getCwd(), src);
  let stats;
  try {
    stats = fs.statSync(absoluteSrcPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      logger.error(`The path "${src}" is not a path to a file or folder`);
      return;
    }
  } catch (e) {
    logger.error(`The path "${src}" is not a path to a file or folder`);
    return;
  }

  if (!dest) {
    logger.error('A destination path needs to be passed');
    return;
  }
  const normalizedDest = convertToUnixPath(dest);
  trackCommandUsage(
    'upload',
    { mode, type: stats.isFile() ? 'file' : 'folder' },
    accountId
  );
  const srcDestIssues = await validateSrcAndDestPaths(
    { isLocal: true, path: src },
    { isHubSpot: true, path: dest }
  );

  if (srcDestIssues.length) {
    srcDestIssues.forEach(({ message }) => logger.error(message));
    process.exit(1);
  }
  if (stats.isFile()) {
    if (!isAllowedExtension(src)) {
      logger.error(`The file "${src}" does not have a valid extension`);
      return;
    }

    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(`The file "${src}" is being ignored via an .hsignore rule`);
      return;
    }

    upload(accountId, absoluteSrcPath, normalizedDest, {
      qs: getFileMapperApiQueryFromMode(mode),
    })
      .then(() => {
        logger.success(
          'Uploaded file from "%s" to "%s" in the Design Manager of account %s',
          src,
          normalizedDest,
          accountId
        );
      })
      .catch(error => {
        logger.error('Uploading file "%s" to "%s" failed', src, normalizedDest);
        logApiUploadErrorInstance(
          error,
          new ApiErrorContext({
            accountId,
            request: normalizedDest,
            payload: src,
          })
        );
      });
  } else {
    logger.log(
      `Uploading files from "${src}" to "${dest}" in the Design Manager of account ${accountId}`
    );
    uploadFolder(accountId, absoluteSrcPath, dest, {
      mode,
    })
      .then(() => {
        logger.success(
          `Uploading files to "${dest}" in the Design Manager is complete`
        );
      })
      .catch(error => {
        logger.error('Uploading failed');
        logErrorInstance(error, {
          accountId,
        });
      });
  }
};

exports.builder = yargs => {
  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addModeOptions(yargs, { write: true }, true);
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe:
      'Path to the local file, relative to your current working directory.',
    type: 'string',
  });
  yargs.positional('dest', {
    describe: 'Path in HubSpot Design Tools, can be a net new path.',
    type: 'string',
  });
  return yargs;
};
