import { createRequire } from 'node:module';
import { describe } from 'vitest';
import * as esm from '../dist/index.mjs';
import { behaviour } from './query';

// The built entries, so a broken bundle fails CI. Run `npm run build` first.
const cjs = createRequire(import.meta.url)('../dist/index.cjs');

describe('dist/index.mjs', () => behaviour(esm.queryGeoBoundary));
describe('dist/index.cjs', () => behaviour(cjs.queryGeoBoundary));
