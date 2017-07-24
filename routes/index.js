var checkAuth = require('middleware/checkAuth');

module.exports = function(app) {

  app.get('/', require('./login').get);

  app.get('/login', require('./login').get);
  app.post('/login', require('./login').post);

  app.post('/logout', require('./logout').post);

  app.get('/frontpage', checkAuth, require('./frontpage').get);

};
