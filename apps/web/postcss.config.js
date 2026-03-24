// Resolve tailwindcss from root node_modules in monorepo (Vercel workspaces compat)
const path = require('path')

module.exports = {
  plugins: {
    [require.resolve('tailwindcss', { paths: [path.resolve(__dirname, '../../')] })]: {},
    [require.resolve('autoprefixer', { paths: [path.resolve(__dirname, '../../')] })]: {},
  },
}
