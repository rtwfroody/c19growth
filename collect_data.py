#!/usr/bin/python3

from bs4 import BeautifulSoup
import requests
import csv
import io
import os
import re
from pathlib import Path
import copy
import time
from pprint import pprint
import json
import collections
from bidict import bidict
from numpy.polynomial.polynomial import Polynomial
import numpy as np
import statistics

state_name = {
	'AL': 'Alabama',
	'AK': 'Alaska',
	'AZ': 'Arizona',
	'AR': 'Arkansas',
	'CA': 'California',
	'CO': 'Colorado',
	'CT': 'Connecticut',
	'DE': 'Delaware',
	'FL': 'Florida',
	'GA': 'Georgia',
	'HI': 'Hawaii',
	'ID': 'Idaho',
	'IL': 'Illinois',
	'IN': 'Indiana',
	'IA': 'Iowa',
	'KS': 'Kansas',
	'KY': 'Kentucky',
	'LA': 'Louisiana',
	'ME': 'Maine',
	'MD': 'Maryland',
	'MA': 'Massachusetts',
	'MI': 'Michigan',
	'MN': 'Minnesota',
	'MS': 'Mississippi',
	'MO': 'Missouri',
	'MT': 'Montana',
	'NE': 'Nebraska',
	'NV': 'Nevada',
	'NH': 'New Hampshire',
	'NJ': 'New Jersey',
	'NM': 'New Mexico',
	'NY': 'New York',
	'NC': 'North Carolina',
	'ND': 'North Dakota',
	'OH': 'Ohio',
	'OK': 'Oklahoma',
	'OR': 'Oregon',
	'PA': 'Pennsylvania',
	'RI': 'Rhode Island',
	'SC': 'South Carolina',
	'SD': 'South Dakota',
	'TN': 'Tennessee',
	'TX': 'Texas',
	'UT': 'Utah',
	'VT': 'Vermont',
	'VA': 'Virginia',
	'WA': 'Washington',
	'WV': 'West Virginia',
	'WI': 'Wisconsin',
	'WY': 'Wyoming',
	'AS': 'American Samoa',
	'DC': 'Washington, D.C.',
	'FM': 'Federated States of Micronesia',
	'GU': 'Guam',
	'MH': 'Marshall Islands',
	'MP': 'Northern Mariana Islands',
	'PW': 'Palau',
	'PR': 'Puerto Rico',
	'VI': 'United States Virgin Islands',
}
state_short = {short: lng for lng, short in state_name.items()}

part_code_dict = bidict()
def generate_acronym(word, length):
    if len(word) <= length:
        yield word.upper()
        i = 0
        while True:
            yield(word + str(i)).upper()

    for i in range(len(word) - length):
        if length == 1:
            yield word[i].upper()
        else:
            for tail in generate_acronym(word[i+1:], length - 1):
                yield word[i].upper() + tail

def add_part_code(path, code):
    code = code.upper()
    if len(path) > 2 and path[0] == "World":
        # Skip world and region
        path = path[2:]

    text = "".join(path).lower()
    text = re.sub(r'\W', '', text)
    if text in part_code_dict:
        return part_code_dict[text]

    if text not in part_code_dict and code not in part_code_dict.inverse:
        part_code_dict[text] = code

def make_code(path):
    if len(path) > 2 and path[0] == "World":
        # Skip world and region
        path = path[2:]

    text = "".join(path).lower()
    text = re.sub(r'\W', '', text)
    if text in part_code_dict:
        return part_code_dict[text]

    for code in generate_acronym(text, 5):
        if code not in part_code_dict.inverse:
            part_code_dict[text] = code
            return code
    for suffix in (chr(ord('A')+i) for i in range(0, 26)):
        for code in generate_acronym(text, 4):
            code = code + suffix
            if code not in part_code_dict.inverse:
                part_code_dict[text] = code
                return code
    assert 0, "Couldn't generate code for %r." % text

def read_csv(f, has_header=True, skip=0):
    reader = csv.reader(f)
    for i in range(skip):
        next(reader)
    if has_header:
        header = next(reader)
    else:
        header = None
    data = []
    for row in reader:
        if not header:
            header = range(len(row))
        entry = {'_': row}
        for i, field in enumerate(header):
            assert (i < len(row)), row
            entry[field] = row[i]
        data.append(entry)
    return data

def open_cached(url):
    cache_path = Path(".cache")
    os.makedirs(cache_path, exist_ok=True)

    cache_file = cache_path.joinpath(re.sub(r'.*/', '', url))
    if not cache_file.exists() or \
            time.time() - cache_file.stat().st_mtime > 3540:
        print("Fetching", url, "...")
        r = requests.get(url)
        assert(r.status_code == 200)
        fd = open(cache_file, "w")
        fd.write(r.text)
        fd.close()
    return open(cache_file, "r")

def shorten(country_name):
    table = {
            "United States of America": "United States",
            "United Kingdom of Great Britain and Northern Ireland": "United Kingdom",
            "Iran (Islamic Republic of)": "Iran",
            "Taiwan, Province of China": "Taiwan",
            "Moldova, Republic of": "Moldova",
            "Bolivia (Plurinational State of)": "Bolivia",
            "Korea, Republic of": "South Korea",
            "Venezuela (Bolivarian Republic of)": "Venezuela",
            "Tanzania, United Republic of": "Tanzania"
            }
    return table.get(country_name, country_name)

class Collector(object):
    def __init__(self):
        # Area Of Interest
        self.aoi = {
#            'XKX': {
#                'name': 'Kosovo',
#                'population': 1831000,
#                'hospital_beds': 5269}
        }
        # country -> state -> county -> city
        # At each level there may be _data -> t -> d -> number
        self.area_tree = {}
        self.enable_debug = False
        self.alpha3 = bidict()
        # Contents of all.csv, indexed by countryID, as used in the timeseries data
        self.all = {}

    def add_area(self, path):
        node = self.area_tree
        partial = []
        for part in path:
            # Create a new list
            partial = partial + [part]
            code = make_code(partial)

            node = node.setdefault(part,
                    { '_path': partial, '_code': code })

            self.aoi.setdefault(code, {})
            self.aoi[code]['path'] = partial
        return node

    def debug(self, *args):
        if self.enable_debug:
            print(*args)

    def tally_data(self, node, t, d, depth=0):
        data = node.get('_data', {})
        if t in data and d in data[t]:
            return data[t][d]
        values = []
        for child in node:
            if child.startswith('_'):
                continue
            v = self.tally_data(node[child], t, d, depth + 1)
            if not v is None:
                values.append(v)
        if len(values) > 0:
            return sum(values)
        else:
            return None

    def tally_population(self, node, depth=0):
        population = node.get('_population')
        if population:
            return population
        population = 0
        for child in node:
            if child.startswith('_'):
                continue
            population += self.tally_population(node[child], depth + 1)
        return population

    def get_node(self, path):
        node = self.area_tree
        for part in path:
            node = node[part]
        return node

    def squash_unlikely_values(self, node, data_key):
        # Convert unlikely data values to None
        lookaround = 5

        if not data_key in node:
            return

        for t in node[data_key]:
            dates = sorted(node[data_key][t].keys())
            values = [node[data_key][t][d] for d in dates]
            tolerance = 1
            for i, date in enumerate(dates):
                value = values[i]
                if value is None:
                    continue
                previous = [v for v in values[max(0, i-lookaround):i]
                            if not v is None]
                if len(previous) > 1:
                    previous_median = statistics.median(previous)
                else:
                    previous_median = None
                following = [v for v in values[i+1:i+2+lookaround]
                            if not v is None]
                if len(following) > 1:
                    following_median = statistics.median(following)
                else:
                    following_median = None
                if (previous_median and value < previous_median - tolerance) or \
                        (previous_median and following_median and
                         previous_median < following_median and
                         value > following_median + tolerance):
#                context = previous + following
#                if len(context) > 3:
#                    average = sum(context) / len(context)
#                    stddev = statistics.stdev(context)
#                    if value > average + (stddev + 1) * 3 or \
#                            value < average - (stddev + 1) * 3:
                    path = node.get('path', node.get('_path'))
                    print("Squash %r %s in %s (%s) on %s (%r)" % (
                        value, t, path[-1], node.get('_locationID'), date,
                        previous + [value] + following))
                    node[data_key][t][date] = None

    def timeseries(self):
        world_name = "World"
        allDates = set()

        data = json.load(open_cached(
            "https://liproduction-reportsbucket-bhk8fnhv1s76.s3-us-west-1.amazonaws.com/v1/latest/timeseries-byLocation.json"))
        for entry in data:
            if "(unassigned)" in entry['locationID']:
                # Unassigned cases are ones that we know that happened in e.g.
                # a state, but we don't know in which county they occurred.
                # I'm ignoring them because they are rare, and included in the
                # state count (in this case) regardless.
                continue

            path = [world_name,
                    self.all.get(entry['countryID'], {'region': 'Unknown'})['region']]
            for part in ('countryName', 'stateName', 'countyName'):
                if part in entry:
                    path.append(entry[part])

            if "(unassigned)" in entry['locationID']:
                path[-1] += " (unassigned)"

            code = None
            for part in entry['locationID'].split("#"):
                if ":" in part:
                    encoding, c = part.split(":")
                    if encoding.startswith('iso'):
                        code = c
            if code:
                if "(unassigned)" in entry['locationID']:
                    code += "-u"
                add_part_code(path, code)
            node = self.add_area(path)

            try:
                node['_population'] = int(entry['population'])
            except ValueError:
                pass

            node['_locationID'] = entry['locationID']
            aoi = self.aoi[node['_code']]
            aoi["level"] = entry["level"]

            aoi.setdefault('data', {})
            for date in entry['dates']:
                allDates.add(date)
                for t in ('cases', 'deaths', 'recovered', 'tested'):
                    if t in entry['dates'][date]:
                        try:
                            node.setdefault('_data', {}) \
                                    .setdefault(t, {})[date] = int(entry['dates'][date][t])
                        except ValueError:
                            pass

                    # Mark this as one we need to fill in later.
                    aoi['data'].setdefault(t, {})[date] = None
            self.squash_unlikely_values(node, '_data')

        allDates = sorted(list(allDates))

        # Now do a second pass, filling in missing data by summing up all the child nodes.
        for aoi in self.aoi.values():
            if len(aoi['path']) > 3:
                aoi['fullName'] = ", ".join(aoi['path'][-3:])
            else:
                aoi['fullName'] = ", ".join(aoi['path'])
            aoi['name'] = aoi['path'][-1]

            node = self.get_node(aoi['path'])
            population = self.tally_population(node)
            if population:
                aoi['population'] = population
            for t in ('cases', 'deaths', 'recovered', 'tested'):
                started = False
                for d in allDates:
                    value = self.tally_data(node, t, d)
                    if value:
                        started = True
                    if started:
                        aoi.setdefault('data', {}).setdefault(t, {})[d] = value
            self.squash_unlikely_values(aoi, 'data')

        # Do another pass, translating date->value hashes into lists with a
        # value for each date.
        # TODO: we assume that allDates is contiguous
        for aoi in self.aoi.values():
            for t in list(aoi['data'].keys()):
                sequence = []
                started = False
                startDate = None
                endDate = max(aoi['data'][t].keys())
                # Hide runs of None at the end
                noneRun = 0
                for d in allDates:
                    if aoi['data'][t].get(d):
                        started = True
                        if startDate is None:
                            startDate = d
                    if started and d <= endDate:
                        value = aoi['data'][t].get(d)
                        if value is None:
                            noneRun += 1
                        else:
                            sequence += [None] * noneRun
                            noneRun = 0
                            sequence.append(value)
                if sequence:
                    aoi['data'][t] = sequence
                    aoi['data'][t + "-start"] = startDate
                else:
                    del aoi['data'][t]

    def save_data(self, path):
        json.dump(self.aoi, open(path, "w"))

    def all_csv(self):
        for entry in read_csv(open("data/all.csv")):
            self.alpha3[entry['alpha-3']] = shorten(entry['name'])
            self.all['iso1:' + entry['alpha-2']] = entry

    def population(self):
        for entry in read_csv(open("data/API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv"), skip=4):
            code = entry['Country Code']
            if code not in self.aoi:
                continue
            for year in range(2020, 2000, -1):
                if entry.get(str(year)):
                    population = int(entry[str(year)])
                    break
            else:
                print("No population info for", entry['Country Name'])
                continue
            if not self.aoi[code].get('population'):
                self.aoi[code]['population'] = population

    def hospital_beds(self):
        for entry in read_csv(open("data/API_SH.MED.BEDS.ZS_DS2_en_csv_v2_821439.csv"), skip=4):
            code = entry['Country Code']
            if code not in self.aoi or 'hospital_beds' in self.aoi[code]:
                continue
            for year in range(2020, 2000, -1):
                if entry.get(str(year)):
                    bed_fraction = float(entry[str(year)])
                    break
            else:
                print("No hospital bed info for", entry['Country Name'])
                continue
            self.aoi[code]['hospital_beds'] = int(bed_fraction * self.aoi[code]['population'])

    def state_hospital_beds(self):
        soup = BeautifulSoup(open("data/state_statistics.html").read(), 'html.parser')
        divs = soup.find_all("div")
        div = [d for d in divs if d.get('class')==['report']][0]
        for tr in div.find_all('tr'):
            td = tr.find_all('td')
            if not td:
                continue
            if td[0].a and re.match(r'[A-Z]{2} - ', td[0].a.text):
                state = td[0].a.text[:2]
                code = "US-" + state
                if code not in self.aoi:
                    continue
                hospital_beds = int(td[2].text.replace(",", ""))
                self.aoi[code]['hospital_beds'] = hospital_beds

    def measure(self):
        """Compute some metrics that give an idea of how well each area is doing."""
        for aoi in self.aoi.values():
            if 'population' not in aoi:
                print("No population info for", aoi['name'])
                continue
            if 'cases' not in aoi['data']:
                print("No cases for", aoi['name'])
                continue
            if len(aoi['data']['cases']) < 2:
                print("Insufficient cases for", aoi['name'])
                continue
            distance = []
            pop = aoi['population']
            distance = [(v or 0)/pop for v in aoi['data']['cases']]

            window = min(14, len(distance))

            polynomial = Polynomial.fit(range(window), distance[-window:],
                                        min(3, window))
            coefficients = list(polynomial.convert().coef[1:])
            # If the trailing coefficients are 0, they're not included in coef.
            # Add them back.
            while len(coefficients) < 3:
                coefficients.append(0)

            aoi['velocity'] = coefficients[0]
            aoi['acceleration'] = coefficients[1]
            aoi['jerk'] = coefficients[2]

    def build(self):
        self.all_csv()
        self.timeseries()
        self.population()
        self.hospital_beds()
        self.state_hospital_beds()
        self.measure()

def main(args):
    from argparse import ArgumentParser
    parser = ArgumentParser()
    parser.add_argument("--output", "-o")
    args = parser.parse_args(args)

    c = Collector()
    c.build()
    c.save_data(args.output or "outbreak.json")

if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
