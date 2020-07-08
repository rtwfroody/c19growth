import {data_set, data_per} from './constants.js';

// JavaScript Dates refer to a moment in time, not just a calendar day. That
// means it's hard to do math with them etc, because of timezones (specifically,
// daylight savings time).

var dateOrder = {}

// Parse YYYY-MM-DD
class CalendarDay {
    constructor(arg) {
        if (arg instanceof CalendarDay) {
            this.value = arg.value.slice()
        } else {
            // JavaScript will turn anything into a string, right?
            this.value = arg.split('-').map(p => parseInt(p, 10))
        }
    }

    increment() {
        if (!(this.value in dateOrder)) {
            // Use the library, because I do not want to reinvent this wheel.
            var d = this.date()
            d.setDate(d.getDate() + 1)
            dateOrder[this.value] = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
        }
        this.value = dateOrder[this.value]
    }

    add(n) {
        while (n > 0) {
            this.increment()
            n--
        }
    }

    date() {
        const [year, month, day] = this.value
        return new Date(year, month - 1, day)
    }

    // Return 1 if this>other, -1 if other<this, 0 if they're equal.
    cmp(other) {
        for (let i = 0; i < 3; i++) {
            if (this.value[i] > other.value[i]) {
                return 1
            } else if (this.value[i] < other.value[i]) {
                return -1
            }
        }
        return 0
    }

    // Return this - other, in days
    difference(other) {
        const initial = this.cmp(other)
        if (initial === 0) {
            return 0
        } else if (initial > 0) {
            // this > other
            let d = new CalendarDay(other)
            let diff = 0
            while (d.cmp(other) > 0) {
                diff++
                d.increment()
            }
            return diff

        } else {
            // this < other
            let d = new CalendarDay(this)
            let diff = 0
            while (d.cmp(other) < 0) {
                diff++
                d.increment()
            }
            return -diff
        }
    }
}

export function makeTrace(aoi, cases, per, daily, start_limit, smooth)
{
    var cases_active
    if (cases === data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases_active = false
    }

    if (!(cases in aoi.data) || aoi.data[cases].length <= 0) {
        return {'error': "ERROR: No " + cases + " data for " + aoi.name}
    }

    const day = new CalendarDay(aoi.data[cases + "-start"])

    let deaths_offset = 0
    let recovered_offset = 0
    if (cases_active) {
        if ('deaths' in aoi.data) {
            deaths_offset = -day.difference(new CalendarDay(aoi.data["deaths-start"]))
        }
        if ('recovered' in aoi.data) {
            recovered_offset = -day.difference(new CalendarDay(aoi.data["recovered-start"]))
        }
    }

    var x = []
    var y = []
    var start_offset = 0
    for (let index = 0; index < aoi.data[cases].length; index++) {
        x.push(day.date())
        day.add(1)

        var value = aoi.data[cases][index]
        if (cases_active) {
            if ('deaths' in aoi.data && index >= deaths_offset) {
                value -= aoi.data['deaths'][index - deaths_offset]
            }
            if ('recovered' in aoi.data && index >= recovered_offset) {
                value -= aoi.data['recovered'][index - recovered_offset]
            }
        }
        if (value < start_limit) {
            start_offset = index
        }
        if (isNaN(value)) {
            return {'error': `ERROR: NaN on ${day} for ${aoi.name}.`}
        }
        y.push(value)
    }

    if (per === data_per.CAPITA) {
        if (!aoi.population) {
            return {'error': "ERROR: Don't know population for " + aoi.name + "."}
        }
        y = y.map(x => x == null ? null : 1000000.0 * x / aoi.population)
    } else if (per === data_per.BED) {
        if (!aoi.hospital_beds) {
            return {'error': "ERROR: Don't know number of hospital beds for " + aoi.name + "."}
        }
        y = y.map(x => x == null ? null : x / aoi.hospital_beds)
    }

    if (daily) {
        for (let i = y.length-1; i > 0; i--) {
            if (y[i] == null || y[i-1] == null) {
                y[i] = null
            } else {
                y[i] -= y[i - 1]
            }
        }
    }

    if (smooth > 1) {
        let weights = []
        if ((smooth & 1) === 0) {
            smooth++
        }
        for (let i = 1; i <= smooth / 2; i++) {
            weights.push(i)
        }
        weights.push((smooth + 1) / 2)
        for (let i = 1; i <= smooth / 2; i++) {
            weights.push(Math.floor(smooth / 2) - i + 1)
        }

        const center = Math.floor(smooth / 2)
        let smoothed = []
        for (let i = 0; i < y.length; i++) {
            let sum = 0
            let total_weight = 0
            for (let j = 0; j < weights.length; j++) {
                if (i + j - center >= 0 && i + j - center < y.length) {
                    sum += weights[j] * y[i + j - center]
                    total_weight += weights[j]
                }
            }
            smoothed.push(sum / total_weight)
        }
        y = smoothed
    }

    return {x: x, y: y, start_offset: start_offset}
}
