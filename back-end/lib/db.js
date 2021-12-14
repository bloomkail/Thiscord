
const {v4: uuid} = require('uuid')
const {clone, merge} = require('mixme')
const microtime = require('microtime')
const level = require('level')
const db = level(__dirname + '/../db')

module.exports = {
  channels: {
    create: async (channel, user) => {
      if(!channel.name) throw Error('Invalid channel')
      if(!channel.members) throw Error('Missing members array')
      if(!user.id) throw Error('Unkwown user')
      const id = uuid()
      await db.put(`channels:${id}`, JSON.stringify(channel))
      for(var i = 0; i < channel.members.length; i++)
      {
        try{
          const member = await module.exports.users.get(channel.members[i])
          member.channels.push(id)
          await module.exports.users.update(channel.members[i],member)
        }
        catch(e){
          channel.members.splice(i,1)
        }
      }
      return merge(channel, {id: id})
    },
    get: async (id, user) => {
      if(!id) throw Error('Invalid id')
      if(!user.id) throw Error('Unkwown user')
      const data = await db.get(`channels:${id}`)
      const channel = JSON.parse(data)
      if(!channel.members.includes(user.id)) throw Error('Unauthorized access')
      return merge(channel, {id: id})
    },
    list: async (user) => {
      if(!user.id) throw Error('Unkwown user')
      const member = await module.exports.users.get(user.id)
      const filteredChannels = [];
      for(channelid of member.channels){
        const channel = await module.exports.channels.get(channelid,user)
        filteredChannels.push(channel)
      }
      return filteredChannels;
    },
    update: async (id, channel, user) => {
      const original = await module.exports.channels.get(id, user)
      if(!original) throw Error('Unregistered channel id')
      delete channel['id']
      //remove the channel from users who are not in it anymore
      const membersToRemove = original.members.filter(e => !channel.members.includes(e))
      for(const userid of membersToRemove)
      {
        try{
          const member = await module.exports.users.get(userid)
          member.channels.splice(member.channels.findIndex(e => e === id),1)
          await module.exports.users.update(userid,member)
        }
        catch(e){
        }
      }
      //add the channel to new members
      const membersToAdd = channel.members.filter(e => !original.members.includes(e))
      for(const userid of membersToAdd)
      {
        try{
          const member = await module.exports.users.get(userid)
          member.channels.push(id)
          await module.exports.users.update(userid,member)
        }
        catch(e){
          channel.members.splice(channel.members.findIndex(e => e === userid),1)
        }
      }
      await db.put(`channels:${id}`, JSON.stringify(channel))
      return merge(channel, {id: id})
    },
    delete: (id, channel) => {
      const original = store.channels[id]
      if(!original) throw Error('Unregistered channel id')
      delete store.channels[id]
    }
  },
  messages: {
    create: async (channelId, message, user) => {
      if(!message.content) throw Error('Invalid message')
      creation = microtime.now()
      await db.put(`messages:${channelId}:${creation}`, JSON.stringify({
        author: user.id,
        content: message.content,
        edited: false
      }))
      return merge(message, {author: user.id, creation: creation, edited: false})
    },
    list: async (channelId) => {
      return new Promise( (resolve, reject) => {
        const messages = []
        db.createReadStream({
          gt: `messages:${channelId}:`,
          lte: `messages:${channelId}` + String.fromCharCode(":".charCodeAt(0) + 1),
        }).on( 'data', ({key, value}) => {
          message = JSON.parse(value)
          const [, channelId, creation] = key.split(':')
          message.creation = creation
          messages.push(message)
        }).on( 'error', (err) => {
          reject(err)
        }).on( 'end', () => {
          resolve(messages)
        })
      })
    },
    update: async (channelId, message, user) => {
      if(!message.content) throw Error('Invalid message')
      if(!message.creation) throw Error('Invalid message')
      const originalJson = await db.get(`messages:${channelId}:${message.creation}`)
      const original = JSON.parse(originalJson)
      if(original.author !== user.id) throw Error('Only the author can edit this message')
      delete message['edited']
      delete message['author']
      await db.put(`messages:${channelId}:${creation}`, JSON.stringify({
        author: user.id,
        content: message.content,
        edited: true
      }))
      return merge(message,{author: user.id, edited: true})
    },
  },
  users: {
    create: async (user, email) => {
      if(!user.username) throw Error('Invalid user')
      if(!email) throw Error('Invalid email')
      const id = uuid()
      await db.put(`usersid:${email}`, JSON.stringify(id))
      await db.put(`users:${id}`, JSON.stringify(merge(user, {email: email, channels: []})))
      return merge(user, {id: id, email: email, channels: []})
    },
    get: async (id) => {
      if(!id) throw Error('Invalid id')
      const data = await db.get(`users:${id}`)
      const user = JSON.parse(data)
      return merge(user, {id: id})
    },
    list: async (string) => {
      return new Promise( (resolve, reject) => {
        const users = []
        db.createReadStream({
          gt: "users:",
          lte: "users" + String.fromCharCode(":".charCodeAt(0) + 1),
        }).on( 'data', ({key, value}) => {
          user = JSON.parse(value)
          user.id = key.split(':')[1]
          if(user.username.search(string) != -1)
            users.push(user)
        }).on( 'error', (err) => {
          reject(err)
        }).on( 'end', () => {
          resolve(users)
        })
      })
    },
    update: async (id, user) => {
      const original = await module.exports.users.get(id)
      if(!original) throw Error('Unregistered user id')
      delete user['id']
      await db.put(`users:${id}`, JSON.stringify(user))
      return merge(user, {id: id})
    },
    delete: (id, user) => {
      const original = store.users[id]
      if(!original) throw Error('Unregistered user id')
      delete store.users[id]
    },
    getId: async (email) => {
      if(!email) throw Error('Invalid email')
      try {
        const data = await db.get(`usersid:${email}`)
        const id = JSON.parse(data)
        return id
      } catch (e) {
        return null
      }
    },
  },
  admin: {
    clear: async () => {
      await db.clear()
    }
  }
}
