import React from 'react';

import Checkbox from '@material-ui/core/Checkbox';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';

import {makeTrace} from './helpers.js';

function findMatches(aoi, target_code, data_set, data_per)
{
    const target_trace = makeTrace(aoi[target_code], data_set, data_per, false)[2]
    if (!target_trace) {
        /* We don't have info for the currently selected trace. */
        return []
    }

    var results = []
    for (const code in aoi) {
        if (code === target_code) {
            continue
        }
        const trace = makeTrace(aoi[code], data_set, data_per, false)[2]
        if (!trace) {
            continue
        }

        for (let shift = 0; shift < target_trace.length; shift++) {
            let difference = 0
            for (let i = 0; i < shift; i++) {
                const delta = target_trace[i]
                difference += delta * delta
            }
            for (let i = 0; i < target_trace.length - shift; i++) {
                const delta = trace[i] - target_trace[i + shift]
                difference += delta * delta
            }
            results.push([difference, code, shift])
        }
    }
    results.sort(function (a, b) { return a[0] - b[0] })
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
}

export default class MatchView extends React.Component
{
    toggleRegion(code, shift) {
        if (this.props.selected[code] === shift) {
            this.props.setSelected(code, undefined)
        } else {
            this.props.setSelected(code, shift)
        }
    }

    render() {
        if (!(this.props.focus in this.props.aoi)) {
            return <div></div>
        }

        const matches = findMatches(this.props.aoi, this.props.focus,
            this.props.data_set, this.props.data_per)

        return (
            <div>
                <p>{this.props.aoi[this.props.focus].name} matches:</p>
                <Table size="small">
                <TableBody>
                {matches.map((m, i) => (
                    <TableRow key={i} onClick={() => this.toggleRegion(m[1], m[2])}>

                      <TableCell padding="checkbox">
                        <Checkbox checked={this.props.selected[m[1]] === m[2]} />
                      </TableCell>

                      <TableCell>
                        {this.props.aoi[m[1]].name}+{m[2]}
                      </TableCell>

                    </TableRow>
                ))}
                </TableBody>
                </Table>
            </div>
        )
    }
}
