const { build } = require('esbuild');

build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/bundle.js',
  external: ['wallpaper'], // Native module, must be external
  banner: {
    js: `
      // Polyfill for __dirname and __filename in ES modules when bundled
      const __filename = typeof __filename !== 'undefined' ? __filename : (() => {
        const path = require('path');
        return typeof require !== 'undefined' && require.main && require.main.filename 
          ? require.main.filename 
          : path.join(process.cwd(), 'index.js');
      })();
      const __dirname = typeof __dirname !== 'undefined' ? __dirname : require('path').dirname(__filename);
    `,
  },
}).catch(() => process.exit(1));

