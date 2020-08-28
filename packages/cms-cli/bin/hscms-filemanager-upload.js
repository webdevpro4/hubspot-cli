#!/usr/bin/env node

const { Command } = require('commander');

const {
  configureCommanderFileManagerUploadCommand,
} = require('../commands/filemanager/upload');

const program = new Command('hscms filemanager upload');
configureCommanderFileManagerUploadCommand(program);
program.parse(process.argv);
