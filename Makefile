PUBLISH=\
	index.html \
	growth.css \
	growth.js \
	regions.csv \
	node_modules \
	wide.css

all:	regions.csv

publish:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/covid19/ && ssh relax.casualhacker.net make -C www-hugo

regions.csv:	data/*
	python3 simplify_population.py
