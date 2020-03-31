"use strict"
// 
/*
 * When the user clicks a button, call a do* function that indicates what the
 * user wants to happen.  That function updates internal state. Then it calls
 * update* functions for the various parts of the page (graph, regions,
 * selected, matches, options).
 */

const data_set = {
    ACTIVE: 'active',
    CONFIRMED: 'cases',
    DEATHS: 'deaths',
    RECOVERED: 'recovered',
    TESTED: 'tested'
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

var regions = {}
var options = {
    'data_set': data_set.CONFIRMED,
    'data_per': data_per.ABSOLUTE,
    'scale': scale.LINEAR,
    // id -> shift of sequences that are actually selected
    'selected': {}
}

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

function color_fade(type, start, end, percentage)
{
    var color = []
    for (var i = 0; i < 3; i++) {
        color.push(Math.round((start[i] * percentage + end[i] * (100 - percentage)) / 100))
    }
    if (type == "hsl") {
        return "hsl(" + color[0] + "," + color[1] + "%," + color[2] + "%)"
    } else {
        return "rgb(" + color.join(",") + ")"
    }
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

function openOptions()
{
    $("#options-dialog").dialog("open")
}

// click is reserved, or something
function doToggle(id)
{
    if (id in options.selected) {
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
    for (var id in options.selected) {
        options.selected[id] = $("#shift-" + id).val()
    }
    updateUrl()
    updateGraph()
}

function updateFocus() {
    if (!(focus in options.selected)) {
        focus = Object.keys(options.selected).sort(id => regions[id].name)[0]
    }
}

function updateAll()
{
    updateFocus()
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
    for (var id in regions) {
        if (id == target_id) {
            continue
        }
        var [err, trace] = makeTrace(id)
        if (err) {
            continue
        }

        for (var shift = 0; shift < target_trace.y.length; shift++) {
            var difference = 0
            for (var i = 0; i < shift; i++) {
                var delta = target_trace.y[i]
                difference += delta * delta
            }
            for (var i = 0; i < target_trace.y.length - shift; i++) {
                var delta = trace.y[i] - target_trace.y[i + shift]
                difference += delta * delta
            }
            //difference /= target_trace.y.length - shift
            results.push([difference, id, shift])
        }
    }
    results.sort(function (a, b) { return a[0] - b[0] })
    var seen = {}
    var unique_results = []
    for (var r of results) {
        var id = r[1]
        if (id in seen) {
            continue
        }
        seen[id] = true
        var shift = r[2]
        if (shift == 0) {
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

function doToggleSequence(id, shift)
{
    if (options.selected[id] == shift) {
        deselect(id)
    } else {
        select(id, shift)
    }
    updateAll()
}

function select(id, shift)
{
    options.selected[id] = shift
    var checkbox = document.getElementById(id)
    checkbox = $("#" + id)
    checkbox.prop("checked", true)

    if (!focus) {
        focus = id
    }
}

function deselect(id)
{
    delete options.selected[id]
    var checkbox = document.getElementById(id)
    checkbox = $("#" + id)
    checkbox.prop("checked", false)

    if (focus == id) {
        focus = undefined
        for (var i in regions) {
            if (i in options.selected) {
                focus = i
                break
            }
        }
    }
}

var focus = undefined
function updateMatches()
{
    var region = regions[focus]

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
    if (matches.length > 0) {
        var ol = document.createElement("ol")
        for (var match of matches) {
            var match_id = match[1]
            var shift = match[2]
            var match_region = regions[match_id]
            var li = document.createElement("li")

            var input = document.createElement('input');
            input.setAttribute("type", "checkbox");
            input.setAttribute("class", "match");
            input.setAttribute("id", match_id + shift);
            if (options.selected[match_id] == shift) {
                input.setAttribute("checked", true)
            }
            input.setAttribute("onClick", 'doToggleSequence("' + match_id + '", ' + shift + ')')
            li.appendChild(input)
            add_label(li, match_id + shift, match_region.name + "+" + shift)

            ol.appendChild(li)
        }
        div.appendChild(ol)


        $('.match').checkboxradio({icon: false});
    } else {
        var p = document.createElement("p")
        p.innerHTML = "No other region"
        div.appendChild(p)
    }
}

function updateSelected()
{
    var url = new URL(window.location)

    var select_table = document.createElement("table")
    var shift_table = document.createElement("table")
    var first_selected = undefined

    for (var id of Object.keys(options.selected).sort(id => regions[id].name)) {
        var region = regions[id]

        if (!first_selected) {
            first_selected = id
        }

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        td.setAttribute("style", "width:1.5em")
        var button = document.createElement("img")
        button.setAttribute("src", "Antu_task-reject.svg")
        button.setAttribute("alt", "x")
        button.setAttribute("style", "width:1.4em;height:1.4em;max-width:unset")
        button.setAttribute("onClick", "doDeselect('" + id + "')")
        td.appendChild(button)
        tr.appendChild(td)
        var td = document.createElement("td")
        add_button(td, "match:" + id, region.name, "doFocus('" + id + "')")
        tr.appendChild(td)
        select_table.appendChild(tr)

        var tr = document.createElement("tr")
        var td = document.createElement("td")
        var shift_id = "shift-" + id
        var input = document.createElement('input');
        input.setAttribute("id", shift_id)
        input.setAttribute("class", "spinner")
        input.setAttribute("value", options.selected[id])
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

    for (var id in regions) {
        region = regions[id]
        if (!(region.region in grouped)) {
            grouped[region.region] = {}
        }
        grouped[region.region][region.name] = id
    }

    var tab_list = document.createElement("ul")
    var tab_div = document.createElement("div")
    tab_div.setAttribute("id", "tabs")
    tab_div.appendChild(tab_list)
    div.appendChild(tab_div)
    var i = 0
    var subgroups = {}
    var active_tab
    for (var group of Object.keys(grouped).sort()) {
        for (name of Object.keys(grouped[group]).sort()) {
            var id = grouped[group][name]
            var region = regions[id]
            if (!(region.region in subgroups)) {
                var div = document.createElement("div")
                div.setAttribute("id", "tabs-" + i)
                div.setAttribute("n", i)
                var table = document.createElement("table")
                div.appendChild(table)

                subgroups[region.region] = div

                var li = document.createElement("li")
                var a = document.createElement("a")
                a.setAttribute("href", "#tabs-" + i)
                a.innerHTML = region.region
                li.appendChild(a)
                tab_list.appendChild(li)

                i++
            }

            var tr = document.createElement("tr")
            tr.setAttribute("onClick", 'doToggle("' + id + '")')

            var input = document.createElement('input');
            input.setAttribute("type", "checkbox");
            input.setAttribute("id", id);
            if (id in options.selected) {
                input.setAttribute("checked", true);
            }

            var td = document.createElement("td")
            td.appendChild(input)
            tr.appendChild(td)

            var td = document.createElement("td")
            td.innerHTML = region.name
            tr.appendChild(td)

            var td = document.createElement("td")
            var p = Math.min(100, Math.max(100.0 * region.velocity / 0.0001, 0))
            td.setAttribute("style", "width:2em;background:" + color_fade("hsl",
                [360, 100, 50], [360, 100, 100], p))
            tr.appendChild(td)

            var td = document.createElement("td")
            var p = Math.min(100, Math.max(100.0 * region.acceleration / 0.0001, -100))
            if (p > 0) {
                td.setAttribute("style", "width:2em;background:" + color_fade("hsl",
                    [360, 100, 50], [360, 100, 100], p))
            } else {
                td.setAttribute("style", "width:2em;background:" + color_fade("hsl",
                    [210, 100, 50], [210, 100, 100], -p))
            }
            tr.appendChild(td)

            var td = document.createElement("td")
            var p = Math.min(100, Math.max(100.0 * region.jerk / 0.0001, -100))
            if (p > 0) {
                td.setAttribute("style", "width:2em;background:" + color_fade("hsl",
                    [360, 100, 50], [360, 100, 100], p))
            } else {
                td.setAttribute("style", "width:2em;background:" + color_fade("hsl",
                    [210, 100, 50], [210, 100, 100], -p))
            }
            tr.appendChild(td)

            subgroups[region.region].appendChild(tr)

            if (id == focus) {
                active_tab = subgroups[region.region].getAttribute("n")
            }
        }
    }

    for (var subgroup of Object.keys(subgroups).sort()) {
        tab_div.appendChild(subgroups[subgroup])
    }

    if (options.scale == scale.LOG) {
        document.getElementById("log_scale").checked = true
    } else {
        document.getElementById("linear_scale").checked = true
    }

    if (options.data_set == data_set.ACTIVE) {
        document.getElementById("active").checked = true
    } else if (options.data_set == data_set.DEATHS) {
        document.getElementById("deaths").checked = true
    } else if (options.data_set == data_set.RECOVERED) {
        document.getElementById("recovered").checked = true
    } else if (options.data_set == data_set.TESTED) {
        document.getElementById("tested").checked = true
    } else {
        document.getElementById("confirmed").checked = true
    }

    if (options.data_per == data_per.CAPITA) {
        document.getElementById("relative_cases").checked = true
    } else if (options.data_per == data_per.BED) {
        document.getElementById("cases_per_bed").checked = true
    } else {
        document.getElementById("absolute_cases").checked = true
    }

    if (options.daily) {
        document.getElementById("daily").checked = true
    } else {
        document.getElementById("cumulative").checked = true
    }

    $(function() {
        //$('input[type="checkbox"]').checkboxradio({icon: false});
        $('input[type="radio"]').checkboxradio({icon: false});
        $("#tabs").tabs({active: active_tab});
    })
}

function makeTrace(id)
{
    var cases
    var cases_active
    if (options.data_set == data_set.ACTIVE) {
        cases = data_set.CONFIRMED
        cases_active = true
    } else {
        cases = options.data_set
        cases_active = false
    }

    var errors = []
    var region = regions[id]
    if (!region) {
        return ["ERROR: No info for " + id, undefined]
    }
    if (!(cases in region.data)) {
        return ["ERROR: No " + cases + " data for " + id, undefined]
    }
    var trace = {
        x: Object.keys(region.data[cases]).sort(),
        name: region.name,
        line: {
            color: region.color
        },
        marker_color: region.color
    };
    trace.y = []
    var data = regions[id].data
    for (var d of trace.x) {
        var value = data[cases][d]
        if (cases_active) {
            if ('deaths' in data) {
                value -= data['deaths'][d]
            }
            if ('recovered' in data) {
                value -= data['recovered'][d]
            }
        }
        trace.y.push(value)
    }

    if (options.data_per == data_per.CAPITA) {
        if (!region.population) {
            return ["ERROR: Don't know population for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => 100000.0 * x / region.population)
    } else if (options.data_per == data_per.BED) {
        if (!region.hospital_beds) {
            return ["ERROR: Don't know number of hospital beds for " + region.name + ".", undefined]
        }
        trace.y = trace.y.map(x => x / region.hospital_beds)
    }

    if (options.daily) {
        // Make daily
        for (var i = trace.y.length-1; i > 0; i--) {
            trace.y[i] -= trace.y[i-1]
        }
    }

    return [undefined, trace]
}

function doChangeOptions()
{
    if (document.getElementById("active").checked) {
        options.data_set = data_set.ACTIVE
    } else if (document.getElementById("deaths").checked) {
        options.data_set = data_set.DEATHS
    } else if (document.getElementById("recovered").checked) {
        options.data_set = data_set.RECOVERED
    } else if (document.getElementById("tested").checked) {
        options.data_set = data_set.TESTED
    } else {
        options.data_set = data_set.CONFIRMED
    }
    if (document.getElementById("relative_cases").checked) {
        options.data_per = data_per.CAPITA
    } else if (document.getElementById("cases_per_bed").checked) {
        options.data_per = data_per.BED
    } else {
        options.data_per = data_per.ABSOLUTE
    }
    if (document.getElementById("log_scale").checked) {
        options.scale = scale.LOG
    } else {
        options.scale = scale.LINEAR
    }
    options.daily = document.getElementById("daily").checked

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
    switch (options.data_set) {
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
        case data_set.TESTED:
            layout.yaxis.title = 'Tested'
            title += "COVID-19 Tested"
            break;
    }

    var traces = []
    var start_offset = Number.MAX_VALUE
    var max_shift = 0
    var date
    for (var id of Object.keys(options.selected).sort()) {
        var region = regions[id]
        var shift = options.selected[id]

        if (!('color' in region)) {
            region.color = colorgen.next().value
        }

        var [err, trace] = makeTrace(id)
        if (err) {
            error.innerHTML += err + "<br/>"
            continue
        }
        date = trace.x[trace.x.length - 1]
        if (options.daily) {
            trace.type = 'bar'
        }
        if (!options.daily || shift == 0) {
            traces.push(trace)
        }

        for (var i = 0; i < trace.y.length; i++) {
            if (trace.y[i] > 0) {
                start_offset = Math.min(i, start_offset)
                break;
            }
        }

        max_shift = Math.max(shift, max_shift)
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
    date = new Date(date)
    // TODO: Why do I need this?
    date.setDate(date.getDate() + 1)
    for (var i = 0; i < max_shift; i++) {
        date.setDate(date.getDate() + 1)
        future_dates.push((1900 + date.getYear()) + "-" + (1 + date.getMonth()) + "-" + date.getDate())
    }
    for (var trace of traces) {
        trace.y = trace.y.slice(start_offset, trace.y.length)
        trace.x = trace.x.slice(start_offset, trace.x.length).concat(future_dates)
    }

    if (options.scale == scale.LOG) {
        layout.yaxis.type = 'log'
    }
    if (options.daily) {
        layout.yaxis.title += ' (daily '
    } else {
        layout.yaxis.title += ' (cumulative '
    }
    switch (options.data_per) {
        case data_per.ABSOLUTE:
            layout.yaxis.title += 'number)'
            break;
        case data_per.CAPITA:
            layout.yaxis.title += 'per 100,000)'
            title += " per 100,000 People"
            break;
        case data_per.BED:
            layout.yaxis.title += 'per hospital bed)'
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
    switch (options.data_set) {
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
        case data_set.TESTED:
            parts.push("tst")
            break
    }
    switch (options.data_per) {
        case data_per.ABSOLUTE:
            break
        case data_per.CAPITA:
            parts.push("rel")
            break
        case data_per.BED:
            parts.push("bed")
            break
    }
    switch (options.scale) {
        case scale.LINEAR:
            break
        case scale.LOG:
            parts.push("log")
    }
    if (options.daily) {
        parts.push("dly")
    }

    for (var id in options.selected) {
        if (options.selected[id] != 0) {
            parts.push(id + options.selected[id])
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
        } else if (match && match[1] in regions) {
            options.selected[match[1]] = parseInt(match[2]) || 0
        } else if (part == "act") {
            options.data_set = data_set.ACTIVE
        } else if (part == "dth") {
            options.data_set = data_set.DEATHS
        } else if (part == "rec") {
            options.data_set = data_set.RECOVERED
        } else if (part == "tst") {
            options.data_set = data_set.TESTED
        } else if (part == "rel") {
            options.data_per = data_per.CAPITA
        } else if (part == "bed") {
            options.data_per = data_per.BED
        } else if (part == "log") {
            options.scale = scale.LOG
        } else if (part == "dly") {
            options.daily = true
        } else {
            console.log("ERROR: Don't know what to do with " + part + " in URL (" + url.hash + ").")
        }
    }
}

function cleanRegions()
{
    // Make sure that each sequence we have contains every date we have.
    var all_dates = {}
    for (var code in regions) {
        var region = regions[code]
        for (var t in region.data) {
            for (var d in region.data[t]) {
                all_dates[d] = true
            }
        }
    }

    all_dates = Object.keys(all_dates).sort()
    for (var code in regions) {
        var region = regions[code]
        for (var t in region.data) {
            var last = 0
            for (var d of all_dates) {
                if (d in region.data[t]) {
                    last = region.data[t][d]
                } else {
                    region.data[t][d] = last
                }
            }
        }
    }
}

$.get("outbreak.json", function(data) {
    regions = data
    cleanRegions()

    parseUrl()
    updateFocus()
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
        $(".controlgroup").controlgroup()
        $(".controlgroup-vertical").controlgroup({ "direction": "vertical" });
    })
})
