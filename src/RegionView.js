import React from 'react';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import PropTypes from 'prop-types';

import ArrowLeftIcon from '@material-ui/icons/ArrowLeft';
import ArrowRightIcon from '@material-ui/icons/ArrowRight';
import { TextField } from '@material-ui/core';

const useStyles = makeStyles(
    {
      statusCell: {
        width: "2em"
      },
    }
);

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Typography
      component="div"
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </Typography>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

function color_fade(type, start, end, fraction)
{
    var color = []
    fraction = Math.max(0, Math.min(fraction, 1))
    for (var i = 0; i < 3; i++) {
        color.push(Math.round(start[i] * fraction + end[i] * (1 - fraction)))
    }
    if (type === "hsl") {
        return "hsl(" + color[0] + "," + color[1] + "%," + color[2] + "%)"
    } else {
        return "rgb(" + color.join(",") + ")"
    }
}

function StatusCell(props) {
  const classes = useStyles();
  const style = { background: props.color }
  return (
      <Tooltip title={props.tip}>
        <TableCell className={classes.statusCell} style={style} />
      </Tooltip>
  )
}

function VelocityCell(props) {
  // 100 people per million per day is maxed out
  const color = color_fade("hsl", [0, 100, 50], [0, 100, 100], props.value * 10000)
  return <StatusCell color={color}
    tip={Math.round(1000000 * props.value) + " new cases/day/million people"}/>
}

function AccelerationCell(props) {
  // 10 people per million per day per day is maxed out
  const p = props.value * 100000
  const color = p > 0 ? color_fade("hsl", [0, 100, 50], [0, 100, 100], p)
        : color_fade("hsl", [210, 100, 50], [210, 100, 100], -p);
  return <StatusCell color={color}
    tip={(Math.round(10000000 * props.value) / 10) + " new cases/day^2/million people"}
        />
}

function JerkCell(props) {
  // 1 people per million per day per day per day is maxed out
  const p = props.value * 1000000
  const color = p > 0 ? color_fade("hsl", [0, 100, 50], [0, 100, 100], p)
    : color_fade("hsl", [210, 100, 50], [210, 100, 100], -p);
  return <StatusCell color={color}
    tip={(Math.round(100000000 * props.value) / 100) + " new cases/day^3/million people"}
        />
}

export default class RegionView extends React.Component
{
  constructor(props) {
    super(props)
    this.state = {
      tabRegion: 0,
      search: ""
    }
  }

  handleChange(event, newValue) {
    this.setState({tabRegion: newValue})
  }

  regionClicked(code) {
    if (code in this.props.selected) {
      this.props.setSelected(code, undefined);
    } else {
      this.props.setSelected(code, 0);
      this.props.setFocus(code);
    }
  }

  setSearch(value) {
    this.setState({search: value})
  }

  matches(code) {
    const search = this.state.search.toLowerCase()
    const lowerCode = code.toLowerCase()
    const fullName = this.props.aoi[code].fullName.toLowerCase()
    let score = 0
    for (const part of search.split(/\W+/)) {
      if (lowerCode.includes(part)) {
        score += 1
      } else if (fullName.includes(part)) {
        score += 2
      } else {
        return false
      }
    }
    if (this.props.aoi[code].population) {
      score += 1.0 / this.props.aoi[code].population
    } else {
      score += 1
    }
    return score
  }

  render() {
    const props = this.props;

    let matches = []
    for (const code in props.aoi) {
      if (code in props.selected) {
        matches.push([-1, code, props.aoi[code].fullName])
      } else {
        const m = this.matches(code)
        if (m) {
          matches.push([m, code, props.aoi[code].fullName])
        }
      }
    }
    matches.sort(function(a, b) {
        if (a[0] > b[0]) {
            return 1
        } else if (a[0] < b[0]) {
            return -1
        } else if (a[2] > b[2]) {
            return 1
        } else {
            return -1
        }
    })
    matches = matches.slice(0, 50)

    return (
      <div>
        <Typography align="center" component="div">
            <TextField
              label="Search for Country, State, County, or City"
              value={this.state.search}
              onChange={event => this.setSearch(event.target.value)}
              variant="outlined"
              style={{width: "25em"}}
            />
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell></TableCell>
              <TableCell>Name</TableCell>
              <TableCell colSpan="3">Status</TableCell>
              <TableCell style={{ width: "9em" }}>Shift</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matches.map((match, index) => (
                <TableRow key={match[1]} bgcolor={
                  this.props.focus === match[1] ? "#f0f7ff" : "white"}>

                  <TableCell padding="checkbox" onClick={() => this.regionClicked(match[1])}>
                    <Checkbox checked={match[1] in props.selected} />
                  </TableCell>

                  <TableCell component="th" scope="row" onClick={() => this.regionClicked(match[1])}>
                    {props.aoi[match[1]].fullName}
                  </TableCell>

                  <VelocityCell value={props.aoi[match[1]].velocity} />
                  <AccelerationCell value={props.aoi[match[1]].acceleration} />
                  <JerkCell value={props.aoi[match[1]].jerk} />

                  <TableCell>
                    <ArrowLeftIcon color={match[1] in props.selected ? "primary" : "disabled"}
                      onClick={() => props.setSelected(match[1], (props.selected[match[1]] || 0) - 1)} />
                    <TextField
                      size="small"
                      margin="none"
                      disabled={!(match[1] in props.selected)}
                      value={props.selected[match[1]] || 0}
                      onChange={event => props.setSelected(match[1], event.target.value)}
                      onClick={() => props.setSelected(match[1], (props.selected[match[1]] || 0))}
                      style={{ width: "2.5em" }}
                    />
                    <ArrowRightIcon color={match[1] in props.selected ? "primary" : "disabled"}
                      onClick={() => props.setSelected(match[1], (props.selected[match[1]] || 0) + 1)} />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    )
  }
}
