import {data_set, data_per} from './constants.js';

export function makeTrace(aoi, cases, per, daily)
{
    var cases_active
    if (cases === data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases_active = false
    }

    if (!(cases in aoi.data)) {
        return ["ERROR: No " + cases + " data for " + aoi.name, undefined, undefined]
    }
    const x = Object.keys(aoi.data[cases]).sort()
    var y = []
    for (const d of x) {
        var value = aoi.data[cases][d]
        if (cases_active) {
            if ('deaths' in aoi.data) {
                value -= aoi.data['deaths'][d]
            }
            if ('recovered' in aoi.data) {
                value -= aoi.data['recovered'][d]
            }
        }
        y.push(value)
    }

    if (per === data_per.CAPITA) {
        if (!aoi.population) {
            return ["ERROR: Don't know population for " + aoi.name + ".", undefined, undefined]
        }
        y = y.map(x => 1000000.0 * x / aoi.population)
    } else if (per === data_per.BED) {
        if (!aoi.hospital_beds) {
            return ["ERROR: Don't know number of hospital beds for " + aoi.name + ".", undefined, undefined]
        }
        y = y.map(x => x / aoi.hospital_beds)
    }

    if (daily) {
        for (let i = y.length-1; i > 0; i--) {
            y[i] -= y[i-1]
        }
    }

    return [undefined, x, y]
}
