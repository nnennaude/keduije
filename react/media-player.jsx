/* eslint-env browser */
/* global $ */
import React from 'react';
import PropTypes from 'prop-types';

import KeduIje from './keduije';
import KeduIjeMedia from './keduije-media';
import LyricDisplay from './lyric-display';
import LyricEditor from './lyric-editor';
import SongInfoForm from './song-info-form';
import ProgressBar from './progress-bar';
import PlayControl from './play-control';

function EditSwitch(props) {
  return (<label className="switch" htmlFor="edit-switch">
    <input
      id="edit-switch"
      type="checkbox"
      checked={props.editMode}
      onChange={props.toggleEditMode}
    />
    <div className="slider" />
  </label>);
}

EditSwitch.propTypes = {
  editMode: PropTypes.bool.isRequired,
  toggleEditMode: PropTypes.func.isRequired,
};

class MediaPlayer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      segmentStart: 0,
      segmentEnd: 0,
      currentTime: 0,
      displayEditor: false,
      originalText: '',
      text: '',
      editMode: false,
      editType: 'add',
      lyrics: [],
      showEditDialog: false,
      editDialogIsOpen: false,
      isPlaying: false,
      videoPlaybackMode: false,
      affixed: false,
    };

    this.maxTime = null;
    this.media = null;
    this.saveStartTime = false; // accounts for "jumping" around, rename to "holdStartTime"
    this.timeMarksFrozen = false;
    this.lyricBeingEdited = null;
    this.stopAtSegmentEnd = false;
    this.originalSongInfo = null;
    this.historyLink = '';

    this.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady.bind(this);
    this.onPlayerReady = this.onPlayerReady.bind(this);
    this.playSegment = this.playSegment.bind(this);
    this.incrementTime = this.incrementTime.bind(this);
    this.decrementTime = this.decrementTime.bind(this);
    this.handlePaused = this.handlePaused.bind(this);
    this.seekTo = this.seekTo.bind(this);
    this.onTimeout = this.onTimeout.bind(this);
    this.handleResume = this.handleResume.bind(this);
    this.showEditDialog = this.showEditDialog.bind(this);
    this.saveLyric = this.saveLyric.bind(this);
    this.loadLyrics = this.loadLyrics.bind(this);
    this.jumpTo = this.jumpTo.bind(this);
    this.close = this.close.bind(this);
    this.handleToggleEditMode = this.handleToggleEditMode.bind(this);
    this.handleTextChange = this.handleTextChange.bind(this);
    this.showEditHeaderDialog = this.showEditHeaderDialog.bind(this);
    this.displaySongInfo = this.displaySongInfo.bind(this);
    this.toggleSongInfoDialog = this.toggleSongInfoDialog.bind(this);
    this.saveSongInfo = this.saveSongInfo.bind(this);
    this.togglePlayState = this.togglePlayState.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.updateIfChanged = this.updateIfChanged.bind(this);
    this.cancelEditMode = this.cancelEditMode.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.deleteThisSong = this.deleteThisSong.bind(this);
  }

  showEditHeaderDialog(data) {
    this.lyricBeingEdited = data;
    const defaultValue = '[]';
    const headingText = prompt(data.heading ? 'Update Heading' : 'Please enter heading', data.heading || defaultValue);
    if (headingText && (headingText !== defaultValue)) { this.saveLyric(headingText); }
  }

  handleDelete(e) {
    const r = confirm(`Are you sure you want to delete '${this.state.originalText}'?`);
    if (r === true) {
      KeduIje.deleteLyric(this.lyricBeingEdited, this.loadLyrics);
    }
  }

  handleTextChange(event) {
    this.setState({ text: event.target.value });
  }

  updateIfChanged(obj, field, stateName) {
    if (this.state[stateName].toString() !== this.lyricBeingEdited[field]) {
      obj[field] = this.state[stateName];
    }
  }

  saveLyric(headingText) {
    if (this.lyricBeingEdited) {
      const lyricChanges = {};
      if (headingText) {
        lyricChanges.heading = headingText;
      } else {
        this.updateIfChanged(lyricChanges, 'text', 'text');
        this.updateIfChanged(lyricChanges, 'startTime', 'segmentStart');
        this.updateIfChanged(lyricChanges, 'endTime', 'segmentEnd');
      }

      // to do: [semantics] back a "refresh" instead
      KeduIje.updateLyric(this.lyricBeingEdited, lyricChanges, this.loadLyrics);
    } else {
      const newLyric = {
        text: this.state.text,
        endTime: this.state.segmentEnd,
        deleted: false,
        startTime: this.state.segmentStart,
        heading: null,
      };
      KeduIje.addLyric(newLyric, this.loadLyrics);
    }
    this.lyricBeingEdited = null;
  }

  handleToggleEditMode() {
    KeduIje.startEditSession(!this.state.editMode, this.cancelEditMode);
      // todo: wait for callback before setting state. or better handle asynchronicity

    this.setState((prevState, props) => ({
      editMode: !prevState.editMode,
    }));
  }

  cancelEditMode(err) {
    console.log(err);
    alert('you cannot edit at this time');
    this.setState({ editMode: false });
  }

  showEditDialog(data) {
    this.lyricBeingEdited = data;

    let mode = 'add';
    let originalText = null;
    if (data.text) {
      this.timeMarksFrozen = true;
      mode = 'save';
      originalText = `original: "${data.text}"`;
    }

    this.setState({
      displayEditor: true,
      originalText: originalText,
      editType: mode,
      text: data.text,
      segmentStart: parseInt(data.startTime, 10),
      segmentEnd: parseInt(data.endTime, 10),
    });
  }

  close() {
    this.setState({
      displayEditor: false,
      originalText: null,
      editType: 'add',
      text: '',
    });

    this.timeMarksFrozen = false;
  }

  loadLyrics(lyrics) {
    lyrics.sort((a, b) => parseInt(a.startTime, 10) - parseInt(b.startTime, 10));

    this.setState({
      lyrics: lyrics,
      displayEditor: false,
      text: '',
    });

    this.timeMarksFrozen = false;
  }

  togglePlayState() {
    (this.state.isPlaying) ? this.media.pause() : this.media.play();
  }

  seekTo(percentage) {
    const time = percentage * this.maxTime;
    this.setState({ currentTime: time });
    this.media.seekTo(time);
  }

  onTimeout() {
    const currentTime = this.media.getCurrentTime();
    this.setState({ currentTime: currentTime });

    // stop if playing a segment
    if (this.stopAtSegmentEnd && (currentTime > this.state.segmentEnd)) {
      this.media.pause();
      this.stopAtSegmentEnd = false;
    }
  }

  onYouTubeIframeAPIReady() {
    // todo: add sanity check here
    if (this.props.mediaType !== KeduIjeMedia.mediaTypes.VIDEO) return;

    this.media = new KeduIjeMedia.Media(
      this.iframe,
      this.onPlayerReady,
      this.handlePaused,
      this.handleResume);
  }

  componentWillMount() {
    window.onkeyup = this.onKeyUp;
    window.onscroll = this.onScroll;
  }

  onScroll(e) {
    if ((!this.state.affixed) && (window.scrollY > this.affixPoint)) {
      this.setState({ affixed: true });
    } else if ((this.state.affixed) && (window.scrollY < this.affixPoint)) {
      this.setState({ affixed: false });
    }
  }

  componentDidMount() {
    KeduIje.init(this.props.mediaID);
    KeduIje.loadLyrics(this.loadLyrics);
    KeduIje.loadSongInfo(this.displaySongInfo);

    this.affixPoint = this.artwork.offsetTop + this.artwork.offsetHeight;

    // todo: add sanity check here
    if (this.props.mediaType === KeduIjeMedia.mediaTypes.AUDIO) {
      this.media = new KeduIjeMedia.Audio(
        this.audioElement,
        this.onPlayerReady,
        this.handlePaused,
        this.handleResume);
    } else if (this.props.mediaType === KeduIjeMedia.mediaTypes.VIDEO) {
      window.onYouTubeIframeAPIReady = this.onYouTubeIframeAPIReady;
      $.getScript('https://www.youtube.com/iframe_api');
    }
  }

  onPlayerReady(event) {
    this.maxTime = this.media.getDuration();
  }

  handlePaused() {
    clearInterval(this.timer);
    this.setState({ isPlaying: false });
    if (this.timeMarksFrozen) return; // revisit

    let segmentStart = this.state.segmentStart;
    let segmentEnd = this.state.segmentEnd;

    if (!this.saveStartTime) {
      this.setState({
        segmentStart: segmentEnd,
      });
      segmentStart = segmentEnd;
    }
    this.saveStartTime = false; // turn off switch
    segmentEnd = Math.floor(this.media.getCurrentTime());
    this.setState({
      segmentEnd: segmentEnd,
      displayEditor: true,
    });
  }

  handleResume() {
    this.timer = setInterval(this.onTimeout, 1000);
    this.setState({ isPlaying: true });
    if ((!this.state.videoPlaybackMode) &&
      (this.props.mediaType === KeduIjeMedia.mediaTypes.VIDEO)) {
      this.setState({ videoPlaybackMode: true });
    }
  }

  jumpTo(start, end) {
    this.setState({
      segmentStart: start,
      segmentEnd: end,
    }, this.playSegment);
  }

  playSegment(stopAtSegmentEnd) {
    this.media.seekTo(this.state.segmentStart, true);
    this.media.play();
    this.saveStartTime = true;
    this.stopAtSegmentEnd = stopAtSegmentEnd;
  }

  decrementTime(variableName) {
    if (this.state[variableName] > 0) {
      this.setState((prevState, props) => {
        const newState = {};
        newState[variableName] = prevState[variableName] - 1;
        return newState;
      });
    }
  }

  incrementTime(variableName) {
    if (this.state[variableName] < this.maxTime) {
      this.setState((prevState, props) => {
        const newState = {};
        newState[variableName] = prevState[variableName] + 1;
        return newState;
      });
    }
  }

  toggleSongInfoDialog(value) {
    this.setState({ editDialogIsOpen: value });
  }

  saveSongInfo(songInfo) {
    KeduIje.saveSongInfo(this.originalSongInfo, songInfo, this.displaySongInfo);
  }

  deleteThisSong() {
    KeduIje.deleteSong(this.originalSongInfo);
  }

  displaySongInfo(songInfo) {
    this.originalSongInfo = songInfo;
    this.historyLink = `/music/${songInfo.slug}/history`;// consider making state
    this.setState({
      title: songInfo.title || '',
      artist: songInfo.artist || '',
      img: songInfo.img || '',
      editDialogIsOpen: false,
    });
  }

  onKeyUp(e) {
    if ((e.keyCode === 32) && (this.state.editMode)) { // space
      if ((!this.state.displayEditor) && (!this.state.editDialogIsOpen)) { this.togglePlayState(); }
    }

    // this.playSegment(true);
  }

  render() {
    const percentage = this.state.currentTime / this.maxTime;
    let mediaElement = null;

    if (this.props.mediaType === KeduIjeMedia.mediaTypes.AUDIO) {
      mediaElement = (<audio ref={(audio) => { this.audioElement = audio; }}>
        <source src={this.props.src} type="audio/mpeg" />
      </audio>);
    } else {
      const src = `http://www.youtube.com/embed/${this.props.videoID
        }?enablejsapi=1&showinfo=0&color=white&modestbranding=1&origin=${
           window.location.origin}&playsinline=1&rel=0&controls=0`;

      const iframeClass = this.state.videoPlaybackMode ? '' : ' hidden-video';
      mediaElement = (<div className={`embed-responsive embed-responsive-16by9${iframeClass}`}>
        <iframe
          ref={(iframe) => { this.iframe = iframe; }}
          className="embed-responsive-item"
          src={src}
          frameBorder="0"
        />
      </div>);
    }

    let affixed = '';
    if (this.state.videoPlaybackMode) {
      affixed = 'hold';
    } else if (this.state.affixed) {
      affixed = 'affix';
    }

    const infoBar = (<div className={`info-bar ${affixed}`}>
      <p className="title">{this.state.title}</p>
      <p className="artist">{this.state.artist}</p>
      <PlayControl
        togglePlayState={this.togglePlayState}
        isPlaying={this.state.isPlaying}
      />
      {this.props.canEdit && (<EditSwitch
        toggleEditMode={this.handleToggleEditMode}
        editMode={this.state.editMode}
      />)}
      <ProgressBar onSeekTo={this.seekTo} percentage={percentage} />
    </div>);

    const artwork = (<div key="artwork" ref={(el) => { this.artwork = el; }} className="artwork" style={{ backgroundImage: `url(${this.state.img})` }}>
      <div className="gradient" />
      <PlayControl
        togglePlayState={this.togglePlayState}
        isPlaying={this.state.isPlaying}
      />
      <ProgressBar onSeekTo={this.seekTo} percentage={percentage} />
      {this.props.canEdit && (<EditSwitch
        toggleEditMode={this.handleToggleEditMode}
        editMode={this.state.editMode}
      />)}
      <div className="song-info">
        <p className="artist">{this.state.artist}</p>
        <h1 className="title">{this.state.title}</h1>

        {this.state.editMode && (<a
          href="#"
          onClick={(e) => { this.toggleSongInfoDialog(true, e); }}
        >(edit)</a>)}
        {this.props.canEdit && <a href={this.historyLink}>(history)</a>}
      </div>
    </div>);

    const editors = this.props.canEdit && <div>
      {this.state.editDialogIsOpen && <SongInfoForm
        onSubmit={this.saveSongInfo}
        title={this.state.title}
        artist={this.state.artist}
        onCancel={(e) => { this.toggleSongInfoDialog(false, e); }}
        img={this.state.img}
        onRemove={this.deleteThisSong}
      />}
      <LyricEditor
        segmentStart={this.state.segmentStart}
        segmentEnd={this.state.segmentEnd}
        incrementTime={this.incrementTime}
        decrementTime={this.decrementTime}
        percentage={percentage || 0}
        playLyric={(e) => { this.playSegment(true, e); }}
        displayed={this.state.displayEditor}
        originalText={this.state.originalText}
        editMode={this.state.editMode}
        mode={this.state.editType}
        close={this.close}
        saveLyric={this.saveLyric}
        value={this.state.text}
        handleChange={this.handleTextChange}
        onDelete={this.handleDelete}
      />
      </div>;

    const classIfVideo = (this.state.videoPlaybackMode) ? ' video-lyrics' : '';
    return (<div className="row">
      <div id="lyric-column" className={`col-md-6 col-xs-12 col-md-offset-3 ${classIfVideo}`}>

        {this.state.videoPlaybackMode || artwork}
        {mediaElement}
        <LyricDisplay
          lyrics={this.state.lyrics}
          currentTime={this.state.currentTime}
          editMode={this.state.editMode}
          jumpTo={this.jumpTo}
          showEditDialog={this.showEditDialog}
          showEditHeaderDialog={this.showEditHeaderDialog}
          videoIsPlaying={this.state.videoPlaybackMode}
        />
        {infoBar}
        {editors}
      </div>
    </div>);
  }
}

MediaPlayer.propTypes = {
  mediaType: PropTypes.oneOf(
    [KeduIjeMedia.mediaTypes.AUDIO, KeduIjeMedia.mediaTypes.VIDEO]).isRequired,
  canEdit: PropTypes.bool.isRequired,
  src: PropTypes.string.isRequired,
  videoID: PropTypes.string.isRequired,
  mediaID: PropTypes.string.isRequired,
};

export default MediaPlayer;