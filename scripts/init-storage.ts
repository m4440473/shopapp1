import path from 'node:path';
import { mkdir } from 'node:fs/promises';

import {
  BUSINESS_OPTIONS,
  ensureAttachmentRoot,
} from '../src/lib/storage';

async function main() {
  const rootDir = await ensureAttachmentRoot();

  for (const option of BUSINESS_OPTIONS) {
    const businessDir = path.join(rootDir, option.slug);
    await mkdir(businessDir, { recursive: true });
  }

  console.log(
    `[storage] Initialized attachment directories under "${rootDir}".`,
  );
}

main().catch((error) => {
  console.error('[storage] Failed to initialize attachment directories.');
  console.error(error);
  process.exit(1);
});
