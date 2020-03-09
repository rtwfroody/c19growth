all:	population.csv

publish:	all
	rsync -az . relax.casualhacker.net:/home/tnewsome/www-hugo/static/covid19-spread/ && ssh relax.casualhacker.net make -C www-hugo

population.csv:	API_SP.POP.TOTL_DS2_en_csv_v2_821007.csv
	python3 simplify_population.py
