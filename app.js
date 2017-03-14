require('dotenv').config()
var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
var express = require('express');
var app = express();
const bodyParser= require('body-parser');
var cors = require('cors')
var path = require('path');
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy;
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

var fbCallbackURL = process.env.DEV ?
  'http://localhost:3000/login/facebook/return'
  : 'http://keduije1.herokuapp.com/login/facebook/return';
var database;

function getFacebookUser(facebookProfile, cb){
  database.collection('users').findAndModify(
     { facebookID: facebookProfile.id } ,
     { facebookID: -1 },
     { $setOnInsert: { facebookID: facebookProfile.id,
                facebookName: facebookProfile.displayName,
                role: "member"
      },
       $set: {
         lastLogin: new Date(),
       }
     },
     { upsert: true },
     function(err, result) {
       cb(err,result.value);
     }
  );
}

function getUser(facebookProfileId, cb){
  database.collection('users').findOne(
    { facebookID: facebookProfileId },
    function (err, result){
      cb(err,result);
    });
}

passport.use(new Strategy({
    clientID: process.env.FB_CLIENT_ID,
    clientSecret: process.env.FB_CLIENT_SECRET,
    callbackURL: fbCallbackURL
  },
  function(accessToken, refreshToken, profile, cb) {
    getFacebookUser(profile, cb);
  }
));

passport.serializeUser(function(user, cb) {
  cb(null, user.facebookID);
});

passport.deserializeUser(function(obj, cb) {
  getUser(obj, cb);
});

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'pug')


app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.static('react'));

app.use(require('cookie-parser')());
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));


app.use(passport.initialize());
app.use(passport.session());



function requireRole(role) {
    return function(req, res, next) {
      //console.log(req.user);
        if(req.user && req.user.role === role)
            next();
        else
            res.sendStatus(403);
    }
}

app.get('/lyrics/:videoID', function (req, res) {

  database.collection('lyrics')
    .find({ videoID: req.params.videoID } )
    .nextObject(function(err, obj) {

    var result = (obj) ? obj.lyrics : [];
    res.send(result);
  })
});

app.get('/music/id/:videoID', function (req, res) {

  var vidID = req.params.videoID;
  database.collection('lyrics')
    .findOne({ videoID: vidID}, function(err, song){

      var youtube_thumbnail = "https://img.youtube.com/vi/"+song.videoID+"/hqdefault.jpg";
      var artwork_src = song.img ? song.img : youtube_thumbnail;

        res.render('player', {
          title: "hello",
          artwork_src: artwork_src,
          videoID: song.videoID,
          user: req.user || null,
          canEdit: req.user && req.user.isAdmin,
          origin: req.headers.host
        });
    });
});

app.get('/', function (req, res) {

  res.render('home', {
    title: "hello",
    user: req.user || null,
  });

});

app.get('/songs/all', function (req, res) {

  database.collection('lyrics').find({},{videoID: 1}).toArray(function(err, results) {
    var videos = [];
    results.forEach(function(obj){
      if(obj.videoID){
        videos.push(obj.videoID);
      }
    })
    res.send(videos);
  });
});

app.get( '/music/new', ensureLoggedIn(), requireRole("admin"), function (req, res) {
  res.render("new_music",{});

      //res.send('<form method="post"><input name="videoID"><input type="submit"></form>');

  });

  app.post( '/music/new', ensureLoggedIn(), requireRole("admin"), function (req, res) {

        console.log(req.body);
        database.collection("lyrics").insertOne(req.body, function(){
          res.redirect("/music/id/"+req.body.videoID); //todo: make bettter;
        });

    });

    app.get('/login',
      function(req, res) {
        res.redirect("/login/facebook");
      });

  app.get('/login/facebook',
    function (req, res, next) {
      req.session.returnTo = req.header('Referer');
      next()
    },
    passport.authenticate('facebook'));

  app.get('/login/facebook/return',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect(req.session.returnTo || "/");
    });

  app.get('/logout', function(req, res){
    req.logout();
    res.redirect(req.header('Referer') || '/');
  });


app.post('/', function (req, res) {

  var obj = req.body;

  database.collection('lyrics').update(
     { videoID: obj.videoID } ,
     { $set: { lyrics: obj.lyrics } },
     { upsert: true },
     function(err, result) {
       assert.equal(err, null);
       res.send(result);
     }
  );

});


MongoClient.connect(process.env.DB_URL, function(err, db) {
  assert.equal(null, err);
  console.log("Connected successfully to server");
  database = db;

  var port = (process.env.PORT || 3000);
  app.listen(port, function () {
    console.log('Example app listening on port ' + port + "!");
  })

});
