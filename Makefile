PUBLISH=\
	build/ \
	collect_data.py \
	data

dobuild:
	npm run build

docollect:
	python3 collect_data.py -o public/outbreak.json

push:	dobuild docollect
	rsync --progress -az --delete \
	    $(PUBLISH) \
	    relax.casualhacker.net:/home/tnewsome/www-hugo/static/covid19/

publish:	push
	ssh relax.casualhacker.net make -C www-hugo

c19:	dobuild outbreak.json
	rsync --progress -az --delete \
	    $(PUBLISH) \
	    relax.casualhacker.net:/home/tnewsome/www-hugo/content/c19/ && \
	ssh relax.casualhacker.net make -C www-hugo

outbreak.json:	data/*
	python3 collect_data.py
