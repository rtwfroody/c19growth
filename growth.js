var data = {
    'regions': {},
    'sequences': {}
};

function buildData(covid_csv, regions_csv) {
    // Translate from Johns Hopkins name to world bank name
    const translate_names = {
        "US": "United States",
        "Mainland China": "China",
        "South Korea": "Korea, Rep.",
        "Macau": "Macao SAR, China",
        "Hong Kong": "Hong Kong SAR, China",
        "UK": "United Kingdom",
        "Russia": "Russian Federation",
        "Egypt": "Egypt, Arab Rep.",
        "Iran": "Iran, Islamic Rep.",
        "Slovakia": "Slovak Republic",
        "Martinique": "St. Martin (French part)",
    }
    var name_to_id = {}
    for (row of regions_csv) {
        var info = {
            'group': row[0],
            'name': row[1],
            'id': row[2],
            'population': row[3]
        }
        data.regions[row[2]] = info
        name_to_id[row[1]] = row[2]
    }

    const province_state = 0;
    const country_region = 1;
    const first_date = 4;

    var header = covid_csv[0]
    data['dates'] = header.slice(first_date, header.length);

    var sequence_map = {}
    var unknown = 0
    for (var i = 1; i < covid_csv.length; i++) {
        row = covid_csv[i]

        if (row[province_state].startsWith("Unassigned Location")) {
            console.log("WARNING: Skipping", row[country_region], row[province_state])
            // Skip corner case.
            continue
        }

        name = row[country_region]
        if (name in translate_names) {
            name = translate_names[name]
        }
        var id
        if (name in name_to_id) {
            id = name_to_id[name]
        } else {
            id = "U" + unknown
            unknown++
        }
        var ids = [id]

        if (row[country_region] == "US" && row[province_state].match(/, *[A-Z][A-Z]/)) {
            ids.push("US-" + row[province_state].replace(/.*, */, "").slice(0, 2))
        }
        for (id of ids) {
            if (!(id in data.regions)) {
                data.regions[id] = {
                    'group': "country",
                    'name': name,
                    'id': id
                }
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
    data.sequences = sequence_map
}

const continent_table = {
    "Mainland China": "asia",
    "Indonesia": "asia",
    "Thailand": "asia",
    "Japan": "asia",
    "South Korea": "asia",
    "Macau": "asia",
    "Hong Kong": "asia",
    "Morocco": "africa",
    "Egypt": "africa",
    "Portugal": "europe",
    "Greece": "europe",
    "Switzerland": "europe",
    "Sweden": "europe",
    "Spain": "europe",
    "Belgium": "europe",
    "Austria": "europe",
    "Liechtenstein": "europe",
    "Andorra": "europe",
    "Ireland": "europe",
    "Luxembourg": "europe",
    "Monaco": "europe",
    "Norway": "europe",
    "Denmark": "europe",
    "Netherlands": "europe",
    "Iceland": "europe",
    "New Zealand": "oceania",
    "Australia": "oceania",
    "Mexico": "north_america",
    "US": "north_america",
    "Canada": "north_america",
    "Argentina": "south_america",
    "Brazil": "south_america",
};
function get_continent(country) {
    if (country in continent_table) {
        return continent_table[country];
    }
    console.log("WARNING: Don't know continent for", country)
    return "unknown";
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

function updateForm() {
    var url = new URL(window.location)
    if (url.hash == "") {
        url.hash = ";USA"
    }

    var div = document.getElementById("options_form");
    var form = document.createElement("form");
    var grouped = {}

    for (id in data.sequences) {
        region = data.regions[id]
        if (!(region.group in grouped)) {
            grouped[region.group] = {}
        }
        grouped[region.group][region.name] = region
    }

    table = document.createElement("table")
    tr = document.createElement("tr")
    for (group of Object.keys(grouped).sort()) {
        td = document.createElement("td")
        for (name of Object.keys(grouped[group]).sort()) {
            region = grouped[group][name]
            var input = document.createElement('input');
            input.setAttribute("type", "checkbox");
            input.setAttribute("id", region.id);
            if (url.hash.includes(";" + region.id)) {
                input.setAttribute("checked", true);
            }
            input.setAttribute("onClick", "updateGraph()")
            td.appendChild(input)

            add_label(td, region.id, region.name)
        }
        tr.appendChild(td)
    }
    table.appendChild(tr)
    form.appendChild(table)

    table = document.createElement("table")
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
    relative = url.hash.includes(";rel")
    add_radio(td, "absolute_cases", "cases", !relative, "Absolute Number of Cases")
    add_radio(td, "relative_cases", "cases", relative, "Relative Number of Cases")
    tr.appendChild(td)

    table.appendChild(tr)

    form.appendChild(table)
    div.appendChild(form);
}

function updateGraph() {
    var error = document.getElementById('error');
    error.innerHTML = ""

    var url = new URL(window.location)
    url.hash = ""

    var traces = [];
    relative_cases = document.getElementById("relative_cases").checked
    for (id in data.sequences) {
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
            trace.y = data.sequences[id].map(x => 100000.0 * x / region.population)
        } else {
            trace.y = data.sequences[id]
        }
        traces.push(trace)
        url.hash += ";" + id
    }

    layout = {
            margin: { t: 0 },
            yaxis: {},
        }
    log_scale = document.getElementById('log_scale')
    if (log_scale.checked) {
        url.hash += ";log"
        layout.yaxis.type = 'log'
    }
    if (relative_cases) {
        url.hash += ";rel"
        layout.yaxis.title = 'Confirmed cases (per 100,000)'
    } else {
        layout.yaxis.title = 'Confirmed cases (number)'
    }

    window.history.pushState("", "", url)

    graph = document.getElementById('graph');
    Plotly.newPlot(graph, traces, layout);
}

$.when(
    $.get("https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv"),
    $.get("regions.csv"),
).then(function(covid_response, regions_response) {
    buildData($.csv.toArrays(covid_response[0]),
        $.csv.toArrays(regions_response[0]))
    updateForm()
    updateGraph();
});

