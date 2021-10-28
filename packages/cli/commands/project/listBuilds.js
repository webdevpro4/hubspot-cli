const path = require('path');

const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  fetchProject,
  fetchProjectBuilds,
} = require('@hubspot/cli-lib/api/dfs');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');
const { getCwd } = require('@hubspot/cli-lib/path');
const { validateAccount } = require('../../lib/validation');
const { getProjectConfig } = require('../../lib/projects');
const moment = require('moment');
const { prompt } = require('inquirer');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'list-builds [path]';
exports.describe = false;

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath, limit } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-list-builds', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const projectConfig = await getProjectConfig(cwd);

  logger.debug(`Fetching builds for project at path: ${projectPath}`);

  const fetchAndDisplayBuilds = async (project, options) => {
    const { results, paging } = await fetchProjectBuilds(
      accountId,
      projectConfig.name,
      options
    );
    const currentDeploy = project.deployedBuildId;

    if (results.length === 0) {
      logger.log('No builds found.');
    } else {
      const builds = results.map(build => {
        const isCurrentlyDeployed = build.buildId === currentDeploy;

        return [
          isCurrentlyDeployed
            ? `#${build.buildId} [deployed]`
            : `#${build.buildId}`,
          build.status,
          moment(build.finishedAt).format('MM/DD/YYYY hh:mm:ss A'),
          Math.round(
            moment
              .duration(moment(build.finishedAt).diff(moment(build.enqueuedAt)))
              .asSeconds()
          ) + 's',
          build.subbuildStatuses
            .filter(subbuild => subbuild.status === 'FAILURE')
            .map(subbuild => `${subbuild.buildName} failed`)
            .join(','),
        ];
      });
      builds.unshift(
        getTableHeader([
          'Build ID',
          'Status',
          'Completed',
          'Duration',
          'Details',
        ])
      );
      logger.log(
        getTableContents(builds, {
          columnDefault: {
            paddingLeft: 3,
          },
        })
      );
    }
    if (paging && paging.next.after) {
      await prompt({
        name: 'more',
        message: 'Load more builds? <enter>',
      });
      await fetchAndDisplayBuilds(project, { limit, after: paging.next.after });
    }
  };

  try {
    const project = await fetchProject(accountId, projectConfig.name);

    await fetchAndDisplayBuilds(project, { limit });
  } catch (e) {
    logApiErrorInstance(e, new ApiErrorContext({ accountId }));
  }
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    limit: {
      describe: 'Max number of builds to load',
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project list-builds myProjectFolder',
      'Fetch a list of builds for a project within the myProjectFolder folder',
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
