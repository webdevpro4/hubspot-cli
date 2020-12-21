const chalk = require('chalk');
const { table, getBorderCharacters } = require('table');

const tableConfigDefaults = {
  singleLine: true,
  border: getBorderCharacters(`void`),
};

const getTableContents = (
  tableData = [],
  tableConfig = tableConfigDefaults
) => {
  return table(tableData, tableConfig);
};

const getTableHeader = headerItems => {
  return headerItems.map(headerItem => chalk.bold(headerItem));
};

module.exports = {
  getTableContents,
  getTableHeader,
};
