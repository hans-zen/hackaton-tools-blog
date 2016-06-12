var express = require('express'),
	Paperpress = require('paperpress'),
	logger = require('morgan'),
	swig = require('swig'),
	utils = require('./lib/utils'),
	_ = require('underscore')

var feedDescription = require('./feed-description')

var server = express();

server.use(logger(':status :req[x-real-ip] :method :response-time ms :url'));

server.engine('html', swig.renderFile);
server.set('view engine', 'html');
server.set('views', __dirname + '/views');
server.set('view cache', false);
swig.setDefaults({ cache: false });

var blog = new Paperpress({});

blog.addHook(function(item){
	item.prettyDate = utils.prettyDate(item.date, item)
	item.slug = item.slug.toLowerCase()
})

blog.load()

blog.items.forEach(function(item){
	console.log('=>', item.type, item.path)
})

server.use(express.static('public'))

server.get('', function (req, res) {
	var articles = blog.getCollection('articles')

	res.render('multiple',{
		articles: articles
	})
})

server.get('/about', function(req, res) {
	var article = _.findWhere(blog.items,{type:'pages', slug:'about'})

	res.render('single',{
		article: article
	})
})

server.get('/articles/:article', function (req, res) {
	if(req.path !== req.path.toLowerCase()){
		return res.redirect( 301, req.path.toLowerCase() )
	}

	var articles = blog.getCollection('articles')
	var article = _.findWhere(articles,{path:req.path})

	if(!article){
		res.status(404)
		return res.render('404')
	}

	var relatedLinks = blog.items.filter(function(item){
		return item.type === 'related-notes' && item.parent === article.path
	})

	res.render('single',{
		article: article,
		relatedLinks: relatedLinks
	})
})

server.get('/feed', function (req, res) {
	res.redirect('/rss')
})

server.get('/rss', function (req, res) {
	// res.send('hi')
	var articles = blog.getCollections(['articles', 'bubbles'])
	articles.forEach((item)=>{
		item.link = item.suggestedPath
	})

	var feed = Paperpress.helpers.createFeed(feedDescription, articles)

	res.set('Content-Type', 'text/xml');
	res.send(feed.render('rss-2.0'));	
})

server.get('/sitemap.xml', function (req, res) {
	// res.send('hi')
	var urls = blog.getCollections(['articles', 'bubbles', 'pages'])

	urls.push({path:'/blog'})

	var sitemap = Paperpress.helpers.createSiteMap(feedDescription, urls)

	res.set('Content-Type', 'text/xml');
	res.send(sitemap);
})

server.get('*', function(req, res){
	// respond with html page
	if (req.accepts('html')) {
		return res.render('404', { url: req.url });
	}

	// respond with json
	if (req.accepts('json')) {
		return res.send({ error: 'Not found' });
	}

	// default to plain-text. send()
	res.type('txt').send('Not found');
});

var webhook = require('./webhook')

server.get('/webhook',webhook(blog))
server.post('/webhook',webhook(blog))

var port = process.env.PORT || 3000
server.listen(port)
console.log('Server running at http://localhost:'+port, new Date() )