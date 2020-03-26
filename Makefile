PUBLISH=\
	index.html \
	growth.css \
	growth.js \
	node_modules \
	wide.css \
	jquery-ui-1.12.1.custom \
	Antu_task-reject.svg \
	outbreak.json \
	collect_data.py \
	data

all:	outbreak.json

push:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/covid19/

publish:	push
	ssh relax.casualhacker.net make -C www-hugo

c19:	all
	rsync --progress -az $(PUBLISH) relax.casualhacker.net:/home/tnewsome/www-hugo/content/c19/ && \
	ssh relax.casualhacker.net make -C www-hugo

outbreak.json:	data/*
	python3 collect_data.py
