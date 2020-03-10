PUBLISH=\
	index.html \
	growth.css \
	population.csv \
	node_modules

all:	population.csv

publish:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/covid19/ && ssh relax.casualhacker.net make -C www-hugo

population.csv:	API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv
	python3 simplify_population.py
