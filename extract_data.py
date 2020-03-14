#!/usr/bin/python3

import csv

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
        entry = {}
        for i, field in enumerate(header):
            entry[field] = row[i]
        data.append(entry)
    return data

state_abbreviation = {
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

us_regions = {
        'US Northeast': ('CT', 'ME', 'MA', 'RI', 'VT', 'NJ', 'NY', 'PA', 'DE',
            'MD', 'DC', 'NH'),
        'US Midwest': ('IA', 'KS', 'MO', 'NE', 'ND', 'SD', 'IL', 'IN', 'MI', 'MN',
            'OH', 'WI'),
        'US South': ('AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK',
            'SC', 'TN', 'TX', 'VA', 'WV'),
        'US West': ('AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR',
            'UT', 'WA', 'WY')
        }

def region_for_state(abbrev):
    for region, states in us_regions.items():
        if abbrev in states:
            return region

class Regions(object):
    def __init__(self):
        self.data = {}

    def add(self, code=None, name=None, group=None, subgroup=None, population=None,
            hospital_beds=None):
        entry = self.data.get(code) or {}
        if not entry.get('code') and code:
            entry['code'] = code
        if not entry.get('name') and name:
            entry['name'] = name
        if not entry.get('group') and group:
            entry['group'] = group
        if not entry.get('subgroup') and subgroup:
            entry['subgroup'] = subgroup
        if not entry.get('population') and population:
            entry['population'] = population
        if not entry.get('hospital_beds') and hospital_beds:
            entry['hospital_beds'] = hospital_beds
        self.data[entry['code']] = entry

    def save(self, path):
        writer = csv.writer(open(path, 'w'))
        for entry in sorted(self.data.values(), key=lambda v: v['name']):
            total_beds = None
            if isinstance(entry.get('hospital_beds'), float) and \
                    isinstance(entry.get('population'), int):
                total_beds = round(entry.get('hospital_beds') * entry.get('population') / 1000)
            writer.writerow([entry['code'], entry['name'], entry['group'],
                    entry.get('subgroup', "other"), entry.get('population'),
                    total_beds])

def main():
    regions = Regions()
    for entry in read_csv(open("data/all.csv")):
        regions.add(
                code=entry['alpha-3'],
                group='country',
                subgroup=entry['region'],
                name=entry['name'])

    for entry in read_csv(open("data/API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv"), skip=4):
        for year in range(2020, 2000, -1):
            if entry.get(str(year)):
                population = int(entry[str(year)])
                break
        else:
            print("No population info for", entry['Country Name'])
            continue
        regions.add(group='country',
                name=entry['Country Name'],
                code=entry['Country Code'],
                population=population)

    for entry in read_csv(open("data/API_SH.MED.BEDS.ZS_DS2_en_csv_v2_821439.csv"), skip=4):
        for year in range(2020, 2000, -1):
            if entry.get(str(year)):
                beds = float(entry[str(year)])
                break
        else:
            print("No hospital bed info for", entry['Country Name'])
            continue
        regions.add(group='country',
                name=entry['Country Name'],
                code=entry['Country Code'],
                hospital_beds=beds)

    started = False
    import xlrd
    workbook = xlrd.open_workbook("data/nst-est2019-01.xlsx")
    sheet = workbook.sheet_by_index(0)
    for i in range(sheet.nrows):
        row = sheet.row(i)
        if row[0].value == '.Alabama':
            started = True
        if not started:
            continue
        if not row[0].value:
            break
        name = row[0].value
        while name.startswith("."):
            name = name[1:]
        code = "US-" + state_abbreviation[name]
        population = int(row[-1].value)
        regions.add(
                group="us_state",
                subgroup=region_for_state(state_abbreviation[name]),
                name=state_abbreviation[name],
                code=code,
                population=population)

    # Some CIA World Fact Book, some Wikipedia
    regions.add(code="TWN", population=23603049)
    regions.add(code="BLM", population=7122)
    #writer.writerow(["country", "Saint Barthelemy", "TB", 7122])
    #writer.writerow(["country", "St. Martin", "RN", 32556])
    regions.add(code="BRN", population=464478)
    #writer.writerow(["country", "Brunei", "BX", 464478])
    regions.add(code="PSE", population=5051953)
    #writer.writerow(["country", "Palestine", "PSE", 5051953])

    regions.save("regions.csv")

main()
