module.exports = {
  'plugins': [
    require('cssnano')({
      'preset': 'default',
    }),
    require('postcss-preset-env'),
    require('postcss-sorting')({
      'properties-order': 'alphabetical',
    }),
  ],
};
