const { logger } = require('@hubspot/cms-lib/logger');

const validateFunctionPath = functionPath => {
  const isInvalid = () => {
    logger.error(`Specified path ${functionPath} is not a .functions folder.`);
    process.exit();
  };

  if (typeof functionPath !== 'string') {
    isInvalid();
  }

  const splitFunctionPath = functionPath.split('.');

  if (
    !splitFunctionPath.length ||
    splitFunctionPath[splitFunctionPath.length - 1] !== 'functions'
  ) {
    isInvalid();
  }
};

const validatePort = port => {
  const parsedPort = parseInt(port, 10);

  if (typeof parsedPort !== 'number' || parsedPort < 1 || parsedPort > 65535) {
    logger.error(`Specified port ${port} is not valid.`);
    process.exit();
  }
};

const validateInputs = ({ path: functionPath, port }) => {
  validateFunctionPath(functionPath);
  validatePort(port);
};

module.exports = {
  validateInputs,
};
