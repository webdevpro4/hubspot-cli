const yaml = require('js-yaml');
const fs = require('fs');
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
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  OAUTH_SCOPES,
  ENVIRONMENT_VARIABLES: {
    HUBSPOT_REFRESH_TOKEN,
    HUBSPOT_API_KEY,
    HUBSPOT_CLIENT_ID,
    HUBSPOT_CLIENT_SECRET,
    HUBSPOT_PERSONAL_ACCESS_KEY,
    HUBSPOT_PORTAL_ID,
  },
  ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
} = require('./constants');

let _config;
let _configPath;
let disableWritesToFile = false;

const getConfig = () => _config;

const setConfig = updatedConfig => {
  _config = updatedConfig;
  return _config;
};

/**
 * @returns {boolean}
 */
function validateConfig() {
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
}

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

const writeConfig = () => {
  if (disableWritesToFile) {
    return;
  }
  logger.debug(`Writing current config to ${_configPath}`);
  fs.writeFileSync(
    _configPath,
    yaml.safeDump(
      JSON.parse(JSON.stringify(getOrderedConfig(_config), null, 2))
    )
  );
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

const loadConfigFromFile = (path, options = {}) => {
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

const loadConfig = (path, options = {}) => {
  const configLoadedFromEnv = loadEnvironmentVariableConfig();
  if (configLoadedFromEnv) {
    disableWritesToFile = true;
    return;
  } else {
    loadConfigFromFile(path, options);
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

const getEnv = nameOrId => {
  let env = 'PROD';
  const config = getAndLoadConfigIfNeeded();
  const portalId = getPortalId(nameOrId);
  if (config.env) {
    env = config.env;
  }
  if (portalId) {
    const portalConfig = getPortalConfig(portalId);
    if (portalConfig.env) {
      env = portalConfig.env;
    }
  } else if (config.env) {
    env = config.env;
  }
  return env;
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

  return nextPortalConfig;
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

  return fs.writeFileSync(_configPath, EMPTY_CONFIG_FILE_CONTENTS);
};

const deleteEmptyConfigFile = () => {
  return (
    configFileExists() && configFileIsBlank() && fs.unlinkSync(_configPath)
  );
};

const getConfigVariablesFromEnv = () => {
  const env = process.env;

  return {
    apiKey: env[HUBSPOT_API_KEY],
    clientId: env[HUBSPOT_CLIENT_ID],
    clientSecret: env[HUBSPOT_CLIENT_SECRET],
    personalAccessKey: env[HUBSPOT_PERSONAL_ACCESS_KEY],
    portalId: parseInt(env[HUBSPOT_PORTAL_ID], 10),
    refreshToken: env[HUBSPOT_REFRESH_TOKEN],
  };
};

const generatePersonalAccessKeyConfig = (portalId, personalAccessKey) => {
  return {
    defaultPortal: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
    portals: [
      {
        name: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        portalId,
        personalAccessKey,
      },
    ],
  };
};

const generateOauthConfig = (
  portalId,
  clientId,
  clientSecret,
  refreshToken,
  scopes
) => {
  return {
    defaultPortal: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
    portals: [
      {
        name: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
        authType: OAUTH_AUTH_METHOD.value,
        portalId,
        auth: {
          clientId,
          clientSecret,
          scopes,
          tokenInfo: {
            refreshToken,
          },
        },
      },
    ],
  };
};

const generateApiKeyConfig = (portalId, apiKey) => {
  return {
    defaultPortal: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
    portals: [
      {
        name: ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
        authType: API_KEY_AUTH_METHOD.value,
        portalId,
        apiKey,
      },
    ],
  };
};

const loadConfigFromEnvironment = () => {
  const {
    apiKey,
    clientId,
    clientSecret,
    personalAccessKey,
    portalId,
    refreshToken,
  } = getConfigVariablesFromEnv();

  if (!portalId) {
    return;
  }

  if (personalAccessKey) {
    return generatePersonalAccessKeyConfig(portalId, personalAccessKey);
  } else if (clientId && clientSecret && refreshToken) {
    return generateOauthConfig(
      portalId,
      clientId,
      clientSecret,
      refreshToken,
      OAUTH_SCOPES.map(scope => scope.value)
    );
  } else if (apiKey) {
    return generateApiKeyConfig(portalId, apiKey);
  } else {
    return;
  }
};

const loadEnvironmentVariableConfig = () => {
  const envConfig = loadConfigFromEnvironment();

  if (!envConfig) {
    return;
  }

  return setConfig(envConfig);
};

module.exports = {
  getAndLoadConfigIfNeeded,
  getEnv,
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
  writeConfig,
};
