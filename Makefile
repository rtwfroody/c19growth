PUBLISH=\
	index.html \
	growth.css \
	growth.js \
	regions.csv \
	node_modules \
	wide.css \
	jquery-ui-1.12.1.custom \
	Antu_task-reject.svg

all:	regions.csv

publish:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/covid19/ && \
	    ssh relax.casualhacker.net make -C www-hugo

c19:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/c19/ && \
	    ssh relax.casualhacker.net make -C www-hugo

regions.csv:	data/*
	python3 simplify_population.py
