const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const { getCwd } = require('@hubspot/cms-lib/path');
const { logger } = require('@hubspot/cms-lib/logger');
const { fetchSchemas, fetchSchema } = require('./api/schema');
const chalk = require('chalk');
const { table, getBorderCharacters } = require('table');

const logSchemas = schemas => {
  const data = schemas
    .map(r => [r.labels.singular, r.name, r.objectTypeId])
    .sort((a, b) => (a[1] > b[1] ? 1 : -1));
  data.unshift([
    chalk.bold('Label'),
    chalk.bold('Name'),
    chalk.bold('objectTypeId'),
  ]);

  const tableConfig = {
    singleLine: true,
    border: getBorderCharacters('honeywell'),
  };

  logger.log(data.length ? table(data, tableConfig) : 'No Schemas were found');
};

const cleanSchema = schema => {
  const parsedSchema = {};
  parsedSchema.name = schema.name;
  parsedSchema.labels = schema.labels;
  parsedSchema.requiredProperties = schema.requiredProperties;
  parsedSchema.searchableProperties = schema.searchableProperties;
  parsedSchema.primaryDisplayProperty = schema.primaryDisplayProperty;
  parsedSchema.associatedObjects = schema.associatedObjects;

  parsedSchema.properties = schema.properties
    .filter(p => !p.name.startsWith('hs_'))
    .map(p => ({
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType,
      description: p.description,
    }));

  return parsedSchema;
};

const writeSchemaToDisk = (schema, dest, clean) => {
  const fullPath = path.resolve(getCwd(), dest || '', `${schema.name}.json`);

  let parsedSchema = schema;
  if (clean) {
    parsedSchema = cleanSchema(schema);
  }

  fs.outputFileSync(
    fullPath,
    prettier.format(JSON.stringify(parsedSchema), {
      parser: 'json',
    })
  );
};

const listSchemas = async portalId => {
  const response = await fetchSchemas(portalId);
  logSchemas(response.results);
};

const downloadSchemas = async (portalId, dest, clean) => {
  const response = await fetchSchemas(portalId);
  logSchemas(response.results);

  if (response.results.length) {
    response.results.forEach(r => writeSchemaToDisk(r, dest, clean));
    logger.log(`Wrote schemas to ${path.resolve(getCwd(), dest || '')}`);
  }
};

const downloadSchema = async (portalId, schemaObjectType, dest, clean) => {
  const response = await fetchSchema(portalId, schemaObjectType);
  writeSchemaToDisk(response, dest, clean);
};

module.exports = {
  writeSchemaToDisk,
  listSchemas,
  downloadSchemas,
  downloadSchema,
};
