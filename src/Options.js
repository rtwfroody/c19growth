import React from 'react';

import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';

import {data_set, scale, data_per} from './constants.js';

export default class Options extends React.Component
{
    render() {
        return (
            <Container>
                <Typography align="center" component="div">
                <Select
                    style={{margin: '0.5em'}}
                    value={this.props.daily}
                    onChange={this.props.setDaily}
                >
                    <MenuItem value={false}>Cumulative</MenuItem>
                    <MenuItem value={true}>Daily</MenuItem>
                </Select>
                <Select
                    style={{margin: '0.5em'}}
                    value={this.props.data_set}
                    onChange={this.props.setDataSet}
                >
                    <MenuItem value={data_set.ACTIVE}>Active Cases</MenuItem>
                    <MenuItem value={data_set.CONFIRMED}>Confirmed Cases</MenuItem>
                    <MenuItem value={data_set.DEATHS}>Confirmed Deaths</MenuItem>
                    <MenuItem value={data_set.RECOVERED}>Recoveries</MenuItem>
                    <MenuItem value={data_set.TESTED}>Tested</MenuItem>
                </Select>
                <Select
                    style={{margin: '0.5em'}}
                    value={this.props.data_per}
                    onChange={this.props.setDataPer}
                >
                    <MenuItem value={data_per.ABSOLUTE}>in Absolute Numbers</MenuItem>
                    <MenuItem value={data_per.CAPITA}>per Capita</MenuItem>
                    <MenuItem value={data_per.BED}>per Hospital Bed</MenuItem>
                </Select>
                    from
                <Select
                    style={{margin: '0.5em'}}
                    value={this.props.from}
                    onChange={this.props.setFrom}
                >
                    <MenuItem value="s1">the 1st case</MenuItem>
                    <MenuItem value="s10">the 10th case</MenuItem>
                    <MenuItem value="s100">the 100th case</MenuItem>
                </Select>
                    using a
                <Select
                    style={{margin: '0.5em'}}
                    value={this.props.scale}
                    onChange={this.props.setScale}
                >
                    <MenuItem value={scale.LINEAR}>Linear Scale</MenuItem>
                    <MenuItem value={scale.LOG}>Log Scale</MenuItem>
                </Select>
                </Typography>
            </Container>)
    }
}
