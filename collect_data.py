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

def make_code(path):
    if len(path) > 2 and path[0] == "World":
        # Skip world and region
        path = path[2:]

    if path[0] == 'USA' and len(path) == 2:
        # For backwards compatiblity with old URLs.
        return "US-" + state_short[path[1]]

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
        # Contents of all.csv, indexed by alpha-3.
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
        value = 0
        for child in node:
            if child.startswith('_'):
                continue
            value += self.tally_data(node[child], t, d, depth + 1)
        return value

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

    def timeseries(self):
        world_name = "World"
        allDates = set()

        for entry in read_csv(open_cached("https://coronadatascraper.com/timeseries.csv")):
            translate_country = {
                'United States': 'USA'
            }
            entry['country'] = translate_country.get(entry['country'], entry['country'])
            entry['country'] = self.alpha3.inverse.get(entry['country'], entry['country'])
            path = (world_name,
                    self.all.get(entry['country'], {'region':'Unknown'})['region'],
                    entry['country'],
                    entry['state'],
                    entry['county'],
                    entry['city'])
            path = [p for p in path if len(p)]
            node = self.add_area(path)

            try:
                node['_population'] = int(entry['population'])
            except ValueError:
                pass

            aoi = self.aoi[node['_code']]
            aoi.setdefault('data', {})
            for t in ('cases', 'deaths', 'recovered', 'tested'):
                if len(entry[t]):
                    allDates.add(entry['date'])
                    try:
                        node.setdefault('_data', {}) \
                                .setdefault(t, {})[entry['date']] = int(entry[t])
                    except ValueError:
                        pass

                # Mark this as one we need to fill in later.
                aoi['data'].setdefault(t, {})[entry['date']] = None

        allDates = sorted(list(allDates))

        # Now do a second pass, filling in missing data by summing up all the child nodes.
        for code, aoi in self.aoi.items():
            if 'name' not in self.aoi[code]:
                aoi['name'] = aoi['path'][-1]
            if len(aoi['path']) > 2:
                aoi['fullName'] = ", ".join(
                    [self.alpha3.get(aoi['path'][2], aoi['path'][2])] +
                    aoi['path'][3:])
            else:
                aoi['fullName'] = ", ".join(aoi['path'])
            if code.startswith('US-'):
                aoi['name'] = state_name.get(aoi['path'][-1], aoi['path'][-1])
            else:
                aoi['name'] = self.alpha3.get(aoi['path'][-1], aoi['path'][-1])
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

        # Do another pass, translating date->value hashes into lists with a
        # value for each date.
        # TODO: we assume that allDates is contiguous
        for code, aoi in self.aoi.items():
            for t in list(aoi['data'].keys()):
                sequence = []
                started = False
                for d in allDates:
                    if not started and aoi['data'][t].get(d):
                        started = True
                        aoi['data'][t + "-start"] = d
                    if started:
                        sequence.append(aoi['data'][t].get(d))
                if sequence:
                    aoi['data'][t] = sequence
                else:
                    del aoi['data'][t]

    def save_data(self, path):
        json.dump(self.aoi, open(path, "w"))

    def all_csv(self):
        for entry in read_csv(open("data/all.csv")):
            self.alpha3[entry['alpha-3']] = shorten(entry['name'])
            self.all[entry['alpha-3']] = entry

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

            window = min(7, len(distance))

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
