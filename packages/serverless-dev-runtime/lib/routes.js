const path = require('path');
const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const { getFunctionDataContext } = require('./data');
const { loadEnvironmentVariables } = require('./environment');
const { logFunctionExecution } = require('./logging');

const outputTrackedLogs = trackedLogs => {
  trackedLogs.forEach(trackedLog => {
    logger.log(...trackedLog);
  });
};

const addEndpointToApp = endpointData => {
  const {
    app,
    method,
    route,
    functionPath,
    tmpDir: { name: tmpDirName },
    file,
    accountId,
    globalEnvironment,
    localEnvironment,
    secrets,
    options,
  } = endpointData;
  logger.debug(
    `Setting up route: ${route} to run function ${functionPath}/${file}.`
  );
  const { contact } = options;

  if (!method) {
    logger.error(`No method was specified for route "${route}"`);
    process.exit();
  }

  if (!file) {
    logger.error(`No file was specified for route "${route}"`);
    process.exit();
  }

  app[method.toLowerCase()](`/${route}`, async (req, res) => {
    const startTime = Date.now();
    const dataForFunc = await getFunctionDataContext(
      req,
      tmpDirName,
      secrets,
      accountId,
      contact
    );
    const functionFilePath = path.resolve(`${tmpDirName}/${file}`);
    if (!fs.existsSync(functionFilePath)) {
      logger.error(`Could not find file ${functionPath}/${file}.`);
      return;
    }
    const { main } = require(functionFilePath);

    if (!main) {
      logger.error(`Could not find "main" export in ${functionPath}/${file}.`);
    }

    const originalConsoleLog = console.log;
    const trackedLogs = [];

    try {
      loadEnvironmentVariables(globalEnvironment, localEnvironment);

      // Capture anything logged within the serverless function
      // for output later. Placement of this code matters!
      console.log = (...args) => {
        trackedLogs.push(args);
      };

      await main(dataForFunc, sendResponseValue => {
        const { statusCode, body } = sendResponseValue;
        const endTime = Date.now();
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log = originalConsoleLog;
        logFunctionExecution('SUCCESS', body, startTime, endTime, memoryUsed);
        outputTrackedLogs(trackedLogs);
        res.status(statusCode).json(body);
      });
    } catch (e) {
      console.log = originalConsoleLog;
      logger.error(e);
      res.status(500).json(e);
    }
  });

  app.all('*', req => {
    logger.warn(`No route found for ${req.method} request to ${req.url}`);
  });
};

const setupRoutes = routeData => {
  const { routes, endpoints } = routeData;

  routes.forEach(route => {
    const { method, file, environment: localEnvironment } = endpoints[route];

    if (Array.isArray(method)) {
      method.forEach(methodType => {
        addEndpointToApp({
          ...routeData,
          method: methodType,
          route,
          file,
          localEnvironment,
        });
      });
    } else {
      addEndpointToApp({
        ...routeData,
        method,
        route,
        file,
        localEnvironment,
      });
    }
  });
};

module.exports = {
  setupRoutes,
};
