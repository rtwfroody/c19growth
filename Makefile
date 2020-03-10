PUBLISH=\
	index.html \
	growth.css \
	regions.csv \
	node_modules

all:	regions.csv

publish:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/covid19/ && ssh relax.casualhacker.net make -C www-hugo

regions.csv:	data/*
	python3 simplify_population.py
