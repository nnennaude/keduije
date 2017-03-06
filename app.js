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

// Connection URL
var url = 'mongodb://localhost:27017/igbo';
var url = 'mongodb://igbo:igbo@ds111940.mlab.com:11940/igbo';
var fbCallbackURL = process.env.DEV ?
  'http://localhost:3000/login/facebook/return'
  : 'http://socialyte.us/login/facebook/return';
var database;

function getFacebookUser(facebookProfile, cb){
  database.collection('users').findAndModify(
     { facebookID: facebookProfile.id } ,
     { facebookID: -1 },
     { $set: { facebookID: facebookProfile.id,
                lastLogin: new Date(),
                facebookProfile: facebookProfile
                //,admin: true
      } },
     { upsert: true },
     function(err, result) {
       //console.log(result);
       cb(err,result.value);
     }
  );
}

function getUser(facebookProfileId, cb){
  database.collection('users').findOne(
    { facebookID: facebookProfileId },
    function (err, result){
      //console.log("result of findOne", result);
      cb(err,result);
    });
}

passport.use(new Strategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: fbCallbackURL
  },
  function(accessToken, refreshToken, profile, cb) {
    //console.log("strategy_callback", profile);
    getFacebookUser(profile, cb);
    //return cb(null, profile);
  }
));

passport.serializeUser(function(user, cb) {
  //console.log("serializeUser",user);
  cb(null, user.facebookID);
});

passport.deserializeUser(function(obj, cb) {
  //console.log("deserializeUser",obj);
  //cb(null, obj);
  getUser(obj, cb);
});

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(cors()); //may no longer be used
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

//app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));


app.use(passport.initialize());
app.use(passport.session());

app.get('/', function (req, res) {

  res.sendFile(path.join(__dirname+'/public/player.html'));

});

app.get('/all', function (req, res) {
  //res.send('Hello World!');
  database.collection('lyrics').find().toArray(function(err, results) {
    //console.log(results)
    // send HTML file populated with quotes here
    res.send(results);
  })
});

app.get('/lyrics/:videoID', function (req, res) {

  database.collection('lyrics')
    .find({ videoID: req.params.videoID } )
    .nextObject(function(err, obj) {
    //console.log(obj)

    var result = (obj) ? obj.lyrics : [];
    res.send(result);
  })
});

app.get('/music/:videoID', function (req, res) {

  getSong(req.params.videoID, function(err, obj) {
      //console.log("user", req.user);

      var lyrics = (obj) ? obj.lyrics : [];

      res.render('player', {
        title: "hello",
        videoID: req.params.videoID,
        user: req.user,
        editMode: false,
        origin: req.headers.host
      });
  });

});


app.get(
  '/music/edit/:videoID',
  ensureLoggedIn(),
    function (req, res) {

      if(!req.user.admin){
        res.send("<h1>Not Authorized</h1>")
        return;
      }

    getSong(req.params.videoID, function(err, obj) {
        //console.log(obj)

        var lyrics = (obj) ? obj.lyrics : [];

        //console.log("user", req.user);
        res.render('player', {
          title: "hello",
          videoID: req.params.videoID,
          user: req.user,
          editMode: true,
          origin: req.headers.host
        });
    });

  });

function getSong(vidID, cb){
  database.collection('lyrics')
    .find({ videoID: vidID})
    .nextObject(cb);
}


app.get('/login',
  function(req, res){
    res.send('<a href="/login/facebook">Log In with Facebook</a>');
  });

  app.get('/login/facebook',
    passport.authenticate('facebook'));

  app.get('/login/facebook/return',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      console.log("before redirect", res.user);
      //res.redirect('/');
      res.redirect(req.session.returnTo);
    });

  app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
  });


app.post('/', function (req, res) {

  console.log(req.body);
  var obj = req.body;
  //res.send(obj);

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


MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected successfully to server");
  database = db;

  var port = (process.env.PORT || 3000);
  app.listen(port, function () {
    console.log('Example app listening on port ' + port + "!");
      //console.log("callbackURL", fbCallbackURL);
  })

});
