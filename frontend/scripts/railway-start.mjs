import { spawn } from 'node:child_process';

const port = process.env.PORT || '4173';

const child = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '0.0.0.0', '--port', port],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) process.exit(1);
  process.exit(1);
});
