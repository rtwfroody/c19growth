import React from 'react';

import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';

import RegionView from './RegionView';
import PlotView from './PlotView';
import MatchView from './MatchView';
import Options from './Options';
import {data_set, scale, data_per} from './constants.js';

function cleanAoi(aoi)
{
    // Make sure that each sequence we have contains every date we have.
    var all_dates = {}
    for (const code in aoi) {
        let region = aoi[code]
        for (const t in region.data) {
            for (const d in region.data[t]) {
                all_dates[d] = true
            }
        }
    }

    all_dates = Object.keys(all_dates).sort()
    for (const code in aoi) {
        let region = aoi[code]
        for (const t in region.data) {
            var last = 0
            for (const d of all_dates) {
                if (d in region.data[t]) {
                    last = region.data[t][d]
                } else {
                    region.data[t][d] = last
                }
            }
        }
    }
    return aoi
}

function UpdateUrl(props) {
  var parts = []
  switch (props.data_set) {
    case data_set.ACTIVE:
      parts.push("act")
      break
    case data_set.CONFIRMED:
      break
    case data_set.DEATHS:
      parts.push("dth")
      break
    case data_set.RECOVERED:
      parts.push("rec")
      break
    case data_set.TESTED:
      parts.push("tst")
      break
    default:
      console.assert(0)
      break
  }
  switch (props.data_per) {
    case data_per.ABSOLUTE:
      break
    case data_per.CAPITA:
      parts.push("rel")
      break
    case data_per.BED:
      parts.push("bed")
      break
    default:
      console.assert(0)
      break
  }
  switch (props.scale) {
    case scale.LINEAR:
      break
    case scale.LOG:
      parts.push("log")
      break
    default:
      console.assert(0)
      break
  }
  if (props.daily) {
    parts.push("dly")
  }

  for (const code in props.selected) {
    if (props.selected[code] !== 0) {
      parts.push(code + props.selected[code])
    } else {
      parts.push(code)
    }
  }

  var url = new URL(window.location)
  url.hash = parts.join(";")
  window.history.pushState("", "", url)

  return null
}

class Dashboard extends React.Component
{
  constructor(props) {
    super(props)
    this.state = {
      loading: true,
      selected: {},
      aoi: {},
      menuAnchor: null,
      daily: false,
      scale: scale.LINEAR,
      data_set: data_set.CONFIRMED,
      data_per: data_per.ABSOLUTE,
      focus: undefined
    }
  }

  setSelected(code, value) {
    var newSelected = {...this.state.selected}
    if (value === undefined) {
      delete newSelected[code]
    } else {
      newSelected[code] = parseInt(value)
    }
    this.setState({selected: newSelected})

    if (!(this.state.focus in newSelected)) {
      let codes = Object.keys(newSelected).sort()
      if (codes.length > 0) {
        this.setState({focus: codes[0]})
      } else {
        this.setState({focus: undefined})
      }
    }
  }

  toggleMenu(event) {
    if (this.state.menuAnchor) {
      this.setState({menuAnchor: null})
    } else {
      this.setState({menuAnchor: event.currentTarget})
    }
  }

  closeMenu(event) { this.setState({menuAnchor: null}) }
  setDaily(event) { this.setState({daily: event.target.value}) }
  setScale(event) { this.setState({scale: event.target.value}) }
  setDataSet(event) { this.setState({data_set: event.target.value}) }
  setDataPer(event) { this.setState({data_per: event.target.value}) } 
  setFocus(code) { this.setState({focus: code})}

  render() {
    if (this.state.loading) {
      return (
        <div>
          <h2>Loading data...</h2>
          <div className="loader"></div>
        </div>
      )
    }

    return (
      <div>
        {/*
        <AppBar position="static">
          <Toolbar>
            <IconButton edge="start" color="inherit" onClick={(event) => this.toggleMenu(event)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6">
              COVID-19 Cases Over Time
            </Typography>
          </Toolbar>
        </AppBar>
        <Menu
          id="menu"
          anchorEl={this.state.menuAnchor}
          keepMounted
          open={Boolean(this.state.menuAnchor)}
          onClose={() => this.closeMenu()}
        >
          <MenuItem onClick={() => this.closeMenu()}>Profile</MenuItem>
          <MenuItem onClick={() => this.closeMenu()}>My account</MenuItem>
          <MenuItem onClick={() => this.closeMenu()}>About</MenuItem>
        </Menu>
        */}

        <Grid container spacing={2}>
          <Grid item xs={12}>
              <PlotView
                aoi={this.state.aoi}
                selected={this.state.selected}
                daily={this.state.daily}
                dataSet={this.state.data_set}
                dataPer={this.state.data_per}
                scale={this.state.scale}
              />
          </Grid>

          <Grid item xs={12}>
            <Paper>
              <Options
                daily={this.state.daily} setDaily={(e) => this.setDaily(e)}
                scale={this.state.scale} setScale={(e) => this.setScale(e)}
                data_set={this.state.data_set} setDataSet={(e) => this.setDataSet(e)}
                data_per={this.state.data_per} setDataPer={(e) => this.setDataPer(e)}
              />
            </Paper>
          </Grid>

          <Grid item sm={9}>
            <Paper>
              <RegionView
                aoi={this.state.aoi}
                selected={this.state.selected}
                setSelected={(code, shift) => this.setSelected(code, shift)}
                setFocus={code => this.setFocus(code)}
              />
            </Paper>
          </Grid>

          <Grid item sm={3}>
            <Paper>
              <MatchView
                aoi={this.state.aoi}
                focus={this.state.focus}
                setSelected={(code, shift) => this.setSelected(code, shift)}
                selected={this.state.selected}
                data_set={this.state.data_set}
                data_per={this.state.data_per}
              />
            </Paper>
          </Grid>
        </Grid>
        <UpdateUrl
          selected={this.state.selected}
          daily={this.state.daily} setDaily={(e) => this.setDaily(e)}
          scale={this.state.scale} setScale={(e) => this.setScale(e)}
          data_set={this.state.data_set}
          data_per={this.state.data_per}
        />
      </div>
    );
  }

  loadData() {
    this.setState({ ...this.state, loading: true })
    fetch("outbreak.json")
      .then(response => response.json())
      .then(aoi => cleanAoi(aoi))
      .then(result => {
        var url = new URL(window.location)

        if (url.hash === "") {
          url.hash = "USA"
        }

        for (var part of url.hash.slice(1).split(";")) {
          var re = new RegExp('([-A-Za-z]+)(-?[0-9]*)')
          var match = re.exec(part)
          if (part === "") {
          } else if (match && match[1] in result) {
            this.setSelected(match[1], parseInt(match[2]) || 0)
          } else if (part === "act") {
            this.setState({data_set: data_set.ACTIVE})
          } else if (part === "dth") {
            this.setState({data_set: data_set.DEATHS})
          } else if (part === "rec") {
            this.setState({data_set: data_set.RECOVERED})
          } else if (part === "tst") {
            this.setState({data_set: data_set.TESTED})
          } else if (part === "rel") {
            this.setState({data_per: data_per.CAPITA})
          } else if (part === "bed") {
            this.setState({data_per: data_per.BED})
          } else if (part === "log") {
            this.setState({scale: scale.LOG})
          } else if (part === "dly") {
            this.setState({daily: true})
          } else {
            console.log("ERROR: Don't know what to do with " + part + " in URL (" + url.hash + ").")
          }
        }

        this.setState({ aoi: result, loading: false })
      })
      .catch(e => {
        console.log(e)
        this.setState({ ...this.state, loading: false })
      })
  }

  componentDidMount() {
    this.loadData()
    this.timer = setInterval(() => this.loadData(), 3600 * 1000)
  }

  componentWillUnmount() {
    clearInterval(this.timer)
    this.timer = null
  }
}

export default function App() {
  return (
      <Dashboard />
  );
}
