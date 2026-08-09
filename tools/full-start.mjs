#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function main() {
  await run('npm', ['run', 'preinstall']);
  await run('npm', ['run', '--workspace=server', 'build']);
  await run('npm', ['run', '--workspace=admin', 'build']);
  await run('npm', ['run', '--workspace=basic-plugin', 'build']);

  const server = spawn('npm', ['run', '--workspace=server', 'server:start'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  const admin = spawn('npm', ['run', '--workspace=admin', 'admin:start'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  server.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
  admin.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
