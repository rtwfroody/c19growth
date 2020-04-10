import {data_set, data_per} from './constants.js';

// Parse YYYY-MM-DD
// If you feed new Date() a string, then timezones mess it up and sometimes(?)
// you get a day earlier.
// https://stackoverflow.com/questions/2587345/why-does-date-parse-give-incorrect-results
// has more info than I care to read about it.
export function parseDate(text)
{
    // Cut and pasted from the above URL.
    var parts = text.split('-');
    // new Date(year, month [, day [, hours[, minutes[, seconds[, ms]]]]])
    return new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
}

export function makeTrace(aoi, cases, per, daily, start_limit)
{
    var cases_active
    const day_ms = 24 * 60 * 60 * 1000
    if (cases === data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases_active = false
    }

    if (!(cases in aoi.data) || aoi.data[cases].length <= 0) {
        return {'error': "ERROR: No " + cases + " data for " + aoi.name}
    }

    const date = parseDate(aoi.data[cases + "-start"])

    let deaths_offset = 0
    let recovered_offset = 0
    if (cases_active) {
        if ('deaths' in aoi.data) {
            deaths_offset = (parseDate(aoi.data["deaths-start"]) - date) / day_ms
        }
        if ('recovered' in aoi.data) {
            recovered_offset = (parseDate(aoi.data["recovered-start"]) - date) / day_ms
        }
    }

    var x = []
    var y = []
    var start_offset = 0
    for (let index = 0; index < aoi.data[cases].length; index++) {
        x.push(new Date(date))
        date.setDate(date.getDate() + 1)

        var value = aoi.data[cases][index]
        if (cases_active) {
            if ('deaths' in aoi.data) {
                value -= aoi.data['deaths'][index - deaths_offset]
            }
            if ('recovered' in aoi.data) {
                value -= aoi.data['recovered'][index - recovered_offset]
            }
        }
        if (value < start_limit) {
            start_offset = index
        }
        y.push(value)
    }

    if (per === data_per.CAPITA) {
        if (!aoi.population) {
            return {'error': "ERROR: Don't know population for " + aoi.name + "."}
        }
        y = y.map(x => 1000000.0 * x / aoi.population)
    } else if (per === data_per.BED) {
        if (!aoi.hospital_beds) {
            return {'error': "ERROR: Don't know number of hospital beds for " + aoi.name + "."}
        }
        y = y.map(x => x / aoi.hospital_beds)
    }

    if (daily) {
        for (let i = y.length-1; i > 0; i--) {
            y[i] -= y[i-1]
        }
    }

    return {x: x, y: y, start_offset: start_offset}
}
