'use strict';
const fetch = require("node-fetch")
const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`, {
  apiVersion: '2020-03-02',
})
const shippo = require('shippo')(`${process.env.SHIPPO_API_TOKEN}`)
const { parseMultipartData, sanitizeEntity } = require('strapi-utils');

module.exports = {
  setupStripe: async (ctx) => {
    let total = 100 // placeholder value
    let validatedCart = []
    let minimalCart = [] // for getting paymentIntent

    // Items & qtys in ctx.request.body
    const {
      salesTaxRate,
      cart
    } = ctx.request.body
    //console.log("setupStripe salesTaxRate", salesTaxRate)

    await Promise.all(cart.map(async item => {
      if (item.itemType === 'painting') {
        const validatedItem = await strapi.services.painting.findOne({
          sku: item.sku
        })
        if (validatedItem) {
          validatedItem.qty = item.qty
          validatedCart.push(validatedItem)
          minimalCart.push({
            sku: item.sku,
            qty: item.qty
          })
          return validatedItem // forces block to complete before continuing
        }
      } else if (item.itemType === 'tradingcard') {
        const validatedItem = await strapi.services.tradingcard.findOne({
          sku: item.sku
        })
        if (validatedItem) {
          validatedItem.qty = item.qty
          validatedCart.push(validatedItem)
          minimalCart.push({
            sku: item.sku,
            qty: item.qty
          })
          return validatedItem // forces block to complete before continuing
        }
      } else if (item.itemType === 'book') {
        const validatedItem = await strapi.services.book.findOne({
          sku: item.sku
        })
        if (validatedItem) {
          validatedItem.qty = item.qty
          validatedCart.push(validatedItem)
          minimalCart.push({
            sku: item.sku,
            qty: item.qty
          })
          return validatedItem // forces block to complete before continuing
        }
      }
    }))

    total = strapi.config.functions.cart.cartTotal(validatedCart, salesTaxRate)

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: 'usd',
        metadata: {
          cart: JSON.stringify(minimalCart)
        },
      });
      return paymentIntent
    } catch (err) {
      return {error: err.raw.message}
    }
  },
  create: async (ctx) => {
    const {
      salesTaxRate,
      paymentIntent,
      firstname,
      lastname,
      address,
      address2,
      city,
      state,
      zip,
      country,
      email,
      newsletter,
      cart
    } = ctx.request.body

    let paintings = []
    let tradingcards = []
    let books = []
    let cart_items = []
    let sanitizedCart = []

    // Prepare items and quantities for posting of order to Strapi
    await Promise.all(cart.map(async item => {
      if (item.itemType === 'painting') {
        const cmsItem = await strapi.services.painting.findOne({
          sku: item.sku
        })
        if (cmsItem) {
          cart_items.push({
            item_type: 'painting',
            sku: item.sku,
            title: item.title,
            qty: item.qty
          })
          paintings.push(cmsItem)
          sanitizedCart.push(
            {...cmsItem, ...{qty: item.qty}}
          )
          return cmsItem // forces block to complete before continuing
        }
      } else if (item.itemType === 'tradingcard') {
        const cmsItem = await strapi.services.tradingcard.findOne({
          sku: item.sku
        })
        if (cmsItem) {
          cart_items.push({
            item_type: 'tradingcard',
            sku: item.sku,
            title: item.title,
            qty: item.qty
          })
          tradingcards.push(cmsItem)
          sanitizedCart.push(
            {...cmsItem, ...{qty: item.qty}}
          )
          return cmsItem // forces block to complete before continuing
        }
      } else if (item.itemType === 'book') {
        const cmsItem = await strapi.services.book.findOne({
          sku: item.sku
        })
        if (cmsItem) {
          cart_items.push({
            item_type: 'book',
            sku: item.sku,
            title: item.title,
            qty: item.qty
          })
          books.push(cmsItem)
          sanitizedCart.push(
            {...cmsItem, ...{qty: item.qty}}
          )
          return cmsItem // forces block to complete before continuing
        }
      }
    }))

    let subtotal = strapi.config.functions.cart.cartSubtotal(sanitizedCart)
    let discount = 0.00
    let salestax = strapi.config.functions.cart.cartSalesTax(sanitizedCart, salesTaxRate)
    let shipping = strapi.config.functions.cart.cartShipping(sanitizedCart)
    let total = strapi.config.functions.cart.cartTotal(sanitizedCart, salesTaxRate)

    total = total * .01 // Unlike Stripe, Strapi expects dollars, not cents

    const stripe_payment_id = paymentIntent.id
    //console.log("create order stripe_paymentintent_id", stripe_paymentintent_id)

    const entry = {
      firstname,
      lastname,
      address,
      address2,
      city,
      state,
      zip,
      country,
      email,
      newsletter,

      paintings,
      tradingcards,
      books,
      cart: cart_items,

      subtotal,
      discount,
      salestax,
      shipping,
      total,

      stripe_payment_id
    }

    try {
      const entity = await strapi.services.order.create(entry);
      //console.log("order/create entity", entity)
      const strapi_order = {
        order_id: entity.id,
        order_created: entity.created_at
      }
      //console.log("order/create strapi_order", strapi_order)
      //return sanitizeEntity(entity, { model: strapi.models.order });
      return strapi_order
    } catch (err) {
      console.log("order/create err", err)
    }
  },

  notifyShippo: async (ctx) => {
    //console.log("notifyShippo ctx.request.body", ctx.request.body)
    try {
      const shippo_order = await shippo.order.create(ctx.request.body)
      //console.log("notifyShippo shippo_order", shippo_order)
      return shippo_order
    } catch (err) {
      console.log("notifyShippo err", err)
    }
  },

  getSalestaxRate: async (ctx) => {
    // *** Don't forget to add Public permission in Strapi Roles & Permissions ***
    //console.log("getSalestaxRate ctx.request.body", ctx.request.body)
    try {
      const postal_code = ctx.request.body.postal_code
      const request_url = `${process.env.ZIPTAX_API_URL}?key=${process.env.ZIPTAX_API_KEY}&postalcode=${postal_code}`

      const response = await fetch(request_url)
      const data = await response.json()
      const taxrate = {
        "geoCity": data.results[0].geoCity,
        "taxSales": data.results[0].taxSales
      }
      //console.log("getSalestax taxrate", taxrate)
      return taxrate // Results in expected response, but 404 error on client side!!!
    } catch (err) {
      console.log("getSalestaxRate err", err)
    }
  },
};
