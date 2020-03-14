var data = {
    'regions': {},
};

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
                    'name': name,
                    'id': id
                }
                name_to_id[name] = id
                console.log("WARNING: Don't have region details (like population) for", name, id)
            }

            for (var j = first_date; j < row.length; j++) {
                row[j] = parseInt(row[j])
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
    }
    for (row of regions_csv) {
        var info = {
            'id': row[0],
            'name': row[1],
            'group': row[2],
            'subgroup': row[3],
            'population': row[4],
            'hospital_beds': row[5]
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

function add_button(element, id, text, onClick) {
    var input = document.createElement('input')
    input.setAttribute("id", id)
    input.setAttribute("type", "button");
    input.setAttribute("onClick", onClick)
    // TODO: What's the difference between this and setAttribute?
    input.value = text
    element.appendChild(input)
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
    for (var group of Object.keys(grouped).sort()) {
        i += 1
        var li = document.createElement("li")
        var a = document.createElement("a")
        a.setAttribute("href", "#tabs-" + i)
        a.innerHTML = group
        li.appendChild(a)
        tab_list.appendChild(li)

        var tab = document.createElement("div")
        tab.setAttribute("id", "tabs-" + i)

        //var fieldset = document.createElement("fieldset")
        //var legend = document.createElement("legend")
        //legend.innerHTML = group
        //fieldset.appendChild(legend)
        var subgroups = {}
        for (name of Object.keys(grouped[group]).sort()) {
            region = grouped[group][name]
            var input = document.createElement('input');
            input.setAttribute("type", "checkbox");
            input.setAttribute("id", region.id);
            if (url.hash.includes(";" + region.id)) {
                input.setAttribute("checked", true);
            }
            input.setAttribute("onClick", "updateGraph()")
            tab.appendChild(input)

            add_label(tab, region.id, region.name)
            subgroups[region.subgroup] = 1
        }

        p = document.createElement("p")
        p.innerHTML = "Select "
        add_button(p, "select_all_" + group, "All", 'updateSelection("' + group + '", "all", 1)')
        for (subgroup of Object.keys(subgroups).sort()) {
            add_button(p, "select_" + subgroup + "_" + group, subgroup,
                'updateSelection("' + group + '", "' + subgroup + '", 1)')
        }

        tab.appendChild(p)

        p = document.createElement("p")
        add_button(p, "clear_all_" + group, "Clear All", 'updateSelection("' + group + '", "all", 0)')
        tab.appendChild(p)
        tab_div.appendChild(tab)
    }

    var table = document.createElement("table")
    tr = document.createElement("tr")
    th = document.createElement("th")
    th.setAttribute("align", "left")
    th.innerHTML = "Options"
    tr.appendChild(th)
    table.appendChild(tr)

    tr = document.createElement("tr")

    td = document.createElement("td")
    log = url.hash.includes(";log")
    add_radio(td, "linear_scale", "scale", !log, "Linear Scale")
    add_radio(td, "log_scale", "scale", log, "Log Scale")
    tr.appendChild(td)

    td = document.createElement("td")
    add_radio(td, "absolute_cases", "cases",
        !(url.hash.includes(";rel") || url.hash.includes(";bed")), "Absolute Number of Cases")
    add_radio(td, "relative_cases", "cases", url.hash.includes(";rel"), "Cases per 100,000")
    add_radio(td, "cases_per_bed", "cases", url.hash.includes(";bed"), "Cases per Hospital Bed")
    tr.appendChild(td)

    td = document.createElement("td")
    add_radio(td, "confirmed", "stat",
        !(url.hash.includes(";dth") || url.hash.includes(";rec")), "Confirmed")
    add_radio(td, "deaths", "stat", url.hash.includes(";dth"), "Deaths")
    add_radio(td, "recovered", "stat", url.hash.includes(";rec"), "Recovered")
    tr.appendChild(td)

    table.appendChild(tr)

    div.appendChild(table)

    $( 'input[type="checkbox"]' ).checkboxradio({icon: false});
    $( 'input[type="radio"]' ).checkboxradio({});
    $( "#tabs" ).tabs();
}

function updateGraph()
{
    var error = document.getElementById('error');
    error.innerHTML = ""

    var url = new URL(window.location)
    url.hash = ""

    var layout = {
            margin: { t: 0 },
            yaxis: {},
        }

    if (document.getElementById('deaths').checked) {
        url.hash += ";dth"
        cases = "deaths"
        layout.yaxis.title = 'Deaths'
    } else if (document.getElementById('recovered').checked) {
        url.hash += ";rec"
        cases = "recovered"
        layout.yaxis.title = 'Recovered'
    } else {
        cases = "confirmed"
        layout.yaxis.title = 'Confirmed cases'
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

        var trace = {
            x: data['dates'],
            name: region.name
        };
        if (relative_cases) {
            if (!region.population) {
                error.innerHTML += "ERROR: Don't know population for " + region.name + ".<br/>"
                continue
            }
            trace.y = data[cases][id].map(x => 100000.0 * x / region.population)
        } else if (cases_per_bed) {
            if (!region.hospital_beds) {
                error.innerHTML += "ERROR: Don't know number of hospital beds for " +
                    region.name + ".<br/>"
                continue
            }
            trace.y = data[cases][id].map(x => x / region.hospital_beds)
        } else {
            trace.y = data[cases][id]
        }
        for (var i = 0; i < trace.y.length; i++) {
            if (trace.y[i] > 0) {
                start_offset = Math.min(i, start_offset)
                break;
            }
        }
        traces.push(trace)
        url.hash += ";" + id
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

    graph = document.getElementById('graph');
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
    updateGraph();
});

