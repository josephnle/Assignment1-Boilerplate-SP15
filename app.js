//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var mongoose = require('mongoose');
var graph = require('fbgraph');
var _ = require('underscore');
var app = express();

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
var INSTAGRAM_ACCESS_TOKEN = "";
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

//connect to database
mongoose.connect(process.env.MONGODB_CONNECTION_URL);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    models.User.findOne({
      "instagram": {
        "id": profile.id
      }
    }, function(err, user) {
      if(err) return done(err);

      if(!user) {
        newUser = new models.User({
          username: profile.username,
          instagram: {
            id: profile.id,
            access_token: profile.access_token
          }
        });

        newUser.save();
      } else {
        user.instagram.access_token = accessToken;
        user.save();
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, user);
        });
      }
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    enableProof: false
  },
  function(accessToken, refreshToken, profile, done) {
    models.User.findOne({
      "facebook": {
        "id": profile.id
      }
    }, function(err, user) {
      if(err) return done(err);

      if(!user) {
        newUser = new models.User({
          username: profile.email,
          facebook: {
            id: profile.id,
            access_token: profile.access_token
          }
        });

        newUser.save();
      } else {
        user.facebook.access_token = accessToken;
        user.save();

        graph.setAccessToken(accessToken);

        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, user);
        });
      }
    });
  }
));

//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true,
                  store: new MongoStore({ mongooseConnection: mongoose.connection })}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function ensureFacebookAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.facebook.hasOwnProperty('access_token')) {
    return next();
  }
  res.redirect('/login');
}

function ensureInstagramAuthenticated(req, res, next) {
  if (req.isAuthenticated() && req.user.instagram.hasOwnProperty('access_token')) {
    return next();
  }
  res.redirect('/login');
}

//routes
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

//app.get('/account', ensureAuthenticated, function(req, res){
//  var query  = models.User.where({ username: req.user.username });
//  query.findOne(function (err, user) {
//    if(err) return handleError(err);
//    if(user) {
//      if(user.instagram.id) {
//        Instagram.users.info({
//          user_id: req.user.instagram.id,
//          complete: function(data) {
//            if(user.facebook.id) {
//              graph.get('me', function(err, fbUser) {
//                return res.render('account',
//                  {
//                    facebook: fbUser,
//                    instagram: data
//                  });
//              });
//            }
//
//            return res.render('account', {instagram: data});
//          }
//        });
//      }
//
//      // If user does not have instagram account attached
//      if(user.facebook.id) {
//        graph.get('me', function(err, fbUser) {
//          return res.render('account',
//            {
//              facebook: fbUser
//            });
//        });
//      }
//    }
//  });
//
//});

app.get('/photos', ensureInstagramAuthenticated, function(req, res){
  console.log('photos');
  var query  = models.User.where({ username: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched
      Instagram.users.liked_by_self({
        access_token: user.instagram.access_token,
        complete: function(data) {
          //Map will iterate through the returned data obj
          var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = {};
            tempJSON.url = item.images.low_resolution.url;
            tempJSON.caption = item.caption.text;
            //insert json object into image array
            return tempJSON;
          });

          Instagram.users.info({
            user_id: req.user.instagram.id,
            complete: function(userData) {
              return res.render('photos', {photos: imageArr, user: userData});
            }
          });
        }
      });
    }
  });
});

app.get('/likes', ensureFacebookAuthenticated, function(req, res) {
  graph.get('me/likes', function(err, data) {
    function getRandomColor() {
      var letters = '0123456789ABCDEF'.split('');
      var color = '#';
      for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    }

    var categoriesMap = [];

    _.each(data.data, function(element, index, array) {
      if(categoriesMap[element.category]) {
        categoriesMap[element.category]++;
      }
      else {
        categoriesMap[element.category] = 1;
      }
    });

    var categories = [];

    for(var key in categoriesMap) {
      if(categoriesMap.hasOwnProperty(key)) {
        var temp = {};
        temp.label = key;
        temp.value = categoriesMap[key];
        temp.color = getRandomColor();
        categories.push(temp);
      }
    }

    graph.get('me', function(err, fbUser) {
      return res.render('likes',
        {
          user: fbUser,
          likes: data.data,
          categories: JSON.stringify(categories)
        });
    });
  });
});


// GET /auth/instagram
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Instagram authentication will involve
//   redirecting the user to instagram.com.  After authorization, Instagram
//   will redirect the user back to this application at /auth/instagram/callback
app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

// GET /auth/instagram/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/instagram/callback',
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/photos');
  });

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: 'user_likes, user_posts' }));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/likes');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
