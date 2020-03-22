"use strict"

/*
 * When the user clicks a button, call a do* function that indicates what the
 * user wants to happen.  That function updates internal state. Then it calls
 * update* functions for the various parts of the page (graph, regions,
 * selected, matches, options).
 */

const data_set = {
    ACTIVE: 'active',
    CONFIRMED: 'confirmed',
    DEATHS: 'deaths',
    RECOVERED: 'recovered'
}

const data_per = {
    ABSOLUTE: 'absolute',
    CAPITA: 'capita',
    BED: 'bed'
}

const scale = {
    LINEAR: 'linear',
    LOG: 'log'
}

var data = {
    'regions': {},
    'options': {
        'data_set': data_set.CONFIRMED,
        'data_per': data_per.ABSOLUTE,
        'scale': scale.LINEAR
    },
    // id -> shift of sequences that are actually selected
    'selected': {}
};

function* color_generator()
{
    while (1) {
        for (var s of ['100%', '60%', '80%']) {
            for (var l of ['50%', '30%', '70%']) {
                for (var h of [0, 120, 180, 240, 300, 20, 80, 140, 200,
                    260, 320, 40, 100, 160, 220, 280, 340]) {
                    var color = "hsl(" + h + "," + s + "," + l + ")"
                    yield color
                }
            }
        }
    }
}
var colorgen = color_generator()

function buildSequence(csv, name_to_id)
{
    const province_state = 0;
    const country_region = 1;
    const first_date = 4;

    var state_abbreviation = {
        "Alabama": "AL",
        "Alaska": "AK",
        "Arizona": "AZ",
        "Arkansas": "AR",
        "California": "CA",
        "Colorado": "CO",
        "Connecticut": "CT",
        "Delaware": "DE",
        "District of Columbia": "DC",
        "Florida": "FL",
        "Georgia": "GA",
        "Hawaii": "HI",
        "Idaho": "ID",
        "Illinois": "IL",
        "Indiana": "IN",
        "Iowa": "IA",
        "Kansas": "KS",
        "Kentucky": "KY",
        "Louisiana": "LA",
        "Maine": "ME",
        "Maryland": "MD",
        "Massachusetts": "MA",
        "Michigan": "MI",
        "Minnesota": "MN",
        "Mississippi": "MS",
        "Missouri": "MO",
        "Montana": "MT",
        "Nebraska": "NE",
        "Nevada": "NV",
        "New Hampshire": "NH",
        "New Jersey": "NJ",
        "New Mexico": "NM",
        "New York": "NY",
        "North Carolina": "NC",
        "North Dakota": "ND",
        "Ohio": "OH",
        "Oklahoma": "OK",
        "Oregon": "OR",
        "Pennsylvania": "PA",
        "Rhode Island": "RI",
        "South Carolina": "SC",
        "South Dakota": "SD",
        "Tennessee": "TN",
        "Texas": "TX",
        "Utah": "UT",
        "Vermont": "VT",
        "Virginia": "VA",
        "Washington": "WA",
        "West Virginia": "WV",
        "Wisconsin": "WI",
        "Wyoming": "WY",
    }

    var header = csv[0]
    if (!('dates' in data)) {
        data['dates'] = header.slice(first_date, header.length);
    }

    var sequence_map = {}
    var unknown = 0
    for (var i = 1; i < csv.length; i++) {
        var row = csv[i]

        if (row[province_state].startsWith("Unassigned Location")) {
            console.log("WARNING: Skipping", row[country_region], row[province_state])
            // Skip corner case.
            continue
        }

        name = row[country_region]
        var id
        if (name in name_to_id) {
            id = name_to_id[name]
            if (id in data.regions) {
                name = data.regions[id].name
            }
        } else {
            id = "U" + unknown
            unknown++
        }
        var ids = [id]

        if (row[country_region] == "US") {
            // The data contains both county data and state aggregate data.  We
            // aggregate them separately, then clean it up below.
            if (row[province_state] in state_abbreviation) {
                ids.push("US-agg-" + state_abbreviation[row[province_state]])
            } else if (row[province_state].match(/, *[A-Z][A-Z]/)) {
                ids.push("US-" + row[province_state].replace(/.*, */, "").slice(0, 2))
            }
        }
        for (id of ids) {
            if (!(id in data.regions) && !id.startsWith("US-agg-")) {
                data.regions[id] = {
                    'group': "country",
                    'subgroup': "Other",
                    'name': name,
                    'id': id,
                }
                name_to_id[name] = id
                console.log("WARNING: Don't have region details (like population) for", name, id)
            }

            for (var j = first_date; j < row.length; j++) {
                row[j] = parseInt(row[j])
                if (isNaN(row[j])) {
                    row[j] = row[j-1]
                }
            }
            if (id in sequence_map) {
                for (var j = first_date; j < row.length; j++) {
                    sequence_map[id][j - first_date] += row[j];
                }
            } else {
                sequence_map[id] = row.slice(first_date, row.length)
            }
        }
    }
    // Process state data, and use that to compute new US data.
    var us_sequence = []
    for (var state of Object.values(state_abbreviation)) {
        var state_id = "US-" + state
        var agg_id = "US-agg-" + state
        if (agg_id in sequence_map) {
            if (state_id in sequence_map) {
                for (var i = 0; i < data.dates.length; i++) {
                    sequence_map[state_id][i] =
                        Math.max(sequence_map[state_id][i], sequence_map[agg_id][i])
                }
            } else {
                sequence_map[state_id] = sequence_map[agg_id]
            }
            delete sequence_map["US-agg-" + state]
        }
        if (state_id in sequence_map) {
            for (var i = 0; i < data.dates.length; i++) {
                if (!us_sequence[i]) {
                    us_sequence[i] = 0
                }
                us_sequence[i] += sequence_map[state_id][i]
            }
        }
    }
    sequence_map['USA'] = us_sequence
    return sequence_map
}

function buildData(confirmed_csv, deaths_csv, recovered_csv, regions_csv)
{
    // Prepopulate with names Johns Hopkins uses.
    var name_to_id = {
        "US": "USA",
        "Mainland China": "CHN",
        "South Korea": "KOR",
        "Korea, South": "KOR",
        "Republic of Korea": "KOR",
        "Taiwan": "TWN",
        "Taiwan*": "TWN",
        "Taipei and environs": "TWN",
        "Macau": "MAC",
        "Macao SAR": "MAC",
        "Vietnam": "VNM",
        "United Kingdom": "GBR",
        "UK": "GBR",
        "Russia": "RUS",
        "Iran": "IRN",
        "Czech Republic": "CZE",
        "Saint Barthelemy": "BLM",
        "Palestine": "PSE",
        "occupied Palestinian territory": "PSE",
        "Moldova": "MDA",
        "Republic of Moldova": "MDA",
        "Brunei": "BRN",
        "Hong Kong SAR": "HKG",
        "Bolivia": "BOL",
        "Cote d'Ivoire": "CIV",
        "Reunion": "REU",
        "Congo (Kinshasa)": "COD",
        "Congo (Brazzaville)": "COG",
        "Curacao": "CUW",
        "Venezuela (Bolivarian Republic of)": "VEN",
        "The Bahamas": "BHS",
        "Bahamas, The": "BHS",
        "Tanzania": "TZA",
        "Republic of the Congo": "COG",
        "The Gambia": "GMB",
        "Gambia, The": "GMB",
    }
    for (var row of regions_csv) {
        var info = {
            'id': row[0],
            'name': row[1],
            'group': row[2],
            'subgroup': row[3],
            'population': row[4],
            'hospital_beds': row[5],
        }
        data.regions[row[0]] = info
        name_to_id[row[1]] = row[0]
    }

    data.confirmed = buildSequence(confirmed_csv, name_to_id)
    data.deaths = buildSequence(deaths_csv, name_to_id)
    data.recovered = buildSequence(recovered_csv, name_to_id)
}

function add_label(element, id, label) {
    var l = document.createElement('label');
    l.setAttribute('for', id)
    l.innerHTML = label
    element.appendChild(l)
}

function add_button(element, id, text, onClick, onDblClick) {
    var input = document.createElement('input')
    if (id) {
        input.setAttribute("id", id)
    }
    input.setAttribute("type", "button");
    if (onClick) {
        input.setAttribute("onClick", onClick)
    }
    if (onDblClick) {
        input.setAttribute("onDblClick", onDblClick)
    }
    // TODO: What's the difference between this and setAttribute?
    input.value = text
    element.appendChild(input)
}

function add_fieldset(element, legend) {
    var fieldset = document.createElement("fieldset")
    var l = document.createElement("legend")
    l.innerHTML = legend
    fieldset.appendChild(l)
    element.appendChild(fieldset)
    return fieldset
}

function doFocus(id)
{
    focus = id
    updateMatches()
}

function updateSelection(group, subgroup, value)
{
    var grouped = {}

    for (var id in data.confirmed) {
        var region = data.regions[id]
        if (group != region.group) {
            continue
        }
        if (subgroup == "all" || subgroup == region.subgroup) {
            var button = document.getElementById(region.id);
            button.checked = value
        }
    }
}

function openOptions()
{
    $("#options-dialog").dialog("open")
}

// click is reserved, or something
function doToggle(id)
{
    if (id in data.selected) {
        deselect(id)
    } else {
        select(id, 0)
    }
    updateAll()
}

function doDeselect(id)
{
    deselect(id)
    updateAll()
}

function doShift()
{
    for (var id in data.selected) {
        data.selected[id] = $("#shift-" + id).val()
    }
    updateAll()
}

function updateAll()
{
    if (!(focus in data.selected)) {
        focus = Object.keys(data.selected).sort(id => data.regions[id].name)[0]
    }

    updateSelected()
    updateGraph()
    updateMatches()
    updateUrl()
}

function findMatches(target_id)
{
    var [err, target_trace] = makeTrace(target_id)
    if (!target_trace) {
        /* We don't have info for the currently selected trace. */
        return []
    }

    var results = []
    for (var id in data["confirmed"]) {
        if (id == target_id) {
            continue
        }
        var [err, trace] = makeTrace(id)
        if (err) {
            continue
        }

        for (var shift = 1; shift < 30; shift++) {
            var difference = 0
            for (var i = 0; i < target_trace.y.length - shift; i++) {
                var delta = trace.y[i] - target_trace.y[i + shift]
                difference += delta * delta
            }
            results.push([difference, id, shift])
        }
    }
    results.sort(function (a, b) { return a[0] - b[0] })
    return results.slice(0, 10)
}

function doToggleSequence(id, shift)
{
    if (data.selected[id] == shift) {
        deselect(id)
    } else {
        select(id, shift)
    }
    updateAll()
}

function select(id, shift)
{
    data.selected[id] = shift
    var checkbox = document.getElementById(id)
    checkbox = $("#" + id)
    checkbox.prop("checked", true)
    checkbox.checkboxradio("refresh")

    if (!focus) {
        focus = id
    }
}

function deselect(id)
{
    delete data.selected[id]
    var checkbox = document.getElementById(id)
    checkbox = $("#" + id)
    checkbox.prop("checked", false)
    checkbox.checkboxradio("refresh")

    if (focus == id) {
        focus = undefined
        for (var i in data.regions) {
            if (i in data.selected) {
                focus = i
                break
            }
        }
    }
}

var focus = undefined
function updateMatches()
{
    var region = data.regions[focus]

    var matches = findMatches(focus)

    var div = document.getElementById("matches")
    div.innerHTML = ""
    var p = document.createElement("p")
    if (!region) {
        p.innerHTML = ""
    } else {
        p.innerHTML = region.name + " today is like:"
    }
    div.appendChild(p)
    if (!region) {
        return
    }
    var ol = document.createElement("ol")
    for (var match of matches) {
        var match_id = match[1]
        var shift = match[2]
        var match_region = data.regions[match_id]
        var li = document.createElement("li")

        var input = document.createElement('input');
        input.setAttribute("type", "checkbox");
        input.setAttribute("id", match_region.id + shift);
        if (data.selected[match_region.id] == shift) {
            input.setAttribute("checked", true)
        }
        input.setAttribute("onClick", 'doToggleSequence("' + match_id + '", ' + shift + ')')
        li.appendChild(input)
        add_label(li, match_region.id + shift, match_region.name + "+" + shift)

        ol.appendChild(li)
    }
    div.appendChild(ol)

    $('input[type="checkbox"]').checkboxradio({icon: false});
}

function updateSelected()
{
    var url = new URL(window.location)

    var select_table = document.createElement("table")
    var shift_table = document.createElement("table")
    var first_selected = undefined

    for (var id of Object.keys(data.selected).sort(id => data.regions[id].name)) {
        var region = data.regions[id]

        if (!first_selected) {
            first_selected = region.id
        }

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        td.setAttribute("style", "width:1.5em")
        var button = document.createElement("img")
        button.setAttribute("src", "Antu_task-reject.svg")
        button.setAttribute("alt", "x")
        button.setAttribute("style", "width:1.4em;height:1.4em;max-width:unset")
        button.setAttribute("onClick", "doDeselect('" + region.id + "')")
        td.appendChild(button)
        tr.appendChild(td)
        var td = document.createElement("td")
        add_button(td, "match:" + region.id, region.name, "doFocus('" + region.id + "')")
        tr.appendChild(td)
        select_table.appendChild(tr)

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        var shift_id = "shift-" + region.id
        var input = document.createElement('input');
        input.setAttribute("id", shift_id)
        input.setAttribute("class", "spinner")
        input.setAttribute("value", data.selected[id])
        td.appendChild(input)
        tr.appendChild(td)
        shift_table.appendChild(tr)
    }

    var div = document.getElementById("selections")
    div.innerHTML = ""
    div.appendChild(select_table)

    var div = document.getElementById("shift")
    div.innerHTML = ""
    div.appendChild(shift_table)

    $("input[type=button]").button()
    $(".spinner").spinner()
    $(".spinner").width(40)
    // TODO: would like to pass id to spin function
    $(".spinner").on("spinstop", function() { doShift() })
}

function updateRegions()
{
    var div = document.getElementById("options_form");
    var grouped = {}

    for (var id in data.confirmed) {
        region = data.regions[id]
        if (!(region.group in grouped)) {
            grouped[region.group] = {}
        }
        grouped[region.group][region.name] = region
    }

    var tab_list = document.createElement("ul")
    var tab_div = document.createElement("div")
    tab_div.setAttribute("id", "tabs")
    tab_div.appendChild(tab_list)
    div.appendChild(tab_div)
    var i = 0
    var subgroups = {}
    for (var group of Object.keys(grouped).sort()) {
        for (name of Object.keys(grouped[group]).sort()) {
            var region = grouped[group][name]
            if (!(region.subgroup in subgroups)) {
                i += 1

                subgroups[region.subgroup] = document.createElement("div")
                subgroups[region.subgroup].setAttribute("id", "tabs-" + i)

                var li = document.createElement("li")
                var a = document.createElement("a")
                a.setAttribute("href", "#tabs-" + i)
                a.innerHTML = region.subgroup
                li.appendChild(a)
                tab_list.appendChild(li)
            }
            var input = document.createElement('input');
            input.setAttribute("type", "checkbox");
            input.setAttribute("id", region.id);
            if (region.id in data.selected) {
                input.setAttribute("checked", true);
            }
            input.setAttribute("onClick", 'doToggle("' + region.id + '")')
            subgroups[region.subgroup].appendChild(input)

            add_label(subgroups[region.subgroup], region.id, region.name)
        }

//        p = document.createElement("p")
//        p.innerHTML = "Select "
//        add_button(p, "select_all_" + group, "All", 'updateSelection("' + group + '", "all", 1)')
//        for (subgroup of Object.keys(subgroups).sort()) {
//            add_button(p, "select_" + subgroup + "_" + group, subgroup,
//                'updateSelection("' + group + '", "' + subgroup + '", 1)')
//        }
//        tab.appendChild(p)

//        p = document.createElement("p")
//        add_button(p, "clear_all_" + group, "Clear All", 'updateSelection("' + group + '", "all", 0)')
//        tab.appendChild(p)
//        tab_div.appendChild(tab)
    }

    for (var subgroup of Object.keys(subgroups).sort()) {
        tab_div.appendChild(subgroups[subgroup])
    }

    if (data.options.scale == scale.LOG) {
        document.getElementById("log_scale").checked = true
    } else {
        document.getElementById("linear_scale").checked = true
    }

    if (data.options.data_set == data_set.ACTIVE) {
        document.getElementById("active").checked = true
    } else if (data.options.data_set == data_set.DEATHS) {
        document.getElementById("deaths").checked = true
    } else if (data.options.data_set == data_set.RECOVERED) {
        document.getElementById("recovered").checked = true
    } else {
        document.getElementById("confirmed").checked = true
    }

    if (data.options.data_per == data_per.CAPITA) {
        document.getElementById("relative_cases").checked = true
    } else if (data.options.data_per == data_per.BED) {
        document.getElementById("cases_per_bed").checked = true
    } else {
        document.getElementById("absolute_cases").checked = true
    }

    $(function() {
        $('input[type="checkbox"]').checkboxradio({icon: false});
        $('input[type="radio"]').checkboxradio({icon: false});
        $("#tabs").tabs();
    })
}

function makeTrace(id)
{
    var cases
    var cases_active
    if (data.options.data_set == data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases = data.options.data_set
        cases_active = false
    }

    var errors = []
    var region = data.regions[id]
    if (!region) {
        return ["ERROR: No info for " + id, undefined]
    }
    var trace = {
        x: data['dates'],
        name: region.name,
        line: {
            color: region.color
        }
    };
    trace.y = data[cases][id]
    if (cases_active) {
        // Copy the array
        trace.y = trace.y.slice()
        for (var i = 0; i < trace.y.length; i++) {
            trace.y[i] -= data.deaths[id][i]
            trace.y[i] -= data.recovered[id][i]
        }
    }

    if (data.options.data_per == data_per.CAPITA) {
        if (!region.population) {
            return ["ERROR: Don't know population for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => 100000.0 * x / region.population)
    } else if (data.options.data_per == data_per.BED) {
        if (!region.hospital_beds) {
            return ["ERROR: Don't know number of hospital beds for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => x / region.hospital_beds)
    }
    return [undefined, trace]
}

function doChangeOptions()
{
    if (document.getElementById("active").checked) {
        data.options.data_set = data_set.ACTIVE
    } else if (document.getElementById("deaths").checked) {
        data.options.data_set = data_set.DEATHS
    } else if (document.getElementById("recovered").checked) {
        data.options.data_set = data_set.RECOVERED
    } else {
        data.options.data_set = data_set.CONFIRMED
    }
    if (document.getElementById("relative_cases").checked) {
        data.options.data_per = data_per.CAPITA
    } else if (document.getElementById("cases_per_bed").checked) {
        data.options.data_per = data_per.BED
    } else {
        data.options.data_per = data_per.ABSOLUTE
    }
    if (document.getElementById("log_scale").checked) {
        data.options.scale = scale.LOG
    } else {
        data.options.scale = scale.LINEAR
    }
    updateAll()
}

function updateGraph()
{
    var error = document.getElementById('error');
    error.innerHTML = ""
    var title = ""

    var layout = {
            margin: { t: 20 },
            yaxis: {},
            showlegend: true,
        }

    var cases_active = false
    var cases
    switch (data.options.data_set) {
        case data_set.ACTIVE:
            layout.yaxis.title = 'Confirmed Active'
            title += "Confirmed Active COVID-19 Cases"
            break;
        case data_set.CONFIRMED:
            layout.yaxis.title = 'Confirmed Cases'
            title += "Confirmed COVID-19 Cases"
            break;
        case data_set.DEATHS:
            layout.yaxis.title = 'Confirmed Deaths'
            title += "Confirmed COVID-19 Deaths"
            break;
        case data_set.RECOVERED:
            layout.yaxis.title = 'Confirmed Recovered'
            title += "Confirmed COVID-19 Recoveries"
            break;
    }

    var traces = []
    var start_offset = Number.MAX_VALUE
    var max_shift = 0
    for (var id of Object.keys(data.selected).sort()) {
        var region = data.regions[id]

        if (!('color' in region)) {
            region.color = colorgen.next().value
        }

        var [err, trace] = makeTrace(id)
        if (err) {
            error.innerHTML += err + "<br/>"
            continue
        }
        traces.push(trace)

        for (var i = 0; i < trace.y.length; i++) {
            if (trace.y[i] > 0) {
                start_offset = Math.min(i, start_offset)
                break;
            }
        }

        var shift = data.selected[id]
        if (shift != 0) {
            var shifted = {}
            Object.assign(shifted, trace)
            shifted.line = {}
            Object.assign(shifted.line, trace.line)
            shifted.line.dash = 'dash'

            if (shift > 0) {
                var prefix = []
                // TODO: There must be an idiomatic way to do this.
                for (var i = 0; i < shift; i++) {
                    prefix.push(0)
                }
                shifted.y = prefix.concat(shifted.y)
                shifted.name = region.name + "+" + shift
            } else if (shift < 0) {
                shifted.y = shifted.y.slice(-shift, undefined)
                shifted.name = region.name + shift
            }
            traces.push(shifted)
        }
    }

    // Make sure we include the last 0 day.
    start_offset = Math.max(start_offset - 1, 0)
    var future_dates = []
    for (var i = 0; i < max_shift; i++) {
        future_dates.push('+' + (i+1))
    }
    for (var trace of traces) {
        trace.y = trace.y.slice(start_offset, trace.y.length)
        trace.x = trace.x.slice(start_offset, trace.x.length).concat(future_dates)
    }

    if (data.options.scale == scale.LOG) {
        layout.yaxis.type = 'log'
    }
    switch (data.options.data_per) {
        case data_per.ABSOLUTE:
            layout.yaxis.title += ' (number)'
            break;
        case data_per.CAPITA:
            layout.yaxis.title += ' (per 100,000)'
            title += " per 100,000 People"
            break;
        case data_per.BED:
            layout.yaxis.title += ' (per hospital bed)'
            title += " per Hospital Bed"
            break;
    }
    title += " over Time"
    $(".post-title").html(title)

    var graph = document.getElementById('graph');
    Plotly.newPlot(graph, traces, layout);
}

function updateUrl()
{
    var parts = []
    switch (data.options.data_set) {
        case data_set.ACTIVE:
            parts.push("act")
            break
        case data_set.CONFIRMED:
            break
        case data_set.DEATHS:
            parts.push("dth")
            break
        case data_set.RECOVERED:
            parts.push("rec")
            break
    }
    switch (data.options.data_per) {
        case data_per.ABSOLUTE:
            break
        case data_per.CAPITA:
            parts.push("rel")
            break
        case data_per.BED:
            parts.push("bed")
            break
    }
    switch (data.options.scale) {
        case scale.LINEAR:
            break
        case scale.LOG:
            parts.push("log")
    }

    for (var id in data.selected) {
        if (data.selected[id]) {
            parts.push(id + data.selected[id])
        } else {
            parts.push(id)
        }
    }

    var url = new URL(window.location)
    url.hash = parts.join(";")
    window.history.pushState("", "", url)
}

function parseUrl()
{
    var url = new URL(window.location)

    if (url.hash == "") {
        url.hash = "USA"
    }

    for (var part of url.hash.slice(1).split(";")) {
        var re = new RegExp('([-A-Za-z]+)(-?[0-9]*)')
        var match = re.exec(part)
        if (part == "") {
        } else if (match && match[1] in data.regions) {
            data.selected[match[1]] = parseInt(match[2]) || 0
        } else if (part == "act") {
            data.options.data_set = data_set.ACTIVE
        } else if (part == "dth") {
            data.options.data_set = data_set.DEATHS
        } else if (part == "rec") {
            data.options.data_set = data_set.RECOVERED
        } else if (part == "rel") {
            data.options.data_per = data_per.CAPITA
        } else if (part == "bed") {
            data.options.data_per = data_per.BED
        } else if (part == "log") {
            data.options.scale = scale.LOG
        } else {
            console.log("ERROR: Don't know what to do with " + part + " in URL (" + url.hash + ").")
        }
    }
}

$.when(
    $.get("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv"),
    $.get("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Deaths.csv"),
    $.get("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Recovered.csv"),
    $.get("regions.csv"),
).then(function(confirmed_response, deaths_response, recovered_response, regions_response) {
    buildData(
        $.csv.toArrays(confirmed_response[0]),
        $.csv.toArrays(deaths_response[0]),
        $.csv.toArrays(recovered_response[0]),
        $.csv.toArrays(regions_response[0])
    )
    parseUrl()
    updateRegions()
    updateAll()

    var graph = document.getElementById("graph");
    $(function(){
        let isMobile = /Mobi/.test(navigator.userAgent)

        $("#options-dialog").dialog({
            autoOpen: !isMobile,
            position: {my: "right top", at: "middle top", of: graph}
        })
        $("#dialog-tabs").tabs()
        $("input[type=button]").button()
    })
});
