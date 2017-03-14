
      class LyricEditor extends React.Component {
        constructor(props) {
          super(props);
          this.state = {
            value: '',
            displayed: true,
            originalText: "",
            mode: "add" /*update or add*/,
            enabled: false,
            /*tail coordinates */
            rightX: 10,
            rightY: 0,
            leftX: 40,
            leftY: 0,
            bottomX: 25,
            bottomY: 50
          };

          this.handleChange = this.handleChange.bind(this);
          this.handleSubmit = this.handleSubmit.bind(this);
          this.handleCancel = this.handleCancel.bind(this);
          this.moveTail = this.moveTail.bind(this);
          this.handleToggleEditMode = this.handleToggleEditMode.bind(this);

          lyricEditor = this;

        }

        moveTail(time){
          var dialogWidth = $("#lyricEditor").outerWidth();
          console.log(dialogWidth);
          var tailWidth = dialogWidth/4;
          var offset = dialogWidth * time/window["maxTime"];
         this.setState({
            rightX: offset,
            rightY: 0,
            leftX: offset + tailWidth,
            leftY: 0,
            bottomX: offset + tailWidth/2,
            bottomY: 50
          });
        }

        handleToggleEditMode(){
          editMode = !this.state.enabled;
          this.setState((prevState, props) => ({
            enabled: !prevState.enabled
          }));
        }

        handleChange(event) {
          this.setState({value: event.target.value});
        }

        handleSubmit(event) {
          event.preventDefault();
          this.props.onSubmit(this.state.value);
          this.setState({value: ""});
        }

        handleCancel(){
          this.setState({displayed: false});
        }

        hide(){
          this.setState({displayed: false});
        }

        show(text){
          var mode = "add";
          var originalText = null;
          var value = this.state.value || "";
          if(text){
            mode = "save";
            originalText = 'original: "' + text + '"';
            value = text;
          }
          this.setState({
            displayed: true,
            originalText: originalText,
            value: value,
            mode: mode
          });
        }

        render () {
          var points = this.state.leftX + "," + this.state.leftY + " "
                      + this.state.rightX + "," + this.state.rightY + " "
                      + this.state.bottomX + "," + this.state.bottomY;
          var btnText = (this.state.mode=="add") ? "Add" : "Update";
          var originalText = this.state.originalText ? <div className="originalText">{this.state.originalText}</div> : null;
          var editSwitchText = (this.state.enabled) ? "Done Editing" : "Edit";
          var dialog = this.state.displayed && <form id="lyricEditor" className="editor-bg-color" onSubmit={this.handleSubmit}><div className="row">
            <div className="col-md-12">
              {originalText}
              <input id="lyric" type="text" placeholder="Transcibe Lyrics..." value={this.state.value} onChange={this.handleChange} />
            </div>
          </div>
          <div className="row">
            <div className="col-md-5">
              <TimeSpinner className="col-md-5"  id="start-spinner" variableName="segmentStart" label="From" onChange={this.moveTail}/>
            </div>
            <div className="col-md-5">
              <TimeSpinner className="col-md-5"  id="end-spinner" variableName="segmentEnd" label="To"/>
            </div>
            <div className="col-md-2">
              <a id="playLyric" type="button" className="btn btn-default btn-lg" title="play" onClick={this.props.onPlay}>
                <span className="glyphicon glyphicon-play" aria-hidden="true"></span>
              </a>
            </div>
          </div>
          <div className="row">
            <div className="col-md-3">
              <button id="cancel-dialog-btn" className="btn btn-default btn-lg" type="reset" onClick={this.handleCancel}>Cancel</button>
            </div>
            <div className="col-md-9">
              <button id="save-lyric-btn" className="btn btn-default btn-lg" type="submit">{btnText}</button>
            </div>
          </div>
          <svg id="tail">
            <polygon points={points} className="editor-bg-color"></polygon>
          </svg></form>;

          return <div>
          <button id="edit-mode-btn" type="button" className="btn btn-default btn-lg" onClick={this.handleToggleEditMode}>{editSwitchText}</button>
          {this.state.enabled && dialog}
          </div>;

        }
      }
