module.exports = {
  'plugins': [
    require('postcss-preset-env'),
    require('postcss-sorting')({
      'properties-order': 'alphabetical',
    }),
    require('cssnano')({
      'preset': 'default',
    }),
  ],
};
