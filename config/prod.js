const webpack = require('webpack');
const path = require('path');

const DEV = path.resolve(__dirname, '../react');
const OUTPUT = path.resolve(__dirname, '../out');

module.exports = (env) => {
  return {
    context: DEV,
    entry: {
      history: './history.jsx',
      // search: './search.jsx',
      player: './player.jsx',
      new_music: './new-music.jsx',
      global: './global.jsx',
      home: './home.js',
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    output: {
      filename: '[name].bundle.js',
      path: OUTPUT,
    },
    module: {
      loaders: [{
        include: [DEV],
        loader: 'babel-loader',
      }],
    },
    plugins: [
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
      })
    ],
  };
};

