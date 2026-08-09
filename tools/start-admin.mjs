#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const child = spawn('npm', ['run', '--workspace=admin', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const admin = spawn('node', ['admin/start.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });
  admin.on('exit', (serverCode) => process.exit(serverCode ?? 0));
});
