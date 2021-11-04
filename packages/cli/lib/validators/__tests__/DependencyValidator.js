const fs = require('fs-extra');
const marketplace = require('@hubspot/cli-lib/api/marketplace');

const DependencyValidator = require('../marketplaceValidators/theme/DependencyValidator');
const { VALIDATION_RESULT } = require('../constants');
const { THEME_PATH } = require('./validatorTestUtils');

jest.mock('fs-extra');
jest.mock('@hubspot/cli-lib/api/marketplace');

const getMockDependencyResult = (customPaths = []) => {
  const result = {
    dependencies: ['./relative/file-2.js', ...customPaths],
  };
  return Promise.resolve(result);
};

describe('validators/marketplaceValidators/theme/DependencyValidator', () => {
  beforeEach(() => {
    DependencyValidator.setThemePath(THEME_PATH);
  });

  describe('isExternalDep', () => {
    beforeEach(() => {
      DependencyValidator.setThemePath(THEME_PATH);
    });

    it('returns true if dep is external to the provided absolute path', () => {
      const absoluteFilePath = `${THEME_PATH}/file.js`;
      const relativeDepPath = '../external/dep/path/file2.js';
      const isExternal = DependencyValidator.isExternalDep(
        absoluteFilePath,
        relativeDepPath
      );
      expect(isExternal).toBe(true);
    });

    it('returns false if dep is not external to the provided absolute path', () => {
      const absoluteFilePath = `${THEME_PATH}/file.js`;
      const relativeDepPath = './internal/dep/path/file2.js';
      const isExternal = DependencyValidator.isExternalDep(
        absoluteFilePath,
        relativeDepPath
      );
      expect(isExternal).toBe(false);
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      fs.readFile.mockImplementation(() => Promise.resolve('source'));
    });

    it('returns error if any referenced path is absolute', async () => {
      marketplace.fetchDependencies.mockReturnValue(
        getMockDependencyResult(['/absolute/file-3.js'])
      );
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns error if any referenced path is external to the theme', async () => {
      marketplace.fetchDependencies.mockReturnValue(
        getMockDependencyResult(['../../external/file-3.js'])
      );
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(1);
      expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
    });

    it('returns no errors if paths are relative and internal', async () => {
      marketplace.fetchDependencies.mockReturnValue(getMockDependencyResult());
      const validationErrors = await DependencyValidator.validate([
        `${THEME_PATH}/template.html`,
      ]);

      expect(validationErrors.length).toBe(0);
    });
  });
});
