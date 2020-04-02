import React from 'react';

import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Container from '@material-ui/core/Container';

import {data_set, scale, data_per} from './constants.js';

export default class Options extends React.Component
{
    render() {
        return (
            <Container>
                <Select
                    value={this.props.daily}
                    onChange={this.props.setDaily}
                >
                    <MenuItem value={false}>Cumulative</MenuItem>
                    <MenuItem value={true}>Daily</MenuItem>
                </Select>
                &nbsp;
                <Select
                    value={this.props.data_set}
                    onChange={this.props.setDataSet}
                >
                    <MenuItem value={data_set.ACTIVE}>Active Cases</MenuItem>
                    <MenuItem value={data_set.CONFIRMED}>Confirmed Cases</MenuItem>
                    <MenuItem value={data_set.DEATHS}>Confirmed Deaths</MenuItem>
                    <MenuItem value={data_set.RECOVERED}>Recoveries</MenuItem>
                    <MenuItem value={data_set.TESTED}>Tested</MenuItem>
                </Select>
                &nbsp;
                <Select
                    value={this.props.data_per}
                    onChange={this.props.setDataPer}
                >
                    <MenuItem value={data_per.ABSOLUTE}>in Absolute Numbers</MenuItem>
                    <MenuItem value={data_per.CAPITA}>per Capita</MenuItem>
                    <MenuItem value={data_per.BED}>per Hospital Bed</MenuItem>
                </Select>
                &nbsp;
                    using a
                &nbsp;
                <Select
                    value={this.props.scale}
                    onChange={this.props.setScale}
                >
                    <MenuItem value={scale.LINEAR}>Linear Scale</MenuItem>
                    <MenuItem value={scale.LOG}>Log Scale</MenuItem>
                </Select>
            </Container>)
    }
}
