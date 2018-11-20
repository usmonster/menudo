#!/usr/bin/env node
const client = require('request-promise-native')
// const { scheduleJob } = require('node-schedule') // Maybe overkill? Just use real cron?
const { IncomingWebhook } = require('@slack/client')

const webhook = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL)
const restId = process.env.RESTAURANT_ID

async function fetchMenu() {
  const [todayMenu, nextMenu] = await client({
    json: true,
    uri: `https://timechef.elior.com/api/restaurant/${restId}/menus/2`,
  })
  // TODO: give nextMenu if called after a certain time
  return todayMenu
}

let lastMenu = {}
async function getMenu(always = false) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const isCurrent = today <= lastMenu.date
  // don't fetch again when we already have a current (or future) menu
  if (isCurrent) return lastMenu

  let menu = await fetchMenu()
  let date, items
  if (!menu) {
    console.warn(`Menu is ${menu}! Using last menu instead`)
    menu = lastMenu
    [date, items] = [menu.date, menu.items]
  } else {
    date = new Date(menu.date)
    items = menu.famillePlats[0].plats.map(_ => _.libelle)
  }

  // don't send an old menu, unless forced
  if (!always && date < today) return
  return { date, items }
}

function isValidMenu(menu) {
  if (
    menu === null
    ||
    !Array.isArray(menu.items)
    ||
    !(menu.date instanceof Date)
    )
   return false
  return true
}

function formatMenu(menu) {
  console.log(menu) //DEBUG
  // TODO: make it pretty
  const message = menu.items.join('\n')
  const messageObj = {
    text: message,
    mrkdwn: true,
  }
  return messageObj
}

async function sendMessage(message) {
  try {
    const res = await webhook.send(message)
    console.log('Message sent:', res)
  } catch (err) {
    console.error('Error:', err)
  }
}

async function sendMenu(always = false) {
  const menu = await getMenu(always)
  // don't send an invalid menu
  if (!isValidMenu(menu)) return
  const message = formatMenu(menu)
  await sendMessage(message)
  lastMenu = menu
}

// Script to run every weekday at 11h11s11 that will send out the day's menu
// scheduleJob('11 11 11 * * MON-FRI', sendMenu)
// TODO: start some server

sendMenu() // DEBUG