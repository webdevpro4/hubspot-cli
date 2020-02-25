const fs = require('fs-extra');
const path = require('path');
const { EOL } = require('os');
const yaml = require('js-yaml');
const findup = require('findup-sync');
const { logger } = require('../logger');
const {
  logErrorInstance,
  logFileSystemErrorInstance,
} = require('../errorHandlers');
const { getCwd } = require('../path');
const {
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  EMPTY_CONFIG_FILE_CONTENTS,
  Mode,
} = require('./constants');

let _config;
let _configPath;

const getConfig = () => _config;

const setConfig = updatedConfig => {
  _config = updatedConfig;
  return _config;
};

/**
 * @returns {boolean}
 */
const validateConfig = () => {
  const config = getConfig();
  if (!config) {
    logger.error('config is not defined');
    return false;
  }
  if (!Array.isArray(config.portals)) {
    logger.error('config.portals[] is not defined');
    return false;
  }
  const portalsHash = {};
  return config.portals.every(cfg => {
    if (!cfg) {
      logger.error('config.portals[] has an empty entry');
      return false;
    }
    if (!cfg.portalId) {
      logger.error('config.portals[] has an entry missing portalId');
      return false;
    }
    if (portalsHash[cfg.portalId]) {
      logger.error(
        `config.portals[] has multiple entries with portalId=${cfg.portalId}`
      );
      return false;
    }
    portalsHash[cfg.portalId] = cfg;
    return true;
  });
};

const getOrderedConfig = unorderedConfig => {
  const {
    defaultPortal,
    defaultMode,
    httpTimeout,
    allowsUsageTracking,
    portals,
    ...rest
  } = unorderedConfig;

  return {
    defaultPortal,
    defaultMode,
    httpTimeout,
    allowsUsageTracking,
    portals,
    ...rest,
  };
};

const charToGlob = ch => `[${ch.toUpperCase()}${ch.toLowerCase()}]`;
const wordToGlobs = word => [].map.call(word, charToGlob).join('');

// .gitignore can be case-sensitive (configurable by user)
// const CONFIG_GITIGNORE_PATTERN = 'hubspot.config.*';
const CONFIG_GITIGNORE_PATTERN = `${wordToGlobs('hubspot')}.${wordToGlobs(
  'config'
)}.*`;
const CONFIG_GITIGNORE_PATTERN_REGEX = /hubspot\.config\..*/i;

/**
 * @param {object}  options
 * @param {string}  options.path
 */
const ensureConfigGitignore = async (options = {}) => {
  const configPath = options.path || _configPath;
  try {
    const dir = path.dirname(configPath);
    const ignoreFilePath = path.join(dir, '.gitignore');
    await fs.ensureFile(ignoreFilePath);
    let source = fs.readFile(ignoreFilePath) || '';
    if (source) {
      const lines = source.split(/[\n\r]/);
      const hasPattern =
        lines.find(
          CONFIG_GITIGNORE_PATTERN_REGEX.test,
          CONFIG_GITIGNORE_PATTERN_REGEX
        ) != null;
      if (hasPattern) {
        return;
      }
    }
    source = `${CONFIG_GITIGNORE_PATTERN}${EOL}${source}`;
    await fs.writeFile(ignoreFilePath, source);
  } catch (err) {
    logFileSystemErrorInstance(err, { filepath: configPath, write: true });
  }
};

/**
 * @param {object}  options
 * @param {string}  options.path
 * @param {string}  options.source
 * @param {boolean} options.gitignore
 */
const writeConfig = (options = {}) => {
  let source;
  try {
    source =
      typeof options.source === 'string'
        ? options.source
        : yaml.safeDump(
            JSON.parse(JSON.stringify(getOrderedConfig(getConfig()), null, 2))
          );
  } catch (err) {
    logErrorInstance(err);
    return;
  }
  const configPath = options.path || _configPath;
  const gitignore =
    options.gitignore === !!options.gitignore ? options.gitignore : true;
  try {
    logger.debug(`Writing current config to ${configPath}`);
    fs.ensureFileSync(configPath);
    fs.writeFileSync(configPath, source);
    if (gitignore) {
      ensureConfigGitignore();
    }
  } catch (err) {
    logFileSystemErrorInstance(err, { filepath: configPath, write: true });
  }
};

const readConfigFile = () => {
  let source;
  let error;
  if (!_configPath) {
    return { source, error };
  }
  try {
    source = fs.readFileSync(_configPath);
  } catch (err) {
    error = err;
    logger.error('Config file could not be read "%s"', _configPath);
    logFileSystemErrorInstance(err, { filepath: _configPath, read: true });
  }
  return { source, error };
};

const parseConfig = configSource => {
  let parsed;
  let error;
  if (!configSource) {
    return { parsed, error };
  }
  try {
    parsed = yaml.safeLoad(configSource);
  } catch (err) {
    error = err;
    logger.error('Config file could not be parsed "%s"', _configPath);
    logErrorInstance(err);
  }
  return { parsed, error };
};

const loadConfig = (path, options = {}) => {
  _configPath = getConfigPath(path);
  if (!_configPath) {
    if (!options.silenceErrors) {
      logger.error(
        `A ${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME} file could not be found`
      );
    }
    return;
  }

  logger.debug(`Reading config from ${_configPath}`);
  const { source, error: sourceError } = readConfigFile(_configPath);
  if (sourceError) return;
  const { parsed, error: parseError } = parseConfig(source);
  if (parseError) return;
  _config = parsed;

  if (!_config) {
    logger.debug('The config file was empty config');
    logger.debug('Initializing an empty config');
    _config = {
      portals: [],
    };
  }
};

const isTrackingAllowed = () => {
  if (!configFileExists() || configFileIsBlank()) {
    return true;
  }
  const { allowUsageTracking } = getAndLoadConfigIfNeeded();
  return allowUsageTracking !== false;
};

const getAndLoadConfigIfNeeded = () => {
  if (!_config) {
    loadConfig(null, {
      silenceErrors: true,
    });
  }
  return _config;
};

const getConfigPath = path => {
  return (
    path ||
    findup([
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
      DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME.replace('.yml', '.yaml'),
    ])
  );
};

const setConfigPath = path => {
  return (_configPath = path);
};

const getConfigEnv = environment => {
  return environment && environment.toUpperCase() === 'QA' ? 'QA' : undefined;
};

const getPortalConfig = portalId => {
  const config = getAndLoadConfigIfNeeded();
  return config.portals.find(portal => portal.portalId === portalId);
};

const getPortalId = nameOrId => {
  const config = getAndLoadConfigIfNeeded();
  let name;
  let portalId;
  let portal;
  if (!nameOrId) {
    if (config && config.defaultPortal) {
      name = config.defaultPortal;
    }
  } else {
    if (typeof nameOrId === 'number') {
      portalId = nameOrId;
    } else if (/^\d+$/.test(nameOrId)) {
      portalId = parseInt(nameOrId, 10);
    } else {
      name = nameOrId;
    }
  }

  if (name) {
    portal = config.portals.find(p => p.name === name);
  } else if (portalId) {
    portal = config.portals.find(p => p.portalId === portalId);
  }

  if (portal) {
    return portal.portalId;
  }

  return null;
};

/**
 * @throws {Error}
 */
const updatePortalConfig = configOptions => {
  const {
    portalId,
    authType,
    environment,
    clientId,
    clientSecret,
    scopes,
    tokenInfo,
    defaultMode,
    name,
    apiKey,
    personalAccessKey,
  } = configOptions;

  if (!portalId) {
    throw new Error('A portalId is required to update the config');
  }

  const config = getAndLoadConfigIfNeeded();
  const portalConfig = getPortalConfig(portalId);

  let auth;
  if (clientId || clientSecret || scopes || tokenInfo) {
    auth = {
      ...(portalConfig ? portalConfig.auth : {}),
      clientId,
      clientSecret,
      scopes,
      tokenInfo,
    };
  }
  const env = getConfigEnv(environment || (portalConfig && portalConfig.env));
  const mode = defaultMode && defaultMode.toLowerCase();
  const nextPortalConfig = {
    ...portalConfig,
    name,
    env,
    portalId,
    authType,
    auth,
    apiKey,
    defaultMode: Mode[mode] ? mode : undefined,
    personalAccessKey,
  };

  if (portalConfig) {
    logger.debug(`Updating config for ${portalId}`);
    const index = config.portals.indexOf(portalConfig);
    config.portals[index] = nextPortalConfig;
  } else {
    logger.debug(`Adding config entry for ${portalId}`);
    if (config.portals) {
      config.portals.push(nextPortalConfig);
    } else {
      config.portals = [nextPortalConfig];
    }
  }
  writeConfig();
};

/**
 * @throws {Error}
 */
const updateDefaultPortal = defaultPortal => {
  if (
    !defaultPortal ||
    (typeof defaultPortal !== 'number' && typeof defaultPortal !== 'string')
  ) {
    throw new Error(
      'A defaultPortal with value of number or string is required to update the config'
    );
  }

  const config = getAndLoadConfigIfNeeded();
  config.defaultPortal = defaultPortal;
  setDefaultConfigPathIfUnset();
  writeConfig();
};

const setDefaultConfigPathIfUnset = () => {
  if (!_configPath) {
    setDefaultConfigPath();
  }
};

const setDefaultConfigPath = () => {
  setConfigPath(`${getCwd()}/${DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME}`);
};

const configFileExists = () => {
  return _configPath && fs.existsSync(_configPath);
};

const configFileIsBlank = () => {
  return _configPath && fs.readFileSync(_configPath).length === 0;
};

const createEmptyConfigFile = () => {
  setDefaultConfigPathIfUnset();

  if (configFileExists()) {
    return;
  }

  writeConfig({ source: EMPTY_CONFIG_FILE_CONTENTS });
};

const deleteEmptyConfigFile = () => {
  return (
    configFileExists() && configFileIsBlank() && fs.unlinkSync(_configPath)
  );
};

module.exports = {
  getAndLoadConfigIfNeeded,
  getConfig,
  getConfigPath,
  setConfig,
  loadConfig,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  updateDefaultPortal,
  createEmptyConfigFile,
  deleteEmptyConfigFile,
  isTrackingAllowed,
  validateConfig,
};
