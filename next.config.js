/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  // The quote drawing engine loads native Node runtimes from route handlers and
  // child workers. They must remain real Node dependencies instead of being
  // parsed as JavaScript by the Next server bundler.
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@tesseract.js-data/eng',
    'pdfjs-dist',
    'tesseract.js',
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
