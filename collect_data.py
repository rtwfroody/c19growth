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
	'DC': 'District of Columbia',
	'FM': 'Federated States of Micronesia',
	'GU': 'Guam',
	'MH': 'Marshall Islands',
	'MP': 'Northern Mariana Islands',
	'PW': 'Palau',
	'PR': 'Puerto Rico',
	'VI': 'Virgin Islands',
}
state_short = {short: lng for lng, short in state_name.items()}

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
            'XKX': {
                'name': 'Kosovo',
                'region': 'Europe',
                'population': 1831000,
                'hospital_beds': 5269}
        }
        # country -> state -> county -> city
        # At each level there may be _data -> t -> d -> number
        self.area_tree = {}
        self.enable_debug = False

    def add_area(self, path):
        root = self.area_tree
        for part in path:
            root = root.setdefault(part, {'_path': path})

    def debug(self, *args):
        if self.enable_debug:
            print(*args)

    def tally(self, node, t, d, depth=0):
        data = node.get('_data', {})
        if t in data and d in data[t]:
            return data[t][d]
        value = 0
        for child in node:
            if child.startswith('_'):
                continue
            value += self.tally(node[child], t, d, depth + 1)
        return value

    def get_node(self, path):
        node = self.area_tree
        for part in path:
            node = node[part]
        return node

    def timeseries(self):
        for entry in read_csv(open_cached("https://coronadatascraper.com/timeseries.csv")):
            path = (entry['country'], entry['state'], entry['county'], entry['city'])
            path = [p for p in path if len(p)]
            self.add_area(path)
            translate_country = {
                'United States': 'USA'
            }
            entry['country'] = translate_country.get(entry['country'], entry['country'])
            if entry['country'] == 'USA' and entry['state']:
                code = "US-" + state_short.get(entry['state'], entry['state'])
                depth = 2
            else:
                code = entry['country']
                depth = 1

            node = self.get_node(path)

            self.aoi.setdefault(code, {})
            self.aoi[code]['path'] = path[:depth]

            # If pure is true, then this row contains data for exactly what
            # we want, and it's not just data for a smaller region that
            # maybe we have to sum up.
            pure = (len(path) == depth)

            if pure:
                try:
                    self.aoi[code]['population'] = int(entry['population'])
                except ValueError:
                    pass

            self.aoi[code].setdefault('data', {})
            for t in ('cases', 'deaths', 'recovered', 'tested'):
                if len(entry[t]):
                    try:
                        node.setdefault('_data', {}).setdefault(t, {})[entry['date']] = int(entry[t])
                    except ValueError:
                        pass

                    # Mark this as one we need to fill in later.
                    self.aoi[code]['data'].setdefault(t, {})[entry['date']] = None

        # Now do a second pass, filling in missing data by summing up all the child nodes.
        for code, aoi in self.aoi.items():
            if 'name' not in self.aoi[code]:
                aoi['name'] = aoi['path'][-1]
            if code.startswith('US-'):
                aoi['region'] = "US State"
                aoi['name'] = state_name.get(aoi['path'][-1], aoi['path'][-1])
            for t in aoi['data']:
                for d in aoi['data'][t]:
                    if aoi['data'][t][d] is None:
                        node = self.get_node(aoi['path'])
                        aoi['data'][t][d] = self.tally(node, t, d)

    def save_data(self, path):
        json.dump(self.aoi, open(path, "w"))

    def all_csv(self):
        for entry in read_csv(open("data/all.csv")):
            code = entry['alpha-3']
            if code not in self.aoi:
                continue
            self.aoi[code]['region'] = entry['region']
            self.aoi[code]['name'] = shorten(entry['name'])

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
        window = 4
        for aoi in self.aoi.values():
            if 'population' not in aoi:
                print("No population info for", aoi['name'])
                continue
            if 'cases' not in aoi['data']:
                print("No cases for", aoi['name'])
                continue
            distance = []
            size = 4
            values = [v for k, v in sorted(aoi['data']['cases'].items())]
            pop = aoi['population']
            for i in range(size):
                if i == 0:
                    distance.insert(0, sum(values[-window:]) / window / pop)
                else:
                    distance.insert(0, sum(values[-window * (i+1):-window * i]) / window / pop)
            velocity = []
            for i in range(len(distance)-1):
                velocity.append(distance[i + 1] - distance[i])
            acceleration = []
            for i in range(len(velocity)-1):
                acceleration.append(velocity[i + 1] - velocity[i])
            jerk = []
            for i in range(len(acceleration)-1):
                jerk.append(acceleration[i + 1] - acceleration[i])

            aoi['velocity'] = velocity[-1]
            aoi['acceleration'] = acceleration[-1]
            aoi['jerk'] = jerk[-1]

    def build(self):
        self.timeseries()
        self.all_csv()
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
