import React from 'react';

import Container from '@material-ui/core/Container';

import Plot from 'react-plotly.js';

import {data_set, scale, data_per} from './constants.js';
import {makeTrace} from './helpers.js';

function* color_generator()
{
    // From https://stackoverflow.com/a/44727682
    while (1) {
        for (const color of ['#1f77b4',  // muted blue
            '#ff7f0e',  // safety orange
            '#2ca02c',  // cooked asparagus green
            '#d62728',  // brick red
            '#9467bd',  // muted purple
            '#8c564b',  // chestnut brown
            '#e377c2',  // raspberry yogurt pink
            '#7f7f7f',  // middle gray
            '#bcbd22',  // curry yellow - green
            '#17becf'  // blue - teal
        ]) {
            yield color
        }
    }
}
var colorgen = color_generator()

export default class PlotView extends React.Component
{
    constructor(props) {
        super(props)
        this.color_map = {}
    }

    render() {
        let traces = []

        let layout = {
            yaxis: {title: ""}
        }

        if (this.props.daily) {
            layout.yaxis.title += "Daily"
        } else {
            layout.yaxis.title += "Cumulative"
        }
        switch (this.props.dataSet) {
            case data_set.ACTIVE:
                layout.yaxis.title += " Active Cases";
                break;
            case data_set.CONFIRMED:
                layout.yaxis.title += " Confirmed Cases";
                break;
            case data_set.DEATHS:
                layout.yaxis.title += " Confirmed Deaths";
                break;
            case data_set.RECOVERED:
                layout.yaxis.title += " Confirmed Recoveries";
                break;
            case data_set.TESTED:
                layout.yaxis.title += " Tested";
                break;
            default:
                console.assert(0)
                break;
        }
        switch (this.props.dataPer) {
            case data_per.ABSOLUTE:
                break;
            case data_per.CAPITA:
                layout.yaxis.title += " per million people"
                break;
            case data_per.BED:
                layout.yaxis.title += " per hospital bed"
                break;
            default:
                console.assert(0)
                break;
        }

        var max_shift = 0;
        var start_offset = Number.MAX_VALUE

        for (const code in this.props.selected) {
            const [error, x, y] = makeTrace(this.props.aoi[code], this.props.dataSet,
                this.props.dataPer, this.props.daily)
            if (error) {
                console.log("TODO:", error)
                continue
            }

            if (!(code in this.color_map)) {
                this.color_map[code] = colorgen.next().value
            }

            var trace = {
                name: this.props.aoi[code].name,
                x: x,
                y: y,
                line: {
                    color: this.color_map[code]
                }
            }
            traces.push(trace)

            for (var i = 0; i < y.length; i++) {
                if (y[i] > 0) {
                    start_offset = Math.min(i, start_offset)
                    break;
                }
            }

            const shift = this.props.selected[code]
            max_shift = Math.max(max_shift, shift)
            if (shift !== 0) {
                let shifted = {}
                Object.assign(shifted, trace)
                shifted.line = {}
                Object.assign(shifted.line, trace.line)
                shifted.line.dash = 'dash'
    
                if (shift > 0) {
                    var prefix = []
                    // TODO: There must be an idiomatic way to do this.
                    for (let i = 0; i < shift; i++) {
                        prefix.push(0)
                    }
                    shifted.y = prefix.concat(shifted.y)
                    shifted.name += "+" + shift
                } else if (shift < 0) {
                    shifted.y = shifted.y.slice(-shift, undefined)
                    shifted.name += shift
                }
                traces.push(shifted)
            }
        }

        if (this.props.scale === scale.LOG) {
            layout.yaxis.type = 'log'
        }

        if (traces.length > 0) {
            const dates = traces[0].x
            let future_dates = []
            let date = new Date(dates[dates.length - 1])
            // TODO: Why do I need this?
            date.setDate(date.getDate() + 1)
            for (let i = 0; i < max_shift; i++) {
                date.setDate(date.getDate() + 1)
                future_dates.push((1900 + date.getYear()) + "-" + (1 + date.getMonth()) + "-" + date.getDate())
            }

            // Make sure we include the last 0 day.
            start_offset = Math.max(start_offset - 1, 0)
            for (let trace of traces) {
                trace.y = trace.y.slice(start_offset, trace.y.length)
                trace.x = trace.x.slice(start_offset, trace.x.length).concat(future_dates)
            }

            return (
                // https://codesandbox.io/s/35loxpjmq has an example on how to make
                // resizing also work.
                <Plot
                    style={{ width: '100%', height: '100%' }}
                    data={traces}
                    layout={layout} />
            )
        } else {
            return (
                <Container
                    style={{ width: '100%', height: '100%' }}>
                        Select an area.
                    </Container>
            )
        }
    }
}
