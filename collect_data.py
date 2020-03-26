#!/usr/bin/python3

from bs4 import BeautifulSoup
import requests
import csv
import io
import os
import re
from pathlib import Path
import numpy as np
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
        self.aoi = {}
        # country -> state -> county -> city
        # At each level there may be _data -> t -> d -> number
        self.area_tree = {}

    def add_area(self, country, state, county, city):
        root = self.area_tree
        for part in (country, state, county, city):
            if not part:
                break
            root = root.setdefault(part, {})

    def tally(self, node, t, d):
        data = node.get('_data', {})
        if t in data and d in data[t]:
            return data[t][d]
        value = 0
        for child in node:
            if child.startswith('_'):
                continue
            value += self.tally(node[child], t, d)
        return value

    def get_node(self, path):
        node = self.area_tree
        for part in path:
            if not part:
                break
            node = node[part]
        return node

    def timeseries(self):
        for entry in read_csv(open_cached("https://coronadatascraper.com/timeseries.csv")):
            self.add_area(entry['country'], entry['state'], entry['county'], entry['city'])
            path = (entry['country'], entry['state'], entry['county'], entry['city'])
            node = self.get_node(path)
            if entry['country'] == 'USA' and entry['state']:
                codes = [("US-" + entry['state'], 2)]
            else:
                codes = [(entry['country'], 1)]
            for code, depth in codes:
                self.aoi.setdefault(code, {})
                self.aoi[code]['path'] = path[:depth]

                # If pure is true, then this row contains data for exactly what
                # we want, and it's not just data for a smaller region that
                # maybe we have to sum up.
                pure = len("".join(path[depth:])) == 0

                if pure:
                    try:
                        self.aoi[code]['population'] = int(entry['population'])
                    except ValueError:
                        pass

                self.aoi[code].setdefault('data', {})
                for t in ('cases', 'deaths', 'recovered', 'active'):

                    try:
                        node.setdefault('_data', {}).setdefault(t, {})[entry['date']] = int(entry[t])
                    except ValueError:
                        pass

                    if pure:
                        try:
                            self.aoi[code]['data'].setdefault(t, {})[entry['date']] = int(entry[t])
                        except ValueError:
                            pass
                    else:
                        # Mark this as one we need to fill in later.
                        self.aoi[code]['data'].setdefault(t, {})[entry['date']] = None

        # Now do a second pass, filling in missing data by summing up all the child nodes.
        for code in self.aoi:
            self.aoi[code]['name'] = self.aoi[code]['path'][-1]
            if code.startswith('US-'):
                self.aoi[code]['region'] = "US State"
            for t in self.aoi[code]['data']:
                for d in self.aoi[code]['data'][t]:
                    if self.aoi[code]['data'][t][d] is None:
                        node = self.get_node(self.aoi[code]['path'])
                        self.aoi[code]['data'][t][d] = self.tally(node, t, d)

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
            if code not in self.aoi:
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

    def build(self):
        self.timeseries()
        self.all_csv()
        self.population()
        self.hospital_beds()
        self.state_hospital_beds()

def main(args):
    from argparse import ArgumentParser
    parser = ArgumentParser()
    args = parser.parse_args(args)

    c = Collector()
    c.build()
    c.save_data("outbreak.json")

if __name__ == "__main__":
    import sys
    sys.exit(main(sys.argv[1:]))
