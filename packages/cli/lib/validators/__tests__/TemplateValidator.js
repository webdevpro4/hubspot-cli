const templates = require('@hubspot/cli-lib/templates');

const TemplateValidator = require('../marketplaceValidators/theme/TemplateValidator');
const { VALIDATION_RESULT } = require('../constants');

jest.mock('@hubspot/cli-lib/templates');

const makeFilesList = numFiles => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    files.push(`file-${i}.html`);
  }
  return files;
};

describe('validators/marketplaceValidators/theme/TemplateValidator', () => {
  beforeEach(() => {
    templates.isTemplate.mockReturnValue(true);
  });

  it('returns error if template limit is exceeded', async () => {
    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(51)
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(50)
    );
    expect(validationErrors.length).toBe(0);
  });
});