import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

const external = [/^node:/, 'osm2geojson-lite'];

/** One module, published as ESM and CommonJS with types. */
export default defineConfig([
    {
        input: 'src/index.ts',
        external,
        output: [
            { file: 'dist/index.mjs', format: 'esm' as const },
            { file: 'dist/index.cjs', format: 'cjs' as const, exports: 'named' as const },
        ],
    },
    {
        input: 'src/index.ts',
        external,
        output: { dir: 'dist', format: 'esm' as const },
        plugins: [dts({ emitDtsOnly: true })],
    },
]);
