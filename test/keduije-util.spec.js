/* eslint-env mocha, browser */
import { expect, assert } from 'chai';
import sinon from 'sinon';

import KeduijeUtil from '../react/keduije-util';
import getToken from '../lib/spotify';
import { configureAjaxBehavior } from './utils/mocks';

KeduijeUtil.__Rewire__('API_KEY', 'AIzaSyAZoi72Rr-ft3ffrgJ9gDZ-O5_fyVNDe_k');

describe('keduije-util.js', function () {
  beforeEach(function () {
    configureAjaxBehavior(true);
  });

  it('find video info from ID', function () {
    const url = 'https://www.youtube.com/watch?v=KUFZgJ32xU8';
    return KeduijeUtil.getYTdata(url)
      .then(function (vid) {
        expect(vid).not.to.be.null;
      });
  });

  it('throws error, when yt video not found', function () {
    configureAjaxBehavior(true, []);
    const url = 'https://www.youtube.com/watch?v=5';
    return KeduijeUtil.getYTdata(url)
      .then(function () {
        assert.fail(0, 1, 'Exception not thrown');
      })
      .catch(function (err) {
        expect(err).to.be.ok;
        expect(err.message).to.equal('Video data not found.');
      });
  });

  it('throws error, when video id not extracted from url', function () {
    const url = 'https://www.youtube.com/';
    return KeduijeUtil.getYTdata(url)
      .then(function () {
        assert.fail(0, 1, 'Exception not thrown');
      })
      .catch(function (err) {
        expect(err).to.be.ok;
        expect(err.message).to.equal('No Video ID found.');
      });
  });

  // ✓ GOOD
  it('handles when it youtube api call fails', function () {
    const errorMessage = '403 error';
    configureAjaxBehavior(false, errorMessage);
    const url = 'https://www.youtube.com/watch?v=KUFZgJ32xU8';
    return KeduijeUtil.getYTdata(url)
      .then(function () {
        assert.fail(0, 1, 'Exception not thrown');
      })
      .catch(function (err) {
        expect(err).to.be.ok;
        expect(err.message).to.equal(errorMessage);
      });
  });

  it('will not look for video url for non youtube url');

  describe('spotify api', function () {
    let token;

    before(function () {
      return getToken(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET)
      .then((t) => {
        token = t;
      });
    });

    it('finds artwork given a string', function () {
      return KeduijeUtil.searchImages('Flavour', token)
        .then(function (images) {
          expect(images).to.be.ok;
        });
    });
  });

  it('loads youtube iframe api', function (done) {
    function cb() {
      done();
    }
    KeduijeUtil.loadYoutubeIFrameAPI(cb);
  });

  it('converts 0 seconds to "0:00"', function () {
    const time = KeduijeUtil.convertToTime(0);
    expect(time).to.equal('0:00');
  });

  it('converts time to double digit minutes', function () {
    const time = KeduijeUtil.convertToTime(700);
    expect(time).to.equal('11:40');
  });

  // ✓ GOOD
  it('converts NaN to "--:--"', function () {
    const time = KeduijeUtil.convertToTime(NaN);
    expect(time).to.equal('--:--');
  });

  // to do: make browser test. also IMPROVE
  it('does not scroll when element in view', function () {
    const div = document.createElement('DIV');
    KeduijeUtil.scrollIfOutOfView(div);
  });

  // to do: make browser test, IMPROVE
  it('scrolls when element is out of view', function () {
    global.$.prototype.offset = sinon.stub();
    global.$.prototype.offset.returns({ top: 50 });
    sinon.spy(global.$.prototype, 'animate');
    const div = document.createElement('DIV');
    KeduijeUtil.scrollIfOutOfView(div);
    expect(global.$.prototype.animate.called).to.be.true;
  });

  it('can handle invalid number for conversion');

  it('sends discriptive error for 403 from server');
});
