const { build } = require('esbuild');

build({
  entryPoints: ['dist/setup-exe.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/bundle-setup.js',
  banner: {
    js: `
      const __filename = typeof __filename !== 'undefined' ? __filename : (() => {
        return typeof require !== 'undefined' && require.main && require.main.filename 
          ? require.main.filename 
          : require('path').join(process.cwd(), 'setup.js');
      })();
      const __dirname = typeof __dirname !== 'undefined' ? __dirname : require('path').dirname(__filename);
    `,
  },
}).catch(() => process.exit(1));

