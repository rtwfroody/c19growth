#!/usr/bin/python3

import csv

started = False
# From https://data.worldbank.org/indicator/SP.POP.TOTL
writer = csv.writer(open("population.csv", "w"))
for row in csv.reader(open("API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv")):
    if row and row[0] == "Country Name":
        started = True
        continue
    elif not started:
        continue
    country = row[0]
    while (not row[-1]):
        row.pop()
    population = row[-1]
    print(country, population)
    try:
        writer.writerow([country, int(population)])
    except ValueError:
        # Couldn't convert population to int, so skip that entry.
        pass
