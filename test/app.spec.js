/* eslint-env mocha */
import { expect } from 'chai';
import request from 'supertest';
import cheerio from 'cheerio';
import sinon from 'sinon';
import APP from '../lib/app';
import TestDB from './utils/db';

const ObjectId = require('mongodb').ObjectId;

let $;

let testUser = {
  _id: ObjectId('58e451206b5df803808e5912'),
  role: 'member',
};

let loggedInUser = null;

const ensureLoggedIn = (req, res, next) => {
  req.user = testUser;
  if (req.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

const passportInitialize = (req, res, next) => { next(); };
const passportSession = (req, res, next) => {
  req.user = loggedInUser;
  next();
};

const login = (vendor, req, res, next) => {
  if (req.query.code) {
    next();
  } else {
    res.redirect(`/login/${vendor}/return?code=111`);
  }
};

const users = {
  log: sinon.stub(),
  setDB: sinon.stub(),
  initialize: () => passportInitialize,
  session: () => passportSession,
  authenticate: vendor => login.bind(null, vendor),
};
users.log.resolves();

const mail = {
  send: sinon.stub(),
};

function Revision(db) {
  function onUpdateRequest(collectionName, req) {
    const queryObj = { _id: ObjectId(req.params.forID) };
    const updateObj = {
      $currentDate: { lastModified: true },
      $set: req.body.changes,
      $inc: { version: 1 },
    };

    return db.collection(collectionName)
      .findOneAndUpdate(queryObj, updateObj, { returnOriginal: false })
      .then(result => result.value);
  }

  this.execute = onUpdateRequest;
}

require('dotenv').config();

const newMedia = [
  {
    title: 'Thriller',
    artist: 'Michael Jackson',
    type: 1,
  },
  {
    title: 'Lucky',
    artist: 'Brittney Spears',
    type: 0,
  },
  {
    title: 'Mmege',
    artist: 'Flavour',
    type: 0,
  },
];

const slugs = ['Thriller', 'Lucky', 'Mmege'];

const newLines = [
  {
    startTime: 5,
    endTime: 6,
    text: 'whoever you are. girl, bye',
  },
];

describe('app.js', () => {
  let server;
  let env;
  let db;

  let revertEnsureLoggedIn;
  let revertUsers;
  let revertMail;
  let revertRevision;
  let revertDB;

  before(function () {
    revertEnsureLoggedIn = APP.__Rewire__('ensureLoggedIn', () => ensureLoggedIn);
    revertUsers = APP.__Rewire__('users', users);
    revertMail = APP.__Rewire__('mail', mail);
    revertRevision = APP.__Rewire__('Revision', Revision);
    revertDB = APP.__Rewire__('DB_URL', process.env.TEST_DB_URL);
    return APP().then((result) => {
      server = result.server;
      env = result.env;
      db = result.db;
    }).catch(function (error) {
      this.skip();
      console.error(error);
      throw error;
    }.bind(this));
  });

  after(function () {
    revertEnsureLoggedIn();
    revertUsers();
    revertMail();
    revertRevision();
    revertDB();
    return TestDB.close(db).then(() => server.close());
  });

  describe('server initialization', function () {
    it('loads environment variables', function () {
      expect(env.HOST).to.not.be.empty;
      expect(env.FB_CLIENT_ID).to.not.be.empty;
      expect(env.FB_CLIENT_SECRET).to.not.be.empty;
      expect(env.TWITTER_CONSUMER_KEY).to.not.be.empty;
      expect(env.DB_URL).to.not.be.empty;
      expect(env.TWITTER_CONSUMER_SECRET).to.not.be.empty;
      expect(env.DEVELOPER_IP).to.not.be.empty;
      expect(env.EMAIL_ADDRESS).to.not.be.empty;
      expect(env.EMAIL_PASSWORD).to.not.be.empty;
    });

    it('connects to server', function () {
      expect(server).to.exist;
    });

    it('can serve generic request', function () {
      return request(server)
        .get('/')
        .expect(200);
    });

    it('can handle app start failure', function () {
      return APP().catch((err) => {
        expect(err.code).to.equal('EADDRINUSE');
      });
    });

    it('can handle db connection failure', function () {
      APP.__Rewire__('DB_URL', '');
      return APP().catch((err) => {
        APP.__Rewire__('DB_URL', process.env.TEST_DB_URL);
        expect(err.message).to.equal('invalid schema, expected mongodb');
      });
    });
  });

  it('POST /api/media/new should fail for unauthorized user', function () {
    return request(server)
      .post('/api/media/new')
      .send(newMedia[0])
      .expect(403);
  });

  it('POST /api/media/new should add new song', function () {
    testUser.role = 'admin';

    return request(server)
      .post('/api/media/new')
      .send(newMedia[0])
      .expect(200)
      .then((res) => {
        expect(res.text).to.equal('Thriller');
        const insertedId = res.header['inserted-id'];
        return db.collection('media').find({ _id: ObjectId(insertedId) }).limit(1).next();
      })
      .then((media) => {
        expect(media.changeset).to.be.an.instanceof(ObjectId);
        expect(media.creator).to.be.an.instanceof(ObjectId);
        expect(media.version).to.equal(1);
        expect(media.status).to.equal('published');
        // to do: check other properties
      });
  });

  it('redirects /history when not logged in ', function () {
    const temp = testUser;
    testUser = null;
    return request(server)
      .get('/history')
      .expect(302)
      .then(() => {
        testUser = temp; // TO DO: better restore
      });
  });

  it('serves /history for authenticated user ', function () {
    return request(server)
      .get('/history')
      .expect(200);
  });

  describe('adding media listings', function () {
    let current = 0;
    let mediaObj;
    let slug;
    beforeEach(function () {
      testUser.role = 'admin';
      testUser.isAdmin = true;
      mediaObj = newMedia[current];
      slug = slugs[current];
      current += 1;
      current %= newMedia.length;
      return request(server)
        .post('/api/media/new')
        .send(mediaObj)
        .expect(200);
    });

    it('responds to /music/:slug (for video)', function () {
      return request(server)
        .get(`/music/${slug}`)
        .expect(200)
        .then(function (res) {
          $ = cheerio.load(res.text);
          expect($('nav').length).to.equal(1);
          expect($('#root').length).to.equal(1);

          // to do: not necessary. can use api request to get _id
          const re = /JSON.parse\('({.*?})'.+\)/;
          const matches = res.text.match(re);
          if (!matches) {
            throw new Error('could not find props data sent from server');
          }

          const props = JSON.parse(matches[1]);
          expect(props.title).to.equal(mediaObj.title);
          expect(props.canEdit).to.be.false;
          mediaObj.mediaID = props.mediaID;
        });
    });

    it('responds to /music/:slug with edit priveledges (and for audio)', function () {
      loggedInUser = {
        isAdmin: true,
      };

      return request(server)
        .get(`/music/${slug}`)
        .expect(200)
        .then(function (res) {
          loggedInUser = null;

          const re = /JSON.parse\('({.*?})'.+\)/;
          const matches = res.text.match(re);
          if (!matches) {
            throw new Error('could not find props data sent from server');
          }

          const props = JSON.parse(matches[1]);
          expect(props.title).to.equal(mediaObj.title);
          expect(props.canEdit).to.be.true;
          mediaObj.mediaID = props.mediaID;
        });
    });

    it('responds to /music/:slug when not found', function () {
      return request(server)
        .get('/music/Adamsfs')
        .expect(404)
        .then(function (res) {
          expect(res.text).to.equal('not found');
        });
    });

    it('responds to /music/:slug/history', function () {
      return request(server)
        .get(`/music/${slug}/history`)
        .expect(200);
    });

    it('responds to /music/:slug/history when not found', function () {
      return request(server)
        .get('/music/Adamsfs/history')
        .expect(404);
    });
  });

  describe('edit session', function () {
    let changesetID;
    let mediaObj;
    let mediaID;

    before(function () {
      mediaObj = newMedia[2];
      return request(server)
        .post('/api/media/new')
        .send(mediaObj)
        .then((res) => {
          mediaID = res.header['inserted-id'];
          return request(server)
            .post(`/api/start_edit/${mediaID}`)
            .expect(200)
            .then(function (res2) {
              changesetID = res2.text;
            });
        });
    });

    it('should have a valid changest', function () {
      expect(changesetID).to.be.a('string');
      expect(changesetID).not.to.be.empty;
      expect(ObjectId.bind(null, changesetID)).not.to.Throw;
    });

    it('POST /api/media/edit/:forID to media info', function () {
      const mediaChange = {
        artist: 0,
      };

      return request(server)
        .post(`/api/media/edit/${mediaID}`)
        .send({
          changes: mediaChange,
          changesetID,
          mediaID,
        })
        .expect(200)
        .then((res) => {
          expect(res.body.artist).to.equal(mediaChange.artist);
          expect(res.body.artist).not.to.equal(mediaObj.artist);
          mediaObj.artist = mediaChange.artist;
        });
    });

    it('POST /api/media/edit/:forID. should update slug', function () {
      const mediaChange = {
        title: 'Bad',
      };

      return request(server)
        .post(`/api/media/edit/${mediaID}`)
        .send({
          changes: mediaChange,
          changesetID,
          mediaID,
        })
        .expect(200)
        .then((res) => {
          expect(res.body.title).to.equal(mediaChange.title);
          expect(res.body.title).not.to.equal(mediaObj.title);
          expect(res.body.slug).to.equal('Bad');
          mediaObj.title = mediaChange.title;
        });
    });

    describe('lyrics', function () {
      let newLine;
      let lineID;
      before('POST /api/media/:mediaID/addline', function () {
        newLine = newLines[0];
        newLine.changesetID = changesetID;

        return request(server)
          .post(`/api/media/${mediaID}/addline`)
          .send(newLine)
          .expect(200)
          .then((res) => {
            expect(res.body).to.be.an('array');
            lineID = res.header['inserted-id'];
          });
      });

      it('should correctly store new line in db', function () {
        newLine.changesetID = changesetID;

        return db.collection('lines')
          .find({ _id: ObjectId(lineID) })
          .limit(1)
          .next()
          .then((line) => {
            expect(line.changeset).to.be.an.instanceof(ObjectId);
            expect(line.changeset.toString()).to.equal(changesetID);
            expect(line.media).to.be.an.instanceof(ObjectId);
            expect(line.media.toString()).to.equal(mediaID);
            expect(line.creator).to.be.an.instanceof(ObjectId);
            expect(line.version).to.equal(1);
            expect(line.deleted).to.equal(false);
            expect(line.heading).to.equal(null);
            expect(line.startTime).to.equal(newLine.startTime);
            expect(line.endTime).to.equal(newLine.endTime);
            expect(line.text).to.equal(newLine.text);
          });
      });

      it('POST /api/lines/edit/:forID', function () {
        const lineChange = {
          text: 'bye bye, bye',
        };

        return request(server)
          .post(`/api/lines/edit/${lineID}`)
          .send({
            changes: lineChange,
            changesetID,
            mediaID,
          })
          .expect(200)
          .then((res) => {
            expect(res.body).to.be.an('array');
            return db.collection('lines').find({ _id: ObjectId(lineID) }).limit(1).next();
          })
          .then((line) => {
            expect(line.text).to.equal(lineChange.text);
            expect(line.text).not.to.equal(newLine.text);
            expect(line.version).to.equal(2);

            expect(line.changeset).to.be.an.instanceof(ObjectId);
            expect(line.changeset.toString()).to.equal(changesetID);
            expect(line.media).to.be.an.instanceof(ObjectId);
            expect(line.media.toString()).to.equal(mediaID);
            expect(line.creator).to.be.an.instanceof(ObjectId);
            expect(line.deleted).to.equal(false);
            expect(line.heading).to.equal(null);
            expect(line.startTime).to.equal(newLine.startTime);
            expect(line.endTime).to.equal(newLine.endTime);
          });
      });

      it('should return two lines, after adding a second');
    });
  });

  describe('ajax requests- ', function () {
    before(function () {
      // automatically authorize request
      // app.use();
    });

    it('/api/changesets/list', function () {
      return request(server)
        .get('/api/changesets/list?userID')
        .expect(200)
        .then(function (res) {
          // TO DO: test actual content
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/changesets/list', function () {
      return request(server)
        .get('/api/changesets/list?userID=58e451206b5df803808e5912')
        .expect(200)
        .then(function (res) {
          // TO DO: test actual content
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/changesets/list', function () {
      return request(server)
        .get('/api/changesets/list?mediaID=58e638a2d300e060f9cdd6ca')
        .expect(200)
        .then(function (res) {
          // TO DO: test actual content
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/changesets/list', function () {
      return request(server)
        .get('/api/changesets/list?mediaID=58e638a2d300e060f9cdd6ca&from=58eb3cceb1dd4ced9f759083')
        .expect(200)
        .then(function (res) {
          // TO DO: test actual content
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/search', function () {
      return request(server)
        .get('/api/search?query=phyno')
        .expect(200)
        .then(function (res) {
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/search with blank query should return empty object', function () {
      return request(server)
        .get('/api/search?query=')
        .expect(200)
        .then(function (res) {
          expect(res.body).to.be.an('object');
        });
    });

    it('/api/lines', function () {
      return request(server)
        .get('/api/lines/58e638a2d300e060f9cdd6ca')
        .expect(200)
        .then(function (res) {
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/media/list shows list for logged in user', function () {
      return request(server)
        .get('/api/media/list')
        .expect(200)
        .then(function (res) {
          expect(res.body).to.be.an('array');
        });
    });

    it('/api/media/:mediaID', function () {
      return request(server)
        .get('/api/media/58e638a2d300e060f9cdd6ca')
        .expect(200)
        .then(function (res) {
          expect(res.body).to.be.an('object');
        });
    });

    it('/api/rankings', function () {
      return request(server)
        .get('/api/rankings')
        .expect(200);
    });

    it('/api/list/audio', function () {
      return request(server)
        .get('/api/list/audio')
        .expect(200);
    });

    it('/api/carousel', function () {
      return request(server)
        .get('/api/carousel')
        .expect(200);
    });

    it('/api/logError', function () {
      return request(server)
        .post('/api/logError')
        .send('test browser error')
        .expect(200);
    });

    it('can handle a server error', function () {
      return request(server)
        .get('/api/media/----')
        .expect(500);
    });
  });

  describe('authorization routing', function () {
    it('should redirect anonymous user to login for restricted page', function () {
      testUser.role = 'member';
      return request(server)
        .get('/new_music')
        .expect(403);
    });

    it('should permit admin user to add new music', function () {
      testUser.role = 'admin'; // to do: restore
      return request(server)
        .get('/new_music')
        .expect(200);
    });

    it('should log out and redirect', function () {
      return request(server)
        .get('/logout')
        .expect(302);
    });

    it('should serve login page', function () {
      return request(server)
        .get('/login')
        .expect(200);
    });

    it('should allow twitter login', function () {
      return request(server)
        .get('/login/twitter')
        .expect(302)
        .then(function (res) {
          expect(res.headers.location).to.equal('/login/twitter/return?code=111');
          return request(server).get(res.headers.location).expect(302).then(function (res2) {
            expect(res2.headers.location).to.equal('/');
          });
        });
    });

    it('should allow facebook login', function () {
      return request(server)
        .get('/login/facebook')
        .expect(302)
        .then(function (res) {
          expect(res.headers.location).to.equal('/login/facebook/return?code=111');
          return request(server).get(res.headers.location).expect(302).then(function (res2) {
            expect(res2.headers.location).to.equal('/');
          });
        });
    });
  });

  it('distinguisehs between two media with the same title/slug');

  it('never loads deleted songs');

  it('does not allow editing of stale line');

  it('redirects to original page after sign in');

  it('stores all numbers as numbers instead of strings');

  it('updates url/slug when title changes');

  it('does not allow title/slug changes after a certain number of views');

  it('maintais daily count of views');

  it('cleans up sessions');

  it('clears failed revisions');

  it('youtube source url always has matching protocol');

  it('manages sessions');
});
