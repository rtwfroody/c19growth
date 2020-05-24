import React, { useState } from 'react';

import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import {data_set, scale, data_per} from './constants.js';

export default function Options(props)
{
    const [advanced, setAdvanced] = useState(false);

    var advancedContent
    if (advanced) {
        advancedContent = (
            <Typography align="center" component="div">
                smoothed over
                <Select
                    style={{margin: '0.5em'}}
                    value={props.smooth}
                    onChange={props.setSmooth}
                >
                    <MenuItem value={1}>1 day</MenuItem>
                    <MenuItem value={3}>3 days</MenuItem>
                    <MenuItem value={5}>5 days</MenuItem>
                    <MenuItem value={7}>7 days</MenuItem>
                    <MenuItem value={11}>11 days</MenuItem>
                    <MenuItem value={15}>15 days</MenuItem>
                    <MenuItem value={21}>21 days</MenuItem>
                    <MenuItem value={31}>31 days</MenuItem>
                </Select>
                using a
                <Select
                    style={{margin: '0.5em'}}
                    value={props.scale}
                    onChange={props.setScale}
                >
                    <MenuItem value={scale.LINEAR}>Linear Scale</MenuItem>
                    <MenuItem value={scale.LOG}>Log Scale</MenuItem>
                </Select>
            </Typography>
        )

    }

    return (
        <Container>
            <Typography align="center" component="div">
            <Select
                style={{margin: '0.5em'}}
                value={props.daily}
                onChange={props.setDaily}
            >
                <MenuItem value={false}>Cumulative</MenuItem>
                <MenuItem value={true}>Daily</MenuItem>
            </Select>
            <Select
                style={{margin: '0.5em'}}
                value={props.data_set}
                onChange={props.setDataSet}
            >
                <MenuItem value={data_set.ACTIVE}>Active Cases</MenuItem>
                <MenuItem value={data_set.CONFIRMED}>Confirmed Cases</MenuItem>
                <MenuItem value={data_set.DEATHS}>Confirmed Deaths</MenuItem>
                <MenuItem value={data_set.RECOVERED}>Recoveries</MenuItem>
                <MenuItem value={data_set.TESTED}>Tested</MenuItem>
            </Select>
            <Select
                style={{margin: '0.5em'}}
                value={props.data_per}
                onChange={props.setDataPer}
            >
                <MenuItem value={data_per.ABSOLUTE}>in Absolute Numbers</MenuItem>
                <MenuItem value={data_per.CAPITA}>per Capita</MenuItem>
                <MenuItem value={data_per.BED}>per Hospital Bed</MenuItem>
            </Select>
                from
            <Select
                style={{margin: '0.5em'}}
                value={props.from}
                onChange={props.setFrom}
            >
                <MenuItem value="s1">the 1st case</MenuItem>
                <MenuItem value="s10">the 10th case</MenuItem>
                <MenuItem value="s100">the 100th case</MenuItem>
                <MenuItem value="a15">15 days ago</MenuItem>
                <MenuItem value="a30">30 days ago</MenuItem>
                <MenuItem value="a60">60 days ago</MenuItem>
            </Select>
            <Button onClick={evt => setAdvanced(!advanced)}>Advanced</Button>
            </Typography>
            {advancedContent}
        </Container>)
}
