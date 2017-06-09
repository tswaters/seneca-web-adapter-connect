'use strict'

const _ = require('lodash')
const QueryString = require('querystring')
const URL = require('url')
const ReadBody = require('./read-body')

module.exports = function connect (options, context, auth, routes, done) {
  const seneca = this

  if (!context) {
    return done(new Error('no context provided'))
  }

  const logger = seneca.log.hasOwnProperty(options.loglevel)
    ? seneca.log[options.loglevel]
    : () => {}

  _.each(routes, (route) => {
    logger(`Mounting ${route.methods.join(', ')}: ${route.path}`)

    context.use(route.path, (request, reply, next) => {
      // Connect does not work with http verbs
      if (route.methods.indexOf(request.method) !== -1) {
        // if parsing body, call into ReadBody otherwise just finish.
        if (options.parseBody) { return ReadBody(request, finish) }
        finish(null, request.body || {})
      }

      function finish (err, body) {
        if (err) {
          return next(err)
        }

        var payload = {
          request$: request,
          response$: reply,
          args: {
            body: body,
            route: route,
            query: QueryString.parse(URL.parse(request.originalUrl).query)
          }
        }
        seneca.act(route.pattern, payload, (err, response) => {
          if (err) {
            return next(err)
          }
          if (route.autoreply) {
            reply.writeHead(200, {'Content-Type': 'application/json'})
            reply.end(JSON.stringify(response))
          }
        })
      }
    })
  })
  return done(null, {routes: routes})
}
