const http = require('../http');
const { fetchRawAssetByPath } = require('./designManager');

const FUNCTION_API_PATH = 'cms/v3/functions';

async function getFunctionByPath(accountId, functionPath) {
  return http.get(accountId, {
    uri: `${FUNCTION_API_PATH}/function/by-path/${functionPath}`,
  });
}

async function getRoutes(accountId) {
  return http.get(accountId, {
    uri: `${FUNCTION_API_PATH}/routes`,
  });
}

async function buildPackage(portalId, folderPath) {
  return http.post(portalId, {
    uri: `${FUNCTION_API_PATH}/build`,
    body: {
      folderPath,
    },
  });
}

async function getBuildStatus(portalId, buildId) {
  return http.get(portalId, {
    uri: `${FUNCTION_API_PATH}/build/${buildId}/poll`,
  });
}

async function deletePackage(portalId, path) {
  return fetchRawAssetByPath(portalId, path).then(resp => {
    return http.delete(portalId, {
      uri: `${FUNCTION_API_PATH}/package?portalId=${portalId}&rawAssetId=${resp.id}`,
    });
  });
}

module.exports = {
  buildPackage,
  deletePackage,
  getBuildStatus,
  getFunctionByPath,
  getRoutes,
};
