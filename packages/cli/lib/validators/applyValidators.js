async function applyAbsoluteValidators(validators, absolutePath, ...args) {
  return Promise.all(
    validators.map(async Validator => {
      Validator.setAbsolutePath(absolutePath);
      const validationResult = await Validator.validate(...args);
      Validator.clearAbsolutePath();

      if (!validationResult.length) {
        // Return a success obj so we can log the successes
        return [Validator.getSuccess()];
      }
      return validationResult;
    })
  );
}

async function applyRelativeValidators(validators, relativePath, ...args) {
  return Promise.all(
    validators.map(async Validator => {
      Validator.setRelativePath(relativePath);
      const validationResult = await Validator.validate(...args);
      Validator.clearRelativePath();

      if (!validationResult.length) {
        // Return a success obj so we can log the successes
        return [Validator.getSuccess()];
      }
      return validationResult;
    })
  );
}

module.exports = { applyAbsoluteValidators, applyRelativeValidators };
