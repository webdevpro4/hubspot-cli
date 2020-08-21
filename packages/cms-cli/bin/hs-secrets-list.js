#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureSecretsListCommand,
} = require('../commands/secrets/listSecrets');

const program = new Command('hs secrets list');
configureSecretsListCommand(program);
program.parse(process.argv);
