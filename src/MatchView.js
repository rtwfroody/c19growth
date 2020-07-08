import memoize from "memoizee"

import React from 'react';

import Checkbox from '@material-ui/core/Checkbox';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import Button from '@material-ui/core/Button';

import {makeTrace} from './helpers.js';

var findMatches = memoize(
function (aoi, target_code, data_set, data_per)
{
    const target_trace = makeTrace(aoi[target_code], data_set, data_per, false)
    if ('error' in target_trace) {
        /* We don't have info for the currently selected trace. */
        return []
    }

    const day = 1000 * 60 * 60 * 24

    var results = []
    for (const code in aoi) {
        if (code === target_code) {
            continue
        }
        const trace = makeTrace(aoi[code], data_set, data_per, false)
        if ('error' in trace) {
            continue
        }

        for (let shift = 0; shift < target_trace.x.length; shift++) {
            let difference = 0
            let index = (target_trace.x[0] - trace.x[0]) / day - shift
            let target_index = 0
            while (target_index < target_trace.x.length) {
                let delta
                if (index < 0 || index >= trace.x.length) {
                    delta = target_trace.y[target_index]
                } else {
                    delta = trace.y[index] - target_trace.y[target_index]
                }
                difference += delta * delta
                index++
                target_index++
            }

            results.push([difference, code, shift])
        }
    }
    results.sort((a, b) => a[0] > b[0] ? 1 : -1)
    let seen = {}
    let unique_results = []
    for (const r of results) {
        const code = r[1]
        if (code in seen) {
            continue
        }
        seen[code] = true
        const shift = r[2]
        if (shift === 0) {
            // This is not an interesting match
            continue
        }
        unique_results.push(r)
        if (unique_results.length >= 10) {
            break
        }
    }
    return unique_results
}, {maxAge: 30 * 60 * 1000})

export default class MatchView extends React.Component
{
    constructor(props) {
        super(props)
        this.state = {
            focus: undefined,
            data_set: undefined,
            data_per: undefined,
            matches: undefined
        }
    }

    toggleRegion(code, shift) {
        if (this.props.selected[code] === shift) {
            this.props.setSelected(code, undefined)
        } else {
            this.props.setSelected(code, shift)
        }
    }

    compute() {
        const matches = findMatches(this.props.aoi, this.props.focus,
            this.props.data_set, this.props.data_per)
        this.setState({
            focus: this.props.focus,
            data_set: this.props.data_set,
            data_per: this.props.data_per,
            matches: matches
        })
    }

    render() {
        if (this.props.focus && (!(this.state.focus) ||
                this.state.focus !== this.props.focus)) {
            return <div>
                <Button onClick={() => this.compute()}>
                    Find matches for {this.props.aoi[this.props.focus].fullName}...
                </Button>
            </div>
        }

        if (!(this.props.focus in this.props.aoi)) {
            return <div></div>
        }

        return (
            <div>
                <p>{this.props.aoi[this.props.focus].fullName} matches:</p>
                <Table size="small">
                <TableBody>
                {this.state.matches.map((m, i) => (
                    <TableRow key={i} onClick={() => this.toggleRegion(m[1], m[2])}>

                      <TableCell padding="checkbox">
                        <Checkbox checked={this.props.selected[m[1]] === m[2]} />
                      </TableCell>

                      <TableCell>
                        {this.props.aoi[m[1]].fullName}+{m[2]}
                      </TableCell>

                    </TableRow>
                ))}
                </TableBody>
                </Table>
            </div>
        )
    }
}
