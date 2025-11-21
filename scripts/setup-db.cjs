const { spawnSync } = require('child_process');

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

(function main() {
  if (process.env.CI || process.env.SKIP_DB_SETUP === '1') {
    console.log('Skipping automatic database setup (CI or SKIP_DB_SETUP set).');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set; skipping automatic database setup.');
    console.log('Set DATABASE_URL and run `npx prisma migrate deploy && npx prisma generate && npm run demo:setup`.');
    return;
  }

  try {
    console.log('Applying Prisma migrations...');
    run('npx', ['prisma', 'migrate', 'deploy', '--skip-generate']);

    console.log('Generating Prisma client...');
    run('npx', ['prisma', 'generate']);

    console.log('Seeding demo data and credentials...');
    run('npm', ['run', '--if-present', 'demo:setup']);

    console.log('Database is up to date and seeded for local development.');
  } catch (err) {
    console.warn('Automatic database setup failed. Run the commands manually:', err.message || err);
  }
})();
