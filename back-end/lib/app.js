
const db = require('./db')
const express = require('express')
const cors = require('cors')
const {authenticator, userLoader} = require('./authenticator')

const app = express()
const authenticate = authenticator({
  test_payload_email: process.env['TEST_PAYLOAD_EMAIL'],
  jwks_uri: 'http://127.0.0.1:5556/dex/keys'
})
const loadUser = userLoader({test_payload_email: process.env['TEST_PAYLOAD_EMAIL']})


app.use(require('body-parser').json())
app.use(cors())

app.all('*', authenticate, loadUser)

// Channels

app.get('/channels', async (req, res) => {
  const channels = await db.channels.list()
  res.json(channels)
})

app.post('/channels', async (req, res) => {
  const channel = await db.channels.create(req.body)
  res.status(201).json(channel)
})

app.get('/channels/:id', async (req, res) => {
  const channel = await db.channels.get(req.params.id)
  res.json(channel)
})

app.put('/channels/:id', async (req, res) => {
  const channel = await db.channels.update(req.body)
  res.json(channel)
})

// Messages

app.get('/channels/:id/messages', async (req, res) => {
  try{
    const channel = await db.channels.get(req.params.id)
  }catch(err){
    return res.status(404).send('Channel does not exist.')
  }
  const messages = await db.messages.list(req.params.id)
  res.json(messages)
})

app.post('/channels/:id/messages', async (req, res) => {
  const message = await db.messages.create(req.params.id, req.body)
  res.status(201).json(message)
})

// Users
app.get('/signin', async (req, res) => {
  const user = await db.users.signin(req.user.email)
  if(!user)
  {
    req.body = {username: Date.now()}
    return app.post('/users',req)
  }
  res.json(user)
})

app.get('/users', async (req, res) => {
  const users = await db.users.list()
  res.json(users)
})

app.post('/users', async (req, res) => {
  const user = await db.users.create(req.body,req.user.email)
  res.status(201).json(user)
})

app.get('/users/:id', async (req, res) => {
  const user = await db.users.get(req.params.id)
  res.json(user)
})

app.put('/users/:id', async (req, res) => {
  const user = await db.users.update(req.body)
  res.json(user)
})

module.exports = app
