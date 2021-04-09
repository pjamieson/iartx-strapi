// Replicates functions from iartx-dot-com/src/utils/cart.js
// A private Node package that both projects use would be a better solution

// Called from setupStripe in api/order/controllers/order.js

const cartSubtotal = (cart) => {
  const subtotal = cart.reduce((counter, item) => {
    return counter + item.price * item.qty
  }, 0)

  return subtotal
}

const cartSalesTax = (cart, taxRate) => {
  const subtotal = cartSubtotal(cart)
  let salestax = 0.00

  if (taxRate > 0) {
    const cartSalesTax = (subtotal * taxRate)
    //console.log("cart.js cartSalesTax", cartSalesTax)
    salestax = Math.round((cartSalesTax + Number.EPSILON) * 100) / 100
  }

  return salestax
}

const cartShipping = (cart) => {
  return 0.00 // For now, all shipping is free
}

const cartTotal = (cart, taxRate) => {
  //console.log("cart.js cartTotal taxRate", taxRate)
  const subtotal = cartSubtotal(cart)
  const salestax = cartSalesTax(cart, taxRate)
  const shipping = cartShipping(cart)
  const total = (subtotal*1 + salestax*1 + shipping*1)

  //console.log("cart.js cartTotal total", total)

  return Math.round(total * 100) // Stripe requires integer in cents, not dollar decimal
}

module.exports = {
  cartSubtotal,
  cartSalesTax,
  cartShipping,
  cartTotal,
}
