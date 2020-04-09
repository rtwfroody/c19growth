import {data_set, data_per} from './constants.js';

export function makeTrace(aoi, cases, per, daily, start_limit)
{
    var cases_active
    if (cases === data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases_active = false
    }

    if (!(cases in aoi.data)) {
        return {'error': "ERROR: No " + cases + " data for " + aoi.name}
    }
    var date = new Date(aoi.data[cases + "-start"])
    var x = []
    var y = []
    var start_offset = 0
    for (let index = 0; index < aoi.data[cases].length; index++) {
        x.push(new Date(date))
        date.setDate(date.getDate() + 1)

        var value = aoi.data[cases][index]
        if (cases_active) {
            if ('deaths' in aoi.data) {
                value -= aoi.data['deaths'][index]
            }
            if ('recovered' in aoi.data) {
                value -= aoi.data['recovered'][index]
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
