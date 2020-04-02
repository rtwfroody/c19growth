import React from 'react';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import { makeStyles } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
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

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

function color_fade(type, start, end, percentage)
{
    var color = []
    for (var i = 0; i < 3; i++) {
        color.push(Math.round((start[i] * percentage + end[i] * (100 - percentage)) / 100))
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
  return <TableCell className={classes.statusCell} style={style} />
}

function VelocityCell(props) {
  const p = Math.min(100, Math.max(100.0 * props.value / 0.0001, 0))
  const color = color_fade("hsl", [0, 100, 50], [0, 100, 100], p)
  return <StatusCell color={color} />
}

function AccelerationCell(props) {
  const p = Math.min(100, Math.max(100.0 * props.value / 0.0001, -100));
  const color = p > 0 ? color_fade("hsl", [0, 100, 50], [0, 100, 100], p)
        : color_fade("hsl", [210, 100, 50], [210, 100, 100], -p);
  return <StatusCell color={color} />
}

function JerkCell(props) {
  const p = Math.min(100, Math.max(100.0 * props.value / 0.0001, -100));
  const color = p > 0 ? color_fade("hsl", [0, 100, 50], [0, 100, 100], p)
    : color_fade("hsl", [210, 100, 50], [210, 100, 100], -p);
  return <StatusCell color={color} />
}

export default class RegionView extends React.Component
{
  constructor(props) {
    super(props)
    this.state = {
      tabRegion: 0
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

  render() {
    let entries = []
    for (let key in this.props.aoi) {
      entries.push(<li>{key}</li>)
    }

    let tabs = {}
    for (const code of Object.keys(this.props.aoi)
      .sort((a, b) => this.props.aoi[a].name > this.props.aoi[b].name ? 1 : -1)) {
        const aoi = this.props.aoi[code]
        if (!(aoi.region in tabs)) {
          tabs[aoi.region] = []
        }
        tabs[aoi.region].push(code)
    }

    const props = this.props;

    return (
      <div>
        <Tabs
          value={this.state.tabRegion}
          onChange={(event, newValue) => this.handleChange(event, newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {Object.keys(tabs).sort().map((region, index) => (
            <Tab key={region} label={region} {...a11yProps(index)} />
          ))}
        </Tabs>

        {Object.keys(tabs).sort().map((region, index) => (
          <TabPanel key={region} value={this.state.tabRegion} index={index}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell colSpan="3">Status</TableCell>
                  <TableCell style={{width: "9em"}}>Shift</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tabs[region].sort((a, b) => props.aoi[a].name > props.aoi[b].name ? 1 : -1)
                  .map(code => (
                    <TableRow key={code}>

                      <TableCell padding="checkbox" onClick={() => this.regionClicked(code)}>
                        <Checkbox checked={code in props.selected} />
                      </TableCell>

                      <TableCell component="th" scope="row" onClick={() => this.regionClicked(code)}>
                        {props.aoi[code].name}
                      </TableCell>

                      <VelocityCell value={props.aoi[code].velocity} />
                      <AccelerationCell value={props.aoi[code].acceleration} />
                      <JerkCell value={props.aoi[code].jerk} />

                      <TableCell>
                        <ArrowLeftIcon color={code in props.selected ? "primary" : "disabled"}
                          onClick={() => code in props.selected && props.setSelected(code, props.selected[code] - 1)} />
                        <TextField disabled={!(code in props.selected)}
                          value={props.selected[code] || 0}
                          onChange={event => props.setSelected(code, event.target.value)}
                          style={{width: "3em"}}
                          />
                        <ArrowRightIcon color={code in props.selected ? "primary" : "disabled"}
                          onClick={() => code in props.selected && props.setSelected(code, props.selected[code] + 1)} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TabPanel>
        ))}</div>
    )
  }
}
