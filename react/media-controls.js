
class ProgressBar extends React.Component {
  constructor(props) {
    super(props);
    this.followMouse = this.followMouse.bind(this);
    this.clearGuide = this.clearGuide.bind(this);
    this.seekTo = this.seekTo.bind(this);
  }

  followMouse(e){

      var seekerOffset = $(this.seekerBar).offset().left;
      var relativePosition = e.pageX - seekerOffset;

      $(".seeking-bar-guide").css("width", relativePosition);

  }

  clearGuide(){
    $(".seeking-bar-guide").css("width", 0);
  }

  seekTo(e){
    var seekerOffset = $(this.seekerBar).offset().left;
    var relativePosition = e.pageX - seekerOffset;
    var percentage = relativePosition/($(this.seekerBar).width());

    this.props.onSeekTo(percentage);

  }

  render (){
    return <div className="seeking" onMouseMove={this.followMouse} onMouseLeave={this.clearGuide}>
      <div className="seeking-bar" ref={(element) => {this.seekerBar = element}} onClick={this.seekTo} >
        <div className="seeking-bar-guide"></div>
        <div className="seeking-bar-meter" ref={(element) => {this.seeker = element}} style={{width: 100 * this.props.percentage + "%"}}></div>
      </div>
    </div>;
  }


}


class MediaControls extends React.Component {
  constructor(props) {
    super(props);
    this.handleTogglePlay = this.handleTogglePlay.bind(this);

    this.state = {paused: true};
  }

  handleTogglePlay(e){
    $(e.currentTarget).blur();
    if(this.state.paused){
      this.props.onPlay();
    }else{
      this.props.onPause();
    }
    this.setState((prevState, props) => ({
      paused: !prevState.paused
    }));
  }

  render(){

    var icon = this.state.paused? "play" : "pause";

    return  <button type="button" className="button" aria-label="Left Align" onClick={this.handleTogglePlay}>
                <span className={"glyphicon glyphicon-" + icon} aria-hidden="true"></span>
              </button>;
  }

}