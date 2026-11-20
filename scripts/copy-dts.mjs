// rolldown-plugin-dts writes one ESM declaration file. CommonJS consumers need a
// .d.cts beside it, or TypeScript reads the CJS build's types as ESM
// ("masquerading as ESM"). The declarations are self-contained, so the same
// text serves both module systems.
import { copyFileSync, renameSync } from 'node:fs';

copyFileSync('dist/index.d.ts', 'dist/index.d.cts');
renameSync('dist/index.d.ts', 'dist/index.d.mts');
