var data = {
    'regions': {},
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
        row = csv[i]

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
        state_id = "US-" + state
        agg_id = "US-agg-" + state
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
        "Tanzania": "TZA",
        "Republic of the Congo": "COG",
        "The Gambia": "GMB",
        "Gambia, The": "GMB",
    }
    for (row of regions_csv) {
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

function add_radio(element, id, name, checked, text) {
    var input = document.createElement('input');
    input.setAttribute("type", "radio");
    input.setAttribute("name", name);
    input.setAttribute("id", id);
    if (checked) {
        input.setAttribute("checked", true);
    }
    input.setAttribute("onClick", "updateGraph()")
    element.appendChild(input)
    add_label(element, id, text)
}

function add_button(element, id, text, onClick, onDblClick) {
    var input = document.createElement('input')
    input.setAttribute("id", id)
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

function updateSelection(group, subgroup, value)
{
    var grouped = {}

    for (var id in data.confirmed) {
        region = data.regions[id]
        if (group != region.group) {
            continue
        }
        if (subgroup == "all" || subgroup == region.subgroup) {
            var button = document.getElementById(region.id);
            button.checked = value
        }
    }
    updateGraph()
}

function openOptions()
{
    $("#options-dialog").dialog("open")
}

// click is reserved, or something
function clck(id)
{
    updateShift()
    updateMatch()
    updateGraph()
}

function spinnerChanged()
{
    updateGraph()
}

function findMatches(target_id)
{
    var cases_active = false
    var cases
    if (document.getElementById('deaths').checked) {
        cases = "deaths"
    } else if (document.getElementById('recovered').checked) {
        cases = "recovered"
    } else if (document.getElementById('active').checked) {
        cases = "confirmed"
        // And then we treat them special in the loop below.
        cases_active = true
    } else {
        cases = "confirmed"
    }

    var [err, target_trace] = makeTrace(target_id, cases, cases_active)

    var results = []
    for (var id in data["confirmed"]) {
        if (id == target_id) {
            continue
        }
        var [err, trace] = makeTrace(id, cases, cases_active)
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

function openMatch(id)
{
    region = data.regions[id]

    var matches = findMatches(id)

    div = document.getElementById("match-dialog")
    div.innerHTML = ""
    ol = document.createElement("ol")
    for (var match of matches) {
        var match_id = match[1]
        var match_region = data.regions[match_id]
        li = document.createElement("li")
        li.innerHTML = match_region.name + "+" + match[2]
        ol.appendChild(li)
    }
    div.appendChild(ol)

    $("#match-dialog").dialog({
        title: region.name,
    })
    $("#match-dialog").dialog("open")
}

function updateMatch()
{
    var table = document.createElement("table")

    for (var id of Object.keys(data["confirmed"]).sort()) {
        region = data.regions[id]
        checkbox = document.getElementById(id)
        if (!checkbox || !(checkbox.checked)) {
            continue
        }

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        add_button(td, "match:" + id, region.name, onClick="openMatch('" + id + "')")
        tr.appendChild(td)

        table.appendChild(tr)
    }

    var div = document.getElementById("dt-match")
    div.innerHTML = ""
    div.appendChild(table)
}

function updateShift()
{
    var url = new URL(window.location)

    var table = document.createElement("table")

    for (id of Object.keys(data["confirmed"]).sort()) {
        region = data.regions[id]
        checkbox = document.getElementById(id)
        if (!checkbox || !(checkbox.checked)) {
            continue
        }

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        td.innerHTML = region.name
        tr.appendChild(td)

        td = document.createElement("td")
        var shift_id = "shift-" + region.id
        var input = document.createElement('input');
        input.setAttribute("id", shift_id)
        input.setAttribute("class", "spinner")
        originalInput = document.getElementById(shift_id)
        if (originalInput) {
            input.setAttribute("value", originalInput.value)
        } else {
            var re = new RegExp(';' + region.id + '(-?[0-9]+)')
            var match = re.exec(url.hash)
            if (match) {
                input.setAttribute("value", match[1])
            } else {
                input.setAttribute("value", 0)
            }
        }
        td.appendChild(input)
        tr.appendChild(td)

        table.appendChild(tr)

    }

    var div = document.getElementById("dt-shift")
    div.innerHTML = ""
    div.appendChild(table)

    $(".spinner").spinner()
    $(".spinner").width(50)
    $(".spinner").on("spinstop", function() { spinnerChanged() })
}

function updateForm()
{
    var url = new URL(window.location)
    if (url.hash == "") {
        url.hash = ";USA"
    }

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
            if (url.hash.includes(";" + region.id)) {
                input.setAttribute("checked", true);
            }
            input.setAttribute("onClick", 'clck("' + region.id + '")')
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

    for (subgroup of Object.keys(subgroups).sort()) {
        tab_div.appendChild(subgroups[subgroup])
    }

    if (url.hash.includes(";log")) {
        document.getElementById("log_scale").checked = true
    } else {
        document.getElementById("linear_scale").checked = true
    }

    if (url.hash.includes(";act")) {
        document.getElementById("active").checked = true
    } else if (url.hash.includes(";dth")) {
        document.getElementById("deaths").checked = true
    } else if (url.hash.includes(";rec")) {
        document.getElementById("recovered").checked = true
    } else {
        document.getElementById("confirmed").checked = true
    }

    if (url.hash.includes(";rel")) {
        document.getElementById("relative_cases").checked = true
    } else if (url.hash.includes(";bed")) {
        document.getElementById("cases_per_bed").checked = true
    } else {
        document.getElementById("absolute_cases").checked = true
    }

    $('input[type="checkbox"]').checkboxradio({icon: false});
    $('input[type="radio"]').checkboxradio({icon: false});
    $("#tabs").tabs();
}

function makeTrace(id, cases, cases_active)
{
    var errors = []
    var region = data.regions[id]
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

    if (relative_cases) {
        if (!region.population) {
            return ["ERROR: Don't know population for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => 100000.0 * x / region.population)
    } else if (cases_per_bed) {
        if (!region.hospital_beds) {
            return ["ERROR: Don't know number of hospital beds for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => x / region.hospital_beds)
    }
    return [undefined, trace]
}

function updateGraph()
{
    var error = document.getElementById('error');
    error.innerHTML = ""

    var url = new URL(window.location)
    url.hash = ""

    var layout = {
            margin: { t: 20 },
            yaxis: {},
            showlegend: true,
        }

    var cases_active = false
    var cases
    if (document.getElementById('deaths').checked) {
        url.hash += ";dth"
        cases = "deaths"
        layout.yaxis.title = 'Confirmed Deaths'
    } else if (document.getElementById('recovered').checked) {
        url.hash += ";rec"
        cases = "recovered"
        layout.yaxis.title = 'Confirmed Recovered'
    } else if (document.getElementById('active').checked) {
        url.hash += ";act"
        cases = "confirmed"
        // And then we treat them special in the loop below.
        cases_active = true
        layout.yaxis.title = 'Confirmed Active'
    } else {
        cases = "confirmed"
        layout.yaxis.title = 'Confirmed Cases'
    }

    var traces = []
    var start_offset = Number.MAX_VALUE
    absolute_cases = document.getElementById("absolute_cases").checked
    relative_cases = document.getElementById("relative_cases").checked
    cases_per_bed = document.getElementById("cases_per_bed").checked
    for (id of Object.keys(data[cases]).sort()) {
        region = data.regions[id]
        checkbox = document.getElementById(id)
        if (!checkbox || !(checkbox.checked)) {
            continue
        }

        shift_element = document.getElementById("shift-" + id)
        if (shift_element) {
            shift = shift_element.value || 0
        } else {
            shift = 0
        }

        if (!('color' in region)) {
            region.color = colorgen.next().value
        }

        var [err, trace] = makeTrace(id, cases, cases_active)
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

        url.hash += ";" + id

        if (shift != 0) {
            url.hash += shift
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
    for (var trace of traces) {
        trace.y = trace.y.slice(start_offset, trace.y.length)
        trace.x = trace.x.slice(start_offset, trace.x.length)
    }

    var log_scale = document.getElementById('log_scale')
    if (log_scale.checked) {
        url.hash += ";log"
        layout.yaxis.type = 'log'
    }
    if (relative_cases) {
        url.hash += ";rel"
        layout.yaxis.title += ' (per 100,000)'
    } else if (cases_per_bed) {
        url.hash += ";bed"
        layout.yaxis.title += ' (per hospital bed)'
    } else {
        layout.yaxis.title += ' (number)'
    }

    window.history.pushState("", "", url)

    var graph = document.getElementById('graph');
    Plotly.newPlot(graph, traces, layout);
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
    updateForm()
    updateShift()
    updateMatch()
    updateGraph()

    var graph = document.getElementById("graph");
    $(function(){
        let isMobile = /Mobi/.test(navigator.userAgent)

        $("#options-dialog").dialog({
            autoOpen: !isMobile,
            position: {my: "right top", at: "middle top", of: graph}
        })
        $("#match-dialog").dialog({
            autoOpen: false,
            position: {my: "right left", at: "middle center", of: $("#options-dialog")}
        })
        $("#dialog-tabs").tabs()
        $("input[type=button]").button()
    })
});

