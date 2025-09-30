const path = require('node:path');
const { mkdir } = require('node:fs/promises');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
  },
});

const { BUSINESS_OPTIONS, ensureAttachmentRoot } = require('../src/lib/storage');

async function main() {
  const rootDir = await ensureAttachmentRoot();

  for (const option of BUSINESS_OPTIONS) {
    const businessDir = path.join(rootDir, option.slug);
    await mkdir(businessDir, { recursive: true });
  }

  console.log(`[storage] Initialized attachment directories under "${rootDir}".`);
}

main().catch((error) => {
  console.error('[storage] Failed to initialize attachment directories.');
  console.error(error);
  process.exit(1);
});
