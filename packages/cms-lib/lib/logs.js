const util = require('util');
const moment = require('moment');
const { logger } = require('../logger');

const SEPARATOR = ' - ';

const formatError = log => {
  return `/n${log.error.type}: ${log.error.message}\n${formatStackTrace(
    log
  )}\n`;
};

const logHandler = {
  UNHANDLED_ERROR: (log, { compact }) => {
    return `${formatLogHeader(log)}${compact ? '' : formatError(log)}`;
  },
  HANDLED_ERROR: (log, { compact }) => {
    return `${formatLogHeader(log)}${compact ? '' : formatError(log)}`;
  },
  SUCCESS: (log, { compact }) => {
    return `${formatLogHeader(log)}${compact ? '' : formatLogPayloadData(log)}`;
  },
};

const formatLogPayloadData = log => {
  return `\n${formatPayload(log)}\n${formatLog(log)}`;
};

const formatLogHeader = log => {
  return `${formatTimestamp(log)}${SEPARATOR}${
    log.status
  }${SEPARATOR}${formatExecutionTime(log)}`;
};

const formatLog = log => {
  return `${log.log}`;
};

const formatStackTrace = log => {
  const stackTrace = (log.error.stackTrace && log.error.stackTrace[0]) || [];
  return stackTrace
    .map(trace => {
      return `  at ${trace}\n`;
    })
    .join('');
};

const formatTimestamp = log => {
  return `${moment(log.createdAt).toISOString()}`;
};

const formatPayload = log => {
  return util.inspect(log.payload, {
    compact: true,
    depth: 'Infinity',
  });
};

const formatExecutionTime = log => {
  return `Execution Time: ${log.executionTime}ms`;
};

const processLog = (log, options) => {
  try {
    return logHandler[log.status](log, options);
  } catch (e) {
    logger.error(`Unable to process log ${JSON.stringify(log)}`);
  }
};

const processLogs = (logsResp, options) => {
  if (!logsResp || (logsResp.results && !logsResp.results.length)) {
    return 'No logs found.';
  } else if (logsResp.results && logsResp.results.length) {
    return logsResp.results
      .map(log => {
        return processLog(log, options);
      })
      .join('\n');
  }
  return processLog(logsResp, options);
};

const outputLogs = (logsResp, options) => {
  logger.log(processLogs(logsResp, options));
};

module.exports = {
  outputLogs,
};
