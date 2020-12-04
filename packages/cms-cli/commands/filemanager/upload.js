const fs = require('fs');
const path = require('path');

const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { uploadFolder } = require('@hubspot/cms-lib/fileManager');
const { uploadFile } = require('@hubspot/cms-lib/api/fileManager');
const { getCwd, convertToUnixPath } = require('@hubspot/cms-lib/path');
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
  addUseEnvironmentOptions,
  setLogLevel,
  getAccountId,
} = require('../../lib/commonOpts');
const { logDebugInfo } = require('../../lib/debugInfo');
const { validateAccount } = require('../../lib/validation');
const { trackCommandUsage } = require('../../lib/usageTracking');

exports.command = 'upload <src> <dest>';
exports.describe =
  'Upload a folder or file from your computer to the HubSpot File Manager';

exports.handler = async options => {
  const { config: configPath, src, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!validateConfig() || !(await validateAccount(options))) {
    process.exit(1);
  }

  const accountId = getAccountId(options);
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
    'filemanager-upload',
    { type: stats.isFile() ? 'file' : 'folder' },
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
    if (shouldIgnoreFile(absoluteSrcPath)) {
      logger.error(`The file "${src}" is being ignored via an .hsignore rule`);
      return;
    }

    uploadFile(accountId, absoluteSrcPath, normalizedDest)
      .then(() => {
        logger.success(
          'Uploaded file from "%s" to "%s" in the File Manager of account %s',
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
      `Uploading files from "${src}" to "${dest}" in the File Manager of account ${accountId}`
    );
    uploadFolder(accountId, absoluteSrcPath, dest)
      .then(() => {
        logger.success(
          `Uploading files to "${dest}" in the File Manager is complete`
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
  addUseEnvironmentOptions(yargs, true);

  yargs.positional('src', {
    describe:
      'Path to the local file, relative to your current working directory',
    type: 'string',
  });
  yargs.positional('dest', {
    describe: 'Path in HubSpot Design Tools, can be a net new path',
    type: 'string',
  });
};
