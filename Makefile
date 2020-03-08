all:
	rsync -az . relax.casualhacker.net:/home/tnewsome/www-hugo/static/covid19-spread/ && ssh relax.casualhacker.net make -C www-hugo
