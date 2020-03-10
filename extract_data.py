#!/usr/bin/python3

import csv

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

started = False
writer = csv.writer(open("regions.csv", "w"))
writer.writerow(("Group", "Name", "Code", "Population"))
# From https://data.worldbank.org/indicator/SP.POP.TOTL
for row in csv.reader(open("data/API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv")):
    if row and row[0] == "Country Name":
        started = True
        continue
    elif not started:
        continue
    country = row[0]
    code = row[1]
    while (not row[-1]):
        row.pop()
    population = row[-1]
    try:
        writer.writerow(["country", country, code, int(population)])
    except ValueError:
        # Couldn't convert population to int, so skip that entry.
        pass

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
    writer.writerow(["us_state", state_abbreviation[name], code, population])

# Some CIA World Fact Book, some Wikipedia
writer.writerow(["country", "Taiwan", "TW", 23603049])
writer.writerow(["country", "Saint Barthelemy", "TB", 7122])
writer.writerow(["country", "St. Martin", "RN", 32556])
writer.writerow(["country", "Brunei", "BX", 464478])
writer.writerow(["country", "Palestine", "PSE", 5051953])
