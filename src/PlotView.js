import React from 'react';

import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';

import Plotly from './plotly-basic-1.53.0.js';
import createPlotlyComponent from 'react-plotly.js/factory';

import {data_set, scale, data_per} from './constants.js';
import {makeTrace} from './helpers.js';

const Plot = createPlotlyComponent(Plotly);

function* color_generator()
{
    // From https://stackoverflow.com/questions/470690/how-to-automatically-generate-n-distinct-colors/4382138#4382138
    const kelly_colors_hex = [
        '#FFB300', //Vivid Yellow
        '#803E75', //Strong Purple
        '#FF6800', //Vivid Orange
        '#A6BDD7', //Very Light Blue
        '#C10020', //Vivid Red
        '#CEA262', //Grayish Yellow
        '#817066', //Medium Gray

        //The following don't work well for people with defective color vision
        '#007D34', //Vivid Green
        '#F6768E', //Strong Purplish Pink
        '#00538A', //Strong Blue
        '#FF7A5C', //Strong Yellowish Pink
        '#53377A', //Strong Violet
        '#FF8E00', //Vivid Orange Yellow
        '#B32851', //Strong Purplish Red
        '#F4C800', //Vivid Greenish Yellow
        '#7F180D', //Strong Reddish Brown
        '#93AA00', //Vivid Yellowish Green
        '#593315', //Deep Yellowish Brown
        '#F13A13', //Vivid Reddish Orange
        '#232C16', //Dark Olive Green
    ]

    // From https://stackoverflow.com/a/44727682
    /*
    const plotly_colors = ['#1f77b4',  // muted blue
        '#ff7f0e',  // safety orange
        '#2ca02c',  // cooked asparagus green
        '#d62728',  // brick red
        '#9467bd',  // muted purple
        '#8c564b',  // chestnut brown
        '#e377c2',  // raspberry yogurt pink
        '#7f7f7f',  // middle gray
        '#bcbd22',  // curry yellow - green
        '#17becf'  // blue - teal
    ]
    */
    while (1) {
        for (const color of kelly_colors_hex) {
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
            yaxis: {title: "", linecolor: '#ccc', linewidth: 1, mirror: true,
                range:[0, 1]},
            xaxis: {linecolor: '#ccc', linewidth: 1, mirror: true},
            margin: {t:25, l:60, b:50}
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

        var max_shift = 0

        let start_limit = -1;
        if (this.props.from.match(/s\d+/)) {
            start_limit = parseInt(this.props.from.slice(1))
        }

        var start_day = new Date()

        var errors = []
        for (const code in this.props.selected) {
            var trace = makeTrace(this.props.aoi[code], this.props.dataSet,
                    this.props.dataPer, this.props.daily, start_limit,
                    this.props.smooth)
            if (trace.error) {
                errors.push(trace.error)
                continue
            }

            if (!(code in this.color_map)) {
                this.color_map[code] = colorgen.next().value
            }

            trace.name = this.props.aoi[code].name
            trace.line = { color: this.color_map[code] }
            if (code === this.props.focus) {
                trace.line.width = 3
            }
            traces.push(trace)

            start_day = Math.min(start_day, trace.x[trace.start_offset])

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

        if (this.props.from.match(/a\d+/)) {
            const days_ago = parseInt(this.props.from.slice(1))
            var ago_day = new Date()
            ago_day.setDate(ago_day.getDate() - days_ago)
            start_day = Math.max(ago_day, start_day)
        }

        if (this.props.scale === scale.LOG) {
            layout.yaxis.type = 'log'
        }

        var graph_traces = []
        if (traces.length > 0) {
            const dates = traces[0].x
            let future_dates = []
            let date = new Date(dates[dates.length - 1])
            for (let i = 0; i < max_shift; i++) {
                date.setDate(date.getDate() + 1)
                future_dates.push((1900 + date.getYear()) + "-" + (1 +
                    date.getMonth()) + "-" + date.getDate())
            }

            for (let trace of traces) {
                if (trace.x[trace.x.length - 1] < start_day) {
                    // This entire trace precedes the start_day.
                    errors.push(`Last data for ${trace.name} precedes ${new Date(start_day)}.`)
                } else {
                    for (let i = 0; i < trace.x.length; i++) {
                        if (trace.x[i] >= start_day) {
                            if (i > 0) {
                                trace.x = trace.x.slice(i)
                                trace.y = trace.y.slice(i)
                            }
                            break
                        }
                        trace.x = trace.x.concat(future_dates)
                    }
                    graph_traces.push(trace)
         
                    layout.yaxis.range[1] = Math.max(layout.yaxis.range[1], Math.max(...trace.y))
                }
            }
        }

        const errorRender = errors.length > 0 ? (
            <Typography color='error' component="span">
            {errors.map((error, index) =>
                <div key={index}>{error}<br /></div>
            )}
            </Typography>
        ) : undefined;

        if (graph_traces.length > 0) {
            return (
                // https://codesandbox.io/s/35loxpjmq has an example on how to make
                // resizing also work.
                <div>
                <Plot
                    style={{ width: '100%', height: '100%' }}
                    data={graph_traces}
                    layout={layout} />
                {errorRender}
                </div>
            )
        } else {
            return (
                <Container
                    style={{ width: '100%', height: '100%' }}>
                        Select an area.
                {errorRender}
                    </Container>
            )
        }
    }
}
